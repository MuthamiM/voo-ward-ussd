const fs = require("fs");
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();

// Load environment variables
require("dotenv").config();

// MongoDB connection helper
async function getDbConnection() {
  if (!process.env.MONGO_URI) return null;
  try {
    const { getDb } = require("./lib/mongo");
    return await getDb();
  } catch (err) {
    console.error("DB connection failed:", err.message);
    return null;
  }
}

// Simple session storage
const sessions = new Map();

// Helper functions
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Middleware: Verify authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = sessions.get(token).user;
  next();
}

// Middleware: Verify MCA role
function requireMCA(req, res, next) {
  if (req.user.role !== "MCA") {
    return res.status(403).json({ error: "Access denied. MCA role required." });
  }
  next();
}

// --- HEALTH FIRST (no DB/middleware) ---
app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    service: "voo-ward-ussd", 
    env: process.env.NODE_ENV || "development" 
  });
});

// --- Basic middleware ---
app.set("trust proxy", 1);
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- Admin Dashboard Authentication Routes ---
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  
  // Fast authentication - no async/await delays
  const user = username.toLowerCase();
  
  if ((user === "admin" && password === "admin123") || (user === "mca" && password === "mca123")) {
    const token = generateSessionToken();
    const userData = {
      id: "mca-1",
      username: user,
      fullName: "MCA Administrator",
      role: "MCA"
    };
    
    sessions.set(token, { user: userData, createdAt: new Date() });
    
    return res.json({ success: true, token, user: userData });
  }
  
  if (user === "pa" && password === "pa123") {
    const token = generateSessionToken();
    const userData = {
      id: "pa-1",
      username: "pa",
      fullName: "Personal Assistant", 
      role: "PA"
    };
    
    sessions.set(token, { user: userData, createdAt: new Date() });
    
    return res.json({ success: true, token, user: userData });
  }
  
  // Quick failure response
  return res.status(401).json({ error: "Invalid credentials. Use admin/admin123 or pa/pa123" });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  sessions.delete(token);
  res.json({ success: true });
});

// Get stats
app.get("/api/admin/stats", requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    if (!db) {
      return res.json({
        constituents: { total: 0 },
        issues: { total: 0 },
        bursaries: { total: 0 },
        announcements: { total: 0 }
      });
    }
    
    const [constituents, issues, bursaries, announcements] = await Promise.all([
      db.collection("constituents").countDocuments(),
      db.collection("issues").countDocuments(),
      db.collection("bursary_applications").countDocuments(),
      db.collection("announcements").countDocuments()
    ]);
    
    res.json({
      constituents: { total: constituents },
      issues: { total: issues },
      bursaries: { total: bursaries },
      announcements: { total: announcements }
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get data endpoints
app.get("/api/admin/issues", requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    if (!db) return res.json([]);
    
    const issues = await db.collection("issues")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    // Format data for admin display
    const formatted = issues.map((issue, index) => ({
      ticket: issue.ticketNo || `ISS-${String(index + 1).padStart(3, '0')}`,
      category: 'General',
      message: `${issue.title}: ${issue.description}`,
      phone_number: issue.phone,
      reporter_name: issue.reporterName || 'Unknown',
      location: issue.location || 'Not specified',
      status: issue.status || 'open',
      created_at: issue.createdAt
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error("Issues error:", err);
    res.json([]);
  }
});

app.get("/api/admin/bursaries", requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    if (!db) return res.json([]);
    
    const bursaries = await db.collection("bursary_applications")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    // Format data for admin display
    const formatted = bursaries.map(b => ({
      ref_code: b.ref,
      student_name: b.fullName,
      institution: b.institution,
      amount_requested: b.feeBalance,
      phone_number: b.phone,
      status: b.status,
      created_at: b.createdAt
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error("Bursaries error:", err);
    res.json([]);
  }
});

app.get("/api/admin/constituents", requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    if (!db) return res.json([]);
    
    const constituents = await db.collection("constituents")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    // Format data for admin display
    const formatted = constituents.map(c => ({
      phone_number: c.phone,
      national_id: c.nationalId || 'N/A',
      full_name: c.name,
      location: c.ward || 'N/A',
      village: c.ward || 'N/A',
      created_at: c.createdAt
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error("Constituents error:", err);
    res.json([]);
  }
});

app.get("/api/admin/announcements", requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    if (!db) return res.json([]);
    
    const announcements = await db.collection("announcements")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    res.json(announcements);
  } catch (err) {
    console.error("Announcements error:", err);
    res.json([]);
  }
});

app.get("/api/auth/users", requireAuth, requireMCA, (req, res) => {
  res.json([{
    _id: "admin-1",
    username: "admin",
    full_name: "MCA Administrator",
    role: "MCA",
    created_at: new Date()
  }]);
});

// Create announcement
app.post("/api/admin/announcements", requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body required" });
    }
    
    const db = await getDbConnection();
    if (!db) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const announcement = {
      title,
      body,
      created_by: req.user.fullName,
      created_by_role: req.user.role,
      createdAt: new Date()
    };
    
    await db.collection("announcements").insertOne(announcement);
    res.json({ success: true, message: "Announcement created" });
  } catch (err) {
    console.error("Create announcement error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Export endpoints
app.get("/api/admin/export/:type", requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
  res.send('No data available\n');
});

// --- Serve admin dashboard on root path ---
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin-dashboard.html"));
});

// --- Mount USSD router (optional if file exists) ---
function safeRequire(p){ try { return fs.existsSync(p) ? require(p) : null; } catch { return null; } }
const ussd = safeRequire(path.join(__dirname, "routes", "ussd.js"));
if (ussd?.router) app.use("/", ussd.router);
else console.warn("[WARN] USSD router not found; only /health works.");

// --- 404 + error handler ---
app.use((req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err.message, err.stack || "");
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`USSD: http://localhost:${PORT}/ussd`);
});
