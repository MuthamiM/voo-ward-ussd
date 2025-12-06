require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
    const c = new MongoClient(process.env.MONGO_URI);
    await c.connect();
    const db = c.db();

    // Clear ALL pending registrations
    const r1 = await db.collection('pending_registrations').deleteMany({});
    console.log('Cleared ALL pending registrations:', r1.deletedCount);

    // Show remaining admin users
    const users = await db.collection('admin_users').find({}).toArray();
    console.log('\nAdmin users:', users.length);
    users.forEach(u => console.log(' -', u.username, '| phone:', u.phone, '| id_number:', u.id_number));

    await c.close();
    console.log('\n✅ Done!');
})();
