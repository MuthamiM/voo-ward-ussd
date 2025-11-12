/**
 * Rate Limiting Middleware for USSD
 * - Phone-based: max 30 requests per 5 minutes
 * - Session-based: max 20 steps per 2 minutes (flood control)
 */

const logger = require('../lib/logger');

// Configuration from environment
const PHONE_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300000'); // 5 minutes
const PHONE_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '30');
const SESSION_WINDOW_MS = 120000; // 2 minutes
const SESSION_MAX_STEPS = 20;

// In-memory stores with automatic cleanup
const phoneRequests = new Map(); // phone -> [{timestamp}]
const sessionSteps = new Map(); // sessionId -> [{timestamp}]

// Metrics counter
let rateLimitedCount = 0;

/**
 * Clean up expired entries from rate limit store
 */
function cleanupStore(store, windowMs) {
  const now = Date.now();
  for (const [key, requests] of store.entries()) {
    const validRequests = requests.filter(r => now - r.timestamp < windowMs);
    if (validRequests.length === 0) {
      store.delete(key);
    } else {
      store.set(key, validRequests);
    }
  }
}

/**
 * Check if phone number has exceeded rate limit
 */
function checkPhoneRateLimit(phoneNumber) {
  if (!phoneNumber) return { allowed: true };

  const now = Date.now();
  const requests = phoneRequests.get(phoneNumber) || [];
  
  // Filter requests within window
  const recentRequests = requests.filter(r => now - r.timestamp < PHONE_WINDOW_MS);
  
  if (recentRequests.length >= PHONE_MAX_REQUESTS) {
    logger.warn({
      phone: phoneNumber,
      count: recentRequests.length,
      limit: PHONE_MAX_REQUESTS,
      window: PHONE_WINDOW_MS
    }, 'Phone rate limit exceeded');
    
    rateLimitedCount++;
    return {
      allowed: false,
      message: 'Too many requests. Please try again later.'
    };
  }
  
  // Add current request
  recentRequests.push({ timestamp: now });
  phoneRequests.set(phoneNumber, recentRequests);
  
  return { allowed: true, count: recentRequests.length };
}

/**
 * Check if session has exceeded flood control limit
 */
function checkSessionFloodControl(sessionId) {
  if (!sessionId) return { allowed: true };

  const now = Date.now();
  const steps = sessionSteps.get(sessionId) || [];
  
  // Filter steps within window
  const recentSteps = steps.filter(s => now - s.timestamp < SESSION_WINDOW_MS);
  
  if (recentSteps.length >= SESSION_MAX_STEPS) {
    logger.warn({
      sessionId,
      count: recentSteps.length,
      limit: SESSION_MAX_STEPS,
      window: SESSION_WINDOW_MS
    }, 'Session flood control triggered');
    
    rateLimitedCount++;
    return {
      allowed: false,
      message: 'Session limit reached. Please start a new session.'
    };
  }
  
  // Add current step
  recentSteps.push({ timestamp: now });
  sessionSteps.set(sessionId, recentSteps);
  
  return { allowed: true, count: recentSteps.length };
}

/**
 * Rate limiting middleware for USSD routes
 */
function ussdRateLimit(request, reply, done) {
  const { phoneNumber, sessionId } = request.body || {};
  
  // Check phone-based rate limit
  const phoneCheck = checkPhoneRateLimit(phoneNumber);
  if (!phoneCheck.allowed) {
    logger.info({ phoneNumber }, 'Rate limit response sent');
    return reply.type('text/plain').send(`END ${phoneCheck.message}`);
  }
  
  // Check session-based flood control
  const sessionCheck = checkSessionFloodControl(sessionId);
  if (!sessionCheck.allowed) {
    logger.info({ sessionId, phoneNumber }, 'Flood control response sent');
    return reply.type('text/plain').send(`END ${sessionCheck.message}`);
  }
  
  // Log rate limit status
  logger.debug({
    phoneNumber,
    sessionId,
    phoneCount: phoneCheck.count,
    sessionCount: sessionCheck.count
  }, 'Rate limit check passed');
  
  done();
}

/**
 * Cleanup expired entries periodically (every minute)
 */
setInterval(() => {
  cleanupStore(phoneRequests, PHONE_WINDOW_MS);
  cleanupStore(sessionSteps, SESSION_WINDOW_MS);
  
  logger.debug({
    phoneStoreSize: phoneRequests.size,
    sessionStoreSize: sessionSteps.size
  }, 'Rate limit store cleanup completed');
}, 60000);

/**
 * Get rate limit metrics
 */
function getRateLimitMetrics() {
  return {
    rate_limited_total: rateLimitedCount,
    phone_store_size: phoneRequests.size,
    session_store_size: sessionSteps.size
  };
}

/**
 * Reset metrics (for testing)
 */
function resetMetrics() {
  rateLimitedCount = 0;
}

module.exports = {
  ussdRateLimit,
  getRateLimitMetrics,
  resetMetrics,
  checkPhoneRateLimit,
  checkSessionFloodControl
};
