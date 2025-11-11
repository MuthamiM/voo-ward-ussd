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

// Create user (MCA only)
app.post("/api/auth/users", requireAuth, requireMCA, async (req, res) => {
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
    res.json({ success: true, message: `Issue ${id} updated`, update });
  } catch (err) {
    console.error("Error updating issue:", err);
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
        console.log('🗑️ Removed legacy PA user: martin');
      }
    } catch (e) {
      console.warn('⚠️ Failed to remove martin user (if existed):', e && e.message);
    }
  } catch (err) {
    console.error("❌ Error initializing admin user:", err.message);
  }
}

// OLD HTML CODE REMOVED - Now served from file
app.get("/old", (req, res) => {
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
                <button class="export-btn" onclick="exportData('issues')">📥 Export Issues CSV</button>
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
                <button class="export-btn" onclick="exportData('bursaries')">📥 Export Bursaries CSV</button>
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
                <button class="export-btn" onclick="exportData('constituents')">📥 Export Constituents CSV</button>
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
                const res = await fetch(API_BASE + '/api/admin/issues');
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
                const res = await fetch(API_BASE + '/api/admin/bursaries');
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
                const res = await fetch(API_BASE + '/api/admin/constituents');
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
                const res = await fetch(API_BASE + '/api/admin/announcements');
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
        
        // Export data
        function exportData(type) {
            window.location.href = API_BASE + '/api/admin/export/' + type;
        }
        
        // Initialize
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

// Start server
const PORT = process.env.ADMIN_PORT || 5000;
app.listen(PORT, async () => {
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
});
