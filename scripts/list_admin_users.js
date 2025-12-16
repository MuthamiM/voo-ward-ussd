// Script to list admin users in MongoDB
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function listAdminUsers() {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not set in environment variables');
        return;
    }

    const client = new MongoClient(MONGO_URI, {
        serverApi: { version: ServerApiVersion.v1 },
        tls: true
    });

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const url = new URL(MONGO_URI);
        const dbName = (url.pathname || "").replace(/^\//, "") || "voo_ward";
        const db = client.db(dbName);
        
        console.log(`📁 Using database: ${dbName}`);

        // List all admin users
        const adminUsers = await db.collection('admin_users').find({}).toArray();
        
        console.log(`\n=== Admin Users Found: ${adminUsers.length} ===\n`);
        
        if (adminUsers.length === 0) {
            console.log('⚠️  NO ADMIN USERS FOUND IN DATABASE!');
            console.log('   You need to create admin users before you can login.');
        } else {
            adminUsers.forEach((u, i) => {
                console.log(`${i+1}. Username: ${u.username || '(none)'} | Name: ${u.full_name || '(none)'} | Role: ${u.role || '(none)'} | Phone: ${u.phone || '(none)'}`);
            });
        }

    } catch (e) {
        console.error('❌ MongoDB Error:', e.message);
    } finally {
        await client.close();
    }
}

listAdminUsers();
