require('dotenv').config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env file");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function addAdmins() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const url = new URL(MONGO_URI);
    const dbName = (url.pathname || "").replace(/^\//, "") || "voo_ward";
    const db = client.db(dbName);
    const usersCollection = db.collection('admin_users');

    const newAdmins = [
        {
            username: 'zak',
            full_name: 'Zak', // Placeholder full name
            role: 'MCA',
            password: 'admin123', // Will be hashed
            email: 'zak@example.com' // Placeholder email
        },
        {
            username: 'muthami',
            full_name: 'Muthami', // Placeholder full name
            role: 'MCA',
            password: 'admin123', // Will be hashed
            email: 'muthami@example.com' // Placeholder email
        }
    ];

    for (const admin of newAdmins) {
        // Check if user exists
        const existing = await usersCollection.findOne({ username: admin.username });
        if (existing) {
            console.log(`User '${admin.username}' already exists. Updating password...`);
            const hashedPassword = bcrypt.hashSync(admin.password, 10);
            await usersCollection.updateOne(
                { username: admin.username },
                { 
                    $set: { 
                        password: hashedPassword,
                        role: admin.role, // Ensure they have MCA role
                        full_name: admin.full_name
                    } 
                }
            );
            console.log(`✅ Updated '${admin.username}' with password '${admin.password}' and role '${admin.role}'`);
        } else {
            console.log(`Creating user '${admin.username}'...`);
            const hashedPassword = bcrypt.hashSync(admin.password, 10);
            await usersCollection.insertOne({
                username: admin.username,
                password: hashedPassword,
                role: admin.role,
                full_name: admin.full_name,
                email: admin.email,
                created_at: new Date(),
                status: 'active'
            });
            console.log(`✅ Created user '${admin.username}' with password '${admin.password}'`);
        }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

addAdmins();
