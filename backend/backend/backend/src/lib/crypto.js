const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Enhanced encryption for sensitive data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

// Encrypt sensitive text data
function encryptSensitive(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('ussd-system'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex')
  };
}

// Decrypt sensitive text data
function decryptSensitive(encryptedObj) {
  if (!encryptedObj || !encryptedObj.data) return null;
  
  try {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('ussd-system'));
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

// Enhanced phone hashing with salt
function hashPhone(phone) {
  const norm = phone.replace(/\D/g,'').slice(-9);
  const salt = process.env.PHONE_SALT || 'kyamatu-ward-2024';
  return crypto.createHash('sha256').update(norm + salt).digest('hex');
}

// Enhanced ID hashing with salt
function hashId(id) {
  const salt = process.env.ID_SALT || 'kenya-national-id-2024';
  return crypto.createHash('sha256').update(String(id) + salt).digest('hex');
}

// Get last 4 digits of ID for display (anonymized)
function getIdLast4(id) {
  return String(id).slice(-4);
}

// Enhanced PIN hashing with higher cost factor
function hashPin(pin) {
  return bcrypt.hashSync(String(pin), 14); // Increased from 12 to 14
}

// Verify PIN with timing attack protection
function verifyPin(pin, hash) {
  if (!pin || !hash) return false;
  
  try {
    return bcrypt.compareSync(String(pin), hash);
  } catch (error) {
    console.error('PIN verification error:', error.message);
    return false;
  }
}

// Generate secure ticket numbers
function generateTicket() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${timestamp}-${random}`;
}

// Generate secure session tokens
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash sensitive data for searching (searchable encryption)
function hashForSearch(text) {
  if (!text) return null;
  const salt = process.env.SEARCH_SALT || 'search-index-2024';
  return crypto.createHash('sha256').update(String(text).toLowerCase() + salt).digest('hex');
}

// Anonymize phone number for logging
function anonymizePhone(phone) {
  if (!phone) return 'N/A';
  const clean = phone.replace(/\D/g,'');
  if (clean.length < 4) return '***';
  return clean.slice(0, 3) + '*'.repeat(clean.length - 6) + clean.slice(-3);
}

// Anonymize national ID for logging
function anonymizeId(id) {
  if (!id) return 'N/A';
  const str = String(id);
  if (str.length < 4) return '***';
  return str.slice(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);
}

// Generate secure API keys
function generateApiKey() {
  const prefix = 'voo_';
  const random = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '');
  return prefix + random;
}

// Validate input for SQL injection protection
function sanitizeInput(input) {
  if (!input) return '';
  return String(input)
    .replace(/[<>'"]/g, '')
    .replace(/--/g, '')
    .replace(/;/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim()
    .slice(0, 1000); // Limit length
}

// Rate limiting token bucket
class RateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  tryConsume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
  
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Security event logger
function logSecurityEvent(event, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    severity: details.severity || 'INFO',
    source_ip: details.ip || 'unknown',
    user_agent: details.userAgent || 'unknown',
    details: {
      ...details,
      // Remove sensitive data from logs
      phone: details.phone ? anonymizePhone(details.phone) : undefined,
      national_id: details.national_id ? anonymizeId(details.national_id) : undefined
    }
  };
  
  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  
  // In production, send to security monitoring system
  if (process.env.NODE_ENV === 'production' && process.env.SECURITY_WEBHOOK) {
    // Send to external monitoring (implement based on your monitoring solution)
  }
}

module.exports = {
  // Original functions (enhanced)
  hashPhone,
  hashId,
  getIdLast4,
  hashPin,
  verifyPin,
  generateTicket,
  
  // New security functions
  encryptSensitive,
  decryptSensitive,
  generateSessionToken,
  hashForSearch,
  anonymizePhone,
  anonymizeId,
  generateApiKey,
  sanitizeInput,
  RateLimiter,
  logSecurityEvent
};
