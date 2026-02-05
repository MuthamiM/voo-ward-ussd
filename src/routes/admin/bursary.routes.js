/**
 * Admin Bursary Routes
 * Handles bursary application management
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { requireAuth, requireMCA } = require('../../middleware/auth');

// Database connection will be injected
let connectDB = null;

function setDependencies(deps) {
  connectDB = deps.connectDB;
}

// ============================================
// GET ALL BURSARY APPLICATIONS (MCA only)
// ============================================
router.get('/', requireAuth, requireMCA, async (req, res) => {
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

// ============================================
// GET BURSARY BY ID
// ============================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const bursary = await database.collection("bursary_applications").findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!bursary) {
      return res.status(404).json({ error: 'Bursary application not found' });
    }

    res.json(bursary);
  } catch (err) {
    console.error("Error fetching bursary:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// APPROVE BURSARY (MCA only)
// ============================================
router.post('/:id/approve', requireAuth, requireMCA, async (req, res) => {
  try {
    const { amount, notes } = req.body;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    await database.collection("bursary_applications").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: 'Approved',
          approved_amount: amount,
          approval_notes: notes,
          approved_by: req.user.username,
          approved_at: new Date(),
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, message: 'Application approved' });
  } catch (err) {
    console.error("Error approving bursary:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// REJECT BURSARY (MCA only)
// ============================================
router.post('/:id/reject', requireAuth, requireMCA, async (req, res) => {
  try {
    const { reason } = req.body;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    await database.collection("bursary_applications").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: 'Rejected',
          rejection_reason: reason,
          rejected_by: req.user.username,
          rejected_at: new Date(),
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, message: 'Application rejected' });
  } catch (err) {
    console.error("Error rejecting bursary:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET BURSARY STATS
// ============================================
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$requested_amount' }
        }
      }
    ];

    const stats = await database.collection("bursary_applications")
      .aggregate(pipeline)
      .toArray();

    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalRequested: 0,
      totalApproved: 0
    };

    stats.forEach(s => {
      summary.total += s.count;
      if (s._id === 'Pending' || !s._id) summary.pending = s.count;
      if (s._id === 'Approved') {
        summary.approved = s.count;
        summary.totalApproved = s.totalAmount || 0;
      }
      if (s._id === 'Rejected') summary.rejected = s.count;
      summary.totalRequested += s.totalAmount || 0;
    });

    res.json(summary);
  } catch (err) {
    console.error("Error fetching bursary stats:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.setDependencies = setDependencies;
