// Script to reset admin password in MongoDB
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const USERNAME = 'admin';
const NEW_PASSWORD = '827700';

async function resetAdminPassword() {
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

        // Hash the new password with bcrypt
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
        console.log(`🔐 Generated bcrypt hash for new password`);

        // Update the admin user
        const result = await db.collection('admin_users').updateOne(
            { username: USERNAME },
            { 
                $set: { 
                    password: hashedPassword,
                    updated_at: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            console.error(`❌ User '${USERNAME}' not found!`);
        } else if (result.modifiedCount > 0) {
            console.log(`✅ Password reset SUCCESS for user: ${USERNAME}`);
            console.log(`   New password: ${NEW_PASSWORD}`);
        } else {
            console.log(`⚠️  User found but password was not changed (may already be set)`);
        }

    } catch (e) {
        console.error('❌ MongoDB Error:', e.message);
    } finally {
        await client.close();
    }
}

resetAdminPassword();
