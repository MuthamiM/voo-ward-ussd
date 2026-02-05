/**
 * Admin Routes Index
 * Aggregates all admin route modules and exports unified router
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const issuesRoutes = require('./issues.routes');
const usersRoutes = require('./users.routes');
const announcementsRoutes = require('./announcements.routes');
const bursaryRoutes = require('./bursary.routes');

// Database connection reference
let connectDB = null;
let sendSMS = null;

/**
 * Initialize dependencies for all route modules
 */
function setDependencies(deps) {
  connectDB = deps.connectDB;
  sendSMS = deps.sendSMS;
  
  // Pass dependencies to route modules that need them
  if (authRoutes.setDependencies) {
    authRoutes.setDependencies({ connectDB, sendSMS });
  }
  if (issuesRoutes.setDependencies) {
    issuesRoutes.setDependencies({ connectDB });
  }
  if (announcementsRoutes.setDependencies) {
    announcementsRoutes.setDependencies({ connectDB });
  }
  if (bursaryRoutes.setDependencies) {
    bursaryRoutes.setDependencies({ connectDB });
  }
}

// Mount routes
router.use('/auth', authRoutes);
router.use('/issues', issuesRoutes);
router.use('/app-users', usersRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/bursaries', bursaryRoutes);

// Health check for admin API
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'admin-api-modular',
    timestamp: new Date().toISOString(),
    routes: ['auth', 'issues', 'app-users', 'announcements', 'bursaries']
  });
});

module.exports = router;
module.exports.setDependencies = setDependencies;
