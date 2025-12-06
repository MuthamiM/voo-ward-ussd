require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
    const c = new MongoClient(process.env.MONGO_URI);
    await c.connect();
    console.log('✅ Connected to MongoDB');

    const db = c.db();

    // Show all users
    console.log('\n📋 Current admin_users:');
    const users = await db.collection('admin_users').find({}).toArray();
    users.forEach(u => console.log(' - ID:', u._id, '| username:', u.username, '| name:', u.full_name));

    // Delete all self-registered users (keep admin and zak only)
    const result = await db.collection('admin_users').deleteMany({
        self_registered: true
    });
    console.log('\n🗑️ Deleted self-registered users:', result.deletedCount);

    // Also delete any users without password (incomplete)
    const result2 = await db.collection('admin_users').deleteMany({
        username: { $nin: ['admin', 'zak'] }
    });
    console.log('🗑️ Deleted other non-admin users:', result2.deletedCount);

    // Show remaining users
    console.log('\n📋 Remaining admin_users:');
    const remaining = await db.collection('admin_users').find({}).toArray();
    remaining.forEach(u => console.log(' - username:', u.username, '| name:', u.full_name || u.name));

    await c.close();
    console.log('\n✅ Cleanup done!');
})();
