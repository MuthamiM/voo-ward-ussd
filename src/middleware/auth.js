/**
 * Authentication Middleware Module
 * Extracted from admin-dashboard.js for modularity
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Session storage (shared with main app)
// In production, this should be Redis or MongoDB store
const sessions = new Map();

// Session cleanup interval
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS) || 1800000; // 30 minutes

setInterval(() => {
  const now = new Date();
  let cleanedCount = 0;
  for (const [token, sess] of sessions.entries()) {
    if (sess.createdAt && (now - sess.createdAt > SESSION_TIMEOUT)) {
      sessions.delete(token);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired sessions (total: ${sessions.size})`);
  }
}, 900000); // 15 minutes

// ============ PASSWORD HELPERS ============

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isBcryptHash(s) {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$') || s.startsWith('$2$'));
}

function bcryptHash(password) {
  return bcrypt.hashSync(password, 10);
}

async function bcryptCompare(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ============ AUTH MIDDLEWARE ============

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token || token === 'null' || token === 'undefined') {
    console.log('Auth failed: No valid token provided');
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = sessions.get(token);
  if (!session) {
    console.log('Auth failed: Session not found for token');
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  console.log('Auth success: User', session.user.username, 'Role:', session.user.role);
  req.user = session.user;
  next();
}

function requireMCA(req, res, next) {
  if (req.user.role !== "MCA") {
    return res.status(403).json({ error: "Access denied. MCA role required." });
  }
  next();
}

// ============ RATE LIMITER ============

let loginLimiter;
try {
  const rateLimit = require('express-rate-limit');
  loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    message: { error: 'Too many login attempts, please try again in a minute' }
  });
  console.log('Login limiter: express-rate-limit active');
} catch (e) {
  // Fallback in-memory limiter
  const attempts = new Map();
  const WINDOW_MS = 60 * 1000;
  const MAX_ATTEMPTS = 10;

  setInterval(() => {
    const now = Date.now();
    for (const [ip, info] of attempts.entries()) {
      if (now - info.firstTs > WINDOW_MS * 5) attempts.delete(ip);
    }
  }, WINDOW_MS * 2).unref();

  loginLimiter = (req, res, next) => {
    try {
      const ip = (req.ip || req.connection?.remoteAddress || 'unknown').toString();
      const now = Date.now();
      const info = attempts.get(ip) || { count: 0, firstTs: now };
      if (now - info.firstTs > WINDOW_MS) {
        info.count = 1;
        info.firstTs = now;
      } else {
        info.count += 1;
      }
      attempts.set(ip, info);
      if (info.count > MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many login attempts, please try again in a minute' });
      }
    } catch (e) {
      console.warn('Fallback limiter error', e && e.message);
    }
    return next();
  };
  console.log('Login limiter: in-process fallback active');
}

// ============ SESSION MANAGEMENT ============

function createSession(user) {
  const token = generateSessionToken();
  sessions.set(token, {
    user: {
      id: user._id || user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name
    },
    createdAt: new Date()
  });
  return token;
}

function destroySession(token) {
  return sessions.delete(token);
}

function getSession(token) {
  return sessions.get(token);
}

module.exports = {
  // Middleware
  requireAuth,
  requireMCA,
  loginLimiter,
  
  // Password helpers
  hashPassword,
  isBcryptHash,
  bcryptHash,
  bcryptCompare,
  generateSessionToken,
  
  // Session management
  sessions,
  createSession,
  destroySession,
  getSession
};
