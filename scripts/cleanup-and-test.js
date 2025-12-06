require('dotenv').config();
const { MongoClient } = require('mongodb');

async function cleanupAndTest() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db();

    console.log('🧹 Cleaning up test data...');

    // Delete all pending and approved registrations
    await db.collection('pending_registrations').deleteMany({});
    await db.collection('approved_registrations').deleteMany({});

    // Delete all users except admin
    const result = await db.collection('admin_users').deleteMany({
        username: { $ne: 'admin' }
    });

    console.log('✅ Deleted ' + result.deletedCount + ' test users');
    console.log('✅ Cleared pending and approved registrations');

    // Show remaining users
    const users = await db.collection('admin_users').find({}).toArray();
    console.log('\n📋 Remaining users:');
    users.forEach(u => console.log('  - ' + u.username + ' (' + u.role + ')'));

    await client.close();
}

cleanupAndTest().catch(console.error);
