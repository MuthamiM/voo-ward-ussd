const { MongoClient } = require('mongodb');
require('dotenv').config();

async function deleteAdminUser() {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not found in environment');
        return;
    }

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const url = new URL(MONGO_URI);
        const dbName = (url.pathname || "").replace(/^\//, "") || "voo_ward";
        const db = client.db(dbName);

        // List current users
        const users = await db.collection('admin_users').find({}).toArray();
        console.log('\n📋 Current users:');
        users.forEach(user => {
            console.log(`  - ${user.username} (${user.role})`);
        });

        // Delete the old 'admin' user
        console.log('\n🗑️  Deleting old admin user...');
        const result = await db.collection('admin_users').deleteOne({ username: 'admin' });

        if (result.deletedCount > 0) {
            console.log('✅ Successfully deleted admin user');
        } else {
            console.log('ℹ️  No admin user found to delete');
        }

        // List remaining users
        const remainingUsers = await db.collection('admin_users').find({}).toArray();
        console.log('\n📋 Remaining users:');
        remainingUsers.forEach(user => {
            console.log(`  - ${user.username} (${user.role})`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
    }
}

deleteAdminUser();
