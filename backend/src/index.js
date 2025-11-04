const fs = require("fs");
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");

const app = express();

// --- HEALTH FIRST (no DB/middleware) ---
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "voo-ward-ussd", ts: new Date().toISOString() });
});

// --- Basic middleware ---
app.set("trust proxy", 1);
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- Mount USSD router (optional if file exists) ---
function safeRequire(p){ try { return fs.existsSync(p) ? require(p) : null; } catch { return null; } }
const ussd = safeRequire(path.join(__dirname, "routes", "ussd.js"));
if (ussd?.router) app.use("/", ussd.router);
else console.warn("[WARN] USSD router not found; only /health works.");

// --- 404 + error handler ---
app.use((req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err.message, err.stack || "");
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`USSD: http://localhost:${PORT}/ussd`);
});
