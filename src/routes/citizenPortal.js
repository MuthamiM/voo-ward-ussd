/**
 * Citizen Portal API Routes
 * Handles citizen authentication and data access
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const crypto = require('crypto');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// In-memory citizen sessions (use Redis in production)
const citizenSessions = new Map();

/**
 * Generate 6-digit OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Request OTP for login
 * POST /api/citizen/request-otp
 */
router.post('/request-otp', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.length < 10) {
        return res.status(400).json({ error: 'Valid phone number required' });
    }

    try {
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP
        otpStore.set(phoneNumber, { otp, expiresAt });

        // TODO: Send OTP via SMS (integrate with Africa's Talking or Twilio)
        logger.info(`OTP generated for ${phoneNumber}: ${otp}`);

        // For development, log the OTP
        console.log(`📱 OTP for ${phoneNumber}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent to your phone',
            // Remove this in production!
            devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (err) {
        logger.error('Request OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

/**
 * Verify OTP and login
 * POST /api/citizen/verify-otp
 */
router.post('/verify-otp', async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return res.status(400).json({ error: 'Phone number and OTP required' });
    }

    try {
        // Check OTP
        const storedOTP = otpStore.get(phoneNumber);

        if (!storedOTP) {
            return res.status(401).json({ error: 'OTP expired or not found' });
        }

        if (storedOTP.expiresAt < Date.now()) {
            otpStore.delete(phoneNumber);
            return res.status(401).json({ error: 'OTP expired' });
        }

        if (storedOTP.otp !== otp) {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        // OTP verified - clear it
        otpStore.delete(phoneNumber);

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const sessionData = {
            phoneNumber,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        };

        citizenSessions.set(token, sessionData);

        logger.info(`Citizen logged in: ${phoneNumber}`);

        res.json({
            success: true,
            token,
            user: {
                phoneNumber,
                registeredAt: new Date().toISOString()
            }
        });
    } catch (err) {
        logger.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * Middleware to authenticate citizen requests
 */
function authenticateCitizen(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const session = citizenSessions.get(token);

    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (session.expiresAt < Date.now()) {
        citizenSessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }

    req.citizen = session;
    next();
}

/**
 * Get citizen's issues
 * GET /api/citizen/issues
 */
router.get('/issues', authenticateCitizen, async (req, res) => {
    try {
        const phoneNumber = req.citizen.phoneNumber;

        // TODO: Fetch from database
        // For now, return mock data
        const issues = [
            {
                id: 1,
                ticket: 'ISS-001',
                category: 'Roads & Infrastructure',
                message: 'Pothole on Main Street',
                location: 'Near Chief Office',
                status: 'in_progress',
                created_at: new Date().toISOString(),
                comments: ['Technician dispatched', 'Work in progress']
            }
        ];

        res.json(issues);
    } catch (err) {
        logger.error('Get issues error:', err);
        res.status(500).json({ error: 'Failed to fetch issues' });
    }
});

/**
 * Submit new issue
 * POST /api/citizen/issues
 */
router.post('/issues', authenticateCitizen, async (req, res) => {
    try {
        const { category, description, location } = req.body;
        const phoneNumber = req.citizen.phoneNumber;

        if (!category || !description) {
            return res.status(400).json({ error: 'Category and description required' });
        }

        // TODO: Save to database and handle photo upload
        const ticket = 'ISS-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');

        const issue = {
            ticket,
            category,
            message: description,
            location,
            phone_number: phoneNumber,
            status: 'open',
            created_at: new Date().toISOString()
        };

        logger.info(`Issue created via citizen portal: ${ticket}`);

        res.status(201).json({
            success: true,
            ticket,
            issue
        });
    } catch (err) {
        logger.error('Create issue error:', err);
        res.status(500).json({ error: 'Failed to create issue' });
    }
});

/**
 * Get citizen's bursary applications
 * GET /api/citizen/bursaries
 */
router.get('/bursaries', authenticateCitizen, async (req, res) => {
    try {
        const phoneNumber = req.citizen.phoneNumber;

        // TODO: Fetch from database
        // For now, return mock data
        const applications = [
            {
                id: 1,
                reference: 'BUR-001',
                student_name: 'John Doe',
                institution: 'Nairobi University',
                amount: 50000,
                status: 'pending',
                created_at: new Date().toISOString()
            }
        ];

        res.json(applications);
    } catch (err) {
        logger.error('Get bursaries error:', err);
        res.status(500).json({ error: 'Failed to fetch bursary applications' });
    }
});

module.exports = router;
