// Script to create admin user in Supabase app_users table
require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment!');
    process.exit(1);
}

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '827700';
const ADMIN_FULL_NAME = 'Zak';
const ADMIN_ROLE = 'MCA';

// Hash password (same format as supabaseService.js)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('base64');
    const saltedPassword = `${salt}:${password}`;
    const hash = crypto.createHash('sha256').update(saltedPassword).digest('hex');
    return `${salt}:${hash}`;
}

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const result = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(result);
                    } else {
                        reject({ status: res.statusCode, error: result });
                    }
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function createAdminUser() {
    try {
        // Check if admin already exists
        const existing = await request('GET', `/rest/v1/app_users?username=eq.${ADMIN_USERNAME}&select=*`);
        
        if (Array.isArray(existing) && existing.length > 0) {
            console.log(`⚠️  User '${ADMIN_USERNAME}' already exists. Updating password...`);
            
            const passwordHash = hashPassword(ADMIN_PASSWORD);
            await request('PATCH', `/rest/v1/app_users?username=eq.${ADMIN_USERNAME}`, {
                password_hash: passwordHash,
                full_name: ADMIN_FULL_NAME,
                updated_at: new Date().toISOString()
            });
            
            console.log(`✅ Updated admin user '${ADMIN_USERNAME}' with new password`);
        } else {
            // Create new admin user
            const passwordHash = hashPassword(ADMIN_PASSWORD);
            
            const result = await request('POST', '/rest/v1/app_users', {
                username: ADMIN_USERNAME,
                full_name: ADMIN_FULL_NAME,
                password_hash: passwordHash,
                phone: '+254000000000', // Placeholder phone
                created_at: new Date().toISOString()
            });
            
            console.log(`✅ Created admin user '${ADMIN_USERNAME}' with role '${ADMIN_ROLE}'`);
            console.log('   Result:', JSON.stringify(result));
        }
        
        console.log(`\n🔐 Login credentials:`);
        console.log(`   Username: ${ADMIN_USERNAME}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

createAdminUser();
