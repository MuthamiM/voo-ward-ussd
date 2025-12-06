require('dotenv').config();
const { MongoClient } = require('mongodb');

async function removeZak() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGO_URI not set');
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const url = new URL(uri);
        const dbName = (url.pathname || '').replace(/^\//, '') || 'voo_ward';
        const db = client.db(dbName);

        // List all users
        const users = await db.collection('admin_users').find({}).toArray();
        console.log('\nCurrent users:');
        users.forEach(u => console.log(`  - ${u.username} (${u.role}) ID: ${u._id}`));

        // Find and remove lowercase 'zak' (keep uppercase ZAK)
        const lowercaseZak = users.find(u => u.username === 'zak');
        const uppercaseZAK = users.find(u => u.username === 'ZAK');

        if (lowercaseZak) {
            console.log(`\n Removing lowercase 'zak' user...`);
            await db.collection('admin_users').deleteOne({ _id: lowercaseZak._id });
            console.log('✅ Removed lowercase zak user');
        } else {
            console.log('\n⚠️ No lowercase zak user found');
        }

        if (uppercaseZAK) {
            console.log(`\n✅ Uppercase ZAK user exists: ${uppercaseZAK.username} (${uppercaseZAK.role})`);
        } else {
            console.log('\n⚠️ No uppercase ZAK user found');
        }

        // List remaining users
        const remainingUsers = await db.collection('admin_users').find({}).toArray();
        console.log('\nRemaining users:');
        remainingUsers.forEach(u => console.log(`  - ${u.username} (${u.role})`));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

removeZak();
