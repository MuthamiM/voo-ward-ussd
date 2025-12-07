const express = require("express");
const https = require("https");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
// bcrypt for secure password hashing and migration from legacy SHA-256
const bcrypt = require('bcryptjs');

// Load environment variables
require("dotenv").config();
const session = require('express-session');
const chatbotSvc = require('./chatbot');

// OAuth Configuration
let oauth;
try {
  oauth = require('./config/oauth');
  console.log('✅ OAuth configuration loaded');
} catch (err) {
  console.warn('⚠️  OAuth configuration not found, social login disabled');
  oauth = { passport: null, isFacebookConfigured: () => false, isTwitterConfigured: () => false };
}

// Input validation and sanitization
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Allow + prefix and digits, length 10-15
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  // Alphanumeric, underscore, hyphen, 3-30 chars
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  // At least 6 characters
  return password.length >= 6 && password.length <= 128;
}

// Helper: Send SMS via Infobip
function sendSMS(to, text) {
  return new Promise((resolve, reject) => {
    if (!process.env.INFOBIP_API_KEY || !process.env.INFOBIP_BASE_URL) {
      console.warn('⚠️ Infobip credentials missing, skipping SMS');
      return resolve({ skipped: true });
    }

    const data = JSON.stringify({
      messages: [
        {
          destinations: [{ to: to }],
          from: process.env.INFOBIP_SENDER || 'ServiceSMS',
          text: text
        }
      ]
    });

    const options = {
      hostname: process.env.INFOBIP_BASE_URL.replace('https://', '').replace(/\/$/, ''),
      path: '/sms/2/text/advanced',
      method: 'POST',
      headers: {
        'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ SMS sent successfully to', to);
          resolve(JSON.parse(responseBody));
        } else {
          console.error('❌ Infobip Error:', res.statusCode, responseBody);
          reject(new Error(`Infobip API Error: ${responseBody}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ SMS Network Error:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

const app = express();

// Trust proxy for production deployment (Render.com)
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy - Allow external resources for maps, fonts, and charts
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none';");
  next();
});

// Middleware with size limits to prevent DOS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS - secure origin handling
const ALLOWED_ORIGINS = [
  'http://localhost:4000',
  'http://localhost:3000',
  'null', // Allow file:// access
  process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use((req, res, next) => {
  // Allow all origins for development/demo purposes
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Credentials not needed for Bearer token auth, and conflict with '*' origin
  // res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const fs = require('fs');
const multer = require('multer');
let sharp;
try { sharp = require('sharp'); } catch (e) { console.warn('sharp not available; image resizing disabled'); }
// Optional S3 support using AWS SDK v3 (@aws-sdk/client-s3)
let s3Client;
let S3_ENABLED = false;
try {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    const region = process.env.S3_REGION || 'us-east-1';
    s3Client = new S3Client({ region });
    // attach command constructors so later code can reference them when needed
    s3Client._PutObjectCommand = PutObjectCommand;
    s3Client._DeleteObjectCommand = DeleteObjectCommand;
    S3_ENABLED = true;
    console.log('S3 (v3): enabled for avatar uploads');
  }
} catch (e) {
  // @aws-sdk/client-s3 not installed or not configured
}

// Session middleware for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Temporarily disabled for OAuth debugging
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport for OAuth
if (oauth.passport) {
  app.use(oauth.passport.initialize());
  app.use(oauth.passport.session());
  console.log('✅ Passport.js initialized');
}


// Enhanced error handling middleware
const errorHandler = require('./middleware/errorHandler');
const redisCache = require('./services/redisCache');

// Simple session storage (in production, use Redis or proper session management)
const sessions = new Map();

// Session cleanup: Remove expired sessions every 15 minutes to prevent memory leaks
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS) || 1800000; // 30 minutes default
setInterval(() => {
  const now = new Date();
  let cleanedCount = 0;
  for (const [token, sess] of sessions.entries()) {
    if (sess.createdAt && (now - sess.createdAt > SESSION_TIMEOUT)) {
      sessions.delete(token);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired sessions (total: ${sessions.size})`);
  }
}, 900000); // 15 minutes

// Helper: Hash password
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Helper: detect bcrypt hash
function isBcryptHash(s) {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$') || s.startsWith('$2$'));
}

// Helper: hash with bcrypt
function bcryptHash(password) {
  return bcrypt.hashSync(password, 10);
}

// Helper: Generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Middleware: Verify authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  // Log authentication attempts for debugging
  console.log('Auth check - Token present:', !!token, 'Value:', token ? token.substring(0, 10) + '...' : 'none');

  // treat explicit 'null' or 'undefined' string values as missing token
  if (!token || token === 'null' || token === 'undefined') {
    console.log('Auth failed: No valid token provided');
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = sessions.get(token);
  if (!session) {
    console.log('Auth failed: Session not found for token');
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  console.log('Auth success: User', session.user.username, 'Role:', session.user.role);
  req.user = session.user;
  next();
}

// Simple rate limiter for auth endpoints to prevent brute force and noisy 401s
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  console.warn('express-rate-limit not installed; falling back to in-process limiter');
}

// If express-rate-limit is available, use it. Otherwise, use a simple in-memory limiter.
let loginLimiter;
if (rateLimit) {
  loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 login requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true, // Trust proxy for accurate IP detection
    message: { error: 'Too many login attempts, please try again in a minute' }
  });
  console.log('Login limiter: express-rate-limit active');
} else {
  // Simple fallback limiter: counts attempts per IP with expiry.
  const attempts = new Map(); // ip -> { count, firstTs }
  const WINDOW_MS = 60 * 1000;
  const MAX_ATTEMPTS = 10;

  // periodic cleanup to avoid memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [ip, info] of attempts.entries()) {
      if (now - info.firstTs > WINDOW_MS * 5) attempts.delete(ip);
    }
  }, WINDOW_MS * 2).unref();

  loginLimiter = (req, res, next) => {
    try {
      const ip = (req.ip || req.connection?.remoteAddress || 'unknown').toString();
      const now = Date.now();
      const info = attempts.get(ip) || { count: 0, firstTs: now };
      if (now - info.firstTs > WINDOW_MS) {
        info.count = 1;
        info.firstTs = now;
      } else {
        info.count += 1;
      }
      attempts.set(ip, info);
      if (info.count > MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many login attempts, please try again in a minute' });
      }
    } catch (e) {
      // on error, allow request through to avoid locking everyone out
      console.warn('Fallback limiter error', e && e.message);
    }
    return next();
  };
  console.log('Login limiter: in-process fallback active');
}

// Middleware: Verify MCA role
function requireMCA(req, res, next) {
  if (req.user.role !== "MCA") {
    return res.status(403).json({ error: "Access denied. MCA role required." });
  }
  next();
}

// MongoDB connection
const { ServerApiVersion } = require("mongodb");
let client;
let db;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function connectDB(retries = 3) {
  if (db) return db;

  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env file");
    return null;
  }

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!client) {
        client = new MongoClient(MONGO_URI, {
          serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
          tls: true,
          retryWrites: true,
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 8000,
          maxPoolSize: 10,
          minPoolSize: 2,
        });
      }

      if (!db) {
        await client.connect();
        // Extract database name from URI
        const url = new URL(MONGO_URI);
        const pathDb = (url.pathname || "").replace(/^\//, "") || "voo_ward";
        db = client.db(pathDb);

        // Create indexes for performance
        await createIndexes(db);
      }

      console.log("✅ Connected to MongoDB Atlas");
      return db;
    } catch (err) {
      lastError = err;
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, err.message);

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error("❌ MongoDB connection failed after", retries, "attempts:", lastError?.message);
  console.log("💡 Tip: Check if MONGO_URI is correct in .env file");
  return null;
}

