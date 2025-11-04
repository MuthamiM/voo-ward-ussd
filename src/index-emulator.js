const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const path = require("path");

// Health FIRST (no crash ever)
const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "voo-ward-ussd-emulator", ts: new Date().toISOString() });
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan("combined"));

// Static USSD simulator page
app.use(express.static(path.join(__dirname, "..", "public")));

// Simulator route
app.get("/sim", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "ussd-sim.html"));
});

// Rate limiter
const { SimpleLimiter } = require("./lib/rateLimiter");
const limiter = new SimpleLimiter({ windowMs: 60_000, max: 90 }); // 90 req/min per IP

// USSD core
const { handleUssdCore } = require("./ussdCore");

// USSD endpoint (no telco)
app.post("/ussd", (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "local";
    if (!limiter.isAllowed(ip)) {
      return res.status(429).send("END Rate limit exceeded. Try again later.");
    }
    const { sessionId="", serviceCode="*000#", phoneNumber="+254000000000", text="" } = req.body || {};
    const reply = handleUssdCore({ sessionId, serviceCode, phoneNumber, text });
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    return res.status(200).send(reply);
  } catch (e) {
    console.error("[USSD ERROR]", e);
    return res.status(500).send("END Internal server error");
  }
});

// 404 fallback
app.use((_req,res)=> res.status(404).json({error:"Not found"}));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> {
  console.log(`\n════════════════════════════════════════`);
  console.log(`  🚀 USSD EMULATOR RUNNING (NO TELCO)`);
  console.log(`════════════════════════════════════════`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  Simulator: http://localhost:${PORT}/sim`);
  console.log(`  USSD API:  http://localhost:${PORT}/ussd`);
  console.log(`════════════════════════════════════════\n`);
});
