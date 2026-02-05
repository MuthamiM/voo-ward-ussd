const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "";
const DISABLE_MONGODB = process.env.DISABLE_MONGODB === 'true';
let client;
let db;

// Stub database that throws on any operation (for when MongoDB is disabled)
const nullDb = {
  collection: () => ({
    find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }),
    findOne: async () => null,
    insertOne: async () => { throw new Error('MongoDB is disabled. Set DISABLE_MONGODB=false to enable.'); },
    updateOne: async () => { throw new Error('MongoDB is disabled'); },
    deleteOne: async () => { throw new Error('MongoDB is disabled'); },
    countDocuments: async () => 0
  })
};

async function getDb() {
  // If MongoDB is disabled, return a stub that won't connect
  if (DISABLE_MONGODB) {
    console.log('⚠️ MongoDB disabled via DISABLE_MONGODB=true');
    return nullDb;
  }
  
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
