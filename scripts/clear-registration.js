/**
 * Script to clear existing registration data for re-registration
 * With verbose output to verify database connection
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function clearRegistration() {
    console.log('🔗 Connecting to:', MONGO_URI ? MONGO_URI.substring(0, 30) + '...' : 'NO URI FOUND');

    if (!MONGO_URI) {
        console.error('❌ No MongoDB URI found in environment!');
        return;
    }

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        console.log('📁 Database:', db.databaseName);

        // Data to clear
        const idNumber = '42032340';
        const phone = '0114945842';
        const formattedPhone = '+254114945842';
        const username = 'cantroll';

        console.log('\n🔍 Searching for records with:');
        console.log('   ID:', idNumber);
        console.log('   Phone:', phone, 'or', formattedPhone);
        console.log('   Username:', username);

        // Check pending_registrations first
        const pendingCount = await db.collection('pending_registrations').countDocuments({
            $or: [
                { idNumber: idNumber },
                { phone: phone },
                { phone: formattedPhone },
                { phone: { $regex: '114945842' } },
                { username: username.toLowerCase() }
            ]
        });
        console.log('\n📋 Found', pendingCount, 'pending registrations');

        // Check admin_users
        const usersCount = await db.collection('admin_users').countDocuments({
            $or: [
                { id_number: idNumber },
                { phone: phone },
                { phone: formattedPhone },
                { phone: { $regex: '114945842' } },
                { username: username.toLowerCase() }
            ]
        });
        console.log('👥 Found', usersCount, 'admin users');

        // Delete from pending_registrations
        const pendingResult = await db.collection('pending_registrations').deleteMany({
            $or: [
                { idNumber: idNumber },
                { phone: phone },
                { phone: formattedPhone },
                { phone: { $regex: '114945842' } },
                { username: username.toLowerCase() }
            ]
        });
        console.log('\n🗑️  Deleted', pendingResult.deletedCount, 'pending registrations');

        // Delete from admin_users
        const usersResult = await db.collection('admin_users').deleteMany({
            $or: [
                { id_number: idNumber },
                { phone: phone },
                { phone: formattedPhone },
                { phone: { $regex: '114945842' } },
                { username: username.toLowerCase() }
            ]
        });
        console.log('🗑️  Deleted', usersResult.deletedCount, 'admin users');

        // List remaining users
        const allUsers = await db.collection('admin_users').find({}).project({ username: 1, phone: 1 }).toArray();
        console.log('\n👥 Remaining admin users:', allUsers.length);
        allUsers.forEach(u => console.log('   -', u.username, '|', u.phone));

        const allPending = await db.collection('pending_registrations').find({}).project({ username: 1, phone: 1, idNumber: 1 }).toArray();
        console.log('\n📋 Remaining pending registrations:', allPending.length);
        allPending.forEach(p => console.log('   -', p.username, '|', p.phone, '|', p.idNumber));

        console.log('\n✅ Done! You can now register with these details.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
    }
}

clearRegistration();
