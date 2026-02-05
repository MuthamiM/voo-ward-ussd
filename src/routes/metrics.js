/**
 * Metrics Route
 * Public endpoint for system metrics and counters
 */

const logger = require('../lib/logger');
const { getRateLimitMetrics } = require('../middleware/rateLimit');
const sessionStore = require('../services/sessionStore');
const areasCache = require('../services/areasCache');
const { getCloudDb } = require('../lib/db');

// Server start time
const startTime = Date.now();

// Counters
const metrics = {
  requests_total: 0,
  registrations_total: 0,
  applications_total: 0,
  issues_total: 0
};

/**
 * Increment a metric counter
 */
function incrementMetric(name) {
  if (metrics.hasOwnProperty(name)) {
    metrics[name]++;
  }
}

/**
 * Get current metric value
 */
function getMetric(name) {
  return metrics[name] || 0;
}

/**
 * Reset all metrics (for testing)
 */
function resetMetrics() {
  metrics.requests_total = 0;
  metrics.registrations_total = 0;
  metrics.applications_total = 0;
  metrics.issues_total = 0;
}

/**
 * GET /metrics - Public metrics endpoint
 */
async function getMetrics(request, reply) {
  try {
    // Get uptime
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    // Get rate limit metrics
    const rateLimitMetrics = getRateLimitMetrics();
    
    // Get session store metrics
    const sessionMetrics = sessionStore.getMetrics();
    
    // Get areas cache status
    const cacheStatus = areasCache.getStatus();
    
    // Get database counts (cached briefly)
    let dbCounts = {
      total_members: 0,
      total_bursary_apps: 0
    };
    
    try {
      const db = getCloudDb();
      const membersCount = await db.query('SELECT COUNT(*) as count FROM constituents');
      const bursaryCount = await db.query('SELECT COUNT(*) as count FROM bursary_applications');
      
      dbCounts.total_members = parseInt(membersCount.rows[0].count) || 0;
      dbCounts.total_bursary_apps = parseInt(bursaryCount.rows[0].count) || 0;
    } catch (error) {
      logger.warn({ error: error.message }, 'Error getting database counts for metrics');
    }
    
    // Compile response
    const response = {
      uptime_s: uptimeSeconds,
      requests_total: metrics.requests_total,
      ussd_active_sessions: sessionMetrics.active_sessions,
      registrations_total: metrics.registrations_total,
      applications_total: metrics.applications_total,
      issues_total: metrics.issues_total,
      rate_limited_total: rateLimitMetrics.rate_limited_total,
      
      // Additional metrics
      database: dbCounts,
      session_store: {
        active: sessionMetrics.active_sessions,
        max_capacity: sessionMetrics.max_capacity
      },
      areas_cache: {
        cached: cacheStatus.cached,
        count: cacheStatus.count,
        expired: cacheStatus.expired
      },
      rate_limit: {
        phone_store_size: rateLimitMetrics.phone_store_size,
        session_store_size: rateLimitMetrics.session_store_size
      }
    };
    
    logger.debug(response, 'Metrics requested');
    
    return reply.send(response);
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting metrics');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics'
    });
  }
}

/**
 * Register metrics route
 */
async function metricsRoutes(fastify, options) {
  // Check if metrics are enabled
  const metricsEnabled = process.env.METRICS_ENABLED !== 'false';
  
  if (!metricsEnabled) {
    logger.info('Metrics endpoint disabled (METRICS_ENABLED=false)');
    return;
  }
  
  fastify.get('/metrics', {
    schema: {
      description: 'Get system metrics and counters',
      tags: ['metrics'],
      response: {
        200: {
          type: 'object',
          properties: {
            uptime_s: { type: 'number' },
            requests_total: { type: 'number' },
            ussd_active_sessions: { type: 'number' },
            registrations_total: { type: 'number' },
            applications_total: { type: 'number' },
            issues_total: { type: 'number' },
            rate_limited_total: { type: 'number' }
          }
        }
      }
    }
  }, getMetrics);
  
  logger.info('Metrics route registered at GET /metrics');
}

// Export as Fastify plugin (default)
module.exports = metricsRoutes;

// Also export utilities
module.exports.incrementMetric = incrementMetric;
module.exports.getMetric = getMetric;
module.exports.resetMetrics = resetMetrics;
module.exports.metrics = metrics;
