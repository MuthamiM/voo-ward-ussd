const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkUsers() {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!MONGO_URI) {
        console.error('MONGO_URI not found in environment');
        return;
    }

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const url = new URL(MONGO_URI);
        const dbName = (url.pathname || "").replace(/^\//, "") || "voo_ward";
        const db = client.db(dbName);

        const users = await db.collection('admin_users').find({}).toArray();

        console.log('\n📋 Found', users.length, 'users:');
        users.forEach(user => {
            console.log('\n---');
            console.log('Username:', user.username);
            console.log('Role:', user.role);
            console.log('Password hash:', user.password ? user.password.substring(0, 20) + '...' : 'NONE');
            console.log('Full name:', user.full_name);
        });

        // Now let's create/update the ZAK user with PIN 827700
        console.log('\n\n🔧 Creating/Updating ZAK user with PIN 827700...');
        const hashedPin = await bcrypt.hash('827700', 10);

        await db.collection('admin_users').updateOne(
            { username: 'zak' },
            {
                $set: {
                    username: 'zak',
                    password: hashedPin,
                    role: 'MCA',
                    full_name: 'ZAK',
                    updated_at: new Date()
                },
                $setOnInsert: {
                    created_at: new Date()
                }
            },
            { upsert: true }
        );

        console.log('✅ ZAK user created/updated successfully!');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
    }
}

checkUsers();
