const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
// bcrypt for secure password hashing and migration from legacy SHA-256
const bcrypt = require('bcryptjs');

// Load environment variables
require("dotenv").config();
const chatbotSvc = require('./chatbot');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const issues = await database.collection("issues")
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    
    // Include action metadata in export: action_by, action_at, action_note
    let csv = "Ticket,Category,Message,Phone,Status,Action By,Action At,Action Note,Created At\n";
    issues.forEach(issue => {
      const ticket = (issue.ticket || '').toString().replace(/"/g, '""');
      const category = (issue.category || '').toString().replace(/"/g, '""');
      const message = (issue.message || '').toString().replace(/"/g, '""');
      const phone = (issue.phone_number || '').toString().replace(/"/g, '""');
      const status = (issue.status || '').toString().replace(/"/g, '""');
      const actionBy = (issue.action_by || '').toString().replace(/"/g, '""');
      const actionAt = issue.action_at ? new Date(issue.action_at).toISOString() : '';
      const actionNote = (issue.action_note || '').toString().replace(/"/g, '""');
      const created = issue.created_at ? new Date(issue.created_at).toISOString() : '';

      csv += `"${ticket}","${category}","${message}","${phone}","${status}","${actionBy}","${actionAt}","${actionNote}","${created}"\n`;
    });
    
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", "attachment; filename=issues.csv");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting issues:", err);
    res.status(500).json({ error: err.message });
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

    const interactions = await database.collection('ussd_interactions')
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    let csv = 'Phone,Text,Parsed Text,Response,Ref Code,IP,Created At\n';
    interactions.forEach(i => {
      const phone = (i.phone_number || '').toString().replace(/"/g, '""');
      const text = (i.text || '').toString().replace(/"/g, '""');
      const parsed = i.parsed_text ? JSON.stringify(i.parsed_text).replace(/"/g, '""') : '';
      const response = (i.response || '').toString().replace(/"/g, '""');
      const ref = (i.ref_code || '').toString().replace(/"/g, '""');
      const ip = (i.ip || '').toString();
      const created = i.created_at ? new Date(i.created_at).toISOString() : '';
      csv += `"${phone}","${text}","${parsed}","${response}","${ref}","${ip}","${created}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename=ussd_interactions.csv');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting USSD interactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export bursaries as CSV (MCA only)
app.get("/api/admin/export/bursaries", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const bursaries = await database.collection("bursary_applications")
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    
    let csv = "Ref Code,Student Name,School,Amount,Status,Phone,Created At\n";
    bursaries.forEach(b => {
      csv += `"${b.ref_code}","${b.student_name}","${b.institution}","${b.amount_requested}","${b.status}","${b.phone_number}","${b.created_at}"\n`;
    });
    
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", "attachment; filename=bursaries.csv");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting bursaries:", err);
    res.status(500).json({ error: err.message });
  }
});

// Export constituents as CSV (MCA only)
app.get("/api/admin/export/constituents", requireAuth, requireMCA, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const constituents = await database.collection("constituents")
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    
    let csv = "Phone,National ID,Full Name,Location,Village,Created At\n";
    constituents.forEach(c => {
      csv += `"${c.phone_number}","${c.national_id}","${c.full_name}","${c.location}","${c.village}","${c.created_at}"\n`;
    });
    
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", "attachment; filename=constituents.csv");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting constituents:", err);
    res.status(500).json({ error: err.message });
  }
});

// Serve admin dashboard HTML
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin-dashboard.html"));
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
    } catch (e) {
      console.warn('Admin dashboard module init warning:', e && e.message);
    }
  })();

  // Emergency admin reset endpoint removed for security. Use scripts/reset-admin.js with
  // proper environment access and admin-controlled processes if needed.
}
