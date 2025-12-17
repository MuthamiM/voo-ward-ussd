require('dotenv').config();
const https = require('https');

// Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ Supabase key is missing!');
    process.exit(1);
}

function request(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
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
        req.end();
    });
}

async function checkSupabase() {
    console.log('🔍 Checking Supabase for users...');

    // 1. Check for admin_users table
    console.log('\n--- Checking admin_users table ---');
    const adminRes = await request('/rest/v1/admin_users?select=*');
    if (adminRes.status === 200) {
        console.log(`✅ Found admin_users table (${adminRes.data.length} records)`);
        adminRes.data.forEach(u => console.log(` - ${u.username || u.email} (Role: ${u.role})`));
    } else {
        console.log(`❌ admin_users table access failed or does not exist (Status: ${adminRes.status})`);
        if (adminRes.error) console.log('   Error:', adminRes.error);
    }

    // 2. Check app_users for Zak or Muthami
    console.log('\n--- Searching app_users for Zak/Muthami ---');
    // Using ilike for case-insensitive partial match
    const queries = [
        'username=eq.zak',
        'username=eq.muthami'
    ];

    for (const q of queries) {
        const res = await request(`/rest/v1/app_users?${q}&select=*`);
        if (res.status === 200 && res.data.length > 0) {
            console.log(`✅ Matches for ${q}:`);
            res.data.forEach(u => {
                console.log(` - ID: ${u.id}`);
                console.log(`   Name: ${u.full_name}`);
                console.log(`   Phone: ${u.phone}`);
                console.log(`   Username: ${u.username}`);
                console.log(`   Password Hash: ${u.password_hash ? (u.password_hash.substring(0, 10) + '...') : 'None'}`);
            });
        }
    }
}

checkSupabase();
