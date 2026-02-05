/**
 * Admin Announcements Routes
 * Handles announcement CRUD operations for the dashboard
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { requireAuth } = require('../../middleware/auth');
const supabaseService = require('../../services/supabaseService');

// Database connection will be injected
let connectDB = null;

function setDependencies(deps) {
  connectDB = deps.connectDB;
}

// ============================================
// GET ALL ANNOUNCEMENTS
// ============================================
router.get('/', requireAuth, async (req, res) => {
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

// ============================================
// CREATE ANNOUNCEMENT
// ============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, body, priority, target_audience } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const announcement = {
      title: title.trim(),
      body: body.trim(),
      content: body.trim(),
      priority: priority || 'normal',
      target_audience: target_audience || 'all',
      is_active: true,
      created_by: req.user.username,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await database.collection("announcements").insertOne(announcement);

    // Also create in Supabase for mobile app sync
    try {
      await supabaseService.createAnnouncement({
        title: announcement.title,
        body: announcement.body,
        priority: announcement.priority,
        target_audience: announcement.target_audience
      });
    } catch (supErr) {
      console.warn('Failed to sync announcement to Supabase:', supErr.message);
    }

    res.json({ 
      success: true, 
      _id: result.insertedId,
      message: 'Announcement created successfully' 
    });
  } catch (err) {
    console.error("Error creating announcement:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UPDATE ANNOUNCEMENT
// ============================================
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { title, body, is_active, priority } = req.body;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const updateData = { updated_at: new Date() };
    if (title) updateData.title = title.trim();
    if (body) updateData.body = body.trim();
    if (typeof is_active === 'boolean') updateData.is_active = is_active;
    if (priority) updateData.priority = priority;

    await database.collection("announcements").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    res.json({ success: true, message: 'Announcement updated successfully' });
  } catch (err) {
    console.error("Error updating announcement:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE ANNOUNCEMENT
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    await database.collection("announcements").deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.setDependencies = setDependencies;
