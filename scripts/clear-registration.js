/**
 * Script to clear existing registration data for re-registration
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function clearRegistration() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();

        // Data to clear
        const idNumber = '42032340';
        const phone = '0114945842';
        const username = 'cantroll';

        // Delete from pending_registrations
        const pendingResult = await db.collection('pending_registrations').deleteMany({
            $or: [
                { idNumber: idNumber },
                { phone: phone },
                { phone: '+254114945842' },
                { username: username.toLowerCase() }
            ]
        });
        console.log(`🗑️  Deleted ${pendingResult.deletedCount} pending registrations`);

        // Delete from admin_users
        const usersResult = await db.collection('admin_users').deleteMany({
            $or: [
                { id_number: idNumber },
                { phone: phone },
                { phone: '+254114945842' },
                { username: username.toLowerCase() }
            ]
        });
        console.log(`🗑️  Deleted ${usersResult.deletedCount} admin users`);

        console.log('✅ Done! You can now register with these details.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

clearRegistration();
