// backend/src/lib/mongo.js
const dns = require("dns");
dns.setDefaultResultOrder?.("ipv4first");

const { MongoClient, ServerApiVersion } = require("mongodb");

// Load dotenv if not already loaded
if (!process.env.MONGO_URI) {
  try {
    require("dotenv").config();
  } catch {}
}

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI && process.env.NODE_ENV === "production") {
  console.warn("[WARN] MONGO_URI is not set in production environment.");
}

let client, db;
async function getDb() {
  if (!MONGO_URI) throw new Error("MONGO_URI not set");
  if (db) return db;
  client = new MongoClient(MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    tls: true,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000
  });
  await client.connect();
  db = client.db(); // derives from URI path (e.g., /voo_ward)
  return db;
}
async function close() {
  try { await client?.close(); } catch {}
  client = undefined; 
  db = undefined;
}

module.exports = { getDb, close, closeDb: close };