const logger = require('../lib/logger');
const { getCloudDb } = require('../lib/db');

// Dev mode data counters
function getDevStats() {
  // Import dev data from admin.js would cause circular dependency
  // So we'll return a simple count based on what we know
  return {
    constituents: 2, // Current registered count
    applications: 0,
    issues: 0,
    latest_registered_at: new Date().toISOString()
  };
}

async function handleGetStats(req, reply) {
  // Dev mode: return dev data counts
  if (process.env.NODE_ENV === 'development') {
    const stats = getDevStats();
    return reply.send(stats);
  }
  
  // Production mode: query database
  const db = getCloudDb();
  try {
    const constituentRes = await db.query('SELECT COUNT(*) as count FROM members');
    const applicationRes = await db.query('SELECT COUNT(*) as count FROM bursary_applications');
    const issueRes = await db.query('SELECT COUNT(*) as count FROM issues');
    const latestRes = await db.query('SELECT MAX(created_at) as latest FROM members');
    
    return reply.send({
      constituents: parseInt(constituentRes.rows[0].count),
      applications: parseInt(applicationRes.rows[0].count),
      issues: parseInt(issueRes.rows[0].count),
      latest_registered_at: latestRes.rows[0].latest
    });
  } catch(err) {
    logger.error('Get stats error:', err);
    return reply.status(500).send({ error: 'Failed to fetch stats' });
  }
}

module.exports = { handleGetStats };
