// backend/src/routes/ussd.js
const express = require("express");
const router = express.Router();
const { getDb } = require("../lib/mongo");

const ALLOWED_MSISDNS = new Set(["+254114945842"]); // temporary access gate

function norm(v){ return (v ?? "").toString().trim(); }
function asParts(text){ return norm(text).length ? norm(text).split("*") : []; }
function normalizeKenyanPhone(p){
  const s = (p||"").replace(/\D+/g,"");
  if (s.startsWith("2547")) return "+" + s;
  if (s.startsWith("07")) return "+254" + s.slice(1);
  if (s.startsWith("7")) return "+254" + s;
  return "+" + s; // last resort
}
function isNumeric(x){ return /^[0-9]+$/.test(x||""); }

// Extract DOB from Kenyan ID number (YYMMDD format in first 6 digits)
function extractDOBFromID(idNo) {
  if (!idNo || idNo.length < 6) return null;
  const yymmdd = idNo.slice(0, 6);
  if (!isNumeric(yymmdd)) return null;
  
  const yy = parseInt(yymmdd.slice(0, 2));
  const mm = parseInt(yymmdd.slice(2, 4));
  const dd = parseInt(yymmdd.slice(4, 6));
  
  // Basic validation
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  
  // Determine century (assume 1900s if yy > 30, else 2000s)
  const year = yy > 30 ? 1900 + yy : 2000 + yy;
  
  try {
    const dob = new Date(year, mm - 1, dd);
    if (isNaN(dob.getTime())) return null;
    return dob;
  } catch {
    return null;
  }
}

function mainMenu(){
  return (
    "CON Main Menu:\n" +
    "1. Register constituent\n" +
    "2. Report issue\n" +
    "3. Announcements\n" +
    "4. Projects\n" +
    "5. Bursary\n" +
    "0. Exit"
  );
}

