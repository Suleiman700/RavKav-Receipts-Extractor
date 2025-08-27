const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Session } = require('./Session.js');
const { RavKav } = require('./RavKav');


const app = express();
const PORT = process.env.PORT || 3000;

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
        console.log('loginResult', loginResult)
        session.setLoginResult(loginResult);

        res.status(200).json({
            sessionId: session.sessionId,
            loginResult: session.getLoginResult(),
        });

    } catch (error) {
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
 */
app.post('/get-transactions', async (req, res) => {
    const sessionId = req.body.sessionId;
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

    const RavKavIns = new RavKav();
    const transactions = await RavKavIns.getTransactions(session);

    res.status(200).json({
        status: 'OK',
        data: transactions,
        timestamp: new Date().toISOString()
    });
});

// Set OTP endpoint
app.post('/set-otp', (req, res) => {
    try {
        const { otp, sessionId } = req.body;
        
        // Validate required fields
        if (!otp) {
            return res.status(400).json({
                errors: ['OTP code is required']
            });
        }
        
        if (!sessionId) {
            return res.status(400).json({
                errors: ['Session ID is required']
            });
        }
        
        // Validate OTP format (assuming it should be numeric and 6 digits)
        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                errors: ['OTP must be a 6-digit number']
            });
        }
        
        // Get session
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(400).json({
                errors: ['Invalid session ID']
            });
        }
        
        // Check if user is logged in
        if (!session.getIsLogged()) {
            return res.status(400).json({
                errors: ['User must be logged in first']
            });
        }
        
        // Set OTP in session
        session.setOtp(otp);
        
        // TODO: Add your OTP verification logic here
        // For now, this is a placeholder that accepts any valid 6-digit OTP
        
        res.status(200).json({
            message: 'OTP set successfully'
        });
        
    } catch (error) {
        console.error('Set OTP error:', error);
        res.status(500).json({
            errors: ['Internal server error']
        });
    }
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
