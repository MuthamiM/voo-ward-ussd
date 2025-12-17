require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env file");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function listAdmins() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const url = new URL(MONGO_URI);
    const dbName = (url.pathname || "").replace(/^\//, "") || "voo_ward";
    const db = client.db(dbName);

    const admins = await db.collection("admin_users").find({}).toArray();

    if (admins.length === 0) {
      console.log("No admin users found.");
    } else {
      console.log("Found admin users:");
      admins.forEach((admin) => {
        console.log(
          `- Username: ${admin.username}, Role: ${admin.role}, ID: ${admin._id}`
        );
      });
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

listAdmins();
