const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Session } = require('./Session.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Store active sessions (in production, use a proper session store like Redis)
const sessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Login endpoint
app.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
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
        const Session = new Session({ email, password });
        Session.setLoginStatus(Session.loginStatuses.NO);

        res.status(200).json({
            // message: 'Login successful',
            sessionId: Session.sessionId
        });
        
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            errors: ['Internal server error']
        });
    }
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
