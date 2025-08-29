import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import {Session} from "./Session.js";
import {RavKav} from "./RavKav.js";
import Browser from './Browser.js';
import path from "path";
import { PDFDocument } from 'pdf-lib';
import fs from "fs";
import { promisify } from 'util';
const rm = promisify(fs.rm); // For recursive delete

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = true;

// Store active sessions (in production, use a proper session store like Redis)
const sessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Login endpoint
 *
 * When doing login and receive "verification_required", an email with otp is sent to your email.
 * Send the same request with the verification_code param to complete the login.
 *
 * Required params:
 *   - email: string
 *   - password: string
 *   - verification_code: number (optional)
 */
app.post('/login', async (req, res) => {
    if (DEBUG) console.log('API: login', req.body);
    try {
        const {email, password, verification_code} = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                errors: ['Email and password are required']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                errors: ['Invalid email format']
            });
        }

        // Create new session with credentials
        const session = new Session({email, password});
        session.setLoginStatus(session.loginStatuses.NO);

        // Save session to map
        sessions.set(session.sessionId, session);

        if (verification_code) {
            session.setVerificationCode(verification_code);
        }

        const RavKavIns = new RavKav();
        const loginResult = await RavKavIns.login(session);
        // console.log('loginResult', loginResult)
        session.setLoginResult(loginResult);

        res.status(200).json({
            sessionId: session.sessionId,
            loginResult: session.getLoginResult(),
        });

    }
    catch (error) {
        console.log('error', error)
        // console.error('Login error:', error);
        res.status(500).json({
            errors: ['Internal server error']
        });
    }
});

/**
 * Get transactions endpoint
 *
 * Required params:
 *  - sessionId: string - The session ID returned from the login endpoint
 *
 *  Available params:
 *  - startDate: string - The start date for the transactions - E.g. 2025-01-01
 *  - endDate: string - The end date for the transactions - E.g. 2025-01-31
 *  - returnFormat: string - The format of the response - E.g. json, pdfBinary, pdfBase64, excel
 */
