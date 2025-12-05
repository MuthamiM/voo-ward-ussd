const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

function showUsage() {
    console.log(`
Usage: node scripts/create-user-manual.js --name "Full Name" --id "ID_NUMBER" --phone "PHONE" --role "ROLE"

Options:
  --name   Full Name of the user
  --id     National ID Number
  --phone  Phone number (e.g., 0712345678)
  --role   Role (clerk, pa)
    `);
    process.exit(1);
}

function parseArgs() {
    const args = {};
    for (let i = 2; i < process.argv.length; i++) {
        if (process.argv[i].startsWith('--')) {
            const key = process.argv[i].substring(2);
            const value = process.argv[i + 1];
            if (value && !value.startsWith('--')) {
                args[key] = value;
                i++;
            }
        }
    }
    return args;
}

async function main() {
    const args = parseArgs();
    
    if (!args.name || !args.id || !args.phone || !args.role) {
        console.error('Error: Missing required arguments.');
        showUsage();
    }

    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!MONGO_URI) {
        console.error('Error: MONGO_URI is not defined in environment variables.');
        process.exit(1);
    }

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();
        const usersCol = db.collection('admin_users');

        // Check if user exists
        const existingUser = await usersCol.findOne({
            $or: [{ id_number: args.id }, { phone: args.phone }]
        });

        if (existingUser) {
            console.error(`Error: User with ID ${args.id} or Phone ${args.phone} already exists.`);
            process.exit(1);
        }

        // Generate Password
        const password = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate Username
        const username = args.name
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 20);

        // Normalize Phone
        let phone = args.phone.replace(/\s+/g, '');
        if (phone.startsWith('0')) {
            phone = '+254' + phone.substring(1);
        } else if (phone.startsWith('254')) {
            phone = '+' + phone;
        }

        const newUser = {
            username: username,
            password: hashedPassword,
            full_name: args.name,
            id_number: args.id,
            phone: phone,
            role: args.role.toLowerCase(),
            created_at: new Date(),
            updated_at: new Date(),
            approved_by: 'manual_script',
            approved_at: new Date()
        };

        await usersCol.insertOne(newUser);

        console.log('\n✅ User Created Successfully!');
        console.log('------------------------------------------------');
        console.log(`Name:     ${args.name}`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`Phone:    ${phone}`);
        console.log(`Role:     ${args.role}`);
        console.log('------------------------------------------------');
        console.log('⚠️  Share these credentials with the user securely.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

main();
