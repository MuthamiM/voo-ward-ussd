// Clean admin-dashboard router implementation.
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

const router = express.Router();
router.use(express.json());

// Minimal session store and helpers so the router can validate tokens.
// This is a lightweight shim used for the fallback env-based login.
const sessions = new Map();
const upload = multer({ storage: multer.memoryStorage() });

function generateSessionToken() {
  return crypto.randomBytes(16).toString('hex');
}

function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
    req.user = session.user;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

function requireMCA(req, res, next) {
  if (!req.user || req.user.role !== 'MCA') return res.status(403).json({ error: 'Access denied. MCA role required.' });
  return next();
}

// Lightweight DB connector (returns null when no MONGO_URI)
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'voo');
    db._client = client;
    return db;
  } catch (e) {
    console.warn('admin-dashboard: connectDB failed:', e && e.message);
    return null;
  }
}

// Health
router.get('/health', (req, res) => res.json({ ok: true, service: 'admin-dashboard', ts: new Date().toISOString() }));

// Simple env-backed login for when DB is not configured
router.post('/api/auth/login', async (req, res) => {
  try {
    console.log('admin-dashboard: login attempt', { ip: req.ip, body: req.body && { username: req.body.username ? 'REDACTED' : undefined } });
    const { username, password } = req.body || {};
    const okUser = (process.env.ADMIN_USER || 'admin').toString();
    const okPass = (process.env.ADMIN_PASS || 'admin123').toString();
    if (username === okUser && password === okPass) {
      const token = (Math.random().toString(36).slice(2) + Date.now().toString(36));
      // store a minimal session so subsequent requireAuth can validate this token
      sessions.set(token, { user: { username: okUser, role: 'MCA', fullName: okUser }, created_at: Date.now() });
      return res.json({ token, fullAccess: true });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (e) {
    console.error('login error', e && e.message);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Minimal stats endpoint: attempts to use DB if available, otherwise returns zeros.
router.get('/api/admin/stats', async (req, res) => {
  const stats = { constituents: { total: 0 }, issues: { total: 0 }, bursaries: { total: 0 }, announcements: { total: 0 } };
  try {
    const db = await connectDB();
    if (db) {
      try {
        stats.constituents.total = await db.collection('constituents').countDocuments();
        stats.issues.total = await db.collection('issues').countDocuments();
        stats.bursaries.total = await db.collection('bursaries').countDocuments();
        stats.announcements.total = await db.collection('announcements').countDocuments();
      } catch (e) {
        console.warn('admin/stats: query failed', e && e.message);
      }
      try { if (db._client) await db._client.close(); } catch (e) {}
    }
  } catch (e) {
    console.warn('admin/stats failed:', e && e.message);
  }
  res.json(stats);
});

// Legacy /old: redirect to static file served by parent app
router.get('/old', (req, res) => {
  res.redirect('/admin-dashboard.html');
});

// Expose connectDB for other modules
router.connectDB = connectDB;

// Export router so parent app can mount admin routes
module.exports = router;

// Best-effort bootstrap (do not start HTTP server here)
(async function bootstrapAdmin() {
  try {
    const db = await connectDB();
    if (db) {
      console.log('admin-dashboard: MongoDB connected (bootstrap)');
      try { if (db._client) await db._client.close(); } catch (e) {}
    } else {
      console.log('admin-dashboard: MongoDB not configured');
    }
  } catch (e) {
    console.warn('admin-dashboard bootstrap failed:', e && e.message);
  }
})();

module.exports.connectDB = connectDB;


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

// Update issue status and action note (PA and MCA can access)
router.patch("/api/admin/issues/:id", requireAuth, async (req, res) => {
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
router.post('/api/admin/issues/bulk-resolve', requireAuth, requireMCA, async (req, res) => {
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

// Simple chatbot/help endpoint to guide admins in using the dashboard
router.post('/api/admin/chatbot', requireAuth, async (req, res) => {
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
router.get('/api/admin/chatbot-kb', requireAuth, requireMCA, async (req, res) => {
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
router.post('/api/admin/chatbot-kb', requireAuth, requireMCA, async (req, res) => {
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
router.post('/api/admin/profile', requireAuth, upload.single('photo'), async (req, res) => {
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
router.delete('/api/admin/profile/photo', requireAuth, async (req, res) => {
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
router.post('/api/ussd', async (req, res) => {
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
router.get('/api/admin/ussd', requireAuth, async (req, res) => {
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
router.get('/api/admin/export/ussd', requireAuth, async (req, res) => {
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
      if (!user || !pass) {
        if (typeof showToast === 'function') showToast('Enter username and password', 'error'); else console.warn('Enter username and password');
        return;
      }
      try {
        const res = await fetch(API_BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (!res.ok) {
          if (typeof showToast === 'function') showToast('Login failed: ' + (data.error || JSON.stringify(data)), 'error'); else console.warn('Login failed: ' + (data.error || JSON.stringify(data)));
          return;
        }
        TOKEN = data.token;
        localStorage.setItem('token', TOKEN);
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.getElementById('login-modal').style.display = 'none';
        await fetchMe();
        loadStats(); loadIssues();
  } catch (err) { if (typeof showToast === 'function') showToast('Login error: ' + err.message, 'error'); else console.warn('Login error: ' + err.message); }
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
        if (!res.ok) {
          if (typeof showToast === 'function') showToast('Export failed: ' + res.statusText, 'error'); else console.warn('Export failed: ' + res.statusText);
          return;
        }
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
        if (typeof showToast === 'function') showToast('Export error: ' + err.message, 'error'); else console.warn('Export error: ' + err.message);
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



