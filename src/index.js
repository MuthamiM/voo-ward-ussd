const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const compression = require("compression");

// IMPORTANT: load ENV first
if (require.resolve("dotenv")) {
  require("dotenv").config();
}

// Initialize Sentry for error monitoring (production only)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  });
}

const app = express();

// Configure trust proxy for rate limiting and proper IP detection
app.set('trust proxy', 1);

const path = require('path');
// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Redirect root to admin dashboard  
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Enable compression for all responses
app.use(compression());

// 1) Health check with enhanced monitoring
app.get("/health", async (req, res) => {
  const health = {
    ok: true,
    service: "voo-kyamatu-ussd",
    timestamp: new Date().toISOString(),
    deployment: "2025-11-22-improvements",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('../package.json').version || '1.0.0'
  };

  // Check database connection (optional - don't fail health check)
  try {
    if (app.locals.connectDB) {
      const db = await app.locals.connectDB();
      if (db) {
        health.database = 'connected';
      }
    }
  } catch (err) {
    health.database = 'disconnected';
    health.ok = false;
  }

  res.status(health.ok ? 200 : 503).json(health);
});

// Detailed health check endpoint
app.get("/health/detailed", async (req, res) => {
  const detailed = {
    timestamp: new Date().toISOString(),
    service: "voo-kyamatu-ussd",
    status: "healthy",
    checks: {
      database: { status: "unknown" },
      redis: { status: "unknown" },
      memory: {
        status: "healthy",
        usage: process.memoryUsage(),
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      uptime: {
        status: "healthy",
        seconds: Math.floor(process.uptime()),
        formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
      }
    }
  };

  res.json(detailed);
});

// parsers & logs
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 2) USSD route (never crash on missing body.text)
app.post("/ussd", async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || "SESSION";
    const phone = req.body?.phoneNumber || "";
    const text = (req.body?.text || "").trim();

    // Minimal happy-path menu (no DB required for first response)
    if (text === "") {
      // language menu
      const msg = [
        "KYAMATU WARD - FREE SERVICE",
        "",
        "Select Language:",
        "1. English",
        "2. Swahili",
        "3. Kamba"
      ].join("\n");
      return res.send(`CON ${msg}`);
    }

    // Example next step (no DB)
    const [lang] = text.split("*");
    if (["1", "2", "3"].includes(lang)) {
      const langName = lang === "1" ? "English" : lang === "2" ? "Swahili" : "Kamba";
      const msg = [
        `Language: ${langName}`,
        "",
        "1. Register as Constituent",
        "2. Report an Issue",
        "3. Announcements",
        "4. Projects",
        "0. Back"
      ].join("\n");
      return res.send(`CON ${msg}`);
    }

    // Default
    return res.send("END Thank you.");
  } catch (e) {
    // never crash; show fail-safe END so aggregator doesn''t retry-loop
    return res.send("END Service temporarily unavailable. Try again later.");
  }
});

// 3) (Optional) DB-backed endpoints can go below; never block startup on DB.
// Mount admin dashboard API routes (merged from admin-dashboard.js)
// Defensive: some versions of admin-dashboard manage their own server and do not
// export an express router. Only call app.use when a middleware/router is exported.
// Defensive: Try multiple candidate paths for admin-dashboard and inspect file contents
const fs = require('fs');
const candidatePaths = [
  path.resolve(__dirname, 'admin-dashboard.js'),
  path.resolve(process.cwd(), 'src/admin-dashboard.js')
];

console.log('[DEBUG] CWD:', process.cwd());
let chosenPath = null;
let adminDashboard = null;
for (const p of candidatePaths) {
  try {
    const exists = fs.existsSync(p);
    console.log('[DEBUG] Checking candidate:', p, 'exists=', exists);
    if (!exists) continue;
    try {
      const stat = fs.statSync(p);
      console.log('[DEBUG] stat for', p, ':', { size: stat.size, mtime: stat.mtime });
    } catch (sErr) {
      console.warn('[WARN] Could not stat', p, sErr && sErr.message);
    }

    try {
      const sample = fs.readFileSync(p, { encoding: 'utf8' });
      const preview = sample.slice(0, 200).replace(/\n/g, '\\n');
      console.log('[DEBUG] preview for', p, ':', preview);
      const starts = preview.trim().charAt(0);
      console.log('[DEBUG] first char for', p, '->', starts);
      if (starts !== '<') {
        chosenPath = p;
        break;
      } else {
        console.warn('[WARN] Candidate looks like HTML (starts with <):', p);
      }
    } catch (rErr) {
      console.warn('[WARN] Could not read preview for', p, rErr && rErr.message);
    }
  } catch (errCheck) {
    console.warn('[WARN] Error inspecting candidate', p, errCheck && errCheck.message);
  }
}

if (!chosenPath) {
  console.error('[ERROR] No suitable admin-dashboard.js candidate found. Candidates inspected:', candidatePaths);
} else {
  console.log('[DEBUG] Requiring admin-dashboard from chosen path:', chosenPath);
  try {
    adminDashboard = require(chosenPath);
    if (typeof adminDashboard === 'function' || (adminDashboard && adminDashboard.handle)) {
      app.use('/admin', adminDashboard);
      console.log('[DEBUG] admin-dashboard mounted successfully at /admin from', chosenPath);
    } else {
      console.log('ℹ️ admin-dashboard did not export a router; assuming it manages its own server or routes. Skipping mount.');
    }
    if (adminDashboard && adminDashboard.connectDB) {
      app.locals.connectDB = adminDashboard.connectDB;
    }
  } catch (e) {
    console.error('⚠️ Failed to require admin-dashboard module from', chosenPath, 'error:', e && e.message);
    if (e && e.stack) console.error(e.stack);
  }
}

// Expose DB connector for other routers (ussd handler) if provided
if (adminDashboard && adminDashboard.connectDB) {
  app.locals.connectDB = adminDashboard.connectDB;
}

// Mount provider-agnostic USSD router at /api/ussd
try {
  const ussdRouter = require('./ussd-handler');
  app.use('/api/ussd', ussdRouter);
} catch (err) {
  console.warn('USSD router not loaded:', err.message);
}

// Mount WhatsApp webhook routes
try {
  const whatsappRouter = require('./routes/whatsapp');
  app.use('/api/whatsapp', whatsappRouter);
  console.log('✅ WhatsApp routes mounted at /api/whatsapp');
} catch (err) {
  console.warn('WhatsApp router not loaded:', err.message);
}

// Mount citizen portal routes
try {
  const citizenRouter = require('./routes/citizenPortal');
  app.use('/api/citizen', citizenRouter);
  console.log('✅ Citizen portal routes mounted at /api/citizen');
} catch (err) {
  console.warn('Citizen portal router not loaded:', err.message);
}

// Default avatar endpoint (SVG fallback for missing profile pictures)
app.get('/uploads/avatars/default-avatar.png', (req, res) => {
  const svgAvatar = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="40" fill="#6366f1"/>
    <circle cx="40" cy="32" r="12" fill="white"/>
    <path d="M16 64c0-16 10.746-24 24-24s24 8 24 24" fill="white"/>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgAvatar);
});

// Favicon endpoint
app.get('/favicon.ico', (req, res) => {
  const svgIcon = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" fill="#6366f1" rx="6"/>
    <text x="16" y="22" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">V</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgIcon);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log("Health:", `http://localhost:${PORT}/health`);
  console.log("USSD:", `http://localhost:${PORT}/ussd`);
  console.log("Citizen Portal:", `http://localhost:${PORT}/api/citizen`);
});