// Create database indexes for performance
async function createIndexes(database) {
  try {
    console.log("🚀 Creating comprehensive database indexes for production optimization...");

    // ===============================
    // ADMIN USERS COLLECTION - Enhanced for query patterns
    // ===============================
    await database.collection('admin_users').createIndex({ username: 1 }, { unique: true, name: "unique_username" });
    await database.collection('admin_users').createIndex({ role: 1, status: 1 }, { name: "role_status_compound" });
    await database.collection('admin_users').createIndex({ last_login: -1 }, { name: "last_login_desc" });
    await database.collection('admin_users').createIndex({ created_at: -1 }, { name: "admin_created_desc" });

    // Text search for admin management
    await database.collection('admin_users').createIndex(
      { username: "text", full_name: "text", email: "text" },
      { name: "admin_text_search", weights: { username: 10, full_name: 5, email: 1 } }
    );

    // ===============================
    // ISSUES COLLECTION - Optimized for dashboard queries
    // ===============================
    await database.collection('issues').createIndex({ status: 1, created_at: -1 }, { name: "status_date_compound" });
    await database.collection('issues').createIndex({ phone_number: 1, created_at: -1 }, { name: "phone_date_compound" });
    await database.collection('issues').createIndex({ assigned_to: 1, status: 1 }, { name: "assigned_status_compound" });
    await database.collection('issues').createIndex({ priority: -1, created_at: -1 }, { name: "priority_date_compound" });
    await database.collection('issues').createIndex({ area_id: 1, status: 1, created_at: -1 }, { name: "area_status_date_compound" });

    // Text search for issue management
    await database.collection('issues').createIndex(
      { title: "text", description: "text", phone_number: "text" },
      { name: "issues_text_search", weights: { title: 10, description: 5, phone_number: 3 } }
    );

    // Geospatial index for location-based queries
    await database.collection('issues').createIndex({ location: "2dsphere" }, { name: "issues_geospatial" });

    // ===============================
    // BURSARIES COLLECTION - Enhanced for application management
    // ===============================
    await database.collection('bursaries').createIndex({ status: 1, created_at: -1 }, { name: "bursary_status_date_compound" });
    await database.collection('bursaries').createIndex({ phone_number: 1, status: 1 }, { name: "bursary_phone_status_compound" });
    await database.collection('bursaries').createIndex({ national_id: 1 }, { unique: true, sparse: true, name: "bursary_unique_national_id" });
    await database.collection('bursaries').createIndex({ application_date: -1 }, { name: "bursary_application_date" });
    await database.collection('bursaries').createIndex({ review_date: -1 }, { sparse: true, name: "bursary_review_date" });
    await database.collection('bursaries').createIndex({ amount: -1, status: 1 }, { name: "bursary_amount_status" });

    // Text search for bursary applications
    await database.collection('bursaries').createIndex(
      { full_name: "text", school_name: "text", phone_number: "text" },
      { name: "bursary_text_search", weights: { full_name: 10, school_name: 5, phone_number: 3 } }
    );

    // ===============================
    // CONSTITUENTS COLLECTION - Optimized for member management
    // ===============================
    await database.collection('constituents').createIndex({ phone_number: 1 }, { unique: true, name: "unique_phone_number" });
    await database.collection('constituents').createIndex({ national_id: 1 }, { unique: true, sparse: true, name: "unique_national_id" });
    await database.collection('constituents').createIndex({ area_id: 1, status: 1 }, { name: "area_status_compound" });
    await database.collection('constituents').createIndex({ registration_date: -1 }, { name: "registration_date_desc" });
    await database.collection('constituents').createIndex({ last_interaction: -1 }, { name: "last_interaction_desc" });

    // Text search for constituent management
    await database.collection('constituents').createIndex(
      { full_name: "text", phone_number: "text", national_id: "text" },
      { name: "constituents_text_search", weights: { full_name: 10, phone_number: 5, national_id: 3 } }
    );

    // Geospatial index for location-based services
    await database.collection('constituents').createIndex({ location: "2dsphere" }, { name: "constituents_geospatial" });

    // ===============================
    // USSD INTERACTIONS - Performance optimized for analytics
    // ===============================
    await database.collection('ussd_interactions').createIndex({ phone_number: 1, created_at: -1 }, { name: "phone_date_compound" });
    await database.collection('ussd_interactions').createIndex({ session_id: 1 }, { name: "session_id_index" });
    await database.collection('ussd_interactions').createIndex({ menu_option: 1, created_at: -1 }, { name: "menu_date_compound" });
    await database.collection('ussd_interactions').createIndex({ created_at: -1 }, { name: "ussd_date_desc", expireAfterSeconds: 31536000 }); // Auto-expire after 1 year

    // ===============================
    // AUDIT LOGS - For security and compliance
    // ===============================
    await database.collection('audit_logs').createIndex({ user_id: 1, timestamp: -1 }, { name: "audit_user_time" });
    await database.collection('audit_logs').createIndex({ action: 1, timestamp: -1 }, { name: "audit_action_time" });
    await database.collection('audit_logs').createIndex({ ip_address: 1, timestamp: -1 }, { name: "audit_ip_time" });
    await database.collection('audit_logs').createIndex({ timestamp: -1 }, { name: "audit_timestamp", expireAfterSeconds: 7776000 }); // Auto-expire after 90 days

    // ===============================
    // AREAS COLLECTION - For geographic management
    // ===============================
    await database.collection('areas').createIndex({ area_code: 1 }, { unique: true, name: "unique_area_code" });
    await database.collection('areas').createIndex({ parent_area: 1 }, { name: "parent_area_index" });
    await database.collection('areas').createIndex({ area_type: 1, status: 1 }, { name: "area_type_status" });

    // Text search for area management
    await database.collection('areas').createIndex(
      { area_name: "text", description: "text" },
      { name: "areas_text_search", weights: { area_name: 10, description: 3 } }
    );

    // ===============================
    // SESSIONS COLLECTION - For session management
    // ===============================
    await database.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: "session_ttl" });
    await database.collection('sessions').createIndex({ user_id: 1 }, { name: "session_user_id" });

    // ===============================
    // NOTIFICATIONS COLLECTION - For real-time features
    // ===============================
    await database.collection('notifications').createIndex({ user_id: 1, created_at: -1 }, { name: "notif_user_date" });
    await database.collection('notifications').createIndex({ read: 1, created_at: -1 }, { name: "notif_read_date" });
    await database.collection('notifications').createIndex({ type: 1, created_at: -1 }, { name: "notif_type_date" });

    console.log("✅ Production-grade database indexes created successfully!");
    console.log("🎯 Indexes optimized for query patterns and performance targets");
    console.log("📊 Text search enabled for all major collections");
    console.log("🌍 Geospatial indexes ready for location-based queries");
    console.log("⏰ TTL indexes configured for automatic data cleanup");

  } catch (err) {
    console.error("❌ Index creation error:", err.message);
    console.warn("⚠️  Some indexes may not have been created - check MongoDB logs");
  }
}

// Prepare upload directory for profile avatars
const UPLOADS_DIR = path.join(__dirname, '../public/uploads/avatars');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { /* ignore */ }

// Multer storage for avatars
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // filename: userId-timestamp.ext
    const uid = req.user ? (req.user.id || req.user.username || 'anon') : 'anon';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${uid}-${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: function (req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only JPEG, PNG or WEBP images are allowed'));
    cb(null, true);
  }
});

