const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;

function getPool() {
    if (!pool && DATABASE_URL) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        pool.on('error', (err) => console.error('PostgreSQL error:', err));
    }
    return pool;
}

async function query(text, params) {
    const p = getPool();
    if (!p) return [];
    const result = await p.query(text, params);
    return result.rows;
}

async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}

async function saveOTP(phone, otp) {
    try {
        const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
        
        await query('DELETE FROM mobile_otps WHERE phone = $1', [phone]);
        await query(
            'INSERT INTO mobile_otps (phone, otp, expires_at) VALUES ($1, $2, $3)',
            [phone, otp, expiresAt]
        );
        return true;
    } catch (e) {
        console.error('[PostgreSQL] saveOTP error:', e.message);
        return false;
    }
}

async function verifyOTP(phone, otp) {
    try {
        const record = await queryOne(
            'SELECT * FROM mobile_otps WHERE phone = $1',
            [phone]
        );
        
        if (!record) {
            return { success: false, error: 'OTP not found or expired' };
        }

        if (new Date() > new Date(record.expires_at)) {
            return { success: false, error: 'OTP expired' };
        }

        if (record.otp !== otp) {
            return { success: false, error: 'Invalid OTP' };
        }

        await query('DELETE FROM mobile_otps WHERE phone = $1', [phone]);
        return { success: true };
    } catch (e) {
        console.error('[PostgreSQL] verifyOTP error:', e.message);
        return { success: false, error: 'Verification error' };
    }
}

async function saveEmailOTP(email, otp) {
    const emailKey = `email:${email.toLowerCase()}`;
    return saveOTP(emailKey, otp);
}

async function verifyEmailOTP(email, otp) {
    const emailKey = `email:${email.toLowerCase()}`;
    return verifyOTP(emailKey, otp);
}

module.exports = {
    getPool,
    query,
    queryOne,
    saveOTP,
    verifyOTP,
    saveEmailOTP,
    verifyEmailOTP
};
