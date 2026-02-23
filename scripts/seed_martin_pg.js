require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

async function seedMartinAppUser() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:23748124@localhost:5432/voo_db',
        ssl: { rejectUnauthorized: false }
    });

    console.log('🌱 Adding Martin to PostgreSQL app_users...');

    try {
        await client.connect();

        // Check if martin exists
        const res = await client.query("SELECT * FROM app_users WHERE username = 'martin'");

        // Hash password using the specific format required by postgresUserService
        // format: salt:hash using sha256
        const salt = crypto.randomBytes(16).toString('base64');
        const saltedPassword = `${salt}:827700`;
        const hash = crypto.createHash('sha256').update(saltedPassword).digest('hex');
        const passwordHash = `${salt}:${hash}`;

        if (res.rows.length === 0) {
            console.log('Inserting martin...');
            await client.query(`
                INSERT INTO app_users (full_name, username, phone, password_hash, role, created_at, is_verified, is_active)
                VALUES ('Martin Admin', 'martin', '+254700827700', $1, 'MCA', NOW(), true, true)
            `, [passwordHash]);
            console.log('✅ Martin added to app_users successfully.');
        } else {
            console.log('Updating martin password...');
            await client.query(`
                UPDATE app_users 
                SET password_hash = $1, role = 'MCA'
                WHERE username = 'martin'
            `, [passwordHash]);
            console.log('✅ Martin password updated in app_users successfully.');
        }

    } catch (e) {
        console.error('❌ Failed to seed Martin to app_users:', e);
    } finally {
        await client.end();
    }
}

seedMartinAppUser();