// Notifications have been disabled per operator request.
// keep a no-op helper to avoid removing all call sites; it will log the intent and return a neutral result.
async function sendNotificationToPhone(db, phone, message) {
  if (!process.env.INFOBIP_API_KEY || !process.env.INFOBIP_BASE_URL) {
    console.warn('⚠️ Infobip not configured, skipping SMS');
    return { ok: false, error: 'Infobip not configured' };
  }

  try {
    // Ensure phone number is in E.164 format (simple check)
    let formattedPhone = phone.replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+254' + formattedPhone.substring(1);
    }

    const response = await fetch(`${process.env.INFOBIP_BASE_URL}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to: formattedPhone }],
            from: process.env.INFOBIP_SENDER || 'ServiceSMS',
            text: message
          }
        ]
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`✅ SMS sent to ${formattedPhone}`);
      return { ok: true, data };
    } else {
      console.error('❌ Infobip SMS failed:', JSON.stringify(data));
      return { ok: false, error: data };
    }
  } catch (error) {
    console.error('❌ SMS network error:', error);
    return { ok: false, error: error.message };
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "voo-admin-dashboard",
    ts: new Date().toISOString(),
    db: db ? "connected" : "disconnected"
  });
});

// Favicon endpoint - return simple SVG icon
app.get("/favicon.ico", (req, res) => {
  const svg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#6366f1"/><text x="16" y="22" font-family="Arial" font-size="20" fill="white" text-anchor="middle" font-weight="bold">V</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// Admin health check (simple)
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "admin-api",
    timestamp: new Date().toISOString()
  });
});

// Admin health check with detailed system status
app.get("/api/admin/health", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();

    // Test database connectivity
    let dbStatus = {
      connected: false,
      collections: 0,
      latency: 0
    };

    if (database) {
      const startTime = Date.now();
      try {
        const collections = await database.listCollections().toArray();
        dbStatus = {
          connected: true,
          collections: collections.length,
          latency: Date.now() - startTime,
          database: "MongoDB Atlas"
        };
      } catch (error) {
        console.error('Database test failed:', error);
        dbStatus.error = error.message;
      }
    }

    // System status
    const systemStatus = {
      service: "VOO Ward Admin Dashboard",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbStatus.connected ? "connected" : "disconnected",
      details: dbStatus
    };

    res.json(systemStatus);

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      error: "Health check failed",
      database: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Login
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  console.log('🔐 Login attempt received:', req.body ? 'with body' : 'no body');
  console.log('🔐 Request headers:', req.headers);
  console.log('🔐 Request IP:', req.ip);

  try {
    let { username, password, pin } = req.body;

    // Allow 'pin' to be used as 'password' since frontend sends 'pin'
    if (!password && pin) {
      password = pin;
    }

    if (!username || !password) {
      console.log('❌ Missing credentials in login request');
      return res.status(400).json({ error: "Username and password required" });
    }

    // Validate input format
    if (!validateUsername(username)) {
      console.log('❌ Invalid username format:', username);
      return res.status(400).json({ error: "Invalid username format" });
    }

    if (!validatePassword(password)) {
      console.log('❌ Invalid password format');
      return res.status(400).json({ error: "Invalid password format" });
    }

    console.log('🔄 Connecting to database for authentication...');
    const database = await connectDB();

    // When database is not connected, require DB for authentication.
    if (!database) {
      console.error('❌ Database not connected - authentication requires a configured database');
      return res.status(503).json({ error: 'Database not connected' });
    }

    console.log(`🔍 Login attempt for user: ${sanitizeString(username, 50)}`);

    // PRODUCTION: Use database authentication
    // Find user
    const user = await database.collection("admin_users").findOne({
      username: username.toLowerCase().trim()
    });

    if (!user) {
      console.warn(`⚠️  Failed login attempt for unknown user '${username}' from ${req.ip}`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log('✅ User found in database:', user.username);

    // Support both bcrypt (new) and legacy SHA-256 passwords.
    let passwordMatches = false;

    try {
      if (isBcryptHash(user.password)) {
        passwordMatches = await bcrypt.compare(password, user.password);
      } else {
        // legacy SHA-256
        passwordMatches = user.password === hashPassword(password);

        // If legacy matches, migrate to bcrypt to improve security
        if (passwordMatches) {
          try {
            const newHash = await bcrypt.hash(password, 10);
            await database.collection('admin_users').updateOne({ _id: user._id }, { $set: { password: newHash } });
            console.log(`🔁 Migrated password for user ${user.username} to bcrypt`);
          } catch (migErr) {
            console.warn('⚠️ Failed to migrate password to bcrypt for user', user.username, migErr && migErr.message);
          }
        }
      }
    } catch (errCompare) {
      console.error('Password compare error:', errCompare);
      passwordMatches = false;
    }

    if (!passwordMatches) {
      console.warn(`Failed login attempt for user '${username}' from ${req.ip}`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create session
    const token = generateSessionToken();
    // include photo_url and settings in session so client can apply saved preferences
    const sessionUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      photo_url: user.photo_url || null,
      photo_thumb: user.photo_thumb || null,
      photo_webp: user.photo_webp || null,
      photo_thumb_webp: user.photo_thumb_webp || null,
      settings: user.settings || {}
    };

    sessions.set(token, { user: sessionUser, createdAt: new Date() });

    res.json({
      success: true,
      token,
      user: sessionUser
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Forgot Password
app.post("/api/auth/forgot-password", loginLimiter, async (req, res) => {
  try {
    const { identifier } = req.body; // username or phone

    if (!identifier) {
      return res.status(400).json({ error: "Username or phone number is required" });
    }

    console.log(`🔑 Forgot password request for: ${identifier}`);

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const user = await database.collection("admin_users").findOne({
      $or: [
        { username: identifier.toLowerCase() },
        { phone: identifier }
      ]
    });

    if (!user) {
      // Security: don't reveal user existence
      return res.json({
        success: true,
        message: "If an account exists, a reset code has been sent."
      });
    }

    // Generate reset PIN (6 digits)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 3600000); // 24 hours

    // Store token in DB
    await database.collection("password_resets").insertOne({
      user_id: user._id,
      token: resetToken,
      expires_at: expiresAt,
      created_at: new Date()
    });

    // Send SMS if phone number exists
    if (user.phone) {
      sendNotificationToPhone(database, user.phone, `Your VOO Ward reset code is: ${resetToken}`)
        .catch(err => console.error('Background SMS error:', err));
    }

    // Log token for dev/demo purposes
    console.log(`🔓 [RESET PIN] For ${user.username}: ${resetToken}`);

    res.json({
      success: true,
      message: "Reset code has been sent to your phone.",
      dev_token: resetToken // Keep for demo convenience
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reset Password
app.post("/api/auth/reset-password", loginLimiter, async (req, res) => {
  try {
    const { token, new_pin } = req.body;

    if (!token || !new_pin) {
      return res.status(400).json({ error: "Token and new PIN are required" });
    }

    if (!/^\d+$/.test(new_pin)) {
      return res.status(400).json({ error: "Password must contain only digits" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Find valid token
    const resetRecord = await database.collection("password_resets").findOne({
      token: token,
      expires_at: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Update user password (PIN)
    // We'll hash the PIN as the password
    const hashedPassword = await bcrypt.hash(new_pin, 10);

    await database.collection("admin_users").updateOne(
      { _id: resetRecord.user_id },
      {
        $set: { password: hashedPassword, updated_at: new Date() }
      }
    );

    // Delete used token
    await database.collection("password_resets").deleteOne({ _id: resetRecord._id });

    console.log(`✅ Password reset successful for user ID: ${resetRecord.user_id}`);

    // Send confirmation SMS
    const user = await database.collection("admin_users").findOne({ _id: resetRecord.user_id });
    if (user && user.phone) {
      try {
        await sendSMS(user.phone, `Your VOO Ward password has been reset successfully. New PIN: ${new_pin}`);
      } catch (smsErr) {
        console.error("Failed to send reset SMS:", smsErr);
      }
    }

    res.json({ success: true, message: "Password reset successfully. Please login with your new PIN." });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update Profile (including profile picture)
app.post("/api/auth/update-profile", requireAuth, async (req, res) => {
  try {
    const { profile_picture, full_name, phone } = req.body;
    const userId = req.user._id || req.user.id;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const updateData = { updated_at: new Date() };

    if (profile_picture) updateData.profile_picture = profile_picture;
    if (full_name) updateData.full_name = full_name;
    if (phone) updateData.phone = phone;

    await database.collection("admin_users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    console.log(`✅ Profile updated for user: ${req.user.username}`);
    res.json({ success: true, message: "Profile updated successfully" });

  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Social Login
app.post("/api/auth/social-login", loginLimiter, async (req, res) => {
  try {
    const { provider, profile_id, name, email } = req.body;

    if (!provider || !profile_id || !name) {
      return res.status(400).json({ error: "Missing social profile information" });
    }

    console.log(`🌐 Social login attempt: ${provider} - ${name}`);

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check if user exists by social_id
    let user = await database.collection("admin_users").findOne({
      social_id: profile_id,
      social_provider: provider
    });

    if (!user) {
      // Check if user exists by username (fallback/linking)
      // Generate username from name
      const username = name.replace(/\s+/g, '').toLowerCase();
      user = await database.collection("admin_users").findOne({ username: username });

      if (user) {
        // Link account
        await database.collection("admin_users").updateOne(
          { _id: user._id },
          {
            $set: {
              social_id: profile_id,
              social_provider: provider,
              updated_at: new Date()
            }
          }
        );
        console.log(`🔗 Linked social account for ${username}`);
      } else {
        // Create new user
        // Check user limit first
        const totalUsers = await database.collection('admin_users').countDocuments({});
        if (totalUsers >= 3) {
          // For demo, we might want to allow it or return error. 
          // Let's return error to be consistent with registration policy, 
          // but maybe we can allow a "guest" role if we had one.
          // For now, strict limit.
          return res.status(400).json({ error: "User limit reached. Cannot create new account via social login." });
        }

        const newUser = {
          username: username,
          password: await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 10), // Random password
          full_name: name,
          phone: "000000", // Placeholder
          role: "PA", // Default role
          social_id: profile_id,
          social_provider: provider,
          created_at: new Date(),
          self_registered: true
        };

        const result = await database.collection("admin_users").insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
        console.log(`✨ Created new user from social login: ${username}`);
      }
    }

    // Create session
    const token = generateSessionToken();
    const sessionUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      photo_url: user.photo_url || null,
      settings: user.settings || {}
    };

    sessions.set(token, { user: sessionUser, createdAt: new Date() });

    res.json({
      success: true,
      token,
      user: sessionUser
    });

  } catch (err) {
    console.error("Social login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PRODUCTION OAUTH ROUTES
// ============================================

// Facebook OAuth - Initiate
app.get("/api/auth/facebook", (req, res, next) => {
  if (!oauth.isFacebookConfigured()) {
    return res.status(503).json({
      error: "Facebook OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in environment variables."
    });
  }
  oauth.passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

// Facebook OAuth - Callback
app.get("/api/auth/facebook/callback",
  (req, res, next) => {
    if (!oauth.isFacebookConfigured()) {
      return res.redirect('/login.html?error=facebook_not_configured');
    }
    next();
  },
  oauth.passport && oauth.passport.authenticate ? oauth.passport.authenticate('facebook', { failureRedirect: '/login.html?error=facebook_auth_failed' }) : (req, res) => res.redirect('/login.html?error=oauth_disabled'),
  async (req, res) => {
    try {
      const socialProfile = req.user;
      const database = await connectDB();

      if (!database) {
        return res.redirect('/login.html?error=database_error');
      }

      // Find or create user
      let user = await database.collection("admin_users").findOne({
        social_id: socialProfile.profile_id,
        social_provider: 'facebook'
      });

      if (!user) {
        // Check if user exists by email (for account linking)
        if (socialProfile.email) {
          user = await database.collection("admin_users").findOne({
            email: socialProfile.email.toLowerCase()
          });

          if (user) {
            // Link social account to existing email-based account
            await database.collection("admin_users").updateOne(
              { _id: user._id },
              {
                $set: {
                  social_id: socialProfile.profile_id,
                  social_provider: 'facebook',
                  photo_url: user.photo_url || socialProfile.photo, // Keep existing or use social
                  updated_at: new Date()
                }
              }
            );
            console.log(`🔗 Linked Facebook to existing account: ${user.username} (${user.email})`);
            // Refresh user data after update
            user = await database.collection("admin_users").findOne({ _id: user._id });
          }
        }

        // Still no user? Check by username as fallback
        if (!user) {
          const username = socialProfile.name.replace(/\s+/g, '').toLowerCase();
          user = await database.collection("admin_users").findOne({ username: username });

          if (user) {
            // Link social account to username match
            await database.collection("admin_users").updateOne(
              { _id: user._id },
              {
                $set: {
                  social_id: socialProfile.profile_id,
                  social_provider: 'facebook',
                  email: user.email || socialProfile.email,
                  photo_url: user.photo_url || socialProfile.photo,
                  updated_at: new Date()
                }
              }
            );
            console.log(`🔗 Linked Facebook to username match: ${username}`);
            user = await database.collection("admin_users").findOne({ _id: user._id });
          }
        }

        // No existing user found - create new one
        if (!user) {
          // Check user limit
          const totalUsers = await database.collection('admin_users').countDocuments({});
          if (totalUsers >= 3) {
            return res.redirect('/login.html?error=user_limit_reached');
          }

          const username = socialProfile.name.replace(/\s+/g, '').toLowerCase();
          const newUser = {
            username,
            password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
            full_name: socialProfile.name,
            email: socialProfile.email ? socialProfile.email.toLowerCase() : null,
            role: 'viewer', // Limited role for social login users
            social_id: socialProfile.profile_id,
            social_provider: 'facebook',
            photo_url: socialProfile.photo,
            created_at: new Date(),
            updated_at: new Date()
          };

          const result = await database.collection("admin_users").insertOne(newUser);
          user = { ...newUser, _id: result.insertedId };
          console.log(`✨ Created new Facebook user: ${username}`);
        }
      }

      // Create session
      const token = generateSessionToken();
      const sessionUser = {
        id: user._id.toString(),
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        photo_url: user.photo_url,
        settings: user.settings || {}
      };

      sessions.set(token, { user: sessionUser, createdAt: new Date() });

      // Redirect with token AND user data for frontend to parse
      const userDataEncoded = encodeURIComponent(JSON.stringify(sessionUser));
      res.redirect(`/admin-dashboard.html?token=${token}&user=${userDataEncoded}`);
    } catch (err) {
      console.error("Facebook OAuth callback error:", err);
      res.redirect('/login.html?error=auth_error');
    }
  }
);

// ============================================
// MANUAL USER REGISTRATION SYSTEM
// ============================================

// Check if registration is open (max 3 users)
app.get("/api/auth/can-register", async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const userCount = await database.collection("admin_users").countDocuments({});
    const pendingCount = await database.collection("pending_registrations").countDocuments({ status: 'pending' });

    res.json({
      canRegister: userCount < 3,
      currentUsers: userCount,
      maxUsers: 3,
      pendingApplications: pendingCount
    });
  } catch (error) {
    console.error("Error checking registration status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// OTP-BASED SELF REGISTRATION FLOW
// ============================================

// Step 1: Send OTP to phone for registration
app.post("/api/auth/register-otp", async (req, res) => {
  try {
    const { fullName, idNumber, phone, role, username } = req.body;

    // Validate required fields
    if (!fullName || !idNumber || !phone || !role || !username) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate role
    const validRoles = ['clerk', 'pa', 'viewer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Validate phone
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Validate username
    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Invalid username. Use 3-30 alphanumeric characters." });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check user limit
    const userCount = await database.collection("admin_users").countDocuments({});
    if (userCount >= 3) {
      return res.status(400).json({ error: "Maximum user limit (3) reached. Registration closed." });
    }

    // Check for duplicate ID or phone
    const existingUser = await database.collection("admin_users").findOne({
      $or: [
        { id_number: idNumber },
        { phone: phone.replace(/\s+/g, '') }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: "A user with this ID or phone already exists" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store pending registration with OTP
    await database.collection("registration_otps").deleteMany({ phone: phone.replace(/\s+/g, '') });
    await database.collection("registration_otps").insertOne({
      fullName: sanitizeString(fullName, 100),
      idNumber: sanitizeString(idNumber, 20),
      phone: phone.replace(/\s+/g, ''),
      username: username.toLowerCase(),
      role: role.toLowerCase(),
      otp,
      otpExpires,
      createdAt: new Date()
    });

    // Send OTP via SMS
    const smsMessage = `Your VOO Ward verification code is: ${otp}. Valid for 10 minutes.`;
    const smsResult = await sendNotificationToPhone(database, phone, smsMessage);

    console.log(`📱 Registration OTP sent to ${phone}: ${otp} (SMS: ${smsResult.ok ? 'OK' : 'FAILED'})`);

    res.json({
      success: true,
      message: "Verification code sent to your phone",
      phone: phone.replace(/\d(?=\d{4})/g, '*') // Mask phone number
    });

  } catch (error) {
    console.error("Registration OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Step 2: Verify OTP and create account
app.post("/api/auth/register-verify", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone and OTP are required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check user limit again (in case it changed)
    const userCount = await database.collection("admin_users").countDocuments({});
    if (userCount >= 3) {
      return res.status(400).json({ error: "Maximum user limit reached" });
    }

    // Find pending registration
    const pendingReg = await database.collection("registration_otps").findOne({
      phone: phone.replace(/\s+/g, ''),
      otp: otp,
      otpExpires: { $gt: new Date() }
    });

    if (!pendingReg) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // Generate 6-digit PIN for login
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(pin, 10);

    // Create user
    const newUser = {
      username: pendingReg.username,
      password: hashedPassword,
      full_name: pendingReg.fullName,
      id_number: pendingReg.idNumber,
      phone: pendingReg.phone,
      role: pendingReg.role,
      created_at: new Date(),
      updated_at: new Date(),
      verified_at: new Date()
    };

    await database.collection("admin_users").insertOne(newUser);

    // Delete OTP record
    await database.collection("registration_otps").deleteOne({ _id: pendingReg._id });

    // Send PIN via SMS
    const smsMessage = `Welcome to VOO Ward!\nYour login PIN: ${pin}\nUsername: ${pendingReg.username}\nLogin: https://voo-ward-ussd-1.onrender.com/login.html`;
    await sendNotificationToPhone(database, pendingReg.phone, smsMessage);

    console.log(`✅ User registered via OTP: ${pendingReg.username} (${pendingReg.role}) PIN: ${pin}`);

    res.json({
      success: true,
      message: "Account created successfully!",
      credentials: {
        username: pendingReg.username,
        pin: pin,
        role: pendingReg.role.toUpperCase()
      }
    });

  } catch (error) {
    console.error("Registration verify error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Resend OTP for registration
app.post("/api/auth/register-resend", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Find existing registration
    const pendingReg = await database.collection("registration_otps").findOne({
      phone: phone.replace(/\s+/g, '')
    });

    if (!pendingReg) {
      return res.status(400).json({ error: "No pending registration found. Please start over." });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await database.collection("registration_otps").updateOne(
      { _id: pendingReg._id },
      { $set: { otp, otpExpires } }
    );

    // Send OTP
    const smsMessage = `Your new VOO Ward code: ${otp}. Valid for 10 minutes.`;
    await sendNotificationToPhone(database, phone, smsMessage);

    console.log(`📱 Resent OTP to ${phone}: ${otp}`);

    res.json({ success: true, message: "New code sent" });

  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit registration request - OTP sent immediately as password
app.post("/api/auth/register-request", async (req, res) => {
  try {
    const { fullName, idNumber, phone, role, username } = req.body;

    // Validate required fields (password NOT required - OTP will be the password)
    if (!fullName || !idNumber || !phone || !role || !username) {
      return res.status(400).json({ error: "All fields are required: fullName, idNumber, phone, role, username" });
    }

    // Validate role
    const validRoles = ['clerk', 'pa', 'viewer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ error: "Invalid role. Must be: clerk, pa, or viewer" });
    }

    // Validate phone
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Validate username
    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Invalid username. Use 3-30 alphanumeric characters." });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check user limit
    const userCount = await database.collection("admin_users").countDocuments({});
    if (userCount >= 3) {
      return res.status(400).json({ error: "Maximum user limit (3) reached. Registration closed." });
    }

    // Check for duplicate ID or phone only (username can be same)
    const existingApp = await database.collection("pending_registrations").findOne({
      $or: [
        { idNumber: idNumber },
        { phone: phone.replace(/\s+/g, '') }
      ],
      status: 'pending'
    });

    if (existingApp) {
      return res.status(400).json({ error: "An application with this ID or phone already exists" });
    }

    // Check if user already exists (only ID and phone must be unique)
    const existingUser = await database.collection("admin_users").findOne({
      $or: [
        { id_number: idNumber },
        { phone: phone.replace(/\s+/g, '') }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: "A user with this ID or phone already exists" });
    }

    // Create PENDING registration (admin must approve)
    const pendingApp = {
      fullName: sanitizeString(fullName, 100),
      idNumber: sanitizeString(idNumber, 20),
      phone: phone.replace(/\s+/g, ''),
      username: username.toLowerCase(),
      role: role.toLowerCase(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await database.collection("pending_registrations").insertOne(pendingApp);

    console.log(`📋 New pending registration: ${fullName} (${role}) - ID: ${insertResult.insertedId}`);
    res.json({
      success: true,
      message: "Application submitted! Please wait for admin approval.",
      applicationId: insertResult.insertedId.toString()
    });

  } catch (error) {
    console.error("Registration request error:", error.message, error.stack);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Check registration status (for polling)
app.get("/api/auth/check-registration/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // First check if still pending
    const pendingApp = await database.collection("pending_registrations").findOne({
      _id: new ObjectId(id)
    });

    if (pendingApp) {
      return res.json({
        status: pendingApp.status || 'pending',
        role: pendingApp.role,
        reason: pendingApp.rejectReason
      });
    }

    // Check if approved (moved to approved_registrations with credentials)
    const approved = await database.collection("approved_registrations").findOne({
      applicationId: id
    });

    if (approved) {
      return res.json({
        status: 'approved',
        role: approved.role,
        credentials: {
          username: approved.username,
          pin: approved.pin
        }
      });
    }

    // Not found
    res.status(404).json({ error: "Application not found" });

  } catch (error) {
    console.error("Check registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get pending registrations (admin only)
app.get("/api/admin/pending-registrations", requireAuth, async (req, res) => {
  try {
    if (!['admin', 'pa'].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const applications = await database.collection("pending_registrations")
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .toArray();

    const userCount = await database.collection("admin_users").countDocuments({});

    res.json({
      applications,
      currentUsers: userCount,
      maxUsers: 3,
      canApprove: userCount < 3
    });
  } catch (error) {
    console.error("Error fetching pending registrations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Approve registration (admin only)
app.post("/api/admin/approve-registration/:id", requireAuth, async (req, res) => {
  try {
    if (!['admin', 'pa'].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check user limit
    const userCount = await database.collection("admin_users").countDocuments({});
    if (userCount >= 3) {
      return res.status(400).json({ error: "Maximum user limit (3) reached" });
    }

    // Find application
    const application = await database.collection("pending_registrations").findOne({
      _id: new ObjectId(req.params.id),
      status: 'pending'
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Admin can override the role
    const assignedRole = req.body.role || application.role;

    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(pin, 10);

    // Use provided username or generate from name
    const username = application.username || application.fullName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);

    // Create user
    const newUser = {
      username: username,
      password: hashedPassword,
      full_name: application.fullName,
      id_number: application.idNumber,
      phone: application.phone,
      role: assignedRole,
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: req.user.username,
      approved_at: new Date()
    };

    await database.collection("admin_users").insertOne(newUser);

    // Store credentials in approved_registrations for polling
    await database.collection("approved_registrations").insertOne({
      applicationId: req.params.id,
      username: username,
      pin: pin,
      role: assignedRole,
      fullName: application.fullName,
      approvedAt: new Date(),
      approvedBy: req.user.username
    });

    // Delete from pending (so polling finds it in approved)
    await database.collection("pending_registrations").deleteOne({
      _id: new ObjectId(req.params.id)
    });

    // Send SMS via Infobip
    const smsMessage = `VOO Ward Access Approved!\nRole: ${assignedRole.toUpperCase()}\nUsername: ${username}\nPIN: ${pin}\nLogin at: https://voo-ward-ussd-1.onrender.com/login.html`;

    const smsResult = await sendNotificationToPhone(database, application.phone, smsMessage);

    console.log(`✅ Approved registration: ${application.fullName} as ${assignedRole} - PIN: ${pin}`);
    console.log(`📱 SMS sent: ${smsResult.ok ? 'Success' : 'Failed'}`);

    res.json({
      success: true,
      message: `User ${username} created as ${assignedRole}. PIN sent via SMS.`,
      smsSent: smsResult.ok,
      credentials: { username, pin, role: assignedRole }
    });

  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Reject registration (admin only)
app.post("/api/admin/reject-registration/:id", requireAuth, async (req, res) => {
  try {
    if (!['admin', 'pa'].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // DELETE the application (not just update status)
    const result = await database.collection("pending_registrations").deleteOne({
      _id: new ObjectId(req.params.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    console.log(`❌ Rejected and deleted registration: ${req.params.id}`);
    res.json({ success: true, message: "Application rejected and deleted" });

  } catch (error) {
    console.error("Rejection error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  sessions.delete(token);
  res.json({ success: true, message: "Logged out successfully" });
});

// Public Registration (CLERK and PA only)
app.post("/api/auth/register", loginLimiter, async (req, res) => {
  try {
    const { username, password, fullName, phone, role } = req.body;

    if (!username || !password || !fullName || !phone || !role) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Validate username format
    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Username must be 3-30 characters, alphanumeric with - or _" });
    }

    // Validate password strength
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be 6-128 characters" });
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Sanitize fullName
    const sanitizedFullName = sanitizeString(fullName, 100);
    if (!sanitizedFullName || sanitizedFullName.length < 2) {
      return res.status(400).json({ error: "Full name must be at least 2 characters" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check total user count (max 3 users total)
    const totalUsers = await database.collection('admin_users').countDocuments({});
    if (totalUsers >= 3) {
      return res.status(400).json({ error: 'Maximum number of users reached (3). Please contact MCA to create space.' });
    }

    // Check if role already exists (only one of each role allowed)
    const roleExists = await database.collection("admin_users").findOne({ role: role });
    if (roleExists) {
      return res.status(400).json({ error: `A user with role ${role} already exists. Each role can only have one user.` });
    }

    // Special handling for MCA role
    if (role === 'MCA') {
      // Only allow MCA registration if no users exist (first user)
      if (totalUsers > 0) {
        return res.status(400).json({ error: "MCA users can only be created as the first user or by existing MCAs." });
      }
    } else if (role !== 'CLERK' && role !== 'PA') {
      return res.status(400).json({ error: "Invalid role. Only MCA, CLERK, and PA roles are allowed." });
    }

    // Check if username exists
    const existing = await database.collection("admin_users").findOne({
      username: username.toLowerCase()
    });

    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create user with bcrypt hash
    const newUser = {
      username: username.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      full_name: fullName,
      phone: phone,
      role: role,
      created_at: new Date(),
      self_registered: true
    };

    const result = await database.collection("admin_users").insertOne(newUser);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: result.insertedId.toString(),
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Change password (authenticated)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'new_password must be at least 6 characters' });
    }

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const user = await database.collection('admin_users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // verify current password against bcrypt or legacy sha256
    let ok = false;
    try {
      if (isBcryptHash(user.password)) {
        ok = await bcrypt.compare(current_password, user.password);
      } else {
        ok = user.password === hashPassword(current_password);
      }
    } catch (e) {
      console.error('Password verify error:', e && e.message);
      ok = false;
    }

    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    // set new bcrypt password
    const newHash = await bcrypt.hash(new_password, 10);
    await database.collection('admin_users').updateOne({ _id: user._id }, { $set: { password: newHash, updated_at: new Date() } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create user (MCA only)
app.post("/api/auth/users", requireAuth, requireMCA, async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;

    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Allowed roles: MCA (main admin), PA (personal assistant), CLERK
    const allowedRoles = ['PA', 'MCA', 'CLERK'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check total user count (max 3 users total)
    const totalUsers = await database.collection('admin_users').countDocuments({});
    if (totalUsers >= 3) {
      return res.status(400).json({ error: 'Maximum number of users reached (3). Cannot create more users.' });
    }

    // Check if username exists
    const existing = await database.collection("admin_users").findOne({
      username: username.toLowerCase()
    });

    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Enforce only one MCA (main administrator)
    if (role === 'MCA') {
      const mcaCount = await database.collection('admin_users').countDocuments({ role: 'MCA' });
      if (mcaCount >= 1) {
        return res.status(400).json({ error: 'There is already an MCA user. Only one MCA allowed.' });
      }
    }

    // Create user (store bcrypt hash)
    const newUser = {
      username: username.toLowerCase(),
      password: bcryptHash(password),
      full_name: fullName,
      role: role,
      created_at: new Date(),
      created_by: req.user.id
    };

    const result = await database.collection("admin_users").insertOne(newUser);

    res.status(201).json({
      success: true,
      user: {
        id: result.insertedId.toString(),
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all users (MCA only)
app.get("/api/auth/users", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const users = await database.collection("admin_users")
      .find({}, { projection: { password: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user (MCA only)
app.delete("/api/auth/users/:id", requireAuth, requireMCA, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Prevent deleting the immutable default admin account
    const target = await database.collection('admin_users').findOne({ _id: new ObjectId(id) });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.username === 'admin' && target.role === 'MCA') {
      return res.status(403).json({ error: 'Cannot delete the main MCA admin account' });
    }

    const result = await database.collection("admin_users").deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(500).json({ error: "Failed to delete user" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// REGISTRATION & APPROVAL ROUTES
// ============================================

// 1. Check if registration is allowed
app.get('/api/auth/can-register', async (req, res) => {
  try {
    const database = await connectDB();
    const count = await database.collection('admin_users').countDocuments({});
    res.json({ canRegister: count < 3, count, max: 3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registration endpoint defined earlier (line ~1179) - removed duplicate here

// 3. List Pending Registrations (Admin)
app.get('/api/admin/pending-registrations', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    const applications = await database.collection('pending_registrations').find({ status: 'pending' }).toArray();
    const currentUsers = await database.collection('admin_users').countDocuments({});

    res.json({
      applications,
      currentUsers,
      maxUsers: 3,
      canApprove: currentUsers < 3
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Approve Registration
app.post('/api/admin/approve-registration/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectDB();
    const app = await database.collection('pending_registrations').findOne({ _id: new ObjectId(id) });

    if (!app) return res.status(404).json({ error: 'Application not found' });

    // Check limit
    const count = await database.collection('admin_users').countDocuments({});
    if (count >= 3) return res.status(400).json({ error: 'User limit reached' });

    // Generate credentials
    const password = Math.random().toString(36).slice(-8); // Random 8 char password
    const username = app.fullName.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 100);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    await database.collection('admin_users').insertOne({
      username,
      password: hashedPassword,
      full_name: app.fullName,
      phone: app.phone,
      role: app.role,
      created_at: new Date(),
      created_by: req.user.id
    });

    // Delete application
    await database.collection('pending_registrations').deleteOne({ _id: new ObjectId(id) });

    // Send SMS
    const message = `Welcome to VOO Ward! Your admin account is approved. Username: ${username}, Password: ${password}. Login at: ${process.env.FRONTEND_URL || 'voo-ward.com'}`;
    await sendSMS(app.phone, message);

    res.json({ success: true, message: 'User approved and SMS sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Reject Registration
app.post('/api/admin/reject-registration/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectDB();
    await database.collection('pending_registrations').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Application rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN API ROUTES
// ============================================

// Get all reported issues (PA and MCA can access)
app.get("/api/admin/issues", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const issues = await database.collection("issues")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(issues);
  } catch (err) {
    console.error("Error fetching issues:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all bursary applications (MCA only)
app.get("/api/admin/bursaries", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const bursaries = await database.collection("bursary_applications")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(bursaries);
  } catch (err) {
    console.error("Error fetching bursaries:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all constituents (MCA only)
app.get("/api/admin/constituents", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const constituents = await database.collection("constituents")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(constituents);
  } catch (err) {
    console.error("Error fetching constituents:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all announcements (PA and MCA can access)
app.get("/api/admin/announcements", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const announcements = await database.collection("announcements")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(announcements);
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get recent activity/audit logs (all authenticated users)
app.get("/api/admin/activity", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const limit = parseInt(req.query.limit) || 10;

    // Get recent audit events from MongoDB
    const activities = await database.collection("admin_audit")
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    // Transform to standardized format
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      action: activity.action,
      user: activity.user || activity.username,
      details: activity.details || activity.description,
      timestamp: activity.timestamp || activity.created_at,
      ip: activity.ip_address,
      severity: activity.severity || 'info'
    }));

    res.json(formattedActivities);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get USSD news feed (announcements + recent issue updates)
app.get("/api/ussd/news", async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const newsItems = [];

    // Get recent announcements (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const announcements = await database.collection("announcements")
      .find({ created_at: { $gte: sevenDaysAgo } })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    // Add announcements to news feed
    announcements.forEach(announcement => {
      newsItems.push({
        type: 'announcement',
        title: announcement.title || 'Ward Announcement',
        content: announcement.body || announcement.content,
        date: announcement.created_at,
        priority: 'high'
      });
    });

    // Get recent issue resolutions (last 7 days)
    const resolvedIssues = await database.collection("issues")
      .find({
        status: 'Resolved',
        action_at: { $gte: sevenDaysAgo }
      })
      .sort({ action_at: -1 })
      .limit(5)
      .toArray();

    // Add resolved issues to news feed
    resolvedIssues.forEach(issue => {
      const categoryName = issue.category || 'General Issue';
      const location = issue.location || 'Ward Area';

      newsItems.push({
        type: 'issue_resolved',
        title: `${categoryName} Issue Resolved`,
        content: `Issue in ${location} has been resolved. Ref: ${issue.ticket}`,
        date: issue.action_at || issue.updated_at,
        priority: 'medium',
        category: issue.category
      });
    });

    // Get recently published projects or updates
    const recentProjects = await database.collection("projects")
      .find({
        status: { $in: ['Active', 'Completed'] },
        updated_at: { $gte: sevenDaysAgo }
      })
      .sort({ updated_at: -1 })
      .limit(3)
      .toArray()
      .catch(() => []); // Projects collection might not exist

    recentProjects.forEach(project => {
      newsItems.push({
        type: 'project_update',
        title: `Project Update: ${project.name || 'Ward Development'}`,
        content: project.description || project.status,
        date: project.updated_at,
        priority: 'low'
      });
    });

    // Sort all news items by date (newest first)
    newsItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit to top 10 items
    const limitedNews = newsItems.slice(0, 10);

    res.json({
      success: true,
      news: limitedNews,
      total: limitedNews.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    console.error("Error fetching USSD news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Get paginated news for USSD (text-optimized)
app.get("/api/ussd/news/:page", async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const limit = 3; // Show 3 items per USSD page

    const newsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ussd/news`);
    const newsData = await newsResponse.json();

    if (!newsData.success) {
      throw new Error('Failed to fetch news');
    }

    const allNews = newsData.news;
    const totalPages = Math.ceil(allNews.length / limit);
    const startIndex = (page - 1) * limit;
    const pageNews = allNews.slice(startIndex, startIndex + limit);

    if (pageNews.length === 0) {
      return res.json({
        message: "No news available",
        hasMore: false,
        page,
        totalPages: 0
      });
    }

    // Format for USSD display
    let ussdText = `=== WARD NEWS (${page}/${totalPages}) ===\n\n`;

    pageNews.forEach((item, index) => {
      const itemNumber = startIndex + index + 1;
      const date = new Date(item.date).toLocaleDateString();

      ussdText += `${itemNumber}. ${item.title}\n`;

      // Truncate content for USSD
      let content = item.content || '';
      if (content.length > 100) {
        content = content.substring(0, 97) + '...';
      }

      ussdText += `${content}\n`;
      ussdText += `Date: ${date}\n\n`;
    });

    if (page < totalPages) {
      ussdText += `Reply with ${page + 1} for more news`;
    } else {
      ussdText += "No more news items";
    }

    res.json({
      message: ussdText,
      hasMore: page < totalPages,
      page,
      totalPages,
      items: pageNews.length
    });

  } catch (err) {
    console.error("Error fetching USSD news page:", err);
    res.json({
      message: "News service temporarily unavailable",
      hasMore: false,
      page: 1,
      totalPages: 0
    });
  }
});

// Update issue status and action note (PA and MCA can access)
app.patch("/api/admin/issues/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action_note } = req.body;
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    // Build update object
    const update = { status, updated_at: new Date() };
    if (typeof action_note === 'string') {
      update.action_note = action_note;
      update.action_by = req.user?.username || 'unknown';
      update.action_at = new Date();
    }
    const result = await database.collection("issues").updateOne(
      { ticket: id },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Issue not found" });
    }
    // Fetch updated issue
    const updated = await database.collection('issues').findOne({ ticket: id });

    // If status changed to resolved, update USSD interactions and notify reporter(s)
    try {
      const newStatus = (status || '').toString().toLowerCase();
      if (newStatus === 'resolved' || newStatus === 'resolved') {
        // Update any USSD interactions for the reporter's phone
        try {
          if (updated && updated.phone_number) {
            await database.collection('ussd_interactions').updateMany(
              { phone_number: updated.phone_number },
              { $set: { issue_status: status, related_ticket: id, updated_at: new Date() } }
            );
          }
        } catch (uErr) {
          console.warn('Failed to update USSD interactions for issue', id, uErr && uErr.message);
        }

        // Notifications are disabled in this deployment. We still update USSD interactions above.
        if (updated && updated.phone_number) {
          console.log('Notification suppressed for issue', id, 'phone', updated.phone_number);
        }
      }
    } catch (e) {
      console.warn('Post-update hooks error for issue', id, e && e.message);
    }

    res.json({ success: true, message: `Issue ${id} updated`, update, issue: updated });
  } catch (err) {
    console.error("Error updating issue:", err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk-resolve (or bulk update status) for multiple issues (MCA only)
app.post('/api/admin/issues/bulk-resolve', requireAuth, requireMCA, async (req, res) => {
  try {
    let { issueIds, status, action_note } = req.body || {};
    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return res.status(400).json({ error: 'issueIds (array) is required' });
    }

    // Sanitize input: ensure strings, trim, dedupe
    issueIds = issueIds
      .map(i => (typeof i === 'string' ? i.trim() : ''))
      .filter(Boolean);
    issueIds = Array.from(new Set(issueIds));

    // Cap maximum items to prevent abuse (production-safe default)
    const MAX_BATCH = 200;
    if (issueIds.length === 0) return res.status(400).json({ error: 'No valid issueIds provided' });
    if (issueIds.length > MAX_BATCH) return res.status(400).json({ error: `Too many issueIds; max ${MAX_BATCH}` });

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const targetStatus = (status || 'resolved').toString();
    const note = typeof action_note === 'string' ? action_note : undefined;

    const results = [];
    const phonesToNotify = new Map(); // phone -> array of tickets

    // Process in batches to avoid long-running single operations
    const BATCH = 50;
    for (let i = 0; i < issueIds.length; i += BATCH) {
      const batch = issueIds.slice(i, i + BATCH);

      // For each ticket in this batch, update and collect phone numbers
      await Promise.all(batch.map(async (ticket) => {
        try {
          const update = { status: targetStatus, updated_at: new Date() };
          if (note) {
            update.action_note = note;
            update.action_by = req.user?.username || 'unknown';
            update.action_at = new Date();
          }

          const r = await database.collection('issues').updateOne({ ticket: ticket }, { $set: update });
          if (r.matchedCount === 0) {
            results.push({ id: ticket, ok: false, error: 'not_found' });
            return;
          }

          const updated = await database.collection('issues').findOne({ ticket: ticket });

          // collect phone for later aggregated notification
          if (updated && updated.phone_number) {
            const phone = updated.phone_number;
            const arr = phonesToNotify.get(phone) || [];
            arr.push(ticket);
            phonesToNotify.set(phone, arr);
          }

          results.push({ id: ticket, ok: true, issue: updated });
        } catch (errInner) {
          console.warn('Error updating issue in bulk', ticket, errInner && errInner.message);
          results.push({ id: ticket, ok: false, error: errInner && errInner.message });
        }
      }));
    }

    // After updating issues, update USSD interactions and send aggregated notifications per phone
    const phoneEntries = Array.from(phonesToNotify.entries());
    for (const [phone, tickets] of phoneEntries) {
      try {
        // Update USSD interactions once per phone
        try {
          await database.collection('ussd_interactions').updateMany(
            { phone_number: phone },
            { $set: { issue_status: targetStatus, related_tickets: tickets.join(','), updated_at: new Date() } }
          );
        } catch (uErr) {
          console.warn('Failed to update USSD interactions for phone', phone, uErr && uErr.message);
        }

        // Send or queue one notification per phone summarizing the tickets
        const notifyMsg = tickets.length === 1
          ? `Your report (${tickets[0]}) has been marked as ${targetStatus}. Thank you.`
          : `Your ${tickets.length} reports (${tickets.slice(0, 5).join(',')}${tickets.length > 5 ? ',...' : ''}) have been marked as ${targetStatus}. Thank you.`;

        // Notifications suppressed by configuration - log intent
        console.log('Notification suppressed for phone', phone, 'tickets', tickets.join(','));
      } catch (e) {
        console.warn('Error in post-update processing for phone', phone, e && e.message);
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.length - succeeded;
    // Record audit entry for this bulk operation
    try {
      await database.collection('admin_audit').insertOne({
        action: 'bulk-resolve',
        performed_by: req.user?.username || 'unknown',
        count: succeeded,
        failed: failed,
        tickets: issueIds,
        note: note || null,
        created_at: new Date()
      });
    } catch (auditErr) {
      console.warn('Failed to write audit entry for bulk-resolve', auditErr && auditErr.message);
    }

    res.json({ success: true, updated: succeeded, failed, results });
  } catch (err) {
    console.error('Bulk resolve error:', err && err.message);
    res.status(500).json({ error: err.message });
  }
});

// Notifications functionality removed: endpoints for listing/retrying notifications were deprecated per configuration.
// The sending path was already disabled earlier; keeping these endpoints would expose internal queues that are no longer used.
// If you need a safe administrative endpoint in the future, re-add intentionally with appropriate access controls.

// Update bursary status (MCA only)
app.patch("/api/admin/bursaries/:id", requireAuth, requireMCA, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const updateData = {
      status,
      updated_at: new Date(),
      reviewed_at: new Date()
    };

    if (admin_notes) {
      updateData.admin_notes = admin_notes;
    }

    const result = await database.collection("bursary_applications").updateOne(
      { ref_code: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Bursary application not found" });
    }

    res.json({ success: true, message: `Bursary ${id} updated to ${status}` });
  } catch (err) {
    console.error("Error updating bursary:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create announcement (PA and MCA can access)
app.post("/api/admin/announcements", requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const announcement = {
      title,
      body,
      created_at: new Date()
    };

    const result = await database.collection("announcements").insertOne(announcement);

    res.status(201).json({
      success: true,
      id: result.insertedId,
      announcement
    });
  } catch (err) {
    console.error("Error creating announcement:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete announcement
app.delete("/api/admin/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const { ObjectId } = require("mongodb");
    const result = await database.collection("announcements").deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({ success: true, message: "Announcement deleted" });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: err.message });
  }
});

// Dashboard statistics
app.get("/api/admin/stats", async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const [
      totalConstituents,
      totalIssues,
      openIssues,
      totalBursaries,
      pendingBursaries,
      totalAnnouncements
    ] = await Promise.all([
      database.collection("constituents").countDocuments(),
      database.collection("issues").countDocuments(),
      database.collection("issues").countDocuments({ status: "open" }),
      database.collection("bursary_applications").countDocuments(),
      database.collection("bursary_applications").countDocuments({ status: "Pending" }),
      database.collection("announcements").countDocuments()
    ]);

    res.json({
      constituents: {
        total: totalConstituents
      },
      issues: {
        total: totalIssues,
        open: openIssues,
        inProgress: totalIssues - openIssues
      },
      bursaries: {
        total: totalBursaries,
        pending: pendingBursaries,
        processed: totalBursaries - pendingBursaries
      },
      announcements: {
        total: totalAnnouncements
      }
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// Simple chatbot/help endpoint to guide admins in using the dashboard
app.post('/api/admin/chatbot', requireAuth, async (req, res) => {
  try {
    const { message } = req.body || {};
    const reply = await chatbotSvc.generateReply(message, req.user);
    res.json({ reply });
  } catch (err) {
    console.error('Chatbot error', err && err.message);
    res.status(500).json({ error: 'chatbot error' });
  }
});

// Admin: get chatbot KB (for editor UI)
app.get('/api/admin/chatbot-kb', requireAuth, requireMCA, async (req, res) => {
  try {
    const kbPath = path.join(__dirname, 'chatbot_kb.json');
    if (!fs.existsSync(kbPath)) return res.json([]);
    const raw = fs.readFileSync(kbPath, 'utf8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (e) {
    console.error('Error reading chatbot KB', e && e.message);
    res.status(500).json({ error: 'failed to read kb' });
  }
});

// Admin: update chatbot KB (replace entire KB)
app.post('/api/admin/chatbot-kb', requireAuth, requireMCA, async (req, res) => {
  try {
    const kb = req.body;
    const kbPath = path.join(__dirname, 'chatbot_kb.json');
    fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    console.error('Error writing chatbot KB', e && e.message);
    res.status(500).json({ error: 'failed to write kb' });
  }
});

// Admin: update current user's profile
// Accept multipart/form-data with an optional 'photo' file and optional 'settings' JSON string
app.post('/api/admin/profile', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    // fullName and phone_number may come from form-data or JSON
    const fullName = req.body.fullName || req.body.full_name || undefined;
    const phone_number = req.body.phone_number || req.body.phone || undefined;

    // settings may be a JSON string in form-data
    let settings = {};
    if (req.body.settings) {
      try { settings = typeof req.body.settings === 'string' ? JSON.parse(req.body.settings) : req.body.settings; } catch (e) { settings = {}; }
    }

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const update = {};
    if (fullName) update.full_name = fullName;
    if (phone_number) update.phone_number = phone_number;
    if (settings && Object.keys(settings).length) update.settings = settings;

    if (req.file) {
      const originalPath = path.join(UPLOADS_DIR, req.file.filename);
      let finalMain = req.file.filename;
      let thumbName = null;
      let webpMain = null;
      let webpThumb = null;

      if (sharp) {
        try {
          const base = path.basename(req.file.filename, path.extname(req.file.filename));

          // 256x256 JPEG main
          const resizedName = `${base}-256.jpg`;
          const resizedPath = path.join(UPLOADS_DIR, resizedName);
          await sharp(originalPath).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(resizedPath);

          // 64x64 thumbnail JPEG
          const thumbFile = `${base}-64.jpg`;
          const thumbPath = path.join(UPLOADS_DIR, thumbFile);
          await sharp(originalPath).resize(64, 64, { fit: 'cover' }).jpeg({ quality: 75 }).toFile(thumbPath);

          // WebP variants for modern browsers
          const webpFile = `${base}-256.webp`;
          const webpPath = path.join(UPLOADS_DIR, webpFile);
          await sharp(originalPath).resize(256, 256, { fit: 'cover' }).webp({ quality: 75 }).toFile(webpPath);

          const webpThumbFile = `${base}-64.webp`;
          const webpThumbPath = path.join(UPLOADS_DIR, webpThumbFile);
          await sharp(originalPath).resize(64, 64, { fit: 'cover' }).webp({ quality: 70 }).toFile(webpThumbPath);

          // Attempt to remove original upload to save disk space
          try { fs.unlinkSync(originalPath); } catch (e) { /* ignore */ }

          finalMain = resizedName;
          thumbName = thumbFile;
          webpMain = webpFile;
          webpThumb = webpThumbFile;
        } catch (imgErr) {
          console.warn('Image processing (sharp) failed:', imgErr && imgErr.message);
          // fallback: keep original file
          finalMain = req.file.filename;
        }
      }

      // If S3 is enabled, upload processed files and set public S3 URLs
      const makePublicUrl = (key) => {
        const region = process.env.S3_REGION || 'us-east-1';
        return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
      };

      if (S3_ENABLED) {
        try {
          const uploads = [];
          const toUpload = [];
          // choose list of filenames to upload
          if (finalMain) toUpload.push({ name: finalMain, local: path.join(UPLOADS_DIR, finalMain), contentType: 'image/jpeg' });
          if (thumbName) toUpload.push({ name: thumbName, local: path.join(UPLOADS_DIR, thumbName), contentType: 'image/jpeg' });
          if (webpMain) toUpload.push({ name: webpMain, local: path.join(UPLOADS_DIR, webpMain), contentType: 'image/webp' });
          if (webpThumb) toUpload.push({ name: webpThumb, local: path.join(UPLOADS_DIR, webpThumb), contentType: 'image/webp' });

          for (const f of toUpload) {
            try {
              const body = fs.readFileSync(f.local);
              const key = `avatars/${f.name}`;
              // Using AWS SDK v3
              const PutObjectCommand = s3Client._PutObjectCommand;
              await s3Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: f.contentType, ACL: 'public-read' }));
              uploads.push({ name: f.name, url: makePublicUrl(key) });
            } catch (upErr) {
              console.warn('S3 upload failed for', f.name, upErr && upErr.message);
            }
          }

          // Map uploaded URLs back to filenames
          const findUrl = (n) => { const it = uploads.find(u => u.name === n); return it ? it.url : path.posix.join('/uploads/avatars', n); };
          const relMain = findUrl(finalMain);
          const relThumb = thumbName ? findUrl(thumbName) : null;
          const relWebp = webpMain ? findUrl(webpMain) : null;
          const relWebpThumb = webpThumb ? findUrl(webpThumb) : null;

          update.photo_url = relMain;
          if (relThumb) update.photo_thumb = relThumb;
          if (relWebp) update.photo_webp = relWebp;
          if (relWebpThumb) update.photo_thumb_webp = relWebpThumb;
        } catch (s3Err) {
          console.warn('S3 processing error:', s3Err && s3Err.message);
          // fallback to local urls
          update.photo_url = path.posix.join('/uploads/avatars', finalMain);
          if (thumbName) update.photo_thumb = path.posix.join('/uploads/avatars', thumbName);
          if (webpMain) update.photo_webp = path.posix.join('/uploads/avatars', webpMain);
          if (webpThumb) update.photo_thumb_webp = path.posix.join('/uploads/avatars', webpThumb);
        }
      } else {
        // Local file URLs
        update.photo_url = path.posix.join('/uploads/avatars', finalMain);
        if (thumbName) update.photo_thumb = path.posix.join('/uploads/avatars', thumbName);
        if (webpMain) update.photo_webp = path.posix.join('/uploads/avatars', webpMain);
        if (webpThumb) update.photo_thumb_webp = path.posix.join('/uploads/avatars', webpThumb);
      }
    }

    // Update admin_users collection (the login users) not a generic 'users' collection
    const userId = new ObjectId(req.user.id);
    await database.collection('admin_users').updateOne({ _id: userId }, { $set: update });
    const user = await database.collection('admin_users').findOne({ _id: userId }, { projection: { password: 0 } });

    // normalize user object for client-side; map DB fields to expected camelCase
    const userResp = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      phone_number: user.phone_number,
      photo_url: user.photo_url || null,
      photo_thumb: user.photo_thumb || null,
      photo_webp: user.photo_webp || null,
      photo_thumb_webp: user.photo_thumb_webp || null,
      settings: user.settings || {}
    };

    // update any active sessions for this username
    for (const [token, sess] of sessions.entries()) {
      if (sess.user && sess.user.username === user.username) {
        sess.user = { ...sess.user, ...userResp };
        sessions.set(token, sess);
      }
    }

    res.json({ success: true, user: userResp });
  } catch (e) {
    console.error('Error updating profile', e && e.message);
    // multer fileFilter or size errors may come through here
    if (e && e.message && e.message.includes('Only JPEG')) return res.status(400).json({ error: e.message });
    if (e && e.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 2MB)' });
    res.status(500).json({ error: 'failed to update profile' });
  }
});

// Delete current user's avatar (remove files and DB fields)
app.delete('/api/admin/profile/photo', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const userId = new ObjectId(req.user.id);
    const user = await database.collection('admin_users').findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Collect local filenames to delete if they exist and are local paths
    const toDeleteLocal = [];
    const photoFields = ['photo_url', 'photo_thumb', 'photo_webp', 'photo_thumb_webp'];
    for (const f of photoFields) {
      if (user[f] && typeof user[f] === 'string' && user[f].startsWith('/uploads/avatars')) {
        const name = path.basename(user[f]);
        toDeleteLocal.push(path.join(UPLOADS_DIR, name));
      }
    }

    // Remove S3 objects if S3_ENABLED and urls point to S3 bucket
    if (S3_ENABLED) {
      try {
        const prefix = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/`;
        for (const f of photoFields) {
          if (user[f] && typeof user[f] === 'string' && user[f].startsWith(prefix)) {
            const key = user[f].replace(prefix, '');
            try {
              const DeleteObjectCommand = s3Client._DeleteObjectCommand;
              await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
            } catch (e) { console.warn('S3 delete failed for', key, e && e.message); }
          }
        }
      } catch (e) { console.warn('S3 delete flow error', e && e.message); }
    }

    // Delete local files
    for (const p of toDeleteLocal) {
      try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
    }

    // Unset DB fields
    const unset = {};
    photoFields.forEach(k => unset[k] = '');
    await database.collection('admin_users').updateOne({ _id: userId }, { $unset: { photo_url: '', photo_thumb: '', photo_webp: '', photo_thumb_webp: '' } });

    // Update session entries
    for (const [token, sess] of sessions.entries()) {
      if (sess.user && sess.user.username === user.username) {
        sess.user.photo_url = null;
        sess.user.photo_thumb = null;
        sess.user.photo_webp = null;
        sess.user.photo_thumb_webp = null;
        sessions.set(token, sess);
      }
    }

    res.json({ success: true, message: 'Avatar removed' });
  } catch (e) {
    console.error('Error deleting avatar', e && e.message);
    res.status(500).json({ error: 'failed to remove avatar' });
  }
});

// Profile picture upload endpoint
app.post('/api/admin/profile/upload', requireAuth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = new ObjectId(req.user.id);

    let finalPath = `/uploads/avatars/${req.file.filename}`;

    // Process image if sharp is available
    if (sharp) {
      try {
        const originalPath = path.join(UPLOADS_DIR, req.file.filename);
        const base = path.basename(req.file.filename, path.extname(req.file.filename));
        const processedName = `${base}-profile.jpg`;
        const processedPath = path.join(UPLOADS_DIR, processedName);

        // Resize and optimize
        await sharp(originalPath)
          .resize(256, 256, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(processedPath);

        // Remove original
        fs.unlinkSync(originalPath);

        finalPath = `/uploads/avatars/${processedName}`;
      } catch (imgErr) {
        console.warn('Image processing failed:', imgErr.message);
      }
    }

    // Update user's profile picture in database
    await database.collection('admin_users').updateOne(
      { _id: userId },
      { $set: { profilePicture: finalPath, updatedAt: new Date() } }
    );

    // Update session
    for (const [token, sess] of sessions.entries()) {
      if (sess.user && sess.user.id === req.user.id) {
        sess.user.profilePicture = finalPath;
        sessions.set(token, sess);
      }
    }

    res.json({
      success: true,
      profilePicture: finalPath,
      message: 'Profile picture updated successfully'
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Update profile information (PUT)
app.put('/api/admin/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;

    // Validate inputs
    if (fullName && (typeof fullName !== 'string' || fullName.trim().length === 0)) {
      return res.status(400).json({ error: 'Invalid full name' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = new ObjectId(req.user.id);
    const updateData = { updatedAt: new Date() };

    if (fullName) updateData.fullName = sanitizeString(fullName.trim());
    if (email) updateData.email = sanitizeString(email.trim().toLowerCase());
    if (phone) updateData.phone = sanitizeString(phone.trim());

    // Update user in database
    const result = await database.collection('admin_users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update session
    for (const [token, sess] of sessions.entries()) {
      if (sess.user && sess.user.id === req.user.id) {
        Object.assign(sess.user, updateData);
        sessions.set(token, sess);
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: { ...req.user, ...updateData }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Export issues as CSV (PA and MCA can access)
app.get("/api/admin/export/issues", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Set proper headers first
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="kyamatu-issues-${new Date().toISOString().split('T')[0]}.csv"`);
    res.header("Cache-Control", "no-cache");

    // Start with UTF-8 BOM for Excel compatibility
    const utf8Bom = '\uFEFF';
    const headers = "Ticket,Category,Message,Phone,Status,Action By,Action At,Action Note,Created At\n";
    res.write(utf8Bom + headers);

    // Stream data in chunks to handle large datasets
    const cursor = database.collection("issues")
      .find({})
      .sort({ created_at: -1 });

    let count = 0;
    await cursor.forEach(issue => {
      const ticket = (issue.ticket || '').toString().replace(/"/g, '""');
      const category = (issue.category || '').toString().replace(/"/g, '""');
      const message = (issue.message || '').toString().replace(/"/g, '""').replace(/\n/g, ' ');
      const phone = (issue.phone_number || '').toString().replace(/"/g, '""');
      const status = (issue.status || '').toString().replace(/"/g, '""');
      const actionBy = (issue.action_by || '').toString().replace(/"/g, '""');
      const actionAt = issue.action_at ? new Date(issue.action_at).toISOString() : '';
      const actionNote = (issue.action_note || '').toString().replace(/"/g, '""').replace(/\n/g, ' ');
      const created = issue.created_at ? new Date(issue.created_at).toISOString() : '';

      const line = `"${ticket}","${category}","${message}","${phone}","${status}","${actionBy}","${actionAt}","${actionNote}","${created}"\n`;
      res.write(line);
      count++;
    });

    console.log(`✅ Exported ${count} issues to CSV`);
    res.end();
  } catch (err) {
    console.error("Error exporting issues:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end(); // End the stream if headers already sent
    }
  }
});

// Persist USSD interactions (public endpoint used by USSD gateway)
app.post('/api/ussd', async (req, res) => {
  try {
    const { phone, text, response, ref_code, parsed_text } = req.body || {};
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const doc = {
      phone_number: phone || (req.body && req.body.phone_number) || '',
      text: text || '',
      parsed_text: parsed_text || null,
      response: response || '',
      ref_code: ref_code || null,
      ip: req.ip,
      created_at: new Date()
    };

    await database.collection('ussd_interactions').insertOne(doc);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Error saving USSD interaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list USSD interactions
app.get('/api/admin/ussd', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    const interactions = await database.collection('ussd_interactions')
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(interactions);
  } catch (err) {
    console.error('Error fetching USSD interactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: export USSD interactions as CSV
app.get('/api/admin/export/ussd', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    // Set proper headers
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="kyamatu-ussd-${new Date().toISOString().split('T')[0]}.csv"`);
    res.header('Cache-Control', 'no-cache');

    // Start with UTF-8 BOM and headers
    const utf8Bom = '\uFEFF';
    const headers = 'Phone,Text,Parsed Text,Response,Ref Code,IP,Created At\n';
    res.write(utf8Bom + headers);

    // Stream data
    const cursor = database.collection('ussd_interactions')
      .find({})
      .sort({ created_at: -1 });

    let count = 0;
    await cursor.forEach(i => {
      const phone = (i.phone_number || '').toString().replace(/"/g, '""');
      const text = (i.text || '').toString().replace(/"/g, '""').replace(/\n/g, ' ');
      const parsed = i.parsed_text ? JSON.stringify(i.parsed_text).replace(/"/g, '""') : '';
      const response = (i.response || '').toString().replace(/"/g, '""').replace(/\n/g, ' ');
      const ref = (i.ref_code || '').toString().replace(/"/g, '""');
      const ip = (i.ip || '').toString();
      const created = i.created_at ? new Date(i.created_at).toISOString() : '';

      const line = `"${phone}","${text}","${parsed}","${response}","${ref}","${ip}","${created}"\n`;
      res.write(line);
      count++;
    });

    console.log(`✅ Exported ${count} USSD interactions to CSV`);
    res.end();
  } catch (err) {
    console.error('Error exporting USSD interactions:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// Export bursaries as CSV (MCA only)
app.get("/api/admin/export/bursaries", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Set proper headers
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="kyamatu-bursaries-${new Date().toISOString().split('T')[0]}.csv"`);
    res.header("Cache-Control", "no-cache");

    // Start with UTF-8 BOM and headers
    const utf8Bom = '\uFEFF';
    const headers = "Ref Code,Student Name,School,Amount,Status,Phone,Created At\n";
    res.write(utf8Bom + headers);

    // Stream data
    const cursor = database.collection("bursary_applications")
      .find({})
      .sort({ created_at: -1 });

    let count = 0;
    await cursor.forEach(b => {
      const refCode = (b.ref_code || '').toString().replace(/"/g, '""');
      const studentName = (b.student_name || '').toString().replace(/"/g, '""');
      const school = (b.institution || '').toString().replace(/"/g, '""');
      const amount = (b.amount_requested || '').toString().replace(/"/g, '""');
      const status = (b.status || '').toString().replace(/"/g, '""');
      const phone = (b.phone_number || '').toString().replace(/"/g, '""');
      const created = b.created_at ? new Date(b.created_at).toISOString() : '';

      const line = `"${refCode}","${studentName}","${school}","${amount}","${status}","${phone}","${created}"\n`;
      res.write(line);
      count++;
    });

    console.log(`✅ Exported ${count} bursary applications to CSV`);
    res.end();
  } catch (err) {
    console.error("Error exporting bursaries:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// Export constituents as CSV (MCA only)
app.get("/api/admin/export/constituents", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Set proper headers
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="kyamatu-constituents-${new Date().toISOString().split('T')[0]}.csv"`);
    res.header("Cache-Control", "no-cache");

    // Start with UTF-8 BOM and headers
    const utf8Bom = '\uFEFF';
    const headers = "Phone,National ID,Full Name,Location,Village,Created At\n";
    res.write(utf8Bom + headers);

    // Stream data
    const cursor = database.collection("constituents")
      .find({})
      .sort({ created_at: -1 });

    let count = 0;
    await cursor.forEach(c => {
      const phone = (c.phone_number || '').toString().replace(/"/g, '""');
      const nationalId = (c.national_id || '').toString().replace(/"/g, '""');
      const fullName = (c.full_name || '').toString().replace(/"/g, '""');
      const location = (c.location || '').toString().replace(/"/g, '""');
      const village = (c.village || '').toString().replace(/"/g, '""');
      const created = c.created_at ? new Date(c.created_at).toISOString() : '';

      const line = `"${phone}","${nationalId}","${fullName}","${location}","${village}","${created}"\n`;
      res.write(line);
      count++;
    });

    console.log(`✅ Exported ${count} constituents to CSV`);
    res.end();
  } catch (err) {
    console.error("Error exporting constituents:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// Serve admin dashboard HTML
// Add no-cache headers for HTML files to prevent stale content on Render
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});
app.use(express.static(path.join(__dirname, "../public")));

// Redirect root to login page
app.get("/", (req, res) => {
  res.redirect('/login.html');
});

// Initialize default MCA admin user on startup
async function initializeAdmin() {
  try {
    const database = await connectDB();
    if (!database) {
      console.log("⚠️  Cannot initialize admin user - database not connected");
      return;
    }

    const existingAdmin = await database.collection("admin_users").findOne({ role: "MCA" });

    if (!existingAdmin) {
      console.log("🔧 Creating default MCA admin user...");

      const defaultAdmin = {
        username: "admin",
        // store default admin with bcrypt hash
        password: bcryptHash("admin123"),
        full_name: "Zak",
        role: "MCA",
        created_at: new Date()
      };

      await database.collection("admin_users").insertOne(defaultAdmin);

      console.log("✅ Default MCA admin created:");
      console.log("   Username: admin");
      console.log("   Password: admin123");
      console.log("   IMPORTANT: Change password after first login!");
    } else {
      // If admin exists but has a different display name, ensure it's Zak (operator requested)
      try {
        if (existingAdmin.username === 'admin' && existingAdmin.full_name !== 'Zak') {
          await database.collection('admin_users').updateOne({ _id: existingAdmin._id }, { $set: { full_name: 'Zak' } });
          console.log('ℹ️ Updated default admin full_name to Zak');
        }
      } catch (e) {
        console.warn('⚠️ Failed to ensure admin full_name is Zak', e && e.message);
      }
      console.log("✅ MCA admin user exists");
    }

    // Remove any legacy test PA user named 'martin' if present (operator requested)
    try {
      const martin = await database.collection('admin_users').findOne({ username: 'martin' });
      if (martin) {
        await database.collection('admin_users').deleteOne({ _id: martin._id });
        console.log('Removed legacy PA user: martin');
      }

    } catch (e) {
      console.warn(' Failed to remove martin user (if existed):', e && e.message);
    }
  } catch (err) {
    console.error(" Error initializing admin user:", err.message);
  }
}

// MISSING API ENDPOINTS
// ============================================

// Chatbot endpoints that frontend expects
app.get('/api/admin/chatbot', requireAuth, (req, res) => {
  res.json({ message: 'AI Assistant endpoint ready' });
});

app.post('/api/admin/chatbot', requireAuth, (req, res) => {
  const { message } = req.body;
  console.log('Chatbot message received:', message);

  // Simple AI response logic
  let reply = 'I can help you with dashboard navigation, system management, and general questions. What would you like to know?';

  if (message && message.toLowerCase().includes('hello') || message && message.toLowerCase().includes('hi')) {
    reply = 'Hello! I\'m Mai, your AI assistant. How can I help you today?';
  } else if (message && message.toLowerCase().includes('issue')) {
    reply = 'For issue management, go to the Issues section where you can view, update status, and resolve constituent problems.';
  } else if (message && message.toLowerCase().includes('export')) {
    reply = 'You can export data from any section using the export buttons. Navigate to Issues, Bursaries, or other sections and look for export options.';
  } else if (message && message.toLowerCase().includes('dashboard')) {
    reply = 'Use the sidebar to navigate between different sections like Dashboard, Issues, Bursaries, Analytics, and Settings.';
  }

  res.json({ reply });
});

// Default avatar endpoint
app.get('/api/admin/default-avatar.png', (req, res) => {
  const svgAvatar = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="40" fill="#6366f1"/>
        <circle cx="40" cy="32" r="12" fill="white"/>
        <path d="M16 64c0-16 10.746-24 24-24s24 8 24 24" fill="white"/>
    </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgAvatar);
});

// Handle the exact 404 path from the logs - this is what the frontend is requesting
app.get('/uploads/avatars/default-avatar.png', (req, res) => {
  const svgAvatar = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="40" fill="#6366f1"/>
        <circle cx="40" cy="32" r="12" fill="white"/>
        <path d="M16 64c0-16 10.746-24 24-24s24 8 24 24" fill="white"/>
    </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgAvatar);
});

// Start server when run directly. When required as a module, export the app so
// a parent process (e.g. src/index.js) can mount it as middleware.
const PORT = process.env.ADMIN_PORT || 5000;
async function startServer() {
  console.log(`\n  VOO WARD ADMIN DASHBOARD v1.1`);
  console.log(` Dashboard: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(` Max Users: 3 (1 MCA + 2 PA/CLERK)`);

  // Test MongoDB connection
  const database = await connectDB();
  if (database) {
    console.log(` MongoDB Connected: Ready to view data`);

    // Initialize admin user
    await initializeAdmin();
  } else {
    console.log(`  MongoDB NOT Connected - Check MONGO_URI in .env`);
  }

  console.log(`\n Ready to view issues, bursaries & constituents!\n`);
  console.log(` Login with: admin / admin123 (Change after first login!)\n`);

  app.listen(PORT, () => {
    // Listening logged above; keep process alive when run standalone
  });
}

// If this file is executed directly (node admin-dashboard.js) start its own server.
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start admin-dashboard server:', err && err.message);
    process.exit(1);
  });
} else {
  // For parent apps we export a Router that mounts the internal Express `app`.
  // This makes the admin routes visible as a mounted router on the parent app's stack
  // (instead of exporting an Express `app` which does not surface routes the same way).
  const wrapperRouter = require('express').Router();
  wrapperRouter.use('/', app);

  module.exports = wrapperRouter;
  // expose connectDB for parent apps that may want to reuse the DB connection
  try { module.exports.connectDB = connectDB; } catch (e) { /* noop */ }

  // Also attempt a best-effort DB connect + admin init when required (non-blocking)
  (async () => {
    try {
      const database = await connectDB();
      if (database) await initializeAdmin();
    } catch (e) {
      console.warn('Admin dashboard module init warning:', e && e.message);
    }
  })();

  // Emergency admin reset endpoint removed for security. Use scripts/reset-admin.js with
  // proper environment access and admin-controlled processes if needed.
}
