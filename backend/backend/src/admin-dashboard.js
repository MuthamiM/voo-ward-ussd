const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
// bcrypt for secure password hashing and migration from legacy SHA-256
const bcrypt = require('bcryptjs');

// Load environment variables
require("dotenv").config();
const chatbotSvc = require('./chatbot');

// Feature flag: enable chat-history APIs only when this is explicitly set to 'true'
const CHAT_HISTORY_ENABLED = process.env.ENABLE_CHAT_HISTORY === 'true';

function requireChatHistoryEnabled(req, res, next) {
  if (!CHAT_HISTORY_ENABLED) return res.status(404).json({ error: 'not found' });
  next();
}


const app = express();
// Trust proxy for correct client IP detection behind Render/Heroku/NGINX
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Chat history and unread APIs
app.get('/api/admin/chat-history', requireAuth, requireChatHistoryEnabled, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.json([]);
    const session_id = req.query.session_id;
    let uid = req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null;
    // normalize to ObjectId when possible for consistent DB lookups
    uid = normalizeUserId(uid);
    const q = session_id ? { session_id } : (uid ? { user_id: uid } : {});
    const rows = await database.collection('chat_messages').find(q).sort({ created_at: 1 }).limit(500).toArray();
    res.json(rows || []);
  } catch (e) {
    console.error('Failed to fetch chat history', e && e.message);
    res.status(500).json({ error: 'failed to fetch chat history' });
  }
});
 
app.get('/api/admin/chat-unread', requireAuth, requireChatHistoryEnabled, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.json({ unread: 0 });
    let uid = req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null;
    if (!uid) return res.json({ unread: 0 });
    uid = normalizeUserId(uid);
    const doc = await database.collection('chat_unreads').findOne({ user_id: uid });
    res.json({ unread: (doc && doc.unread) ? doc.unread : 0 });
  } catch (e) {
    console.error('Failed to fetch unread count', e && e.message);
    res.status(500).json({ error: 'failed to fetch unread' });
  }
});
 
app.post('/api/admin/chat-read', requireAuth, requireChatHistoryEnabled, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });
    let uid = req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null;
    if (!uid) return res.status(400).json({ error: 'Missing user' });
    uid = normalizeUserId(uid);
    await database.collection('chat_unreads').updateOne(
      { user_id: uid },
      { $set: { unread: 0, last_read_at: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to mark chat read', e && e.message);
    res.status(500).json({ error: 'failed to mark read' });
  }
});

