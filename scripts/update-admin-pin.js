require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function updateAdminPin() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const url = new URL(uri);
        const db = client.db(url.pathname.replace(/^\//, '') || 'voo_ward');

        const hashedPin = await bcrypt.hash('827700', 10);
        await db.collection('admin_users').updateOne(
            { username: 'admin' },
            { $set: { password: hashedPin, updated_at: new Date() } }
        );

        console.log('✅ Admin password updated to PIN: 827700');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.close();
    }
}

updateAdminPin();
