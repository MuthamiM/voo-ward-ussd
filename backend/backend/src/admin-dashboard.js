const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
const bcrypt = require('bcryptjs');
// Optional Redis for sessions and rate-limiting. Set REDIS_URL in env to enable.
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    const IORedis = require('ioredis');
    redisClient = new IORedis(process.env.REDIS_URL);
    console.log('🔌 Redis enabled for sessions/rate-limiter');
  } catch (e) {
    console.warn('⚠️ Could not initialize Redis client:', e.message);
    redisClient = null;
  }
}

// Load environment variables
require("dotenv").config();


const router = express.Router();

// Middleware
router.use(express.json());
router.use(express.urlencoded({ extended: false }));
// Accept plain text bodies (some USSD gateways post text/plain)
router.use(express.text({ type: ['text/*', 'application/*+xml'] }));

// CORS - allow frontend to connect
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Simple session storage (in production, use Redis or proper session management)
const sessions = new Map();

// Rate limiter: in-memory fallback, or Redis-backed when REDIS_URL is set
const ussdRateLimits = new Map();

async function checkUssdRateLimit(ip, windowMs = 60_000, maxRequests = 6) {
  if (redisClient) {
    try {
      const key = `ussd:rl:${ip}`;
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.pexpire(key, windowMs);
      return count <= maxRequests;
    } catch (e) {
      console.warn('Redis rate-limit error, falling back to memory', e.message);
    }
  }

  const now = Date.now();
  const entry = ussdRateLimits.get(ip) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);
  if (entry.timestamps.length >= maxRequests) {
    ussdRateLimits.set(ip, entry);
    return false;
  }
  entry.timestamps.push(now);
  ussdRateLimits.set(ip, entry);
  return true;
}

