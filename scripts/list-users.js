const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db();
        
        console.log('--- Pending Registrations ---');
        const pending = await db.collection('pending_registrations').find({}).toArray();
        console.log(JSON.stringify(pending, null, 2));

        console.log('\n--- Admin Users ---');
        const users = await db.collection('admin_users').find({}).toArray();
        console.log(JSON.stringify(users, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();