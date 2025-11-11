const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");

// IMPORTANT: load ENV first
if (require.resolve("dotenv")) {
  require("dotenv").config();
}

const app = express();


const path = require('path');
// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Redirect root to admin dashboard
app.get('/', (req, res) => {
  res.redirect('/admin-dashboard.html');
});

// 1) Health first, no DB dependency
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "voo-kyamatu-ussd", ts: new Date().toISOString() });
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
    if (["1","2","3"].includes(lang)) {
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
  path.resolve(process.cwd(), 'backend/src/admin-dashboard.js'),
  path.resolve(__dirname, '../backend/src/admin-dashboard.js'),
  path.resolve(process.cwd(), 'backend/admin-dashboard.js'),
  path.resolve(process.cwd(), 'admin-dashboard.js')
];

console.log('[DEBUG] CWD:', process.cwd());
let chosenPath = null;
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
    const adminDashboard = require(chosenPath);
    if (typeof adminDashboard === 'function' || (adminDashboard && adminDashboard.handle)) {
      app.use(adminDashboard);
      console.log('[DEBUG] admin-dashboard mounted successfully from', chosenPath);
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log("Health:", `http://localhost:${PORT}/health`);
  console.log("USSD:", `http://localhost:${PORT}/ussd`);
});
