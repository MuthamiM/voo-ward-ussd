/**
 * Admin Issues Routes
 * Handles issue CRUD operations for the dashboard
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const supabaseService = require('../../services/supabaseService');

// Database connection will be injected
let connectDB = null;

function setDependencies(deps) {
  connectDB = deps.connectDB;
}

// ============================================
// GET ALL ISSUES (from Supabase)
// ============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const issues = await supabaseService.getAllIssues();
    
    // Map to consistent format for dashboard
    const formattedIssues = issues.map(issue => {
      const imageUrls = issue.images || issue.image_urls || [];
      return {
        _id: issue.id,
        ticket: issue.issue_number || (issue.id ? `ISS-${String(issue.id).slice(-6).toUpperCase()}` : null),
        title: issue.title,
        category: issue.category,
        description: issue.description,
        location: issue.location,
        status: issue.status || 'pending',
        image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        image_urls: imageUrls,
        user_id: issue.user_id,
        phone_number: issue.phone,
        action_note: issue.resolution_notes || issue.action_note,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        resolved_at: issue.resolved_at,
      };
    });

    res.json(formattedIssues);
  } catch (err) {
    console.error("Error fetching issues from Supabase:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET SINGLE ISSUE
// ============================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const issues = await supabaseService.getAllIssues();
    const issue = issues.find(i => 
      i.id === req.params.id || 
      i.issue_number === req.params.id ||
      String(i.id) === req.params.id
    );
    
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    res.json(issue);
  } catch (err) {
    console.error("Error fetching issue:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UPDATE ISSUE STATUS
// ============================================
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status, action_note } = req.body;
    const issueId = req.params.id;
    
    console.log(`📝 Updating issue ${issueId} to status: ${status}`);
    
    // Find the actual numeric ID if ticket number was provided
    let numericId = issueId;
    if (issueId.startsWith('ISS-')) {
      const issues = await supabaseService.getAllIssues();
      const issue = issues.find(i => i.issue_number === issueId);
      if (issue) {
        numericId = issue.id;
      }
    }
    
    const updates = {
      status: status,
      action_note: action_note,
      resolved_at: status === 'Resolved' ? new Date().toISOString() : null
    };
    
    const result = await supabaseService.updateIssue(numericId, updates);
    
    if (result.success) {
      res.json({ success: true, message: 'Issue updated successfully' });
    } else {
      res.status(400).json({ error: result.error || 'Update failed' });
    }
  } catch (err) {
    console.error("Error updating issue:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE ISSUE
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const issueId = req.params.id;
    
    const result = await supabaseService.deleteIssue(issueId);
    
    if (result.success) {
      res.json({ success: true, message: 'Issue deleted successfully' });
    } else {
      res.status(400).json({ error: result.error || 'Delete failed' });
    }
  } catch (err) {
    console.error("Error deleting issue:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET ISSUES BY USER
// ============================================
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const issues = await supabaseService.getIssuesByUserId(req.params.userId);
    res.json(issues);
  } catch (err) {
    console.error("Error fetching user issues:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.setDependencies = setDependencies;
