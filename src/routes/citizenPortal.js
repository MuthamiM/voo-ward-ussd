/**
 * Citizen Portal API Routes
 * Handles citizen authentication and data access
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../lib/mongo');
const { ObjectId } = require('mongodb');

// Create uploads directory for issue images
const ISSUE_UPLOADS_DIR = path.join(__dirname, '../../public/uploads/issues');
try { fs.mkdirSync(ISSUE_UPLOADS_DIR, { recursive: true }); } catch (e) { /* ignore */ }


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

        // Check if citizen exists in DB, if not create/update
        const db = await getDb();
        const citizen = await db.collection('constituents').findOne({ phone_number: phoneNumber });

        if (!citizen) {
            // Optional: Auto-register or just log
            logger.info(`New citizen login: ${phoneNumber}`);
        }

        logger.info(`Citizen logged in: ${phoneNumber}`);

        res.json({
            success: true,
            token,
            user: {
                phoneNumber,
                name: citizen ? citizen.full_name : 'Citizen',
                registeredAt: citizen ? citizen.created_at : new Date().toISOString()
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
        const db = await getDb();

        const issues = await db.collection('issues')
            .find({ phone_number: phoneNumber })
            .sort({ created_at: -1 })
            .toArray();

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
        const { category, description, location, title } = req.body;
        const phoneNumber = req.citizen.phoneNumber;

        if (!category || !description) {
            return res.status(400).json({ error: 'Category and description required' });
        }

        const db = await getDb();

        // Generate ticket ID
        const count = await db.collection('issues').countDocuments();
        const ticket = 'ISS-' + String(count + 1).padStart(3, '0');

        const issue = {
            ticket,
            title: title || category, // Fallback if title not provided
            category,
            message: description, // Dashboard uses 'message'
            description, // Keep description for compatibility
            location,
            phone_number: phoneNumber,
            status: 'open',
            source: 'Mobile App',
            created_at: new Date(),
            updated_at: new Date(),
            comments: []
        };

        const result = await db.collection('issues').insertOne(issue);

        logger.info(`Issue created via citizen portal: ${ticket}`);

        res.status(201).json({
            success: true,
            ticket,
            issue: { ...issue, _id: result.insertedId }
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
        const db = await getDb();

        const applications = await db.collection('bursaries')
            .find({ phone_number: phoneNumber })
            .sort({ created_at: -1 })
            .toArray();

        res.json(applications);
    } catch (err) {
        logger.error('Get bursaries error:', err);
        res.status(500).json({ error: 'Failed to fetch bursary applications' });
    }
});

/**
 * Submit bursary application
 * POST /api/citizen/bursaries
 */
router.post('/bursaries', authenticateCitizen, async (req, res) => {
    try {
        const { institutionName, course, yearOfStudy, institutionType, reason, amountRequested } = req.body;
        const phoneNumber = req.citizen.phoneNumber;

        if (!institutionName || !course || !yearOfStudy) {
            return res.status(400).json({ error: 'Institution, course, and year of study required' });
        }

        const db = await getDb();

        // Generate reference code
        const count = await db.collection('bursaries').countDocuments();
        const refCode = 'BUR-' + String(count + 1).padStart(4, '0');

        const application = {
            ref_code: refCode,
            phone_number: phoneNumber,
            institution_name: institutionName,
            course,
            year_of_study: yearOfStudy,
            institution_type: institutionType || 'Other',
            reason: reason || '',
            amount_requested: amountRequested || 0,
            status: 'pending',
            source: 'Mobile App',
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('bursaries').insertOne(application);

        logger.info(`Bursary application submitted via mobile: ${refCode}`);

        res.status(201).json({
            success: true,
            refCode,
            application: { ...application, _id: result.insertedId }
        });
    } catch (err) {
        logger.error('Submit bursary error:', err);
        res.status(500).json({ error: 'Failed to submit bursary application' });
    }
});

/**
 * Get announcements (PUBLIC - no auth required)
 * GET /api/citizen/announcements
 */
router.get('/announcements', async (req, res) => {
    try {
        const db = await getDb();

        // Fetch published announcements
        const announcements = await db.collection('announcements')
            .find({}) // All announcements are public
            .sort({ created_at: -1 })
            .limit(20)
            .toArray();

        res.json(announcements);
    } catch (err) {
        logger.error('Get announcements error:', err);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

/**
 * Submit issue from mobile app (PUBLIC with phone number)
 * POST /api/citizen/mobile/issues
 * This endpoint allows the mobile app to submit issues without citizen portal auth
 * Uses Cloudinary for image storage
 */
router.post('/mobile/issues', async (req, res) => {
    try {
        const { phoneNumber, title, category, description, location, images, userId, fullName } = req.body;

        if (!phoneNumber || !category || !description) {
            return res.status(400).json({ error: 'Phone number, category, and description required' });
        }

        const db = await getDb();

        // Generate ticket ID
        const count = await db.collection('issues').countDocuments();
        const ticket = 'ISS-' + String(count + 1).padStart(3, '0');

        // Upload images to Cloudinary if available
        let imageUrls = [];
        let thumbnailUrls = [];

        if (images && Array.isArray(images) && images.length > 0) {
            try {
                // Try Cloudinary first
                const cloudinaryService = require('../lib/cloudinaryService');
                const uploadResult = await cloudinaryService.uploadMultipleImages(images, 'issues');
                imageUrls = uploadResult.urls;
                thumbnailUrls = uploadResult.thumbnails;
                logger.info(`Uploaded ${imageUrls.length} images to Cloudinary for ${ticket}`);
            } catch (cloudErr) {
                logger.warn('Cloudinary upload failed, falling back to local storage:', cloudErr.message);
                // Fallback to local storage
                for (let i = 0; i < Math.min(images.length, 5); i++) {
                    try {
                        let base64Data = images[i];
                        if (base64Data.includes(',')) {
                            base64Data = base64Data.split(',')[1];
                        }
                        const buffer = Buffer.from(base64Data, 'base64');
                        const filename = `issue-${Date.now()}-${i}.jpg`;
                        const filepath = path.join(ISSUE_UPLOADS_DIR, filename);
                        fs.writeFileSync(filepath, buffer);
                        imageUrls.push(`/uploads/issues/${filename}`);
                    } catch (imgErr) {
                        logger.error('Failed to save issue image:', imgErr);
                    }
                }
            }
        }

        const issue = {
            ticket,
            title: title || category,
            category,
            message: description,
            description,
            location: typeof location === 'string' ? location : JSON.stringify(location),
            images: imageUrls,
            thumbnails: thumbnailUrls,
            phone_number: phoneNumber,
            user_id: userId || null,
            reporter_name: fullName || null,
            status: 'open',
            source: 'Mobile App',
            created_at: new Date(),
            updated_at: new Date(),
            comments: []
        };

        const result = await db.collection('issues').insertOne(issue);

        logger.info(`Issue created via mobile app: ${ticket} with ${imageUrls.length} images`);

        res.status(201).json({
            success: true,
            ticket,
            issueNumber: ticket,
            issue: { ...issue, _id: result.insertedId }
        });
    } catch (err) {
        logger.error('Create mobile issue error:', err);
        res.status(500).json({ error: 'Failed to create issue' });
    }
});

/**
 * Submit bursary application from mobile app (PUBLIC with user info)
 * POST /api/citizen/mobile/bursaries
 * This endpoint allows the mobile app to submit bursary applications without citizen portal auth
 * since the mobile app uses Supabase authentication
 */
router.post('/mobile/bursaries', async (req, res) => {
    try {
        const {
            phoneNumber,
            userId,
            fullName,
            institutionName,
            course,
            yearOfStudy,
            institutionType,
            reason,
            amountRequested
        } = req.body;

        if (!institutionName || !course || !yearOfStudy) {
            return res.status(400).json({ error: 'Institution, course, and year of study required' });
        }

        const db = await getDb();

        // Generate reference code
        const count = await db.collection('bursaries').countDocuments();
        const refCode = 'BUR-' + String(count + 1).padStart(4, '0');

        const application = {
            ref_code: refCode,
            application_number: refCode,
            phone_number: phoneNumber || '',
            user_id: userId || null,
            full_name: fullName || '',
            institution_name: institutionName,
            institutionName: institutionName,  // For dashboard compatibility
            course,
            year_of_study: yearOfStudy,
            yearOfStudy: yearOfStudy,  // For dashboard compatibility
            institution_type: institutionType || 'university',
            reason: reason || '',
            amount_requested: amountRequested || 0,
            amountRequested: amountRequested || 0,  // For dashboard compatibility
            status: 'pending',
            source: 'Mobile App',
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('bursaries').insertOne(application);

        logger.info(`Bursary application submitted via mobile: ${refCode}`);

        res.status(201).json({
            success: true,
            refCode,
            applicationNumber: refCode,
            application: { ...application, _id: result.insertedId }
        });
    } catch (err) {
        logger.error('Submit mobile bursary error:', err);
        res.status(500).json({ error: 'Failed to submit bursary application' });
    }
});

module.exports = router;

