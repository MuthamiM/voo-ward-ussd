const express = require("express");
const router = express.Router();
const { getDb } = require("../lib/mongo");

const ALLOWED_MSISDNS = new Set(["+254114945842"]);

function norm(v){ return (v ?? "").toString().trim(); }

router.post("/ussd", async (req, res) => {
  try {
    const sessionId = norm(req.body.sessionId);
    const serviceCode = norm(req.body.serviceCode);
    const phoneNumber = norm(req.body.phoneNumber);
    const text = norm(req.body.text);

    if (!ALLOWED_MSISDNS.has(phoneNumber)) {
      return res.send("END Access restricted to VOO Kyamatu Ward.");
    }

    const parts = text ? text.split("*") : [];
    const step = parts.length;

    if (step === 0) {
      return res.send(
        "CON KYAMATU WARD - FREE SERVICE\n\n" +
        "Select Language:\n" +
        "1. English\n" +
        "2. Swahili\n" +
        "3. Kamba"
      );
    }

    if (step === 1) {
      return res.send(
        "CON Main Menu:\n" +
        "1. Register constituent\n" +
        "2. Report issue\n" +
        "3. Announcements\n" +
        "4. Projects\n" +
        "0. Exit"
      );
    }

    const haveDb = !!process.env.MONGO_URI;
    let db = null;
    if (haveDb) {
      try {
        db = await getDb();
      } catch (e) {
        db = null;
      }
    }

    if (parts[1] === "1") {
      if (step === 2) return res.send("CON Enter your full name:");
      if (step === 3) {
        if (!db) return res.send("END Service temporarily unavailable.");
        await db.collection("constituents").insertOne({
          phone: phoneNumber,
          name: parts[2],
          createdAt: new Date()
        });
        return res.send("END Registration complete. Thank you.");
      }
    }

    if (parts[1] === "2") {
      if (step === 2) return res.send("CON Enter issue title:");
      if (step === 3) return res.send("CON Describe issue:");
      if (step === 4) {
        if (!db) return res.send("END Service temporarily unavailable.");
        await db.collection("issues").insertOne({
          phone: phoneNumber,
          title: parts[2],
          description: parts[3],
          createdAt: new Date()
        });
        return res.send("END Issue submitted.");
      }
    }

    if (parts[1] === "3") {
      if (!db) return res.send("END No announcements.");
      const latest = await db.collection("announcements").find({}).project({ _id: 0, title: 1 }).sort({ createdAt: -1 }).limit(3).toArray();
      if (!latest.length) return res.send("END No announcements.");
      return res.send("END Announcements:\n" + latest.map((a,i) => (i+1) + ". " + a.title).join("\n"));
    }

    if (parts[1] === "4") {
      if (!db) return res.send("END No projects.");
      const items = await db.collection("projects").find({}).project({ _id: 0, name: 1, status: 1 }).limit(3).toArray();
      if (!items.length) return res.send("END No projects.");
      return res.send("END Projects:\n" + items.map((p,i) => (i+1) + ". " + p.name + " - " + (p.status||"ongoing")).join("\n"));
    }

    if (parts[1] === "0") return res.send("END Goodbye.");
    return res.send("END Invalid option.");
  } catch (e) {
    console.error("[USSD ERROR]", e);
    return res.status(500).send(JSON.stringify({ error: "Internal error" }));
  }
});

module.exports = { router };
