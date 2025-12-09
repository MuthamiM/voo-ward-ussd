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

/**
 * MOBILE APP ENDPOINTS
 * ==========================================
 */

/**
 * Mobile User Registration with username/password
 * POST /api/citizen/mobile/register
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
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

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

        // Hash password (simple hash - use bcrypt in production)
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

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
        logger.info(`Mobile user registered: ${username}`);

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
 */
router.post('/mobile/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const db = await getDb();
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        const user = await db.collection('mobile_users').findOne({
            username: username.toLowerCase(),
            password: hashedPassword
        });

        if (!user) {
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

        logger.info(`Mobile user logged in: ${username}`);

        res.json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                fullName: user.full_name,
                phoneNumber: user.phone_number,
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
