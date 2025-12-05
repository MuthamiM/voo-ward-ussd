const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
    const identifier = process.argv[2]; // Phone or ID

    if (!identifier) {
        console.error('Please provide a phone number or ID number to delete.');
        console.log('Usage: node scripts/delete-user-application.js <phone_or_id>');
        process.exit(1);
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
        
        // Normalize phone for search
        let phoneVariations = [identifier];
        // If it looks like a phone number
        if (identifier.match(/\d+/)) {
            const digits = identifier.replace(/\D/g, '');
            phoneVariations.push(digits); // 011...
            if (digits.startsWith('0')) {
                phoneVariations.push('+254' + digits.substring(1)); // +25411...
                phoneVariations.push('254' + digits.substring(1));  // 25411...
            }
            if (digits.startsWith('254')) {
                phoneVariations.push('+' + digits);
                phoneVariations.push('0' + digits.substring(3));
            }
        }

        console.log('Searching for:', phoneVariations);

        // 1. Delete from pending_registrations
        const pendingCol = db.collection('pending_registrations');
        const pendingResult = await pendingCol.deleteMany({
            $or: [
                { idNumber: identifier },
                { phone: { $in: phoneVariations } },
                { username: identifier }
            ]
        });
        console.log(`Deleted ${pendingResult.deletedCount} from pending_registrations`);

        // 2. Delete from admin_users
        const usersCol = db.collection('admin_users');
        const usersResult = await usersCol.deleteMany({
            $or: [
                { id_number: identifier },
                { phone: { $in: phoneVariations } },
                { username: identifier }
            ]
        });
        console.log(`Deleted ${usersResult.deletedCount} from admin_users`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

main();