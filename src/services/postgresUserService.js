const crypto = require('crypto');
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
    if (!p) throw new Error('Database not configured');
    const result = await p.query(text, params);
    return result.rows;
}

async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}

function generateSalt() {
    return crypto.randomBytes(16).toString('base64');
}

function hashPassword(password, salt = null) {
    if (!salt) salt = generateSalt();
    const saltedPassword = `${salt}:${password}`;
    const hash = crypto.createHash('sha256').update(saltedPassword).digest('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) {
        console.log('[DEBUG verifyPassword] Invalid hash format:', storedHash);
        return false;
    }
    const [salt, hash] = storedHash.split(':');
    console.log('[DEBUG verifyPassword] Salt:', salt);
    console.log('[DEBUG verifyPassword] Stored hash part:', hash);
    const expectedHash = hashPassword(password, salt);
    console.log('[DEBUG verifyPassword] Expected:', expectedHash);
    console.log('[DEBUG verifyPassword] Stored:', storedHash);
    const match = expectedHash === storedHash;
    console.log('[DEBUG verifyPassword] Match:', match);
    return match;
}

async function getUserByPhone(phone) {
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
    }
    return await queryOne('SELECT * FROM app_users WHERE phone = $1', [formattedPhone]);
}

async function getUserByEmail(email) {
    return await queryOne('SELECT * FROM app_users WHERE LOWER(email) = LOWER($1)', [email]);
}

async function getUserByUsernameOrPhone(username) {
    let user = await queryOne('SELECT * FROM app_users WHERE username = $1', [username]);
    if (user) return user;
    
    let formattedPhone = username;
    if (!username.startsWith('+') && /^\d/.test(username)) {
        formattedPhone = `+254${username.replace(/^0/, '')}`;
    }
    return await queryOne('SELECT * FROM app_users WHERE phone = $1', [formattedPhone]);
}

async function registerUser(data) {
    try {
        // Handle various field name formats
        const fullName = data.fullName || data.full_name || data.name || 'User';
        const phone = data.phone || data.phoneNumber;
        const idNumber = data.idNumber || data.id_number || null;
        const password = data.password;
        const village = data.village || null;
        const username = data.username;

        let formattedPhone = phone;
        if (formattedPhone && !formattedPhone.startsWith('+')) {
            formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
        }

        const existing = await getUserByPhone(formattedPhone);
        if (existing) {
            return { success: false, error: 'Phone number already registered' };
        }

        const passwordHash = hashPassword(password);

        const result = await query(
            `INSERT INTO app_users (full_name, phone, id_number, password_hash, village, username, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [fullName, formattedPhone, idNumber, passwordHash, village, username || formattedPhone.replace('+254', '')]
        );

        const user = result[0];
        return {
            success: true,
            user: {
                id: user.id,
                fullName: user.full_name,
                phone: user.phone,
                username: user.username,
            }
        };
    } catch (e) {
        console.error('[PostgreSQL] registerUser error:', e.message);
        return { success: false, error: 'Registration failed' };
    }
}

async function registerUserWithEmail(data) {
    try {
        // Handle various field name formats
        const fullName = data.fullName || data.full_name || data.name || 'User';
        const email = data.email;
        const phone = data.phone || data.phoneNumber;
        const idNumber = data.idNumber || data.id_number || null;
        const password = data.password;
        const village = data.village || null;
        const username = data.username;

        let formattedPhone = phone;
        if (phone && !formattedPhone.startsWith('+')) {
            formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
        }

        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            return { success: false, error: 'Email already registered' };
        }

        if (phone) {
            const existingPhone = await getUserByPhone(formattedPhone);
            if (existingPhone) {
                return { success: false, error: 'Phone number already registered' };
            }
        }

        const passwordHash = hashPassword(password);

        const result = await query(
            `INSERT INTO app_users (full_name, email, phone, id_number, password_hash, village, username, is_verified, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, NOW()) RETURNING *`,
            [fullName, email.toLowerCase(), formattedPhone || null, idNumber, passwordHash, village, username || email.split('@')[0]]
        );

        const user = result[0];
        return {
            success: true,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phone: user.phone,
                username: user.username,
            }
        };
    } catch (e) {
        console.error('[PostgreSQL] registerUserWithEmail error:', e.message);
        return { success: false, error: 'Registration failed' };
    }
}

async function loginUser(username, password) {
    try {
        console.log('[PostgreSQL] Login attempt for:', username);
        const user = await getUserByUsernameOrPhone(username);

        if (!user) {
            console.log('[PostgreSQL] User not found:', username);
            return { success: false, error: 'User not found' };
        }

        console.log('[PostgreSQL] User found:', user.username, 'has password_hash:', !!user.password_hash);
        const passwordMatch = verifyPassword(password, user.password_hash);
        console.log('[PostgreSQL] Password match:', passwordMatch);
        
        if (!passwordMatch) {
            return { success: false, error: 'Invalid password' };
        }

        await query('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        return {
            success: true,
            user: {
                id: user.id,
                fullName: user.full_name,
                phone: user.phone,
                username: user.username,
                village: user.village,
                email: user.email,
                role: user.role || 'citizen'
            }
        };
    } catch (e) {
        console.error('[PostgreSQL] loginUser error:', e.message);
        return { success: false, error: 'Login failed' };
    }
}

async function updatePasswordByPhone(phone, newPassword) {
    try {
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
        }

        const user = await getUserByPhone(formattedPhone);
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const passwordHash = hashPassword(newPassword);
        await query('UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.id]);

        return { success: true };
    } catch (e) {
        console.error('[PostgreSQL] updatePasswordByPhone error:', e.message);
        return { success: false, error: 'Password update failed' };
    }
}

async function updateUserFCMToken(userId, fcmToken) {
    try {
        await query('UPDATE app_users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [fcmToken, userId]);
        return { success: true };
    } catch (e) {
        console.error('[PostgreSQL] updateUserFCMToken error:', e.message);
        return { success: false, error: 'FCM update failed' };
    }
}

async function registerGoogleUser(profile) {
    try {
        let user = await queryOne('SELECT * FROM app_users WHERE google_id = $1', [profile.id]);
        if (user) {
            return { success: true, user };
        }

        user = await getUserByEmail(profile.email);
        if (user) {
            await query('UPDATE app_users SET google_id = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3',
                [profile.id, profile.picture, user.id]);
            return { success: true, user: { ...user, google_id: profile.id } };
        }

        const result = await query(
            `INSERT INTO app_users (full_name, email, google_id, avatar_url, username, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
            [profile.name, profile.email, profile.id, profile.picture, profile.email.split('@')[0]]
        );
        
        return { success: true, user: result[0] };
    } catch (e) {
        console.error('[PostgreSQL] registerGoogleUser error:', e.message);
        return { success: false, error: 'Google registration failed' };
    }
}

module.exports = {
    getPool,
    query,
    queryOne,
    hashPassword,
    verifyPassword,
    getUserByPhone,
    getUserByEmail,
    getUserByUsernameOrPhone,
    registerUser,
    registerUserWithEmail,
    loginUser,
    updatePasswordByPhone,
    updateUserFCMToken,
    registerGoogleUser
};