// Admin-only: fetch chat history for any user or session (filtering)
app.get('/api/admin/chat-history-admin', requireAuth, requireMCA, requireChatHistoryEnabled, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.json([]);
    const { user_id, session_id, start, end, limit = 500, skip = 0 } = req.query;
    const q = {};
    if (session_id) q.session_id = session_id;
    if (user_id) {
      let uid = normalizeUserId(user_id);
      q.user_id = uid;
    }
    if (start || end) {
      q.created_at = {};
      if (start) q.created_at.$gte = new Date(start);
      if (end) q.created_at.$lte = new Date(end);
    }
    const rows = await database.collection('chat_messages').find(q).sort({ created_at: 1 }).skip(parseInt(skip,10)||0).limit(Math.min(2000, parseInt(limit,10)||500)).toArray();
    // Support CSV export when requested
    if (req.query.export === 'csv' || (req.headers.accept && req.headers.accept.includes && req.headers.accept.includes('text/csv'))) {
      try {
        const csvLines = ['created_at,user_id,user_name,role,session_id,message'];
        (rows || []).forEach(r => {
          const when = new Date(r.created_at).toISOString();
          const uid = r.user_id ? (typeof r.user_id === 'object' && r.user_id._bsontype === 'ObjectID' ? r.user_id.toString() : String(r.user_id)) : '';
          const name = (r.user_name || '').replace(/"/g, '""');
          const role = (r.role || '');
          const sid = (r.session_id || '').replace(/"/g, '""');
          const msg = (r.message || '').replace(/"/g, '""');
          csvLines.push(`"${when}","${uid}","${name}","${role}","${sid}","${msg}"`);
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="chat_history.csv"');
        return res.send(csvLines.join('\n'));
      } catch (csvErr) {
        console.warn('Failed to generate CSV', csvErr && csvErr.message);
      }
    }
    res.json(rows || []);
  } catch (e) {
    console.error('Failed to fetch admin chat history', e && e.message);
    res.status(500).json({ error: 'failed to fetch admin chat history' });
  }
});

// CORS - allow frontend to connect
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
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


// Simple session storage (in production, use Redis or proper session management)
const sessions = new Map();

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
  
  // treat explicit 'null' or 'undefined' string values as missing token
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  
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

// Chat rate limiter (protect chatbot from abuse). Per-IP window by default.
let chatLimiter;
if (rateLimit) {
  chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 chat requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many chat requests, please slow down' }
  });
} else {
  // Simple no-op fallback (allow all) to avoid blocking when module not present
  chatLimiter = (req, res, next) => next();
}

// Middleware: Verify MCA role
function requireMCA(req, res, next) {
  if (req.user.role !== "MCA") {
    return res.status(403).json({ error: "Access denied. MCA role required." });
  }
  next();
}

// Helper: normalize user id to ObjectId when possible
function normalizeUserId(uid) {
  if (!uid) return null;
  try {
    if (uid instanceof ObjectId) return uid;
    if (typeof uid === 'string' && ObjectId.isValid(uid)) return new ObjectId(uid);
  } catch (e) {
    // fall through - return original value
  }
  return uid;
}

// MongoDB connection
const { ServerApiVersion } = require("mongodb");
let client;
let db;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
// Auto-delete configuration: delay before deleting resolved issues and reaper interval
const ISSUE_AUTO_DELETE_MS = parseInt(process.env.ISSUE_AUTO_DELETE_MS, 10) || (2 * 60 * 1000); // default 2 minutes
const ISSUE_REAPER_INTERVAL_MS = parseInt(process.env.ISSUE_REAPER_INTERVAL_MS, 10) || (60 * 1000); // default run every 60s

async function connectDB() {
  if (db) return db;
  
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env file");
    return null;
  }
  
  try {
    if (!client) {
      client = new MongoClient(MONGO_URI, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
        tls: true,
        retryWrites: true,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 8000,
      });
    }
    
    if (!db) {
      await client.connect();
      // Extract database name from URI
      const url = new URL(MONGO_URI);
      const pathDb = (url.pathname || "").replace(/^\//, "") || "voo_ward";
      db = client.db(pathDb);
      // Ensure important indexes exist to optimize reaper and related queries
      try {
        const issuesCol = db.collection('issues');
        await issuesCol.createIndex({ scheduled_delete_at: 1, deleted: 1 });
        console.log('Ensured index on issues.scheduled_delete_at and issues.deleted');
      } catch (ixErr) {
        console.warn('Could not ensure indexes for issues collection:', ixErr && ixErr.message);
      }
    }
    
    console.log("✅ Connected to MongoDB Atlas");
    return db;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("💡 Tip: Check if MONGO_URI is correct in .env file");
    return null;
  }
}

// Prepare upload directory for profile avatars
const UPLOADS_DIR = path.join(__dirname, '../public/uploads/avatars');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { /* ignore */ }

