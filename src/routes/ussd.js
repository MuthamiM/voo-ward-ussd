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
    "CON ===== MAIN MENU =====\n" +
    "1. Register as Constituent\n" +
    "2. Report an Issue\n" +
    "3. News & Announcements\n" +
    "4. Ongoing Projects\n" +
    "5. Bursary Services\n" +
    "0. Exit\n" +
    "======================="
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
      if (step === 2) {
        return res.send(
          "CON === REGISTRATION (1/3) ===\n" +
          "Enter your Full Name:\n" +
          "(e.g., John Mwangi Kamau)\n\n" +
          "0. Back to Main Menu"
        );
      }
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        if (parts[2].length < 3) {
          return res.send(
            "CON Name too short!\n" +
            "Enter your Full Name:\n" +
            "(minimum 3 characters)\n\n" +
            "0. Back"
          );
        }
        return res.send(
          "CON === REGISTRATION (2/3) ===\n" +
          "Name: " + parts[2] + "\n\n" +
          "Enter your Village/Location:\n" +
          "(e.g., Mbitini, Kyamatu)\n\n" +
          "0. Back"
        );
      }
      if (step === 4) {
        if (parts[3] === "0") return res.send(mainMenu());
        if (parts[3].length < 2) {
          return res.send(
            "CON Location too short!\n" +
            "Enter your Village/Location:\n\n" +
            "0. Back"
          );
        }
        return res.send(
          "CON === REGISTRATION (3/3) ===\n" +
          "Name: " + parts[2] + "\n" +
          "Location: " + parts[3] + "\n\n" +
          "Enter National ID (optional)\n" +
          "or press 0 to complete\n\n" +
          "0. Skip & Complete"
        );
      }
      if (step === 5) {
        if (!db) return res.send("END Service temporarily unavailable. Please try again later.");
        
        const nationalId = parts[4] === "0" ? null : parts[4];
        const dob = nationalId ? extractDOBFromID(nationalId) : null;
        
        // Check if already registered
        const existing = await db.collection("constituents").findOne({ phone: phoneNumber });
        if (existing) {
          await db.collection("constituents").updateOne(
            { phone: phoneNumber },
            { 
              $set: {
                name: parts[2],
                ward: parts[3],
                nationalId: nationalId,
                dateOfBirth: dob,
                updatedAt: new Date()
              }
            }
          );
          return res.send(
            "END ✓ Registration Updated!\n" +
            "Name: " + parts[2] + "\n" +
            "Location: " + parts[3] + "\n" +
            "Phone: " + phoneNumber + "\n\n" +
            "Thank you for updating your details."
          );
        }
        
        await db.collection("constituents").insertOne({
          phone: phoneNumber,
          name: parts[2],
          ward: parts[3],
          nationalId: nationalId,
          dateOfBirth: dob,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return res.send(
          "END ✓ Registration Complete!\n" +
          "Name: " + parts[2] + "\n" +
          "Location: " + parts[3] + "\n" +
          "Phone: " + phoneNumber + "\n\n" +
          "Welcome to Kyamatu Ward services!"
        );
      }
    }

    // --- Option 2: Report issue ---
    if (parts[1] === "2") {
      if (step === 2) {
        return res.send(
          "CON === REPORT ISSUE (1/4) ===\n" +
          "Enter your Name:\n" +
          "(for follow-up)\n\n" +
          "0. Back to Main Menu"
        );
      }
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        if (parts[2].length < 2) {
          return res.send("CON Name required!\nEnter your Name:\n\n0. Back");
        }
        return res.send(
          "CON === REPORT ISSUE (2/4) ===\n" +
          "Reporter: " + parts[2] + "\n\n" +
          "Enter Issue Title:\n" +
          "(e.g., Water shortage)\n\n" +
          "0. Back"
        );
      }
      if (step === 4) {
        if (parts[3] === "0") return res.send(mainMenu());
        if (parts[3].length < 3) {
          return res.send("CON Title too short!\nEnter Issue Title:\n\n0. Back");
        }
        return res.send(
          "CON === REPORT ISSUE (3/4) ===\n" +
          "Title: " + parts[3] + "\n\n" +
          "Describe the issue:\n" +
          "(brief description)\n\n" +
          "0. Back"
        );
      }
      if (step === 5) {
        if (parts[4] === "0") return res.send(mainMenu());
        if (parts[4].length < 5) {
          return res.send("CON Description too short!\nDescribe the issue:\n\n0. Back");
        }
        return res.send(
          "CON === REPORT ISSUE (4/4) ===\n" +
          "Location/Landmark:\n" +
          "(e.g., Near Mbitini Market)\n\n" +
          "0. Skip & Submit"
        );
      }
      if (step === 6) {
        if (!db) return res.send("END Service unavailable. Please try again later.");
        
        // Generate unique ticket number with timestamp
        const ticketNo = "TICK-" + Date.now().toString(36).toUpperCase().slice(-8);
        
        await db.collection("issues").insertOne({
          ticket: ticketNo,
          phone: phoneNumber,
          reporter_name: parts[2],
          message: parts[3] + ": " + parts[4],
          location: parts[5] === "0" ? "Not specified" : parts[5],
          status: "pending",
          action_note: "",
          created_at: new Date()
        });
        
        return res.send(
          "END ✓ Issue Reported!\n" +
          "Ticket: " + ticketNo + "\n" +
          "Title: " + parts[3] + "\n" +
          "Location: " + (parts[5] === "0" ? "N/A" : parts[5]) + "\n\n" +
          "We will follow up soon.\n" +
          "Save your ticket number!"
        );
      }
    }

    // --- Option 3: News & Announcements ---
    if (parts[1] === "3") {
      if (!db) return res.send("END No announcements available at this time.");
      
      const latest = await db.collection("announcements")
        .find({}).project({ _id: 0, title: 1, body: 1 })
        .sort({ created_at: -1 }).limit(3).toArray();

      if (step === 2) {
        if (!latest.length) {
          return res.send("END === WARD NEWS ===\nNo announcements at this time.\n\nCheck back later.");
        }
        const lines = latest.map((a, i) => `${i+1}. ${a.title}`).join("\n");
        return res.send(
          "CON === WARD NEWS ===\n" +
          lines + "\n\n" +
          "Select news to read\n" +
          "0. Back"
        );
      }
      if (step === 3) {
        if (parts[2] === "0") return res.send(mainMenu());
        const n = Number(parts[2]);
        if (n >= 1 && n <= latest.length) {
          const item = latest[n-1];
          const body = item.body || "No details available.";
          // Truncate if too long for USSD
          const displayBody = body.length > 150 ? body.substring(0, 150) + "..." : body;
          return res.send(
            "END === " + item.title + " ===\n\n" +
            displayBody + "\n\n" +
            "--- End of News ---"
          );
        }
        return res.send("END Invalid selection.");
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

      // 5->1 Apply for Bursary
      if (parts[2] === "1") {
        if (!db) return res.send("END Service temporarily unavailable. Please try again later.");
        
        if (step === 3) {
          return res.send(
            "CON === BURSARY (Step 1/8) ===\n" +
            "Enter National ID:\n" +
            "(8-10 digits)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 4) {
          if (parts[3] === "0") return res.send(mainMenu());
          const natId = parts[3];
          if (!(isNumeric(natId) && natId.length >= 7 && natId.length <= 10)) {
            return res.send(
              "CON Invalid ID format!\n" +
              "Enter 8-10 digit ID:\n\n" +
              "0. Back"
            );
          }
          return res.send(
            "CON === BURSARY (Step 2/8) ===\n" +
            "ID: " + natId + "\n\n" +
            "Enter Full Name:\n" +
            "(as in ID/Birth Cert)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 5) {
          if (parts[4] === "0") return res.send(mainMenu());
          if (parts[4].length < 3) {
            return res.send("CON Name too short!\nEnter Full Name:\n\n0. Back");
          }
          return res.send(
            "CON === BURSARY (Step 3/8) ===\n" +
            "Name: " + parts[4] + "\n\n" +
            "Institution Name:\n" +
            "(e.g., KCA University)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 6) {
          if (parts[5] === "0") return res.send(mainMenu());
          if (parts[5].length < 3) {
            return res.send("CON Institution name required!\nEnter Institution:\n\n0. Back");
          }
          return res.send(
            "CON === BURSARY (Step 4/8) ===\n" +
            "Education Level:\n" +
            "1. Secondary School\n" +
            "2. TVET/College\n" +
            "3. University\n\n" +
            "0. Back"
          );
        }
        
        if (step === 7) {
          if (parts[6] === "0") return res.send(mainMenu());
          if (!["1","2","3"].includes(parts[6])) {
            return res.send("CON Invalid level!\nSelect 1, 2, or 3:\n\n0. Back");
          }
          const levelMap = { "1":"Secondary", "2":"TVET/College", "3":"University" };
          return res.send(
            "CON === BURSARY (Step 5/8) ===\n" +
            "Level: " + levelMap[parts[6]] + "\n\n" +
            "Admission/Student No:\n" +
            "(e.g., ADM/001/2024)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 8) {
          if (parts[7] === "0") return res.send(mainMenu());
          if (parts[7].length < 3) {
            return res.send("CON Admission number required!\nEnter Adm No:\n\n0. Back");
          }
          return res.send(
            "CON === BURSARY (Step 6/8) ===\n" +
            "Fee Balance Amount:\n" +
            "(KSh - numbers only)\n" +
            "(e.g., 25000)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 9) {
          if (parts[8] === "0") return res.send(mainMenu());
          const fee = parts[8];
          if (!(isNumeric(fee) && Number(fee) >= 1000)) {
            return res.send(
              "CON Invalid amount!\n" +
              "Enter fee balance (min 1000):\n\n" +
              "0. Back"
            );
          }
          return res.send(
            "CON === BURSARY (Step 7/8) ===\n" +
            "Fee: KSh " + Number(fee).toLocaleString() + "\n\n" +
            "Household Status:\n" +
            "1. Orphan\n" +
            "2. Single Parent\n" +
            "3. Vulnerable Family\n" +
            "4. Other\n\n" +
            "0. Back"
          );
        }
        
        if (step === 10) {
          if (parts[9] === "0") return res.send(mainMenu());
          if (!["1","2","3","4"].includes(parts[9])) {
            return res.send("CON Invalid option!\nSelect 1-4:\n\n0. Back");
          }
          return res.send(
            "CON === BURSARY (Step 8/8) ===\n" +
            "Guardian/Parent Phone:\n" +
            "(e.g., 0712345678)\n\n" +
            "0. Back"
          );
        }
        
        if (step === 11) {
          if (parts[10] === "0") return res.send(mainMenu());
          const guardianPhone = normalizeKenyanPhone(parts[10]);
          if (!guardianPhone.startsWith("+254") || guardianPhone.length < 12) {
            return res.send(
              "CON Invalid phone format!\n" +
              "Enter Guardian Phone:\n" +
              "(e.g., 0712345678)\n\n" +
              "0. Back"
            );
          }
          
          const levelMap = { "1":"Secondary", "2":"TVET/College", "3":"University" };
          const householdMap = {"1":"Orphan", "2":"Single Parent", "3":"Vulnerable", "4":"Other"};
          
          return res.send(
            "CON === CONFIRM APPLICATION ===\n" +
            "Name: " + parts[4] + "\n" +
            "ID: " + parts[3] + "\n" +
            "School: " + parts[5] + "\n" +
            "Level: " + (levelMap[parts[6]] || "N/A") + "\n" +
            "Adm No: " + parts[7] + "\n" +
            "Fee: KSh " + Number(parts[8]).toLocaleString() + "\n" +
            "Status: " + (householdMap[parts[9]] || "Other") + "\n" +
            "Guardian: " + guardianPhone + "\n\n" +
            "1. Submit Application\n" +
            "0. Cancel"
          );
        }
        
        if (step === 12) {
          if (parts[11] === "0") {
            return res.send("END Application cancelled.\n\nYou can apply again anytime.");
          }
          if (parts[11] !== "1") {
            return res.send("END Invalid option. Application cancelled.");
          }

          // Generate unique reference code
          const ref = "VKW-BUR-" + Date.now().toString(36).toUpperCase().slice(-6);
          const levelMap = { "1":"Secondary", "2":"TVET/College", "3":"University" };
          const householdMap = {"1":"Orphan", "2":"Single Parent", "3":"Vulnerable", "4":"Other"};
          
          await db.collection("bursary_applications").insertOne({
            ref_code: ref,
            phone: phoneNumber,
            national_id: parts[3],
            student_name: parts[4],
            institution: parts[5],
            level: levelMap[parts[6]] || "N/A",
            admission_no: parts[7],
            fee_balance: Number(parts[8]),
            household_status: householdMap[parts[9]] || "Other",
            guardian_phone: normalizeKenyanPhone(parts[10]),
            ward: "Kyamatu",
            status: "pending",
            admin_notes: "",
            created_at: new Date()
          });
          
          return res.send(
            "END ✓ APPLICATION RECEIVED!\n\n" +
            "Reference: " + ref + "\n" +
            "Name: " + parts[4] + "\n" +
            "Amount: KSh " + Number(parts[8]).toLocaleString() + "\n\n" +
            "Your application will be reviewed.\n" +
            "SAVE YOUR REFERENCE NUMBER!\n\n" +
            "Check status: Dial *384*1234# > Bursary > Check Status"
          );
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
