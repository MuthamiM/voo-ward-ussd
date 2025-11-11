/**
 * Admin Areas Route
 * Endpoint for refreshing areas cache
 */

const logger = require('../lib/logger');
const areasCache = require('../services/areasCache');

// Admin key from environment
const ADMIN_KEY = process.env.ADMIN_EXPORT_KEY || 'kyamatu-secure-2024';

/**
 * Middleware to verify admin key
 */
function verifyAdminKey(request, reply, done) {
  const providedKey = request.headers['x-admin-key'];
  
  if (!providedKey || providedKey !== ADMIN_KEY) {
    logger.warn({
      ip: request.ip,
      url: request.url
    }, 'Unauthorized admin access attempt');
    
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing X-ADMIN-KEY header'
    });
  }
  
  done();
}

/**
 * GET /admin/areas/refresh
 * Refresh areas cache
 */
async function refreshAreasCache(request, reply) {
  try {
    logger.info({ admin: true }, 'Admin requesting areas cache refresh');
    
    const result = await areasCache.refresh();
    
    return reply.send({
      success: true,
      count: result.count,
      refreshed_at: result.refreshed_at,
      message: `Areas cache refreshed with ${result.count} areas`
    });
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Error refreshing areas cache');
    
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to refresh areas cache'
    });
  }
}

/**
 * GET /admin/areas/status
 * Get areas cache status
 */
async function getAreasStatus(request, reply) {
  try {
    const status = areasCache.getStatus();
    
    return reply.send({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Error getting areas cache status');
    
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to get areas cache status'
    });
  }
}

/**
 * GET /admin/areas
 * List all areas (from cache)
 */
async function listAreas(request, reply) {
  try {
    const areas = await areasCache.getAreas();
    
    return reply.send({
      success: true,
      count: areas.length,
      areas
    });
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Error listing areas');
    
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to list areas'
    });
  }
}

/**
 * Register admin areas routes
 */
async function adminAreasRoutes(fastify, options) {
  // All routes require admin key
  fastify.addHook('preHandler', verifyAdminKey);
  
  // Refresh cache
  fastify.get('/admin/areas/refresh', {
    schema: {
      description: 'Refresh areas cache (requires X-ADMIN-KEY)',
      tags: ['admin'],
      headers: {
        type: 'object',
        properties: {
          'x-admin-key': { type: 'string' }
        },
        required: ['x-admin-key']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            refreshed_at: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, refreshAreasCache);
  
  // Get cache status
  fastify.get('/admin/areas/status', {
    schema: {
      description: 'Get areas cache status (requires X-ADMIN-KEY)',
      tags: ['admin']
    }
  }, getAreasStatus);
  
  // List areas
  fastify.get('/admin/areas', {
    schema: {
      description: 'List all areas from cache (requires X-ADMIN-KEY)',
      tags: ['admin']
    }
  }, listAreas);
  
  logger.info('Admin areas routes registered');
}

// Export as Fastify plugin (default)
module.exports = adminAreasRoutes;
