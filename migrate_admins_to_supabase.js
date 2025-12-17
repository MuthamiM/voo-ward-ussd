require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

// Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ Supabase key is missing!');
    process.exit(1);
}

// Password Hashing Logic
function generateSalt() {
    return crypto.randomBytes(16).toString('base64');
}

function hashPassword(password, salt = null) {
    if (!salt) salt = generateSalt();
    const saltedPassword = `${salt}:${password}`;
    const hash = crypto.createHash('sha256').update(saltedPassword).digest('hex');
    return `${salt}:${hash}`;
}

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation', // Get back the inserted/updated data
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const result = body ? JSON.parse(body) : null;
                    resolve({ status: res.statusCode, data: result });
                } catch (e) {
                    resolve({ status: res.statusCode, error: body });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function migrateAdmins() {
    console.log('🚀 Starting admin migration to Supabase app_users...');

    const admins = [
        {
            username: 'zak',
            full_name: 'Zak Admin',
            phone: '+254700000001', // Dummy unique phone
            password: '827700',
            village: 'Admin HQ',
            role: 'MCA'
        },
        {
            username: 'muthami',
            full_name: 'Muthami Admin',
            phone: '+254700000002', // Dummy unique phone
            password: 'admin123',
            village: 'Admin HQ',
            role: 'MCA'
        }
    ];

    for (const admin of admins) {
        // 1. Check if user exists (by username)
        // Note: Supabase REST filtering syntax: ?column=eq.value
        const existingRes = await request('GET', `/rest/v1/app_users?username=eq.${admin.username}&select=*`);
        const existingString = JSON.stringify(existingRes); // for debug

        let action = 'create';
        let userId = null;

        if (existingRes.status === 200 && existingRes.data && existingRes.data.length > 0) {
            action = 'update';
            userId = existingRes.data[0].id;
            console.log(`ℹ️ User '${admin.username}' already exists (ID: ${userId}). Updating...`);
        } else {
            console.log(`ℹ️ User '${admin.username}' not found. Creating...`);
        }

        const hashedPassword = hashPassword(admin.password);

        const payload = {
            username: admin.username,
            full_name: admin.full_name,
            password_hash: hashedPassword,
            village: admin.village,
            updated_at: new Date().toISOString()
        };

        if (action === 'create') {
            payload.phone = admin.phone;
            payload.created_at = new Date().toISOString();
            // POST to create
            const createRes = await request('POST', '/rest/v1/app_users', payload);
             if (createRes.status === 201 || createRes.status === 200) {
                console.log(`✅ Successfully created '${admin.username}'`);
            } else {
                console.error(`❌ Failed to create '${admin.username}':`, createRes.status, JSON.stringify(createRes.data || createRes.error));
            }
        } else {
            // PATCH to update
            const updateRes = await request('PATCH', `/rest/v1/app_users?id=eq.${userId}`, payload);
            if (updateRes.status === 200 || updateRes.status === 204) {
                 console.log(`✅ Successfully updated '${admin.username}'`);
            } else {
                 console.error(`❌ Failed to update '${admin.username}':`, updateRes.status, JSON.stringify(updateRes.data || updateRes.error));
            }
        }
    }
}

migrateAdmins();
