// Admin Key Authentication Middleware
const logger = require('../lib/logger');

async function requireAdminKey(req, reply) {
  const providedKey = req.headers['x-admin-key'];
  const validKey = process.env.ADMIN_EXPORT_KEY || 'kyamatu-admin-2024';
  
  if (!providedKey) {
    logger.warn({ ip: req.ip }, 'Admin export attempted without key');
    throw new Error('Missing X-ADMIN-KEY header');
  }
  
  if (providedKey !== validKey) {
    logger.warn({ ip: req.ip, key: providedKey.substring(0, 5) + '...' }, 'Invalid admin key');
    throw new Error('Invalid admin key');
  }
  
  logger.info({ ip: req.ip }, 'Admin export authorized');
}

module.exports = { requireAdminKey };
