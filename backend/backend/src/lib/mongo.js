const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "";
let client;
let db;

async function getDb() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI not set");
  }
  if (!client) {
    client = new MongoClient(MONGO_URI, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      tls: true,                             // explicit TLS for Atlas
      retryWrites: true,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 8000,
    });
  }
  if (!db) {
    await client.connect();
    // if URI has db at the end, use it; else default to 'voo_ward'
    const url = new URL(MONGO_URI);
    const pathDb = (url.pathname || "").replace(/^\//, "") || "voo_ward";
    db = client.db(pathDb);
  }
  return db;
}

module.exports = { getDb };