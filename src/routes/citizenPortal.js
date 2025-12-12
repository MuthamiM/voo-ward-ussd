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
const { listImages, deleteImage } = require('../lib/cloudinaryService');
const bcrypt = require('bcryptjs');
const supabaseService = require('../services/supabaseService');

// Create uploads directory for issue images
const ISSUE_UPLOADS_DIR = path.join(__dirname, '../../public/uploads/issues');
try { fs.mkdirSync(ISSUE_UPLOADS_DIR, { recursive: true }); } catch (e) { /* ignore */ }

// Ensure database indexes for performance
async function ensureIndexes() {
    try {
        const db = await getDb();
        // OTPs: auto-expire after 5 minutes
        await db.collection('mobile_otps').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 300 });
        await db.collection('mobile_otps').createIndex({ "phoneNumber": 1 }, { unique: true });

        // Sessions: auto-expire after 7 days
        await db.collection('mobile_sessions').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 604800 });
        await db.collection('mobile_sessions').createIndex({ "token": 1 }, { unique: true });

        // Users: unique username and phone
        await db.collection('mobile_users').createIndex({ "username": 1 }, { unique: true });
        await db.collection('mobile_users').createIndex({ "phone_number": 1 }, { unique: true });

        logger.info('Database indexes ensured for performance');
    } catch (e) {
        logger.error('Failed to ensure indexes:', e);
    }
}
// Run indexes check
ensureIndexes();

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

        // Store OTP in database
        const db = await getDb();
        await db.collection('mobile_otps').updateOne(
            { phoneNumber },
            {
                $set: {
                    otp,
                    expiresAt,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );

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
        // Check OTP from database
        const db = await getDb();
        const storedOTP = await db.collection('mobile_otps').findOne({ phoneNumber });

        if (!storedOTP) {
            return res.status(401).json({ error: 'OTP expired or not found' });
        }

        if (storedOTP.expiresAt < Date.now()) {
            await db.collection('mobile_otps').deleteOne({ phoneNumber });
            return res.status(401).json({ error: 'OTP expired' });
        }

        if (storedOTP.otp !== otp) {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        // OTP verified - clear it
        await db.collection('mobile_otps').deleteOne({ phoneNumber });

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const sessionData = {
            phoneNumber,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        };

        citizenSessions.set(token, sessionData);

        // Check if citizen exists in DB, if not create/update
        // Reuse existing db connection
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
 * Uses Supabase as primary source (MongoDB disabled)
 */
router.get('/announcements', async (req, res) => {
    try {
        // Use Supabase for announcements (MongoDB is disabled)
        const announcements = await supabaseService.getAnnouncements();
        res.json(announcements);
    } catch (err) {
        logger.error('Get announcements error:', err);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

// ============================================
// LOST ID REPORTING
// ============================================

/**
 * Report a lost ID (PUBLIC)
 * POST /api/citizen/lost-ids
 */
router.post('/lost-ids', async (req, res) => {
    try {
        const { reporter_phone, reporter_name, id_owner_name, id_owner_phone, is_for_self, id_number, last_seen_location, date_lost, additional_info } = req.body;

        if (!reporter_phone || !id_owner_name) {
            return res.status(400).json({ error: 'Reporter phone and ID owner name are required' });
        }

        const result = await supabaseService.reportLostId({
            reporter_phone,
            reporter_name,
            id_owner_name,
            id_owner_phone,
            is_for_self: is_for_self !== false,
            id_number,
            last_seen_location,
            date_lost,
            additional_info
        });

        if (result.success) {
            res.json({ success: true, message: 'Lost ID reported successfully', data: result.data });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        logger.error('Report lost ID error:', err);
        res.status(500).json({ error: 'Failed to report lost ID' });
    }
});

/**
 * Get my lost ID reports (PUBLIC with phone)
 * GET /api/citizen/lost-ids/:phone
 */
router.get('/lost-ids/:phone', async (req, res) => {
    try {
        const allReports = await supabaseService.getAllLostIds();
        const myReports = allReports.filter(r => r.reporter_phone === req.params.phone);
        res.json(myReports);
    } catch (err) {
        logger.error('Get lost IDs error:', err);
        res.status(500).json({ error: 'Failed to fetch lost ID reports' });
    }
});

// ============================================
// FEEDBACK
// ============================================

/**
 * Submit feedback (PUBLIC)
 * POST /api/citizen/feedback
 */
router.post('/feedback', async (req, res) => {
    try {
        const { user_id, user_phone, user_name, category, message, rating } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await supabaseService.submitFeedback({
            user_id,
            user_phone,
            user_name,
            category: category || 'general',
            message,
            rating
        });

        if (result.success) {
            res.json({ success: true, message: 'Feedback submitted successfully', data: result.data });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        logger.error('Submit feedback error:', err);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

/**
 * Submit issue from mobile app (PUBLIC with phone number)
 * POST /api/citizen/mobile/issues
 * Stores to Supabase (so dashboard can see it) with MongoDB fallback
 * Uses Cloudinary for image storage
 */
router.post('/mobile/issues', async (req, res) => {
    try {
        const { phoneNumber, title, category, description, location, images, userId, fullName } = req.body;

        if (!phoneNumber || !category || !description) {
            return res.status(400).json({ error: 'Phone number, category, and description required' });
        }

        // Upload images to Cloudinary first
        let imageUrls = [];
        let thumbnailUrls = [];

        if (images && Array.isArray(images) && images.length > 0) {
            try {
                const cloudinaryService = require('../lib/cloudinaryService');
                const uploadResult = await cloudinaryService.uploadMultipleImages(images, 'issues');
                imageUrls = uploadResult.urls;
                thumbnailUrls = uploadResult.thumbnails;
                logger.info(`Uploaded ${imageUrls.length} images to Cloudinary`);
            } catch (cloudErr) {
                logger.warn('Cloudinary upload failed:', cloudErr.message);
            }
        }

        // Generate ticket ID
        const ticket = 'ISS-' + Date.now().toString().slice(-6);

        // Try Supabase first (so dashboard can see it)
        try {
            const supabaseService = require('../services/supabaseService');
            const result = await supabaseService.createIssue({
                issue_number: ticket,
                title: title || category,
                category,
                description,
                location: typeof location === 'string' ? location : JSON.stringify(location),
                images: imageUrls,
                image_urls: imageUrls,
                phone: phoneNumber,
                user_id: userId || null,
                reporter_name: fullName || null,
                status: 'Pending',
                source: 'Mobile App'
            });

            if (result.success) {
                logger.info(`Issue created in Supabase: ${ticket} with ${imageUrls.length} images`);
                return res.status(201).json({
                    success: true,
                    ticket,
                    issueNumber: ticket,
                    issue: result.data
                });
            } else {
                logger.warn('Supabase issue insert failed:', result.error);
            }
        } catch (supaErr) {
            logger.warn('Supabase issue service error, using MongoDB fallback:', supaErr.message);
        }

        // MongoDB fallback
        const db = await getDb();
        const count = await db.collection('issues').countDocuments();
        const fallbackTicket = 'ISS-' + String(count + 1).padStart(3, '0');

        const issue = {
            ticket: fallbackTicket,
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
        logger.info(`Issue created via MongoDB fallback: ${fallbackTicket}`);

        res.status(201).json({
            success: true,
            ticket: fallbackTicket,
            issueNumber: fallbackTicket,
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
 * Stores directly to Supabase so dashboard can see it
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

        // Validation - require all important fields
        if (!institutionName || !course || !yearOfStudy) {
            return res.status(400).json({ error: 'Institution, course, and year of study required' });
        }
        
        if (!amountRequested || amountRequested <= 0) {
            return res.status(400).json({ error: 'Amount requested is required' });
        }

        // Store to Supabase (primary) so dashboard can see it
        try {
            const supabaseService = require('../services/supabaseService');
            
            // Generate reference code
            const refCode = 'BUR-' + Date.now().toString().slice(-8);
            
            const result = await supabaseService.createBursaryApplication({
                ref_code: refCode,
                user_id: userId || null,
                applicant_name: fullName || 'Unknown',
                full_name: fullName || 'Unknown',
                phone: phoneNumber || '',
                institution_name: institutionName,
                school_name: institutionName,
                course: course,
                year_of_study: yearOfStudy,
                institution_type: institutionType || 'university',
                amount_requested: amountRequested,
                reason: reason || '',
                status: 'Pending',
                source: 'Mobile App'
            });

            if (result.success) {
                logger.info(`Bursary application submitted to Supabase: ${refCode}`);
                return res.status(201).json({
                    success: true,
                    refCode,
                    applicationNumber: refCode,
                    application: result.data
                });
            } else {
                logger.warn('Supabase bursary insert failed:', result.error);
                // Fall through to MongoDB
            }
        } catch (supaErr) {
            logger.warn('Supabase bursary service error, using MongoDB fallback:', supaErr.message);
        }

        // MongoDB fallback
        const db = await getDb();
        const count = await db.collection('bursaries').countDocuments();
        const refCode = 'BUR-' + String(count + 1).padStart(4, '0');

        const application = {
            ref_code: refCode,
            application_number: refCode,
            phone_number: phoneNumber || '',
            user_id: userId || null,
            full_name: fullName || 'Unknown',
            applicant_name: fullName || 'Unknown',
            institution_name: institutionName,
            institutionName: institutionName,
            course,
            year_of_study: yearOfStudy,
            yearOfStudy: yearOfStudy,
            institution_type: institutionType || 'university',
            reason: reason || '',
            amount_requested: amountRequested || 0,
            amountRequested: amountRequested || 0,
            status: 'pending',
            source: 'Mobile App',
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('bursaries').insertOne(application);
        logger.info(`Bursary application submitted via MongoDB fallback: ${refCode}`);

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

/**
 * MOBILE APP ENDPOINTS
 * ==========================================
 */

/**
 * Mobile User Registration with username/password
 * POST /api/citizen/mobile/register
 * Uses Supabase for primary storage (shared with mobile app)
 * MongoDB as fallback
 */
router.post('/mobile/register', async (req, res) => {
    try {
        const {
            fullName,
            username,
            phoneNumber,
            nationalId,
            village,
            password
        } = req.body;

        if (!username || !password || !fullName || !phoneNumber) {
            return res.status(400).json({ error: 'Username, password, name and phone required' });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Try Supabase first (primary storage)
        try {
            const supabaseService = require('../services/supabaseService');
            const result = await supabaseService.registerUser({
                fullName,
                phone: phoneNumber,
                idNumber: nationalId || '',
                password,
                village,
                username: username.toLowerCase()
            });

            if (result.success) {
                logger.info(`Mobile user registered via Supabase: ${username}`);
                return res.status(201).json({
                    success: true,
                    message: 'Registration successful',
                    userId: result.user?.id
                });
            } else {
                // If Supabase fails with duplicate, return that error
                if (result.error?.includes('already')) {
                    return res.status(400).json({ error: result.error });
                }
                // Otherwise fall through to MongoDB
                logger.warn('Supabase registration failed, trying MongoDB:', result.error);
            }
        } catch (supaErr) {
            logger.warn('Supabase service unavailable, using MongoDB fallback:', supaErr.message);
        }

        // MongoDB fallback
        const db = await getDb();

        // Check if username exists
        const existingUser = await db.collection('mobile_users').findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Check if phone exists
        const existingPhone = await db.collection('mobile_users').findOne({ phone_number: phoneNumber });
        if (existingPhone) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            username: username.toLowerCase(),
            full_name: fullName,
            phone_number: phoneNumber,
            national_id: nationalId || '',
            village: village || '',
            password: hashedPassword,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('mobile_users').insertOne(user);
        logger.info(`Mobile user registered via MongoDB: ${username}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            userId: result.insertedId.toString()
        });
    } catch (err) {
        logger.error('Mobile register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});


/**
 * Mobile User Login with username/password
 * POST /api/citizen/mobile/login
 * Uses Supabase for primary auth (shared with mobile app)
 * MongoDB as fallback
 */
router.post('/mobile/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Try Supabase first (primary auth)
        try {
            const supabaseService = require('../services/supabaseService');
            const result = await supabaseService.loginUser(username, password);

            if (result.success) {
                // Generate session token
                const token = crypto.randomBytes(32).toString('hex');
                citizenSessions.set(token, {
                    userId: result.user.id,
                    username: result.user.username || username,
                    phoneNumber: result.user.phone,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                });

                logger.info(`Mobile user logged in via Supabase: ${username}`);

                return res.json({
                    success: true,
                    token,
                    user: {
                        id: result.user.id,
                        username: result.user.username || username,
                        fullName: result.user.fullName,
                        phoneNumber: result.user.phone,
                        phone: result.user.phone,
                        village: result.user.village || ''
                    }
                });
            } else {
                // If user not found in Supabase, try MongoDB
                if (result.error?.includes('not found')) {
                    logger.info('User not in Supabase, trying MongoDB');
                } else {
                    // Invalid password or other error from Supabase
                    return res.status(401).json({ error: result.error || 'Invalid credentials' });
                }
            }
        } catch (supaErr) {
            logger.warn('Supabase login unavailable, using MongoDB fallback:', supaErr.message);
        }

        // MongoDB fallback
        const db = await getDb();
        const user = await db.collection('mobile_users').findOne({
            username: username.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Check password (support both bcrypt and legacy sha256)
        let passwordValid = false;
        if (user.password.startsWith('$2')) {
            // bcrypt hash
            passwordValid = await bcrypt.compare(password, user.password);
        } else {
            // legacy sha256
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            passwordValid = user.password === hashedPassword;
        }

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        citizenSessions.set(token, {
            userId: user._id.toString(),
            username: user.username,
            phoneNumber: user.phone_number,
            createdAt: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        logger.info(`Mobile user logged in via MongoDB: ${username}`);

        res.json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                phone: user.phone_number,
                village: user.village || ''
            }
        });
    } catch (err) {
        logger.error('Mobile login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});


/**
 * Mobile OTP Send (for verification during registration)
 * POST /api/citizen/mobile/otp/send
 */
router.post('/mobile/otp/send', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        // Generate 6-digit OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP
        otpStore.set(phoneNumber, { otp, expiresAt });

        // Log OTP (in production, send via SMS)
        console.log(`📱 Mobile OTP for ${phoneNumber}: ${otp}`);
        logger.info(`OTP generated for mobile: ${phoneNumber}`);

        res.json({
            success: true,
            message: 'OTP sent to your phone',
            // Return OTP for testing (remove in production)
            otp: otp
        });
    } catch (err) {
        logger.error('Mobile OTP send error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

/**
 * Mobile OTP Verify
 * POST /api/citizen/mobile/otp/verify
 */
router.post('/mobile/otp/verify', async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ error: 'Phone number and OTP required' });
        }

        const storedOTP = otpStore.get(phoneNumber);

        if (!storedOTP) {
            return res.status(401).json({ error: 'OTP not found or expired', verified: false });
        }

        if (storedOTP.expiresAt < Date.now()) {
            otpStore.delete(phoneNumber);
            return res.status(401).json({ error: 'OTP expired', verified: false });
        }

        if (storedOTP.otp !== otp) {
            return res.status(401).json({ error: 'Invalid OTP', verified: false });
        }

        // OTP verified - clear it
        otpStore.delete(phoneNumber);
        logger.info(`OTP verified for mobile: ${phoneNumber}`);

        res.json({
            success: true,
            verified: true,
            message: 'Phone verified successfully'
        });
    } catch (err) {
        logger.error('Mobile OTP verify error:', err);
        res.status(500).json({ error: 'Verification failed', verified: false });
    }
});

/**
 * Get Mobile User Profile
 * GET /api/citizen/mobile/profile/:userId
 */
router.get('/mobile/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await getDb();

        const user = await db.collection('mobile_users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user._id.toString(),
                username: user.username,
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                nationalId: user.national_id || '',
                village: user.village || '',
                createdAt: user.created_at
            }
        });
    } catch (err) {
        logger.error('Get mobile profile error:', err);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

/**
 * Update Mobile User Profile
 * PUT /api/citizen/mobile/profile/:userId
 */
router.put('/mobile/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, phoneNumber, village } = req.body;
        const db = await getDb();

        const result = await db.collection('mobile_users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    full_name: fullName,
                    phone_number: phoneNumber,
                    village: village,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`Mobile profile updated: ${userId}`);

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (err) {
        logger.error('Update mobile profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * Get User Issues by userId
 * GET /api/citizen/mobile/issues/:userId
 */
router.get('/mobile/issues/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await getDb();

        const issues = await db.collection('issues')
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();

        res.json({
            success: true,
            issues: issues.map(issue => ({
                id: issue._id.toString(),
                ticket: issue.ticket,
                title: issue.title,
                category: issue.category,
                description: issue.description,
                status: issue.status,
                location: issue.location,
                imageUrl: issue.image_url,
                thumbnailUrl: issue.thumbnail_url,
                createdAt: issue.created_at
            }))
        });
    } catch (err) {
        logger.error('Get user issues error:', err);
        res.status(500).json({ error: 'Failed to get issues' });
    }
});

/**
 * Get User Bursaries by userId
 * GET /api/citizen/mobile/bursaries/:userId
 */
router.get('/mobile/bursaries/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await getDb();

        const bursaries = await db.collection('bursaries')
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();

        res.json({
            success: true,
            bursaries: bursaries.map(b => ({
                id: b._id.toString(),
                refCode: b.ref_code,
                institutionName: b.institution_name,
                course: b.course,
                yearOfStudy: b.year_of_study,
                status: b.status,
                amountRequested: b.amount_requested,
                createdAt: b.created_at
            }))
        });
    } catch (err) {
        logger.error('Get user bursaries error:', err);
        res.status(500).json({ error: 'Failed to get bursaries' });
    }
});

/**
 * MEDIA GALLERY ENDPOINTS
 * ==========================================
 */

/**
 * Get all images from Cloudinary (Media Gallery)
 * GET /api/citizen/media/images
 */
router.get('/media/images', async (req, res) => {
    try {
        const folder = req.query.folder || 'issues';
        const result = await listImages(folder);

        if (result.success) {
            res.json({ success: true, images: result.images });
        } else {
            res.status(500).json({ error: result.error, images: [] });
        }
    } catch (err) {
        logger.error('Get media images error:', err);
        res.status(500).json({ error: 'Failed to get images' });
    }
});

/**
 * Delete an image from Cloudinary
 * DELETE /api/citizen/media/images/:publicId
 */
router.delete('/media/images/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        const result = await deleteImage(decodeURIComponent(publicId));

        if (result.success) {
            res.json({ success: true, message: 'Image deleted' });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        logger.error('Delete media image error:', err);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

/**
 * Get all mobile app users (for dashboard)
 * GET /api/citizen/mobile/users
 */
router.get('/mobile/users', async (req, res) => {
    try {
        const db = await getDb();
        const users = await db.collection('mobile_users')
            .find({}, { projection: { password: 0 } })
            .sort({ created_at: -1 })
            .toArray();

        res.json({
            success: true,
            users: users.map(u => ({
                id: u._id.toString(),
                username: u.username,
                fullName: u.full_name,
                phoneNumber: u.phone_number,
                nationalId: u.national_id || '',
                village: u.village || '',
                createdAt: u.created_at
            })),
            total: users.length
        });
    } catch (err) {
        logger.error('Get mobile users error:', err);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

/**
 * DATABASE BACKUP/RECOVERY ENDPOINTS
 * ==========================================
 */

/**
 * Create database backup (recovery point)
 * POST /api/citizen/admin/backup
 */
router.post('/admin/backup', async (req, res) => {
    try {
        const db = await getDb();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Get all collections data
        const collections = ['mobile_users', 'issues', 'bursaries', 'constituents', 'announcements'];
        const backup = {
            timestamp,
            createdAt: new Date(),
            data: {}
        };

        for (const collName of collections) {
            try {
                backup.data[collName] = await db.collection(collName).find({}).toArray();
            } catch (e) {
                backup.data[collName] = [];
            }
        }

        // Store backup in a backups collection
        await db.collection('backups').insertOne(backup);

        logger.info(`Database backup created: ${timestamp}`);

        res.json({
            success: true,
            backupId: timestamp,
            message: 'Backup created successfully',
            stats: Object.keys(backup.data).reduce((acc, k) => {
                acc[k] = backup.data[k].length;
                return acc;
            }, {})
        });
    } catch (err) {
        logger.error('Database backup error:', err);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

/**
 * List available backups
 * GET /api/citizen/admin/backups
 */
router.get('/admin/backups', async (req, res) => {
    try {
        const db = await getDb();
        const backups = await db.collection('backups')
            .find({}, { projection: { data: 0 } })
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray();

        res.json({
            success: true,
            backups: backups.map(b => ({
                id: b._id.toString(),
                timestamp: b.timestamp,
                createdAt: b.createdAt
            }))
        });
    } catch (err) {
        logger.error('List backups error:', err);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

/**
 * Restore from backup
 * POST /api/citizen/admin/restore/:backupId
 */
router.post('/admin/restore/:backupId', async (req, res) => {
    try {
        const { backupId } = req.params;
        const db = await getDb();

        const backup = await db.collection('backups').findOne({ timestamp: backupId });

        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        // Restore each collection
        const restored = {};
        for (const [collName, docs] of Object.entries(backup.data)) {
            if (docs.length > 0) {
                // Create backup of current state before restore
                const currentDocs = await db.collection(collName).find({}).toArray();
                await db.collection(`${collName}_pre_restore_${Date.now()}`).insertMany(currentDocs);

                // Clear and restore
                await db.collection(collName).deleteMany({});
                await db.collection(collName).insertMany(docs);
                restored[collName] = docs.length;
            }
        }

        logger.info(`Database restored from backup: ${backupId}`);

        res.json({
            success: true,
            message: 'Database restored successfully',
            restored
        });
    } catch (err) {
        logger.error('Database restore error:', err);
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

module.exports = router;