app.post('/get-transactions', async (req, res) => {
    if (DEBUG) console.log('API: get-transactions', req.body);
    let { sessionId, startDate, endDate, returnFormat } = req.body;

    if (!sessionId) {
        return res.status(400).json({ errors: ['Session ID is required'] });
    }

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(400).json({ errors: ['Session not found'] });
    }

    if (!returnFormat) {
        returnFormat = 'json';
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
        return res.status(400).json({ errors: ['Invalid start date format, expected format: YYYY-MM-DD'] });
    }
    if (endDate && !dateRegex.test(endDate)) {
        return res.status(400).json({ errors: ['Invalid end date format, expected format: YYYY-MM-DD'] });
    }
    if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({ errors: ['Start date must be before end date'] });
    }

    const allowedReturnFormats = ['json', 'pdfBinary', 'pdfBase64', 'excel'];
    if (returnFormat && !allowedReturnFormats.includes(returnFormat)) {
        return res.status(400).json({
            errors: [`Invalid return format, Please use: ${allowedReturnFormats.join(', ')}`]
        });
    }

    const RavKavIns = new RavKav();
    const transactionsResult = await RavKavIns.getTransactions(session, { startDate, endDate });

    if (returnFormat == 'json') {
        return res.status(transactionsResult.status).json({
            status: transactionsResult.state ? 'OK' : 'ERROR',
            data: transactionsResult.data,
            errors: transactionsResult.errors,
            timestamp: new Date().toISOString()
        });
    }
    else if (returnFormat === 'pdfBinary' || returnFormat === 'pdfBase64') {
        const result = {
            state: true,
            data: null,
            errors: [],
        };

        const transactions = transactionsResult.data.data.results;
        const tmp = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const pdfPath = path.join(`./pdfs/${tmp}`);

        // Make sure directory exists
        fs.mkdirSync(pdfPath, { recursive: true });

        // Generate individual PDFs
        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            const browser = new Browser({ debug: true, dataDir: pdfPath });
            try {
                const url = transaction.purchase_approval_link;
                await browser.goto(url);
                let date = transaction.period_description.replace(/\//g, '-');
                const filename = `${i + 1} - ${date}.pdf`;
                await browser.savePDF(filename);
            } catch (err) {
                console.error('Error:', err);
                result.state = false;
                result.errors.push(err);
            } finally {
                await browser.close();
            }
        }

        if (!result.state) {
            return res.status(500).json({
                status: 'ERROR',
                data: null,
                errors: result.errors,
            });
        }

        // Merge all PDFs
        const pdfFiles = fs.readdirSync(pdfPath)
            .filter(f => f.endsWith('.pdf'))
            .map(f => path.join(pdfPath, f));

        const mergedPdf = await PDFDocument.create();
        for (const file of pdfFiles) {
            const pdfBytes = fs.readFileSync(file);
            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        const mergedPdfBytes = await mergedPdf.save();

        // Delete tmp folder BEFORE returning
        try {
            await rm(pdfPath, { recursive: true, force: true });
            console.log(`[DEBUG] Temporary folder deleted: ${pdfPath}`);
        } catch (err) {
            console.error('[ERROR] Failed to delete tmp folder:', err);
        }

        if (returnFormat === 'pdfBinary') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');
            return res.send(Buffer.from(mergedPdfBytes));
        }
        else if (returnFormat === 'pdfBase64') {
            const mergedPdfBase64 = Buffer.from(mergedPdfBytes).toString('base64');
            return res.status(200).json({
                status: 'OK',
                data: { pdfBase64: mergedPdfBase64 },
                errors: []
            });
        }
    }
    // else if (returnFormat == 'pdf') {
    //     const result = {
    //         state: true,
    //         data: {
    //             pdf: null, // Store the PDF
    //         },
    //         errors: [],
    //     };
    //
    //     const transactions = transactionsResult.data.data.results;
    //     const tmp = `tmp_${Date.now()}`
    //     const pdfStoragePath = path.join(`./pdfs/${tmp}`); // create a temporary directory for the PDFs
    //
    //     for (let i = 0; i < transactions.length; i++) {
    //         const transaction = transactions[i];
    //
    //         const browser = new Browser({ debug: true, dataDir: pdfStoragePath });
    //         try {
    //             const url = transaction.purchase_approval_link;
    //             await browser.goto(url);
    //             let date = transaction.period_description; // E.g. 4/8/2025
    //             date = date.replace(/\//g, '-'); // Safe date: "4-8-2025"
    //             const filename = `${i+1} - ${date}.pdf`;
    //             await browser.savePDF(filename);
    //         }
    //         catch (err) {
    //             console.error('Error:', err);
    //             result.state = false;
    //             result.errors.push(err);
    //         }
    //         finally {
    //             await browser.close();
    //             result.state = true;
    //         }
    //     }
    //
    //     if (!result.state) {
    //         return res.status(500).json({
    //             status: 'ERROR',
    //             data: null,
    //             errors: result.errors,
    //         });
    //     }
    //
    //     // Combine all PDFs into one
    //     {
    //         const pdfFiles = fs.readdirSync(pdfStoragePath)
    //             .filter(f => f.endsWith('.pdf'))
    //             .map(f => path.join(pdfStoragePath, f));
    //
    //         const mergedPdf = await PDFDocument.create();
    //
    //         for (const file of pdfFiles) {
    //             const pdfBytes = fs.readFileSync(file);
    //             const pdf = await PDFDocument.load(pdfBytes);
    //             const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    //             copiedPages.forEach(page => mergedPdf.addPage(page));
    //         }
    //
    //         // Save merged PDF
    //         const mergedPdfPath = path.join(pdfStoragePath, `merged_${Date.now()}.pdf`);
    //         const mergedPdfBytes = await mergedPdf.save();
    //         fs.writeFileSync(mergedPdfPath, mergedPdfBytes);
    //
    //         console.log('Merged PDF saved:', mergedPdfPath);
    //
    //         // Return merged PDF path in response
    //         return res.status(200).json({
    //             status: 'OK',
    //             data: { pdf: mergedPdfPath },
    //             errors: []
    //         });
    //
    //     }
    // }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;