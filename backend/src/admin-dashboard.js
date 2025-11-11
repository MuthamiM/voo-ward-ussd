const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
// bcrypt for secure password hashing and migration from legacy SHA-256
const bcrypt = require('bcryptjs');

// Load environment variables
require("dotenv").config();

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
  
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  
  req.user = session.user;
  next();
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

// Helper: send notification to a phone number. Uses Twilio if configured (ACCOUNT SID, AUTH TOKEN, FROM).
// If Twilio not configured, stores notification in `notifications` collection for auditing.
async function sendNotificationToPhone(db, phone, message) {
  // normalize phone (basic)
  if (!phone || !message) return;
  const TW_SID = process.env.TWILIO_ACCOUNT_SID;
  const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TW_FROM = process.env.TWILIO_FROM;

  // record attempt in notifications collection
  const notifications = db.collection('notifications');
  const record = {
    phone,
    message,
    provider: null,
    status: 'queued',
    created_at: new Date()
  };

  try {
    if (TW_SID && TW_TOKEN && TW_FROM) {
      // send via Twilio REST API using fetch (no dependency required)
      const auth = Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64');
      const body = new URLSearchParams({ From: TW_FROM, To: phone, Body: message });
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      const data = await resp.json();
      record.provider = 'twilio';
      record.status = resp.ok ? 'sent' : 'failed';
      record.response = data;
      await notifications.insertOne(record);
      return { ok: resp.ok, result: data };
    }
  } catch (e) {
    record.status = 'error';
    record.error = e && e.message;
    await notifications.insertOne(record);
    throw e;
  }

  // Fallback: store notification for manual sending
  await notifications.insertOne(record);
  return { ok: false, queued: true };
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
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    const database = await connectDB();
    
    // FALLBACK: Allow demo login when database is not connected (local testing only)
    if (!database) {
      console.log("⚠️  Database not connected - using demo login mode");
      
      // Demo credentials: admin/admin123 or pa/pa123
      if (username.toLowerCase() === "admin" && password === "admin123") {
        const token = generateSessionToken();
        sessions.set(token, {
          user: {
            id: "demo-mca-id",
            username: "admin",
            fullName: "MCA Administrator (Demo)",
            role: "MCA"
          },
          createdAt: new Date()
        });
        
        return res.json({
          success: true,
          token,
          user: {
            id: "demo-mca-id",
            username: "admin",
            fullName: "MCA Administrator (Demo)",
            role: "MCA"
          }
        });
      } else if (username.toLowerCase() === "pa" && password === "pa123") {
        const token = generateSessionToken();
        sessions.set(token, {
          user: {
            id: "demo-pa-id",
            username: "pa",
            fullName: "Personal Assistant (Demo)",
            role: "PA"
          },
          createdAt: new Date()
        });
        
        return res.json({
          success: true,
          token,
          user: {
            id: "demo-pa-id",
            username: "pa",
            fullName: "Personal Assistant (Demo)",
            role: "PA"
          }
        });
      } else {
        return res.status(401).json({ error: "Invalid credentials. Use admin/admin123 or pa/pa123 in demo mode" });
      }
    }
    
    // PRODUCTION: Use database authentication
    // Find user
    const user = await database.collection("admin_users").findOne({
      username: username.toLowerCase()
    });

    if (!user) {
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
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create session
    const token = generateSessionToken();
    sessions.set(token, {
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

        // Notify reporter by SMS (best-effort). If messaging provider not configured, record notification in DB.
        const notifyMsg = `Your report (${id}) has been marked as ${status}. Thank you.`;
        try {
          if (updated && updated.phone_number) {
            await sendNotificationToPhone(database, updated.phone_number, notifyMsg);
          } else {
            console.warn('No phone number available on updated issue', id);
          }
        } catch (notifyErr) {
          console.warn('Notification send failed for issue', id, notifyErr && notifyErr.message);
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
    const { issueIds, status, action_note } = req.body || {};
    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return res.status(400).json({ error: 'issueIds (array) is required' });
    }

    const database = await connectDB();
    if (!database) return res.status(503).json({ error: 'Database not connected' });

    // sanitize inputs
    const targetStatus = (status || 'resolved').toString();
    const note = typeof action_note === 'string' ? action_note : undefined;

    const results = [];

    // Process in small batches to avoid timeouts
    const BATCH = 50;
    for (let i = 0; i < issueIds.length; i += BATCH) {
      const batch = issueIds.slice(i, i + BATCH);
      // For each ticket id in batch, attempt update
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

          // Post-update hooks: when resolving, update USSD interactions and notify reporter
          try {
            const newStatus = (targetStatus || '').toString().toLowerCase();
            if (newStatus === 'resolved') {
              if (updated && updated.phone_number) {
                try {
                  await database.collection('ussd_interactions').updateMany(
                    { phone_number: updated.phone_number },
                    { $set: { issue_status: targetStatus, related_ticket: ticket, updated_at: new Date() } }
                  );
                } catch (uErr) {
                  console.warn('Failed to update USSD interactions for issue', ticket, uErr && uErr.message);
                }

                const notifyMsg = `Your report (${ticket}) has been marked as ${targetStatus}. Thank you.`;
                try {
                  await sendNotificationToPhone(database, updated.phone_number, notifyMsg);
                } catch (notifyErr) {
                  console.warn('Notification send failed for issue', ticket, notifyErr && notifyErr.message);
                }
              } else {
                console.warn('No phone number available on updated issue', ticket);
              }
            }
          } catch (hookErr) {
            console.warn('Post-update hook error for issue', ticket, hookErr && hookErr.message);
          }

          results.push({ id: ticket, ok: true, issue: updated });
        } catch (errInner) {
          console.warn('Error updating issue in bulk', ticket, errInner && errInner.message);
          results.push({ id: ticket, ok: false, error: errInner && errInner.message });
        }
      }));
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.length - succeeded;

    res.json({ success: true, updated: succeeded, failed, results });
  } catch (err) {
    console.error('Bulk resolve error:', err && err.message);
    res.status(500).json({ error: err.message });
  }
});

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
}