// Helper: Hash password
// Helper: Check if user is the main admin
function isMainAdmin(user) {
  return user && user.username === "admin" && user.role === "MCA";
}
function hashPassword(password) {
  // legacy SHA-256 for existing users
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function hashPasswordBcrypt(password) {
  return bcrypt.hash(password, 10);
}

function isBcryptHash(s) {
  return typeof s === 'string' && s.startsWith('$2');
}

// Helper: Generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Middleware: Verify authentication
// Session helpers (Redis-backed if enabled)
async function setSession(token, sessionObj, ttlSeconds = 60 * 60 * 24) {
  if (redisClient) {
    await redisClient.set(`sess:${token}`, JSON.stringify(sessionObj), 'EX', ttlSeconds);
  } else {
    sessions.set(token, sessionObj);
  }
}

async function getSession(token) {
  if (!token) return null;
  if (redisClient) {
    const s = await redisClient.get(`sess:${token}`);
    return s ? JSON.parse(s) : null;
  }
  return sessions.get(token) || null;
}

async function deleteSession(token) {
  if (redisClient) {
    await redisClient.del(`sess:${token}`);
  } else {
    sessions.delete(token);
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const session = await getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });
    req.user = session.user;
    next();
  } catch (err) {
    console.error('Auth middleware error', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
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

// Health check
router.get("/health", (req, res) => {
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
router.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    // Find user
    const user = await database.collection("admin_users").findOne({ 
      username: username.toLowerCase() 
    });
    
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    // Check password: support bcrypt or legacy SHA-256. Migrate SHA users to bcrypt on successful login.
    let match = false;
    try {
      if (isBcryptHash(user.password)) {
        match = await bcrypt.compare(password, user.password);
      } else {
        match = (user.password === hashPassword(password));
      }
    } catch (e) {
      console.error('Password check error', e);
    }

    if (!match) return res.status(401).json({ error: "Invalid username or password" });

    // If legacy SHA-256 hash, migrate to bcrypt
    if (!isBcryptHash(user.password)) {
      try {
        const newHash = await hashPasswordBcrypt(password);
        const database = await connectDB();
        if (database) {
          await database.collection('admin_users').updateOne({ _id: user._id }, { $set: { password: newHash } });
          console.log(`🔁 Migrated user ${user.username} password to bcrypt`);
        }
      } catch (e) {
        console.warn('Password migration failed for', user.username, e.message);
      }
    }

    // Create session
    const token = generateSessionToken();
    await setSession(token, {
      user: {
        id: user._id.toString(),
        username: user.username,
        fullName: user.full_name,
        role: user.role
      },
      createdAt: new Date()
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Logout
router.post("/api/auth/logout", requireAuth, async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  await deleteSession(token);
  res.json({ success: true, message: "Logged out successfully" });
});

// Get current user
router.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: req.user,
    fullAccess: isMainAdmin(req.user)
  });
});

// Create user (MCA only)
router.post("/api/auth/users", requireAuth, requireMCA, async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    
    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ error: "All fields required" });
    }
    if (role !== "PA" && role !== "MCA") {
      return res.status(400).json({ error: "Role must be PA or MCA" });
    }
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    // Enforce limits: only 1 MCA (main admin) and maximum 3 PA users
    const adminCount = await database.collection("admin_users").countDocuments({ role: "MCA" });
    const paCount = await database.collection("admin_users").countDocuments({ role: "PA" });
    if (role === "MCA" && adminCount >= 1) {
      return res.status(403).json({ error: "Maximum 1 MCA admin allowed" });
    }
    if (role === "PA" && paCount >= 3) {
      return res.status(403).json({ error: "Maximum 3 PA users allowed" });
    }
    // Check if username exists
    const existing = await database.collection("admin_users").findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    // Create user (store bcrypt hash)
    const pwHash = await hashPasswordBcrypt(password);
    const newUser = {
      username: username.toLowerCase(),
      password: pwHash,
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
router.get("/api/auth/users", requireAuth, requireMCA, async (req, res) => {
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
router.delete("/api/auth/users/:id", requireAuth, requireMCA, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    // Find user to delete
    const userToDelete = await database.collection("admin_users").findOne({ _id: new ObjectId(id) });
    if (!userToDelete) {
      return res.status(404).json({ error: "User not found" });
    }
    // Prevent deleting the main admin (username 'admin')
    if (userToDelete.username === "admin" || userToDelete.immutable) {
      return res.status(403).json({ error: "Cannot delete the main or immutable admin user" });
    }
    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    const result = await database.collection("admin_users").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------
// USSD: Bursary tracking
// Supports Africa's Talking (text, sessionId, phoneNumber) and generic providers
// Flow (simple):
// - initial request (text === '' ) -> show menu
// - user selects 1 -> prompt for ref code
// - user replies with ref code (or sends 1*REF) -> lookup and return status
// ------------------------
router.post('/api/ussd', async (req, res) => {
  try {
    // Logging and rate-limiting
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '').toString();
    const phone = req.body.phoneNumber || req.body.phone || req.body.from || req.body.msisdn || '';

    // Normalize incoming fields - accept common provider fields
    const rawText = req.body.text ?? req.body.Text ?? req.body.input ?? '';
    const incoming = (rawText === null || rawText === undefined) ? '' : String(rawText);

    console.info('USSD request', { ip, phone, rawText: incoming });

    // Rate limit per IP
    if (!(await checkUssdRateLimit(ip))) {
      console.warn('USSD rate limit exceeded for IP', ip);
      res.set('Content-Type', 'text/plain');
      return res.send('END Too many requests. Try again in a minute.');
    }

    // Robust parsing: treat spaces and multiple separators as '*', remove unwanted chars
    let text = incoming.trim();
    // Replace multiple whitespace with '*', convert spaces to '*' for providers that use spaces
    text = text.replace(/\s+/g, '*');
    // Normalize repeated '*' and remove trailing/leading separators
    text = text.replace(/\*+/g, '*').replace(/^\*|\*$/g, '');

    // responder helper (Africa's Talking expects plain text starting with CON or END)
    const reply = (message, end = false) => {
      const prefix = end ? 'END ' : 'CON ';
      res.set('Content-Type', 'text/plain');
      // Log outgoing
      console.info('USSD reply', { ip, phone, message: (prefix + message).slice(0, 200) });
      return res.send(prefix + message);
    };

    // initial menu (no input)
    if (!text) {
      return reply('Welcome to VOO Ward USSD\n1. Check Bursary Status\n0. Exit');
    }

    // split AT-style '1*REF' flows
    const parts = text.split('*').filter(p => p !== '');

    // option 1 selected -> ask for ref code
    if (parts[0] === '1' && parts.length === 1) {
      return reply('Enter your bursary reference code:');
    }

    // user provided 1*REF or direct REF
    if (parts[0] === '1' && parts.length >= 2) {
      const ref = parts.slice(1).join('*').trim();
      if (!ref) return reply('Reference code cannot be empty. Enter your bursary reference code:');

      const database = await connectDB();
      if (!database) return reply('Service unavailable. Please try later.', true);

      const app = await database.collection('bursary_applications').findOne({ ref_code: ref });
      if (!app) return reply(`No application found for ref ${ref}.`, true);

      const status = app.status || 'Pending';
      const notes = app.admin_notes ? ` Notes: ${app.admin_notes}` : '';
      return reply(`Ref ${ref}\nStatus: ${status}.${notes}`, true);
    }

    // fallback: if user typed a direct ref code
    if (/^[A-Za-z0-9-]{3,}$/.test(text)) {
      const ref = text;
      const database = await connectDB();
      if (!database) return reply('Service unavailable. Please try later.', true);

      const app = await database.collection('bursary_applications').findOne({ ref_code: ref });
      if (!app) return reply(`No application found for ref ${ref}.`, true);

      const status = app.status || 'Pending';
      const notes = app.admin_notes ? ` Notes: ${app.admin_notes}` : '';
      return reply(`Ref ${ref}\nStatus: ${status}.${notes}`, true);
    }

    // exit
    if (text === '0') return reply('Goodbye', true);

    // default
    return reply('Invalid choice.\n1. Check Bursary Status\n0. Exit');
  } catch (err) {
    console.error('USSD error:', err);
    // ensure we end the session on errors
    res.set('Content-Type', 'text/plain');
    return res.send('END Service error. Please try again later.');
  }
});

// ============================================
// ADMIN API ROUTES
// ============================================

// Get all reported issues (PA and MCA can access)
router.get("/api/admin/issues", requireAuth, async (req, res) => {
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
router.get("/api/admin/bursaries", requireAuth, requireMCA, async (req, res) => {
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
router.get("/api/admin/constituents", requireAuth, requireMCA, async (req, res) => {
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
router.get("/api/admin/announcements", requireAuth, async (req, res) => {
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

// Update issue status (PA and MCA can access)
router.patch("/api/admin/issues/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const result = await database.collection("issues").updateOne(
      { ticket: id },
      { $set: { status, updated_at: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Issue not found" });
    }
    
    res.json({ success: true, message: `Issue ${id} updated to ${status}` });
  } catch (err) {
    console.error("Error updating issue:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update bursary status (MCA only)
router.patch("/api/admin/bursaries/:id", requireAuth, requireMCA, async (req, res) => {
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
router.post("/api/admin/announcements", requireAuth, async (req, res) => {
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
router.delete("/api/admin/announcements/:id", async (req, res) => {
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
router.get("/api/admin/stats", async (req, res) => {
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

// Export issues as CSV (PA and MCA can access)
router.get("/api/admin/export/issues", requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const issues = await database.collection("issues")
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    
    let csv = "Ticket,Category,Message,Phone,Status,Created At\n";
    issues.forEach(issue => {
      csv += `"${issue.ticket}","${issue.category}","${issue.message}","${issue.phone_number}","${issue.status}","${issue.created_at}"\n`;
    });
    
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", "attachment; filename=issues.csv");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting issues:", err);
    res.status(500).json({ error: err.message });
  }
});

// Export bursaries as CSV (MCA only)
router.get("/api/admin/export/bursaries", requireAuth, requireMCA, async (req, res) => {
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
router.get("/api/admin/export/constituents", requireAuth, requireMCA, async (req, res) => {
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
router.use(express.static(path.join(__dirname, "../public")));

router.get("/", (req, res) => {
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
    
    const existingAdmins = await database.collection("admin_users").find({ role: "MCA" }).toArray();
    // Remove legacy 'martin' user if present
    try {
      const legacy = await database.collection('admin_users').findOne({ username: 'martin' });
      if (legacy) {
        await database.collection('admin_users').deleteOne({ _id: legacy._id });
        console.log('🗑️ Removed legacy PA/MCA user: martin');
      }
    } catch (e) {
      console.warn('Could not check/remove legacy user martin:', e && e.message ? e.message : e);
    }

    if (!existingAdmins || existingAdmins.length === 0) {
      console.log("🔧 Creating default MCA admin user...");
      const pwHash = await hashPasswordBcrypt('admin123');
      const defaultAdmin = {
        username: "admin",
        password: pwHash,
        full_name: "Zak",
        role: "MCA",
        // mark the default admin as immutable so it cannot be deleted
        immutable: true,
        created_at: new Date()
      };
      await database.collection("admin_users").insertOne(defaultAdmin);
      console.log("✅ Default MCA admin created:");
      console.log("   Username: admin");
      console.log("   Password: admin123");
      console.log("   IMPORTANT: Change password after first login!");
    } else {
      // Ensure the primary admin record is named 'admin' and has full_name 'Zak'
      const main = await database.collection('admin_users').findOne({ username: 'admin' });
      if (main) {
        if (main.full_name !== 'Zak' || !isBcryptHash(main.password)) {
          try {
            const update = {};
            if (main.full_name !== 'Zak') update.full_name = 'Zak';
            if (!isBcryptHash(main.password)) {
              // If password is legacy SHA, don't change it unless it matches admin123; otherwise leave it.
              // Migrate to bcrypt only if it matches admin123
              if (main.password === hashPassword('admin123')) {
                update.password = await hashPasswordBcrypt('admin123');
              }
            }
            if (Object.keys(update).length) {
              update.updated_at = new Date();
              await database.collection('admin_users').updateOne({ _id: main._id }, { $set: update });
              console.log('ℹ️ Updated default admin metadata');
            }
          } catch (e) {
            console.warn('Could not update default admin metadata:', e && e.message ? e.message : e);
          }
        }
      }
      console.log(`✅ MCA admin user(s) exist: ${existingAdmins.map(a => a.username).join(", ")}`);
    }
  } catch (err) {
    console.error("❌ Error initializing admin user:", err.message);
  }
}

// Secure seed endpoint to create or update a default admin remotely.
// Protected by the SEED_ADMIN_TOKEN environment variable. Usage:
//  - Set SEED_ADMIN_TOKEN in Render / your env.
//  - POST /api/auth/seed-admin with header `x-seed-token: <token>` or body { token }
//  - Body may include optional: { username, password, fullName, role, force }
// If the username exists the endpoint updates password and full_name; otherwise it inserts.
router.post('/api/auth/seed-admin', async (req, res) => {
  try {
    const provided = req.headers['x-seed-token'] || req.body?.token;
    const expected = process.env.SEED_ADMIN_TOKEN;

    if (!expected) {
      return res.status(500).json({ error: 'SEED_ADMIN_TOKEN not configured on server' });
    }

    if (!provided || provided !== expected) {
      return res.status(403).json({ error: 'Invalid or missing seed token' });
    }

    const {
      username = 'admin',
      password = 'admin123',
      fullName = 'Zak',
      role = 'MCA',
      force = false
    } = req.body || {};

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    // If there are existing MCA admins and force is not true, warn the caller.
    const existingAdmins = await database.collection('admin_users').find({ role: 'MCA' }).toArray();
    if (existingAdmins.length > 0 && !force) {
      return res.status(409).json({ error: 'MCA admin(s) already exist. Use force=true to override or update a specific username.' });
    }

    const uname = username.toLowerCase();
    const existing = await database.collection('admin_users').findOne({ username: uname });
    if (existing) {
      // Update existing user password and info (store bcrypt)
      const newHash = await hashPasswordBcrypt(password);
      await database.collection('admin_users').updateOne(
        { _id: existing._id },
        { $set: { password: newHash, full_name: fullName, role, updated_at: new Date() } }
      );
      return res.json({ success: true, message: 'Existing admin updated', username: uname });
    }

    // Insert new admin (bcrypt password)
    const newHash = await hashPasswordBcrypt(password);
    const newUser = {
      username: uname,
      password: newHash,
      full_name: fullName,
      role,
      created_at: new Date()
    };

    await database.collection('admin_users').insertOne(newUser);
    return res.status(201).json({ success: true, message: 'Admin user created', username: uname });
  } catch (err) {
    console.error('Seed admin error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// OLD HTML CODE REMOVED - Now served from file
router.get("/old", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VOO Ward Admin Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card h3 { color: #667eea; font-size: 2.5em; margin-bottom: 5px; }
        .stat-card p { color: #666; font-size: 0.9em; }
        .tabs {
            display: flex;
            background: #f8f9fa;
            border-bottom: 2px solid #e0e0e0;
            padding: 0 30px;
        }
        .tab {
            padding: 15px 25px;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 16px;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: bold;
        }
        .tab:hover { color: #667eea; }
        .content { padding: 30px; }
        .table-container {
            overflow-x: auto;
            margin-top: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #667eea;
            color: white;
            font-weight: 600;
        }
        tr:hover { background: #f8f9fa; }
        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge.open { background: #ffc107; color: #000; }
        .badge.in_progress { background: #17a2b8; color: white; }
        .badge.resolved { background: #28a745; color: white; }
        .badge.pending { background: #ffc107; color: #000; }
        .badge.approved { background: #28a745; color: white; }
        .badge.rejected { background: #dc3545; color: white; }
        .export-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        .export-btn:hover { background: #218838; }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 1.2em;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .empty {
            text-align: center;
            padding: 40px;
            color: #999;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
    <div class="header">
      <h1> VOO Kyamatu Ward Admin Dashboard</h1>
      <p>MCA Administrative Portal - View Issues, Bursaries & Constituents</p>
      <div style="position: absolute; right: 20px; top: 22px;">
        <button id="login-btn" class="export-btn">Login</button>
        <button id="logout-btn" class="export-btn" style="display:none; background:#dc3545;">Logout</button>
      </div>
    </div>
    <!-- Login modal -->
    <div id="login-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;">
      <div style="background:white; padding:20px; width:320px; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.2); margin:auto;">
        <h3 style="margin-bottom:10px;">Admin Login</h3>
        <form id="login-form">
          <div style="margin-bottom:8px;"><input id="login-username" placeholder="Username" style="width:100%; padding:8px;" /></div>
          <div style="margin-bottom:12px;"><input id="login-password" type="password" placeholder="Password" style="width:100%; padding:8px;" /></div>
          <div style="text-align:right;"><button id="login-submit" class="export-btn" type="submit">Sign in</button> <button id="login-cancel" type="button" style="margin-left:8px;" class="export-btn">Cancel</button></div>
        </form>
      </div>
    </div>
        
        <div class="stats" id="stats">
            <div class="stat-card">
                <h3 id="stat-constituents">-</h3>
                <p>Total Constituents</p>
            </div>
            <div class="stat-card">
                <h3 id="stat-issues">-</h3>
                <p>Reported Issues</p>
            </div>
            <div class="stat-card">
                <h3 id="stat-bursaries">-</h3>
                <p>Bursary Applications</p>
            </div>
            <div class="stat-card">
                <h3 id="stat-announcements">-</h3>
                <p>Active Announcements</p>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('issues')">📋 Issues</button>
            <button class="tab" onclick="showTab('bursaries')">🎓 Bursaries</button>
            <button class="tab" onclick="showTab('constituents')">👥 Constituents</button>
            <button class="tab" onclick="showTab('announcements')">📢 Announcements</button>
        </div>
        
        <div class="content">
            <div id="issues-content">
                <button class="export-btn requires-admin" onclick="exportData('issues')">📥 Export Issues CSV</button>
                <div class="table-container">
                    <table id="issues-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Category</th>
                                <th>Message</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody id="issues-tbody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="bursaries-content" style="display:none;">
                <button class="export-btn requires-admin" onclick="exportData('bursaries')">📥 Export Bursaries CSV</button>
                <div class="table-container">
                    <table id="bursaries-table">
                        <thead>
                            <tr>
                                <th>Ref Code</th>
                                <th>Student Name</th>
                                <th>School/Institution</th>
                                <th>Amount Requested</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody id="bursaries-tbody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="constituents-content" style="display:none;">
                <button class="export-btn requires-admin" onclick="exportData('constituents')">📥 Export Constituents CSV</button>
                <div class="table-container">
                    <table id="constituents-table">
                        <thead>
                            <tr>
                                <th>Phone Number</th>
                                <th>National ID</th>
                                <th>Full Name</th>
                                <th>Location</th>
                                <th>Village</th>
                                <th>Registered At</th>
                            </tr>
                        </thead>
                        <tbody id="constituents-tbody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="announcements-content" style="display:none;">
                <div class="table-container">
                    <table id="announcements-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Body</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody id="announcements-tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        
    // Authentication token stored in localStorage
    let TOKEN = localStorage.getItem('token') || null;

    function authHeaders() {
      return TOKEN ? { 'Authorization': 'Bearer ' + TOKEN } : {};
    }

    async function fetchWithAuth(url, opts = {}) {
      opts.headers = Object.assign({}, opts.headers || {}, authHeaders());
      return fetch(url, opts);
    }

    // Login/logout helpers (modal-based)
    function showLogin() {
      // use flex to allow centering via align-items/justify-content
      document.getElementById('login-modal').style.display = 'flex';
      document.getElementById('login-username').focus();
    }

    async function submitLogin(ev) {
      ev.preventDefault();
      const user = document.getElementById('login-username').value.trim();
      const pass = document.getElementById('login-password').value;
      if (!user || !pass) return alert('Enter username and password');
      try {
        const res = await fetch(API_BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (!res.ok) return alert('Login failed: ' + (data.error || JSON.stringify(data)));
        TOKEN = data.token;
        localStorage.setItem('token', TOKEN);
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.getElementById('login-modal').style.display = 'none';
        await fetchMe();
        loadStats(); loadIssues();
      } catch (err) { alert('Login error: ' + err.message); }
    }

    async function doLogout() {
      const token = TOKEN;
      TOKEN = null;
      localStorage.removeItem('token');
      document.getElementById('login-btn').style.display = 'inline-block';
      document.getElementById('logout-btn').style.display = 'none';
      applyAccess(false);
      if (token) {
        try { await fetch(API_BASE + '/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch (e) {}
      }
    }

    async function fetchMe() {
      if (!TOKEN) return applyAccess(false);
      try {
        const res = await fetch(API_BASE + '/api/auth/me', { headers: authHeaders() });
        if (!res.ok) return applyAccess(false);
        const data = await res.json();
        applyAccess(data.fullAccess === true);
      } catch (err) {
        console.error('me fetch error', err);
        applyAccess(false);
      }
    }

    function applyAccess(fullAccess) {
      document.querySelectorAll('.requires-admin').forEach(el => {
        el.style.display = fullAccess ? 'inline-block' : 'none';
      });
      // Hide bursaries tab for non-admins
      if (!fullAccess) {
        const bursTab = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.toLowerCase().includes('bursaries'));
        if (bursTab) bursTab.style.display = 'none';
      }
    }

    // Load statistics
    async function loadStats() {
            try {
                const res = await fetch(API_BASE + '/api/admin/stats');
                const data = await res.json();
                document.getElementById('stat-constituents').textContent = data.constituents.total;
                document.getElementById('stat-issues').textContent = data.issues.total;
                document.getElementById('stat-bursaries').textContent = data.bursaries.total;
                document.getElementById('stat-announcements').textContent = data.announcements.total;
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        
        // Load issues
        async function loadIssues() {
            const tbody = document.getElementById('issues-tbody');
            tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading issues...</td></tr>';
            
            try {
                const res = await fetchWithAuth(API_BASE + '/api/admin/issues');
                const issues = await res.json();
                
                if (issues.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="empty">No issues reported yet</td></tr>';
                    return;
                }
                
                tbody.innerHTML = issues.map(issue => \`
                    <tr>
                        <td><strong>\${issue.ticket}</strong></td>
                        <td>\${issue.category}</td>
                        <td>\${issue.message}</td>
                        <td>\${issue.phone_number}</td>
                        <td><span class="badge \${issue.status}">\${issue.status}</span></td>
                        <td>\${new Date(issue.created_at).toLocaleString()}</td>
                    </tr>
                \`).join('');
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="6" class="error">Error loading issues: ' + err.message + '</td></tr>';
            }
        }
        
        // Load bursaries
        async function loadBursaries() {
            const tbody = document.getElementById('bursaries-tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading bursary applications...</td></tr>';
            
            try {
                const res = await fetchWithAuth(API_BASE + '/api/admin/bursaries');
                const bursaries = await res.json();
                
                if (bursaries.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="empty">No bursary applications yet</td></tr>';
                    return;
                }
                
                tbody.innerHTML = bursaries.map(b => \`
                    <tr>
                        <td><strong>\${b.ref_code}</strong></td>
                        <td>\${b.student_name}</td>
                        <td>\${b.institution}</td>
                        <td>KES \${b.amount_requested.toLocaleString()}</td>
                        <td>\${b.phone_number}</td>
                        <td><span class="badge \${b.status.toLowerCase()}">\${b.status}</span></td>
                        <td>\${new Date(b.created_at).toLocaleString()}</td>
                    </tr>
                \`).join('');
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="7" class="error">Error loading bursaries: ' + err.message + '</td></tr>';
            }
        }
        
        // Load constituents
        async function loadConstituents() {
            const tbody = document.getElementById('constituents-tbody');
            tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading constituents...</td></tr>';
            
            try {
                const res = await fetchWithAuth(API_BASE + '/api/admin/constituents');
                const constituents = await res.json();
                
                if (constituents.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="empty">No constituents registered yet</td></tr>';
                    return;
                }
                
                tbody.innerHTML = constituents.map(c => \`
                    <tr>
                        <td>\${c.phone_number}</td>
                        <td>\${c.national_id}</td>
                        <td><strong>\${c.full_name}</strong></td>
                        <td>\${c.location}</td>
                        <td>\${c.village}</td>
                        <td>\${new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                \`).join('');
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="6" class="error">Error loading constituents: ' + err.message + '</td></tr>';
            }
        }
        
        // Load announcements
        async function loadAnnouncements() {
            const tbody = document.getElementById('announcements-tbody');
            tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading announcements...</td></tr>';
            
            try {
                const res = await fetchWithAuth(API_BASE + '/api/admin/announcements');
                const announcements = await res.json();
                
                if (announcements.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="empty">No announcements yet</td></tr>';
                    return;
                }
                
                tbody.innerHTML = announcements.map(a => \`
                    <tr>
                        <td><strong>\${a.title}</strong></td>
                        <td>\${a.body}</td>
                        <td>\${new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                \`).join('');
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="3" class="error">Error loading announcements: ' + err.message + '</td></tr>';
            }
        }
        
        // Show tab
        function showTab(tab) {
            // Hide all content
            document.querySelectorAll('.content > div').forEach(div => div.style.display = 'none');
            
            // Remove active class from tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Show selected content
            document.getElementById(tab + '-content').style.display = 'block';
            
            // Add active class to tab
            event.target.classList.add('active');
            
            // Load data for selected tab
            if (tab === 'issues') loadIssues();
            else if (tab === 'bursaries') loadBursaries();
            else if (tab === 'constituents') loadConstituents();
            else if (tab === 'announcements') loadAnnouncements();
        }
        
    // Export data (fetch with auth and download)
    async function exportData(type) {
      try {
        const res = await fetchWithAuth(API_BASE + '/api/admin/export/' + type);
        if (!res.ok) return alert('Export failed: ' + res.statusText);
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Export error: ' + err.message);
      }
    }
        
    // Initialize
    document.getElementById('login-btn').addEventListener('click', showLogin);
    document.getElementById('logout-btn').addEventListener('click', doLogout);
    // Wire up modal form submit and cancel
    document.getElementById('login-form').addEventListener('submit', submitLogin);
    document.getElementById('login-cancel').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-modal').style.display = 'none';
    });
    // Close modal when clicking outside the dialog
    document.getElementById('login-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('login-modal')) {
        document.getElementById('login-modal').style.display = 'none';
      }
    });
    // reflect stored token UI
    if (TOKEN) {
      document.getElementById('login-btn').style.display = 'none';
      document.getElementById('logout-btn').style.display = 'inline-block';
    }
    fetchMe();
    loadStats();
    loadIssues();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            loadStats();
            const activeTab = document.querySelector('.tab.active').textContent.toLowerCase();
            if (activeTab.includes('issues')) loadIssues();
            else if (activeTab.includes('bursaries')) loadBursaries();
            else if (activeTab.includes('constituents')) loadConstituents();
            else if (activeTab.includes('announcements')) loadAnnouncements();
        }, 30000);
    </script>
</body>
</html>
  `);
});


// Export router for use in main server
// Expose connectDB for other modules (e.g. USSD handler) and export router
router.connectDB = connectDB;
// Bootstrap default admin on module load (best-effort)
(async function bootstrapAdmin() {
  try {
    // initializeAdmin will connect to DB and create the default admin if none exists
    await initializeAdmin();
  } catch (e) {
    console.warn('Bootstrap admin initialization failed:', e && e.message ? e.message : e);
  }
})();
module.exports = router;
