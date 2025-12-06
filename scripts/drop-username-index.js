require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
    const c = new MongoClient(process.env.MONGO_URI);
    await c.connect();
    console.log('✅ Connected to MongoDB');

    const db = c.db();

    // List all indexes on admin_users
    console.log('\n📋 Current indexes on admin_users:');
    const indexes = await db.collection('admin_users').indexes();
    indexes.forEach(idx => console.log(' -', idx.name, '| unique:', idx.unique || false));

    // Drop the username unique index
    try {
        await db.collection('admin_users').dropIndex('username_1');
        console.log('\n✅ Dropped username_1 unique index!');
    } catch (err) {
        console.log('\n⚠️ Could not drop username_1:', err.message);
    }

    // List indexes again
    console.log('\n📋 Indexes after dropping:');
    const indexesAfter = await db.collection('admin_users').indexes();
    indexesAfter.forEach(idx => console.log(' -', idx.name, '| unique:', idx.unique || false));

    await c.close();
    console.log('\n✅ Done! Username can now repeat.');
})();
