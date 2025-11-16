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
let adminDashboard;
try {
  adminDashboard = require('./admin-dashboard');
  // support either an express Router/function or a module that starts its own server
  if (typeof adminDashboard === 'function') {
    app.use(adminDashboard);
    app.locals.adminMounted = true;
  } else if (adminDashboard && adminDashboard.router) {
    app.use(adminDashboard.router);
    app.locals.adminMounted = true;
  } else {
    console.log('ℹ️ admin-dashboard did not export a router; assuming it manages its own server or routes. Skipping mount.');
  }
} catch (err) {
  console.warn('⚠️ Failed to require admin-dashboard module:', err && err.message);
}

// Expose DB connector for other routers (if adminDashboard exported it)
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
// SPA fallback: serve admin-dashboard for any non-API/static route to avoid 404s
// Use a regex route to avoid path-to-regexp parsing issues with plain '*'.
// Debug endpoint: report whether admin routes (like /api/auth/login) are registered
app.get('/__debug/admin-routes', (req, res) => {
  try {
    const routes = [];
    // traverse app router stack
    const appStack = (app._router && app._router.stack) || [];
    appStack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // router mounted; inspect its stack
        layer.handle.stack.forEach((r) => {
          if (r.route && r.route.path) {
            routes.push({ path: r.route.path, methods: Object.keys(r.route.methods) });
          }
        });
      } else {
        // generic layer - include its name for diagnostics
        routes.push({ path: null, layer: layer.name || 'unknown' });
      }
    });
    const hasLogin = routes.some(r => r.path === '/api/auth/login' || r.path === 'api/auth/login');
    const adminMounted = !!app.locals.adminMounted;
    const appStackLength = appStack.length;
    // provide extra router diagnostics when available
    const routerDiagnostics = [];
    appStack.forEach((layer, idx) => {
      if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        routerDiagnostics.push({ index: idx, name: layer.name, stackLength: layer.handle.stack.length });
      }
    });
    // if adminDashboard exported a router, try to report its stack length
    const adminRouterStack = (typeof adminDashboard === 'object' && adminDashboard && adminDashboard.router && adminDashboard.router.stack) ? adminDashboard.router.stack.length : null;
    res.json({ ok: true, hasLogin, adminMounted, routeCount: routes.length, routes, appStackLength, routerDiagnostics, adminRouterStack });
  } catch (e) {
    res.status(500).json({ ok: false, error: e && e.message });
  }
});

// SPA fallback: serve admin-dashboard for any non-API/static route to avoid 404s
// Use a regex route to avoid path-to-regexp parsing issues with plain '*'.
app.get(/.*/, (req, res, next) => {
  const p = req.path || '';
  // Allow API, USSD, uploads and static asset paths to continue
  if (p.startsWith('/api') || p.startsWith('/ussd') || p.startsWith('/uploads') || p.startsWith('/images')) return next();
  return res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});
