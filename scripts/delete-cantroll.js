require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
    const c = new MongoClient(process.env.MONGO_URI);
    await c.connect();
    const db = c.db();

    // Delete cantroll user directly
    const r1 = await db.collection('admin_users').deleteOne({ username: 'cantroll' });
    console.log('Deleted cantroll from admin_users:', r1.deletedCount);

    // Delete by phone
    const r2 = await db.collection('admin_users').deleteMany({ phone: '0114945842' });
    console.log('Deleted by phone 0114945842:', r2.deletedCount);

    const r3 = await db.collection('admin_users').deleteMany({ phone: '+254114945842' });
    console.log('Deleted by phone +254114945842:', r3.deletedCount);

    // Delete by ID
    const r4 = await db.collection('admin_users').deleteMany({ id_number: '42032340' });
    console.log('Deleted by id_number:', r4.deletedCount);

    // Also clear pending
    const r5 = await db.collection('pending_registrations').deleteMany({ username: 'cantroll' });
    console.log('Deleted from pending:', r5.deletedCount);

    // Show remaining users
    const users = await db.collection('admin_users').find({}).project({ username: 1, phone: 1, id_number: 1 }).toArray();
    console.log('\nRemaining users:');
    users.forEach(u => console.log(' -', u.username, '|', u.phone, '|', u.id_number));

    await c.close();
    console.log('\n✅ Done! Try registering again.');
})();