router.post("/ussd", async (req, res) => {
  try {
    const sessionId = norm(req.body.sessionId);
    const serviceCode = norm(req.body.serviceCode);
    const phoneNumber = norm(req.body.phoneNumber);
    const text = norm(req.body.text);
    const parts = asParts(text);
    const step = parts.length;

    // temporary ward-only gate
    if (!ALLOWED_MSISDNS.has(phoneNumber)) {
      return res.send("END Access restricted to VOO Kyamatu Ward.");
    }

    // Language screen (step 0)
    if (step === 0) {
      return res.send(
        "CON KYAMATU WARD - FREE SERVICE\n\n" +
        "Select Language:\n" +
        "1. English\n" +
        "2. Swahili\n" +
        "3. Kamba"
      );
    }

    // Main menu (step 1)
    if (step === 1) {
      return res.send(mainMenu());
    }

    // Mongo (optional). If env missing, features that need DB will return temporary message.
    let db = null;
    if (process.env.MONGO_URI) {
      try { db = await getDb(); } catch { db = null; }
    }

    // --- Option 1: Register constituent ---
    if (parts[1] === "1") {
      if (step === 2) return res.send("CON Enter your full name:\n\n0. Back to Main Menu");
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        return res.send("CON Enter your Ward/Village:\n\n0. Back to Main Menu");
      }
      if (step === 4) {
        if (parts[3] === "0") return res.send(mainMenu());
        return res.send("CON Enter your National ID (optional).\n\n0. Skip and Complete");
      }
      if (step === 5) {
        if (!db) return res.send("END Service temporarily unavailable (DB).");
        
        const nationalId = parts[4] === "0" ? null : parts[4];
        const dob = nationalId ? extractDOBFromID(nationalId) : null;
        
        await db.collection("constituents").insertOne({
          phone: phoneNumber,
          name: parts[2],
          ward: parts[3],
          nationalId: nationalId,
          dateOfBirth: dob,
          createdAt: new Date()
        });
        return res.send("END Registration complete. Thank you.");
      }
    }

    // --- Option 2: Report issue ---
    if (parts[1] === "2") {
      if (step === 2) return res.send("CON Enter your name:\n\n0. Back to Main Menu");
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        return res.send("CON Enter issue title:\n\n0. Back to Main Menu");
      }
      if (step === 4) {
        if (parts[3] === "0") return res.send(mainMenu());
        return res.send("CON Describe your issue briefly:\n\n0. Back to Main Menu");
      }
      if (step === 5) {
        if (parts[4] === "0") return res.send(mainMenu());
        return res.send("CON Nearest location/landmark (optional).\n\n0. Skip and Submit");
      }
      if (step === 6) {
        if (!db) return res.send("END Service temporarily unavailable (DB).");
        
        // Generate ticket number
        const ticketNo = "TKT-" + Date.now().toString(36).toUpperCase().slice(-6);
        
        await db.collection("issues").insertOne({
          ticketNo: ticketNo,
          phone: phoneNumber,
          reporterName: parts[2],
          title: parts[3],
          description: parts[4],
          location: parts[5] === "0" ? null : parts[5],
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return res.send(`END Issue submitted. Ticket: ${ticketNo}. We'll follow up.`);
      }
    }

    // --- Option 3: Announcements ---
    if (parts[1] === "3") {
      if (!db) return res.send("END No announcements right now.");
      const latest = await db.collection("announcements")
        .find({}).project({ _id: 0, title: 1 })
        .sort({ createdAt: -1 }).limit(3).toArray();

      if (step === 2) {
        if (!latest.length) return res.send("END No announcements right now.");
        const lines = latest.map((a, i) => `${i+1}. ${a.title}`).join("\n");
        return res.send("CON Announcements:\n" + lines + "\n0. Back");
      }
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        const n = Number(parts[2]);
        if (n >= 1 && n <= latest.length) {
          const item = latest[n-1];
          return res.send("END " + item.title);
        }
        return res.send("END Invalid option.");
      }
    }

    // --- Option 4: Projects ---
    if (parts[1] === "4") {
      if (!db) return res.send("END No projects to show.");
      const items = await db.collection("projects")
        .find({}).project({ _id: 0, name: 1, status: 1 })
        .limit(3).toArray();

      if (step === 2) {
        if (!items.length) return res.send("END No projects to show.");
        const lines = items.map((p,i)=>`${i+1}. ${p.name} - ${p.status||"ongoing"}`).join("\n");
        return res.send("CON Projects:\n" + lines + "\n0. Back");
      }
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        const n = Number(parts[2]);
        if (n >= 1 && n <= items.length) {
          const item = items[n-1];
          return res.send("END " + item.name + " - " + (item.status || "ongoing"));
        }
        return res.send("END Invalid option.");
      }
    }

    // --- Option 5: Bursary (Apply / Status / Requirements) ---
    if (parts[1] === "5") {
      // Submenu
      if (step === 2) {
        return res.send(
          "CON Bursary:\n" +
          "1. Apply\n" +
          "2. Check status\n" +
          "3. Requirements\n" +
          "0. Back"
        );
      }

      // 5->0 Back
      if (parts[2] === "0") return res.send(mainMenu());

      // 5->3 Requirements
      if (parts[2] === "3") {
        return res.send(
          "END Requirements:\n" +
          "- National ID / Birth Cert\n" +
          "- Admission Letter\n" +
          "- Fee Structure/Balance\n" +
          "- Proof of Need\n" +
          "- Guardian Contact"
        );
      }

      // 5->2 Check status
      if (parts[2] === "2") {
        if (!db) return res.send("END Service temporarily unavailable (DB).");
        if (step === 3) return res.send("CON Enter your National ID:");
        if (step === 4) {
          const natId = parts[3];
          const app = await db.collection("bursary_applications")
            .find({ phone: phoneNumber, nationalId: natId })
            .sort({ createdAt: -1 }).limit(1).next();
          if (!app) return res.send("END No application found. Apply first.");
          return res.send(`END Status: ${app.status}. Ref: ${app.ref}`);
        }
      }

      // 5->1 Apply
      if (parts[2] === "1") {
        if (!db) return res.send("END Service temporarily unavailable (DB).");
        if (step === 3) return res.send("CON Enter your National ID:");
        if (step === 4) {
          const natId = parts[3];
          if (!(isNumeric(natId) && natId.length >= 6 && natId.length <= 10)) {
            return res.send("CON Invalid ID. Re-enter your National ID:");
          }
          return res.send("CON Enter your Full Name:");
        }
        if (step === 5) return res.send("CON Institution (e.g., KCA Univ, Mbitini Sec):");
        if (step === 6) {
          return res.send("CON Level:\n1. Secondary\n2. TVET/College\n3. University");
        }
        if (step === 7) return res.send("CON Admission/Student Number:");
        if (step === 8) return res.send("CON Fee balance amount (KSh):");
        if (step === 9) {
          const fee = parts[8];
          if (!(isNumeric(fee) && Number(fee) > 0)) {
            return res.send("CON Invalid amount. Re-enter fee balance (KSh):");
          }
          return res.send("CON Household status:\n1. Orphan\n2. Single Parent\n3. Vulnerable\n4. Other");
        }
        if (step === 10) return res.send("CON Guardian/Parent Phone (07xxxxxxxx):");
        if (step === 11) {
          const levelMap = { "1":"Secondary","2":"TVET/College","3":"University" };
          const level = levelMap[parts[6]];
          const guardianPhone = normalizeKenyanPhone(parts[10]);
          return res.send(
            "CON Confirm application:\n" +
            `Name: ${parts[4]}\n` +
            `ID: ${parts[3]}\n` +
            `Inst: ${parts[5]}\n` +
            `Level: ${level || "N/A"}\n` +
            `Fee: KSh ${parts[8]}\n` +
            `Guardian: ${guardianPhone}\n` +
            "1. Confirm\n" +
            "0. Cancel"
          );
        }
        if (step === 12) {
          if (parts[11] === "0") return res.send("END Cancelled.");
          if (parts[11] !== "1") return res.send("END Invalid option.");

          const ref = "VKW-" + Math.random().toString(36).slice(2, 8).toUpperCase();
          const levelMap = { "1":"Secondary","2":"TVET/College","3":"University" };
          const householdMap = {"1":"Orphan","2":"Single Parent","3":"Vulnerable","4":"Other"};
          await db.collection("bursary_applications").insertOne({
            ref,
            phone: phoneNumber,
            nationalId: parts[3],
            fullName: parts[4],
            institution: parts[5],
            level: levelMap[parts[6]] || "N/A",
            admissionNo: parts[7],
            feeBalance: Number(parts[8]),
            household: householdMap[parts[9]] || "Other",
            guardianPhone: normalizeKenyanPhone(parts[10]),
            ward: "Kyamatu",
            status: "Received",
            createdAt: new Date(),
            updatedAt: new Date()
          });
          return res.send(`END Application received. Wait for approval. Ref: ${ref}`);
        }
      }
    }

    // --- Exit ---
    if (parts[1] === "0") return res.send("END Goodbye.");

    // Fallback
    return res.send("END Invalid option. Dial again.");
  } catch (e) {
    console.error("[USSD ERROR]", e);
    return res.status(500).send(JSON.stringify({ error: "Internal server error" }));
  }
});

// GET handler - informational only (USSD uses POST)
router.get("/ussd", (req, res) => {
  res.json({
    service: "VOO Kyamatu Ward USSD API",
    status: "active",
    method: "POST only",
    callback_url: "https://voo-ward-ussd.onrender.com/ussd",
    note: "This endpoint accepts POST requests from Safaricom USSD gateway. GET requests are for monitoring only.",
    features: [
      "Register constituent",
      "Report issue (with ticket generation)",
      "View announcements",
      "View projects",
      "Bursary application (Apply/Check Status/Requirements)"
    ],
    access: "Limited to authorized ward MSISDNs"
  });
});

module.exports = { router };
