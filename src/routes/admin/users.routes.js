/**
 * Admin Users Routes (App Users / Citizens)
 * Handles viewing citizen users from Supabase
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const supabaseService = require('../../services/supabaseService');

// ============================================
// GET ALL APP USERS (Citizens from Supabase)
// ============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await supabaseService.getAllUsers();
    
    // Map to consistent format
    const formattedUsers = users.map(u => ({
      _id: u.id,
      username: u.username,
      full_name: u.full_name,
      phone: u.phone,
      id_number: u.id_number,
      village: u.village,
      created_at: u.created_at,
      source: 'Mobile App'
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error("Error fetching app users from Supabase:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET USER BY ID
// ============================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = await supabaseService.getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id: user.id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone,
      id_number: user.id_number,
      village: user.village,
      created_at: user.created_at,
      source: 'Mobile App'
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET USER STATS
// ============================================
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const users = await supabaseService.getAllUsers();
    
    // Calculate stats
    const totalUsers = users.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newToday = users.filter(u => {
      const created = new Date(u.created_at);
      return created >= today;
    }).length;

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const newThisWeek = users.filter(u => {
      const created = new Date(u.created_at);
      return created >= thisWeek;
    }).length;

    res.json({
      total: totalUsers,
      newToday,
      newThisWeek
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
