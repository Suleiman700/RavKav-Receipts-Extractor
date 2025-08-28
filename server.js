const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Session } = require('./Session.js');
const { RavKav } = require('./RavKav');


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
 *  - returnFormat: string - The format of the response - E.g. json, pdf, excel
 */
app.post('/get-transactions', async (req, res) => {
    if (DEBUG) console.log('API: get-transactions', req.body);
    let {sessionId, startDate, endDate, returnFormat} = req.body;

    // Check if sessionId is provided
    if (!sessionId) {
        return res.status(400).json({
            errors: ['Session ID is required']
        });
    }

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(400).json({
            errors: ['Session not found']
        });
    }

    // Set default returnFormat to json if not provided
    if (!returnFormat) {
        returnFormat = 'json';
    }

    // Validate dates format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
        return res.status(400).json({
            errors: ['Invalid start date format, expected format: YYYY-MM-DD']
        })
    }
    if (endDate && !dateRegex.test(endDate)) {
        return res.status(400).json({
            errors: ['Invalid end date format, expected format: YYYY-MM-DD']
        })
    }
    if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({
            errors: ['Start date must be before end date']
        })
    }

    // validate returnFormat
    const allowedReturnFormats = ['json', 'pdf', 'excel'];
    if (returnFormat && !allowedReturnFormats.includes(returnFormat)) {
        return res.status(400).json({
            errors: [`Invalid return format, Please use: ${allowedReturnFormats.join(', ')}`]
        });
    }

    const RavKavIns = new RavKav();
    const transactions = await RavKavIns.getTransactions(session, {startDate, endDate});

    res.status(200).json({
        status: 'OK',
        data: transactions,
        timestamp: new Date().toISOString()
    });
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

module.exports = app;
