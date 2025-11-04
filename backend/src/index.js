const express = require("express");
const app = express();

// HEALTH ENDPOINT FIRST - NO DEPENDENCIES, NO MIDDLEWARE
app.get("/health", (_req, res) => {
  try {
    res.json({ ok: true, service: "voo-ward-ussd", ts: new Date().toISOString() });
  } catch (error) {
    console.error('Health endpoint error:', error);
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// Now load everything else
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const morgan = require("morgan");
require('dotenv').config();

// Import MongoDB helper and security modules
const { getDb, MONGO_URI } = require('./lib/mongo');
const { logSecurityEvent, sanitizeInput } = require('./lib/crypto');
const SecurityMiddleware = require('./middleware/security');
const PrivacyProtection = require('./lib/privacy');

app.set("trust proxy", 1);

// Initialize security middleware
const security = new SecurityMiddleware();
const privacy = new PrivacyProtection();

// Global security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Global rate limiting (disabled for USSD compatibility)
// app.use(security.globalRateLimiter.bind(security));

// Body parsing with enhanced security
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Enhanced logging with security context
app.use(morgan('combined'));

// Database connection helpers
function getCloudDb() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DB_URL
  });
  client.connect();
  return client;
}

// Database health probe - separate endpoint
app.get("/health/db", async (_req, res) => {
  try {
    const { getDb } = require("./lib/mongo");
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, db: "voo_ward" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const client = getCloudDb();
    const result = await client.query(
      'SELECT username, role, is_permanent FROM admin_users WHERE username = $1',
      [decoded.username]
    );
    
    if (result.rows.length === 0) {
      logSecurityEvent('INVALID_ADMIN_TOKEN', {
        username: decoded.username,
        ip: security.getClientIP(req),
        severity: 'HIGH'
      });
      return res.status(401).json({ error: 'Invalid admin user' });
    }

    req.user = result.rows[0];
    await client.end();
    next();
  } catch (error) {
    logSecurityEvent('ADMIN_AUTH_ERROR', {
      error: error.message,
      ip: security.getClientIP(req),
      severity: 'HIGH'
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// MongoDB endpoints for data exploration
app.get('/admin/mongo/collections', adminAuth, async (req, res) => {
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    
    logSecurityEvent('MONGO_COLLECTIONS_ACCESSED', {
      admin: req.user?.username,
      ip: security.getClientIP(req),
      severity: 'INFO'
    });
    
    res.json({
      database: 'voo_ward',
      collections: collections.map(c => ({
        name: c.name,
        type: c.type
      }))
    });
  } catch (error) {
    logSecurityEvent('MONGO_ACCESS_ERROR', {
      error: error.message,
      admin: req.user?.username,
      severity: 'HIGH'
    });
    res.status(500).json({ error: 'MongoDB access failed' });
  }
});

app.get('/admin/mongo/collection/:name/count', adminAuth, async (req, res) => {
  try {
    const db = await getDb();
    const collectionName = sanitizeInput(req.params.name);
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    
    logSecurityEvent('MONGO_COLLECTION_COUNT', {
      collection: collectionName,
      admin: req.user?.username,
      ip: security.getClientIP(req),
      severity: 'INFO'
    });
    
    res.json({
      collection: collectionName,
      count
    });
  } catch (error) {
    logSecurityEvent('MONGO_COUNT_ERROR', {
      error: error.message,
      admin: req.user?.username,
      severity: 'MEDIUM'
    });
    res.status(500).json({ error: 'Collection count failed' });
  }
});

function safeRequire(p){ try { return fs.existsSync(p) ? require(p) : null; } catch { return null; } }

// MongoDB CRUD Routes - Production Ready with Strict Security
const mongoCrud = safeRequire(path.join(__dirname, 'routes', 'mongo-crud.js'));
if (mongoCrud) {
  // Constituents routes
  app.get('/api/constituents', security.globalRateLimiter.bind(security), mongoCrud.getConstituents);
  app.get('/api/constituents/:id', security.globalRateLimiter.bind(security), mongoCrud.getConstituent);
  app.post('/api/constituents', security.globalRateLimiter.bind(security), ...mongoCrud.createConstituent);
  app.put('/api/constituents/:id', security.globalRateLimiter.bind(security), mongoCrud.updateConstituent);
  app.delete('/api/constituents/:id', security.globalRateLimiter.bind(security), mongoCrud.deleteConstituent);
  
  // Issues routes
  app.get('/api/issues', security.globalRateLimiter.bind(security), mongoCrud.getIssues);
  app.post('/api/issues', security.globalRateLimiter.bind(security), ...mongoCrud.createIssue);
  app.put('/api/issues/:id', security.globalRateLimiter.bind(security), mongoCrud.updateIssue);
  
  // Announcements routes (public read, admin write)
  app.get('/api/announcements', mongoCrud.getAnnouncements);
  app.post('/api/announcements', security.globalRateLimiter.bind(security), ...mongoCrud.createAnnouncement);
  
  // Projects routes (public read, admin write)
  app.get('/api/projects', mongoCrud.getProjects);
  app.post('/api/projects', security.globalRateLimiter.bind(security), ...mongoCrud.createProject);
  app.put('/api/projects/:id', security.globalRateLimiter.bind(security), mongoCrud.updateProject);
  
  console.log('[ROUTES] MongoDB CRUD routes loaded with strict security');
} else {
  console.log('[ROUTES] MongoDB CRUD routes not loaded - file missing');
}

// USSD endpoint (security disabled temporarily for Africa's Talking compatibility)
const ussd = safeRequire(path.join(__dirname,"routes","ussd.js")) || safeRequire(path.join(__dirname,"ussd.js")) || safeRequire(path.join(__dirname,"ussd","index.js"));
if (ussd?.handleUSSD) {
  app.post("/ussd", ussd.handleUSSD);
  console.log('[ROUTES] USSD endpoint loaded at POST /ussd');
} else {
  console.log('[ROUTES] USSD endpoint not loaded - file missing or no handleUSSD export');
}

// SMS endpoint with security
const sms = safeRequire(path.join(__dirname,"sms.js")) || safeRequire(path.join(__dirname,"sms","index.js"));
if (sms?.handleInboundSMS) {
  app.post("/sms", 
    security.globalRateLimiter.bind(security),
    sms.handleInboundSMS
  );
}

// Admin login endpoint with enhanced security
app.post('/admin/login',
  security.authRateLimiter.bind(security),
  security.authenticationMiddleware.bind(security),
  async (req, res) => {
    try {
      const { username, pin } = req.body;
      
      if (!username || !pin) {
        logSecurityEvent('LOGIN_MISSING_CREDENTIALS', {
          ip: security.getClientIP(req),
          severity: 'LOW'
        });
        return res.status(400).json({ error: 'Username and PIN required' });
      }

      const client = getCloudDb();
      const result = await client.query(
        'SELECT * FROM admin_users WHERE username = $1',
        [sanitizeInput(username)]
      );

      if (result.rows.length === 0) {
        logSecurityEvent('LOGIN_INVALID_USER', {
          username: sanitizeInput(username),
          ip: security.getClientIP(req),
          severity: 'MEDIUM'
        });
        await client.end();
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(pin, user.pin_hash);

      if (!isValid) {
        logSecurityEvent('LOGIN_INVALID_PIN', {
          username: sanitizeInput(username),
          ip: security.getClientIP(req),
          severity: 'HIGH'
        });
        await client.end();
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      logSecurityEvent('LOGIN_SUCCESS', {
        username: user.username,
        role: user.role,
        ip: security.getClientIP(req),
        severity: 'INFO'
      });

      await client.end();
      res.json({
        token,
        user: {
          username: user.username,
          role: user.role,
          is_permanent: user.is_permanent
        }
      });
    } catch (error) {
      logSecurityEvent('LOGIN_ERROR', {
        error: error.message,
        ip: security.getClientIP(req),
        severity: 'HIGH'
      });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Error handling middleware
app.use((error, req, res, next) => {
  logSecurityEvent('SERVER_ERROR', {
    error: error.message,
    url: req.url,
    method: req.method,
    ip: security.getClientIP(req),
    severity: 'HIGH'
  });
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message 
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log(`[SECURITY] Enterprise protection: ENABLED`);
  
  // Initialize PostgreSQL connection pool
  try {
    const { initDevDb } = require('./lib/db');
    await initDevDb();
    console.log(`[DATABASE] PostgreSQL: READY`);
  } catch (error) {
    console.log(`[DATABASE] PostgreSQL: ERROR - ${error.message}`);
  }
  
  // MongoDB connection validation
  try {
    const mongoDb = await getDb();
    await mongoDb.admin().ping();
    console.log(`[DATABASE] MongoDB: READY`);
  } catch (error) {
    console.log(`[DATABASE] MongoDB: UNAVAILABLE`);
  }
  
  logSecurityEvent('PRODUCTION_SERVER_START', {
    port: PORT,
    environment: process.env.NODE_ENV || 'production',
    databases: ['postgresql', 'mongodb'],
    security_level: 'ENTERPRISE',
    severity: 'INFO'
  });
});