// Background reaper: delete issues with scheduled_delete_at <= now (safe-guard: only if still resolved)
function startIssueReaper() {
  try {
    const intervalMs = ISSUE_REAPER_INTERVAL_MS;
    const timer = setInterval(async () => {
      try {
        const database = await connectDB();
        if (!database) return;
        const now = new Date();
        const cursor = database.collection('issues').find({ scheduled_delete_at: { $lte: now } });
        const docs = await cursor.toArray();
        for (const doc of docs) {
          try {
            const status = (doc.status || '').toString().toLowerCase();
            if (status === 'resolved') {
              // Soft-delete: mark deleted=true so we retain audit trail
              try {
                await database.collection('issues').updateOne(
                  { _id: doc._id },
                  { $set: { deleted: true, deleted_at: new Date(), deleted_by: 'system' }, $unset: { scheduled_delete_at: "" } }
                );
                console.log('Reaper: soft-deleted scheduled resolved issue', doc.ticket || doc._id);
              } catch (softErr) {
                console.warn('Reaper: failed to soft-delete', doc.ticket || doc._id, softErr && softErr.message);
              }
            } else {
              await database.collection('issues').updateOne({ _id: doc._id }, { $unset: { scheduled_delete_at: "" } });
              console.log('Reaper: cleared scheduled_delete_at for', doc.ticket || doc._id, 'status', status);
            }
          } catch (e) {
            console.warn('Reaper failed for', doc.ticket || doc._id, e && e.message);
          }
        }
      } catch (e) {
        console.warn('Issue reaper error', e && e.message);
      }
    }, intervalMs);
    if (timer && typeof timer.unref === 'function') try { timer.unref(); } catch (e) { /* ignore */ }
    console.log('Issue reaper started (interval ms):', intervalMs);
    return timer;
  } catch (e) {
    console.warn('Failed to start issue reaper', e && e.message);
    return null;
  }
}

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
async function sendNotificationToPhone(/* db, phone, message */) {
  console.log('Notifications disabled: sendNotificationToPhone called - notifications removed from this deployment.');
  return { ok: false, queued: false };
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

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Login
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    const database = await connectDB();
    
    // When database is not connected, require DB for authentication.
    if (!database) {
      console.error('Database not connected - authentication requires a configured database');
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // PRODUCTION: Use database authentication
    // Find user
    const user = await database.collection("admin_users").findOne({
      username: username.toLowerCase()
    });

    if (!user) {
      console.warn(`Failed login attempt for unknown user '${username}' from ${req.ip}`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

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

// Logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  sessions.delete(token);
  res.json({ success: true, message: "Logged out successfully" });
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
    
    // Check if username exists
    const existing = await database.collection("admin_users").findOne({ 
      username: username.toLowerCase() 
    });
    
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Enforce a maximum number of PAs (Personal Assistants)
    if (role === 'PA') {
      const paCount = await database.collection('admin_users').countDocuments({ role: 'PA' });
      if (paCount >= 3) {
        return res.status(400).json({ error: 'Maximum number of PA users reached (3)' });
      }
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
app.get("/api/auth/users", requireAuth, requireMCA, async (req, res) => {
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
// ADMIN API ROUTES
// ============================================

// Get all reported issues (PA and MCA can access)
app.get("/api/admin/issues", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    // Exclude soft-deleted issues from exports
    const issues = await database.collection("issues")
      .find({ deleted: { $ne: true } })
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
    // Ensure we always return an array to the frontend to avoid "map is not a function" errors
    const safeBursaries = Array.isArray(bursaries) ? bursaries : (bursaries ? [bursaries] : []);
    res.json(safeBursaries);
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

            // Schedule automatic deletion after 2 minutes (safe-guard: only delete if still resolved)
            try {
              const scheduledAt = new Date(Date.now() + ISSUE_AUTO_DELETE_MS);
              // mark the document with a scheduled_delete_at timestamp so admins can see it
              await database.collection('issues').updateOne({ ticket: id }, { $set: { scheduled_delete_at: scheduledAt } });
              setTimeout(async () => {
                try {
                  const fresh = await database.collection('issues').findOne({ ticket: id });
                  if (!fresh) return console.log('Scheduled delete: issue already removed', id);
                  const s = (fresh.status || '').toString().toLowerCase();
                  if (s === 'resolved') {
                    // Soft-delete instead of hard delete to keep an audit trail
                    try {
                      await database.collection('issues').updateOne(
                        { ticket: id },
                        { $set: { deleted: true, deleted_at: new Date(), deleted_by: req.user?.username || 'system' }, $unset: { scheduled_delete_at: "" } }
                      );
                      console.log('Scheduled delete: soft-deleted resolved issue', id);
                    } catch (sdErr) {
                      console.warn('Scheduled soft-delete failed for', id, sdErr && sdErr.message);
                    }
                  } else {
                    console.log('Scheduled delete skipped for', id, 'status is', s);
                    // clear scheduled_delete_at to indicate it was skipped
                    try { await database.collection('issues').updateOne({ ticket: id }, { $unset: { scheduled_delete_at: "" } }); } catch (e) { /* ignore */ }
                  }
                } catch (sErr) { console.warn('Scheduled delete failed for', id, sErr && sErr.message); }
              }, ISSUE_AUTO_DELETE_MS);
            } catch (schedErr) {
              console.warn('Failed to schedule delete for issue', id, schedErr && schedErr.message);
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
          // If we just marked this as resolved, schedule deletion after 2 minutes
          try {
            const ts = (targetStatus || '').toString().toLowerCase();
            if (ts === 'resolved') {
              const scheduledAt = new Date(Date.now() + ISSUE_AUTO_DELETE_MS);
              try { await database.collection('issues').updateOne({ ticket: ticket }, { $set: { scheduled_delete_at: scheduledAt } }); } catch(e) { /* ignore */ }
              setTimeout(async () => {
                try {
                  const fresh = await database.collection('issues').findOne({ ticket: ticket });
                  if (!fresh) return console.log('Scheduled delete: issue already removed', ticket);
                  const s = (fresh.status || '').toString().toLowerCase();
                  if (s === 'resolved') {
                    // Soft-delete instead of hard delete to keep an audit trail
                    try {
                      await database.collection('issues').updateOne(
                        { ticket: ticket },
                        { $set: { deleted: true, deleted_at: new Date(), deleted_by: req.user?.username || 'system' }, $unset: { scheduled_delete_at: "" } }
                      );
                      console.log('Scheduled delete: soft-deleted resolved issue', ticket);
                    } catch (sdErr) {
                      console.warn('Scheduled soft-delete failed for', ticket, sdErr && sdErr.message);
                    }
                  } else {
                    console.log('Scheduled delete skipped for', ticket, 'status is', s);
                    try { await database.collection('issues').updateOne({ ticket: ticket }, { $unset: { scheduled_delete_at: "" } }); } catch (ee) { /* ignore */ }
                  }
                } catch (se) { console.warn('Scheduled delete failed for', ticket, se && se.message); }
              }, ISSUE_AUTO_DELETE_MS);
            }
          } catch (schedErr) { console.warn('Failed to schedule delete for', ticket, schedErr && schedErr.message); }
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
          : `Your ${tickets.length} reports (${tickets.slice(0,5).join(',')}${tickets.length>5? ',...':''}) have been marked as ${targetStatus}. Thank you.`;

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
  // exclude soft-deleted issues from counts
  database.collection("issues").countDocuments({ deleted: { $ne: true } }),
  database.collection("issues").countDocuments({ status: "open", deleted: { $ne: true } }),
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
// Protect chat endpoint with a rate limiter to prevent abuse
app.post('/api/admin/chatbot', chatLimiter, requireAuth, async (req, res) => {
  try {
    const { message } = req.body || {};
    // Log user message and bot reply to chat_messages collection (if DB available)
    let replyObj = { reply: 'Sorry, the help service is unavailable.', source: 'kb' };
    try {
      const database = await connectDB();
      const userId = normalizeUserId(req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null);
      const userName = req.user && (req.user.full_name || req.user.fullName || req.user.username) ? (req.user.full_name || req.user.fullName || req.user.username) : 'unknown';
      const msgDoc = { user_id: userId, user_name: userName, role: 'user', message: message, session_id: req.body && req.body.session_id ? req.body.session_id : null, created_at: new Date() };
      if (database) {
        try { await database.collection('chat_messages').insertOne(msgDoc); } catch (e) { console.warn('Failed to log chat message:', e && e.message); }
      }

      const gen = await chatbotSvc.generateReply(message, req.user);
      if (gen && typeof gen === 'object' && gen.reply) replyObj = gen;

      const botDoc = { user_id: userId, user_name: userName, role: 'bot', message: replyObj.reply, source: replyObj.source || 'kb', session_id: req.body && req.body.session_id ? req.body.session_id : null, created_at: new Date() };
      if (database) {
        try { 
          await database.collection('chat_messages').insertOne(botDoc); 
          // increment per-user unread counter if we have a user id
          if (userId) {
            try {
              await database.collection('chat_unreads').updateOne(
                { user_id: userId },
                { $inc: { unread: 1 }, $set: { last_message_at: new Date() } },
                { upsert: true }
              );
            } catch (incErr) { console.warn('Failed to increment chat_unreads:', incErr && incErr.message); }
          }
        } catch (e) { console.warn('Failed to log chat reply:', e && e.message); }
      }
    } catch (e) {
      // If DB or logging fails, still try to get a reply
      try {
        const gen = await chatbotSvc.generateReply(message, req.user);
        if (gen && typeof gen === 'object' && gen.reply) replyObj = gen;
        else if (typeof gen === 'string') replyObj = { reply: gen, source: 'kb' };
      } catch (err) { /* ignore */ }
    }
    return res.json({ reply: replyObj.reply, source: replyObj.source });
  } catch (err) {
    console.error('Chatbot error', err && err.message);
    res.status(500).json({ error: 'chatbot error' });
  }
});

// Admin: get chatbot KB (for editor UI)
// NOTE: Chatbot KB editor removed for production — chatbot now relies on OpenAI (when configured)

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
    const photoFields = ['photo_url','photo_thumb','photo_webp','photo_thumb_webp'];
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

// Export issues as CSV (PA and MCA can access)
app.get("/api/admin/export/issues", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: "Database not connected" });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=issues.csv');

    // write header
    res.write('Ticket,Category,Message,Phone,Status,Action By,Action At,Action Note,Created At\n');

    const cursor = database.collection('issues').find({}).sort({ created_at: -1 });
    let count = 0;
    try {
      for await (const issue of cursor) {
        const ticket = (issue.ticket || '').toString().replace(/"/g, '""');
        const category = (issue.category || '').toString().replace(/"/g, '""');
        const message = (issue.message || '').toString().replace(/"/g, '""');
        const phone = (issue.phone_number || '').toString().replace(/"/g, '""');
        const status = (issue.status || '').toString().replace(/"/g, '""');
        const actionBy = (issue.action_by || '').toString().replace(/"/g, '""');
        const actionAt = issue.action_at ? new Date(issue.action_at).toISOString() : '';
        const actionNote = (issue.action_note || '').toString().replace(/"/g, '""');
        const created = issue.created_at ? new Date(issue.created_at).toISOString() : '';

        res.write(`"${ticket}","${category}","${message}","${phone}","${status}","${actionBy}","${actionAt}","${actionNote}","${created}"\n`);
        count++;
      }
    } catch (streamErr) {
      console.warn('Error while streaming issues export', streamErr && streamErr.message);
    }

    // write audit record for export
    try {
      await database.collection('admin_audit').insertOne({
        action: 'export',
        export_type: 'issues',
        performed_by: req.user?.username || 'unknown',
        count: count,
        created_at: new Date()
      });
    } catch (auditErr) {
      console.warn('Failed to write audit entry for issues export', auditErr && auditErr.message);
    }

    return res.end();
  } catch (err) {
    console.error("Error exporting issues:", err && err.message);
    return res.status(500).json({ error: err.message || 'failed to export issues' });
  }
});

// Admin: purge soft-deleted issues (permanent removal). MCA only.
app.post('/api/admin/issues/purge', requireAuth, requireMCA, async (req, res) => {
  try {
    const { ticket, older_than_minutes, all, confirm } = req.body || {};
    if (!confirm) return res.status(400).json({ error: 'Confirm required. Set { confirm: true } to proceed.' });

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    if (ticket) {
      const r = await database.collection('issues').deleteOne({ ticket: ticket, deleted: true });
      await database.collection('admin_audit').insertOne({ action: 'purge-issue', ticket, performed_by: req.user?.username || 'unknown', count: r.deletedCount, created_at: new Date() });
      return res.json({ success: true, deleted: r.deletedCount });
    }

    if (older_than_minutes && Number(older_than_minutes) > 0) {
      const mins = Number(older_than_minutes);
      const cutoff = new Date(Date.now() - mins * 60 * 1000);
      const r = await database.collection('issues').deleteMany({ deleted: true, deleted_at: { $lte: cutoff } });
      await database.collection('admin_audit').insertOne({ action: 'purge-issues-older', performed_by: req.user?.username || 'unknown', older_than_minutes: mins, count: r.deletedCount, created_at: new Date() });
      return res.json({ success: true, deleted: r.deletedCount });
    }

    if (all) {
      const r = await database.collection('issues').deleteMany({ deleted: true });
      await database.collection('admin_audit').insertOne({ action: 'purge-all-deleted-issues', performed_by: req.user?.username || 'unknown', count: r.deletedCount, created_at: new Date() });
      return res.json({ success: true, deleted: r.deletedCount });
    }

    return res.status(400).json({ error: 'Provide ticket or older_than_minutes or all with confirm:true' });
  } catch (e) {
    console.error('Purge issues error', e && e.message);
    res.status(500).json({ error: 'failed to purge issues' });
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

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ussd_interactions.csv');
    res.write('Phone,Text,Parsed Text,Response,Ref Code,IP,Created At\n');

    const cursor = database.collection('ussd_interactions').find({}).sort({ created_at: -1 });
    let count = 0;
    try {
      for await (const i of cursor) {
        const phone = (i.phone_number || '').toString().replace(/"/g, '""');
        const text = (i.text || '').toString().replace(/"/g, '""');
        const parsed = i.parsed_text ? JSON.stringify(i.parsed_text).replace(/"/g, '""') : '';
        const response = (i.response || '').toString().replace(/"/g, '""');
        const ref = (i.ref_code || '').toString().replace(/"/g, '""');
        const ip = (i.ip || '').toString();
        const created = i.created_at ? new Date(i.created_at).toISOString() : '';
        res.write(`"${phone}","${text}","${parsed}","${response}","${ref}","${ip}","${created}"\n`);
        count++;
      }
    } catch (streamErr) {
      console.warn('Error while streaming USSD export', streamErr && streamErr.message);
    }

    try {
      await database.collection('admin_audit').insertOne({ action: 'export', export_type: 'ussd', performed_by: req.user?.username || 'unknown', count, created_at: new Date() });
    } catch (auditErr) { console.warn('Failed to write audit entry for ussd export', auditErr && auditErr.message); }

    return res.end();
  } catch (err) {
    console.error('Error exporting USSD interactions:', err && err.message);
    return res.status(500).json({ error: err.message || 'failed to export ussd' });
  }
});

// Export bursaries as CSV (MCA only)
app.get("/api/admin/export/bursaries", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: "Database not connected" });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bursaries.csv');
    res.write('Ref Code,Student Name,School,Amount,Status,Phone,Created At\n');

    const cursor = database.collection('bursary_applications').find({}).sort({ created_at: -1 });
    let count = 0;
    try {
      for await (const b of cursor) {
        const ref = (b.ref_code || '').toString().replace(/"/g, '""');
        const student = (b.student_name || '').toString().replace(/"/g, '""');
        const school = (b.institution || '').toString().replace(/"/g, '""');
        const amount = (b.amount_requested || '').toString().replace(/"/g, '""');
        const status = (b.status || '').toString().replace(/"/g, '""');
        const phone = (b.phone_number || '').toString().replace(/"/g, '""');
        const created = b.created_at ? new Date(b.created_at).toISOString() : '';
        res.write(`"${ref}","${student}","${school}","${amount}","${status}","${phone}","${created}"\n`);
        count++;
      }
    } catch (streamErr) { console.warn('Error while streaming bursaries export', streamErr && streamErr.message); }

    try { await database.collection('admin_audit').insertOne({ action: 'export', export_type: 'bursaries', performed_by: req.user?.username || 'unknown', count, created_at: new Date() }); } catch (auditErr) { console.warn('Failed to write audit entry for bursaries export', auditErr && auditErr.message); }

    return res.end();
  } catch (err) {
    console.error("Error exporting bursaries:", err && err.message);
    return res.status(500).json({ error: err.message || 'failed to export bursaries' });
  }
});

// Export constituents as CSV (MCA only)
app.get("/api/admin/export/constituents", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) return res.status(503).json({ error: "Database not connected" });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=constituents.csv');
    res.write('Phone,National ID,Full Name,Location,Village,Created At\n');

    const cursor = database.collection('constituents').find({}).sort({ created_at: -1 });
    let count = 0;
    try {
      for await (const c of cursor) {
        const phone = (c.phone_number || '').toString().replace(/"/g, '""');
        const nid = (c.national_id || '').toString().replace(/"/g, '""');
        const name = (c.full_name || '').toString().replace(/"/g, '""');
        const loc = (c.location || '').toString().replace(/"/g, '""');
        const village = (c.village || '').toString().replace(/"/g, '""');
        const created = c.created_at ? new Date(c.created_at).toISOString() : '';
        res.write(`"${phone}","${nid}","${name}","${loc}","${village}","${created}"\n`);
        count++;
      }
    } catch (streamErr) { console.warn('Error while streaming constituents export', streamErr && streamErr.message); }

    try { await database.collection('admin_audit').insertOne({ action: 'export', export_type: 'constituents', performed_by: req.user?.username || 'unknown', count, created_at: new Date() }); } catch (auditErr) { console.warn('Failed to write audit entry for constituents export', auditErr && auditErr.message); }

    return res.end();
  } catch (err) {
    console.error("Error exporting constituents:", err && err.message);
    return res.status(500).json({ error: err.message || 'failed to export constituents' });
  }
});

// Unified export endpoint: /api/admin/export?type=issues|bursaries|constituents|ussd
app.get('/api/admin/export', requireAuth, async (req, res) => {
  try {
    const type = (req.query.type || '').toString();
    if (!type) return res.status(400).json({ error: 'type query parameter required (issues|bursaries|constituents|ussd)' });

    const mcaOnly = ['bursaries', 'constituents'];
    if (mcaOnly.includes(type) && req.user.role !== 'MCA') {
      return res.status(403).json({ error: 'Access denied. MCA role required for this export.' });
    }

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    // Configure streaming params per export type
    let collectionName, headerRow, filename, query = {};
    if (type === 'issues') {
      collectionName = 'issues';
      headerRow = 'Ticket,Category,Message,Phone,Status,Action By,Action At,Action Note,Created At';
      filename = 'issues.csv';
      query = { deleted: { $ne: true } };
    } else if (type === 'bursaries') {
      collectionName = 'bursary_applications';
      headerRow = 'Ref Code,Student Name,School,Amount,Status,Phone,Created At';
      filename = 'bursaries.csv';
    } else if (type === 'constituents') {
      collectionName = 'constituents';
      headerRow = 'Phone,National ID,Full Name,Location,Village,Created At';
      filename = 'constituents.csv';
    } else if (type === 'ussd') {
      collectionName = 'ussd_interactions';
      headerRow = 'Phone,Text,Parsed Text,Response,Ref Code,IP,Created At';
      filename = 'ussd_interactions.csv';
    } else {
      return res.status(400).json({ error: 'Unsupported export type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.write(headerRow + '\n');

    const cursor = database.collection(collectionName).find(query).sort({ created_at: -1 });
    let count = 0;
    try {
      for await (const doc of cursor) {
        let line = '';
        if (type === 'issues') {
          const ticket = (doc.ticket || '').toString().replace(/"/g, '""');
          const category = (doc.category || '').toString().replace(/"/g, '""');
          const message = (doc.message || '').toString().replace(/"/g, '""');
          const phone = (doc.phone_number || '').toString().replace(/"/g, '""');
          const status = (doc.status || '').toString().replace(/"/g, '""');
          const actionBy = (doc.action_by || '').toString().replace(/"/g, '""');
          const actionAt = doc.action_at ? new Date(doc.action_at).toISOString() : '';
          const actionNote = (doc.action_note || '').toString().replace(/"/g, '""');
          const created = doc.created_at ? new Date(doc.created_at).toISOString() : '';
          line = `"${ticket}","${category}","${message}","${phone}","${status}","${actionBy}","${actionAt}","${actionNote}","${created}"`;
        } else if (type === 'bursaries') {
          const ref = (doc.ref_code || '').toString().replace(/"/g, '""');
          const student = (doc.student_name || '').toString().replace(/"/g, '""');
          const school = (doc.institution || '').toString().replace(/"/g, '""');
          const amount = (doc.amount_requested || '').toString().replace(/"/g, '""');
          const status = (doc.status || '').toString().replace(/"/g, '""');
          const phone = (doc.phone_number || '').toString().replace(/"/g, '""');
          const created = doc.created_at ? new Date(doc.created_at).toISOString() : '';
          line = `"${ref}","${student}","${school}","${amount}","${status}","${phone}","${created}"`;
        } else if (type === 'constituents') {
          const phone = (doc.phone_number || '').toString().replace(/"/g, '""');
          const nid = (doc.national_id || '').toString().replace(/"/g, '""');
          const name = (doc.full_name || '').toString().replace(/"/g, '""');
          const loc = (doc.location || '').toString().replace(/"/g, '""');
          const village = (doc.village || '').toString().replace(/"/g, '""');
          const created = doc.created_at ? new Date(doc.created_at).toISOString() : '';
          line = `"${phone}","${nid}","${name}","${loc}","${village}","${created}"`;
        } else if (type === 'ussd') {
          const phone = (doc.phone_number || '').toString().replace(/"/g, '""');
          const text = (doc.text || '').toString().replace(/"/g, '""');
          const parsed = doc.parsed_text ? JSON.stringify(doc.parsed_text).replace(/"/g, '""') : '';
          const response = (doc.response || '').toString().replace(/"/g, '""');
          const ref = (doc.ref_code || '').toString().replace(/"/g, '""');
          const ip = (doc.ip || '').toString();
          const created = doc.created_at ? new Date(doc.created_at).toISOString() : '';
          line = `"${phone}","${text}","${parsed}","${response}","${ref}","${ip}","${created}"`;
        }
        res.write(line + '\n');
        count++;
      }
    } catch (streamErr) {
      console.warn('Error while streaming unified export', streamErr && streamErr.message);
    }

    try { await database.collection('admin_audit').insertOne({ action: 'export', export_type: type, performed_by: req.user?.username || 'unknown', count, created_at: new Date() }); } catch (auditErr) { console.warn('Failed to write audit entry for unified export', auditErr && auditErr.message); }

    return res.end();
  } catch (err) {
    console.error('Unified export error', err && err.message);
    res.status(500).json({ error: 'failed to export' });
  }
});

// Serve admin dashboard HTML (use canonical repository public directory)
app.use(express.static(path.join(__dirname, "..", "..", "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "..", "public", "admin-dashboard.html"));
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

// OLD HTML: served from static file in ../public/admin-dashboard.html
app.get('/old', (req, res) => {
  // Redirect legacy /old route to the static admin-dashboard.html
  res.redirect('/admin-dashboard.html');
});

// Start server when run directly. When required as a module, export the app so
// a parent process (e.g. src/index.js) can mount it as middleware.
const PORT = process.env.ADMIN_PORT || 5000;
async function startServer() {
  console.log(`\n  VOO WARD ADMIN DASHBOARD`);
  console.log(` Dashboard: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  
  // Test MongoDB connection
  const database = await connectDB();
  if (database) {
    console.log(` MongoDB Connected: Ready to view data`);
    
    // Initialize admin user
    await initializeAdmin();
    // Start background reaper to process scheduled deletions
    try { startIssueReaper(); } catch (e) { console.warn('Failed to start issue reaper after init', e && e.message); }
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
  // Export the Express app so a parent application can mount it (e.g. app.use('/admin', adminApp))
  module.exports = app;
  // expose connectDB for parent apps that may want to reuse the DB connection
  try { module.exports.connectDB = connectDB; } catch (e) { /* noop */ }
  // Also attempt a best-effort DB connect + admin init when required (non-blocking)
  (async () => {
    try {
      const database = await connectDB();
      if (database) await initializeAdmin();
        // Start background reaper when running as a module too
        try { startIssueReaper(); } catch (e) { console.warn('Failed to start issue reaper (module init)', e && e.message); }
    } catch (e) {
      console.warn('Admin dashboard module init warning:', e && e.message);
    }
  })();

  // Internal endpoint: reset admin password (requires ADMIN_RESET_TOKEN header)
  // Use only when ADMIN_RESET_TOKEN is set in environment and you provide the token in the request.
  app.post('/internal/reset-admin', async (req, res) => {
    try {
      const token = req.headers['x-admin-reset-token'] || '';
      if (!process.env.ADMIN_RESET_TOKEN || token !== process.env.ADMIN_RESET_TOKEN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const database = await connectDB();
      if (!database) return res.status(503).json({ error: 'Database not connected' });

      const ADMIN_USER = (process.env.ADMIN_USER || 'admin').toLowerCase();
      const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

      const col = database.collection('admin_users');
      const user = await col.findOne({ username: ADMIN_USER });
      const bcrypt = require('bcryptjs');
      const newHash = await bcrypt.hash(ADMIN_PASS, 10);

      if (!user) {
        const doc = { username: ADMIN_USER, password: newHash, full_name: process.env.ADMIN_FULLNAME || 'Zak', role: process.env.ADMIN_ROLE || 'MCA', created_at: new Date(), immutable: true };
        await col.insertOne(doc);
        console.log('Admin reset: created admin user');
        return res.json({ success: true, message: 'Admin user created and password set from ADMIN_PASS' });
      }

      await col.updateOne({ _id: user._id }, { $set: { password: newHash, updated_at: new Date() } });
      console.log('Admin reset: password updated for', ADMIN_USER);
      return res.json({ success: true, message: 'Admin password reset to ADMIN_PASS' });
    } catch (e) {
      console.error('internal reset-admin error', e && e.message);
      res.status(500).json({ error: 'failed' });
    }
  });
}
