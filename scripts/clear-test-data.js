require('dotenv').config();
const { MongoClient } = require('mongodb');

async function clearTestData() {
    const client = new MongoClient(process.env.MONGO_URI);

    try {
        await client.connect();
        const db = client.db();

        console.log('=== BEFORE DELETION ===');
        const adminBefore = await db.collection('admin_users').find({}).toArray();
        const pendingBefore = await db.collection('pending_registrations').find({}).toArray();
        console.log('Admin users:', adminBefore.map(u => u.username));
        console.log('Pending registrations:', pendingBefore.map(p => p.username || p.fullName));

        console.log('\n=== DELETING ===');

        // Delete ALL pending registrations
        const delPending = await db.collection('pending_registrations').deleteMany({});
        console.log('Deleted pending registrations:', delPending.deletedCount);

        // Delete all admin_users EXCEPT 'admin'
        const delUsers = await db.collection('admin_users').deleteMany({
            username: { $ne: 'admin' }
        });
        console.log('Deleted admin users (except admin):', delUsers.deletedCount);

        console.log('\n=== AFTER DELETION ===');
        const adminAfter = await db.collection('admin_users').find({}).toArray();
        const pendingAfter = await db.collection('pending_registrations').find({}).toArray();
        console.log('Admin users remaining:', adminAfter.map(u => u.username));
        console.log('Pending registrations remaining:', pendingAfter.length);

        console.log('\n✅ DONE! All test data cleared.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

clearTestData();
