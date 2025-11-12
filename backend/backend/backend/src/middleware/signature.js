/**
 * Signature Verification Middleware for Africa's Talking USSD
 * Verifies HMAC signature in X-AT-Signature header
 * Optional - enabled via VERIFY_SIGNATURE env var
 */

const crypto = require('crypto');
const logger = require('../lib/logger');

// Configuration
const VERIFY_SIGNATURE = process.env.VERIFY_SIGNATURE === 'true';
const AT_API_KEY = process.env.AT_API_KEY || '';

/**
 * Verify HMAC-SHA256 signature from Africa's Talking
 * @param {string} payload - Raw request body as string
 * @param {string} signature - X-AT-Signature header value
 * @param {string} secret - Africa's Talking API key
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    return false;
  }
  
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Signature verification error');
    return false;
  }
}

/**
 * Signature verification middleware
 * Only runs if VERIFY_SIGNATURE=true in environment
 */
function signatureVerification(request, reply, done) {
  // Skip if verification is disabled
  if (!VERIFY_SIGNATURE) {
    logger.debug('Signature verification disabled (VERIFY_SIGNATURE=false)');
    return done();
  }
  
  // Skip if no API key configured
  if (!AT_API_KEY) {
    logger.warn('Signature verification enabled but AT_API_KEY not set');
    return done();
  }
  
  const signature = request.headers['x-at-signature'];
  
  // Check if signature header is present
  if (!signature) {
    logger.warn({
      ip: request.ip,
      url: request.url
    }, 'Missing X-AT-Signature header');
    
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing signature header'
    });
  }
  
  // Get raw body for verification
  const rawBody = request.rawBody || JSON.stringify(request.body);
  
  // Verify signature
  const isValid = verifySignature(rawBody, signature, AT_API_KEY);
  
  if (!isValid) {
    logger.warn({
      ip: request.ip,
      url: request.url,
      signature: signature.substring(0, 16) + '...'
    }, 'Invalid signature');
    
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid signature'
    });
  }
  
  logger.debug('Signature verification passed');
  done();
}

/**
 * Fastify plugin to capture raw body before parsing
 * Required for signature verification
 */
async function rawBodyPlugin(fastify, options) {
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => {
      // Store raw body for signature verification
      req.rawBody = body;
      
      // Parse the body
      const parsed = {};
      body.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          parsed[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
      
      done(null, parsed);
    }
  );
}

module.exports = {
  signatureVerification,
  rawBodyPlugin,
  verifySignature
};
