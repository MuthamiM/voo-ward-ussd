// backend/src/lib/mongo.js
const { MongoClient, ServerApiVersion } = require("mongodb");
const MONGO_URI = process.env.MONGO_URI;

let client, db;
async function getDb() {
  if (!MONGO_URI) throw new Error("MONGO_URI not set");
  if (db) return db;
  client = new MongoClient(MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    tls: true,
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000
  });
  await client.connect();
  db = client.db(); // derives from URI path (e.g., /voo_ward)
  return db;
}
async function closeDb(){ if (client) await client.close(); client = null; db = null; }
module.exports = { getDb, closeDb };