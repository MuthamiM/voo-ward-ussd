const path = require('path');
const fs = require('fs');

// 1. Try to load .env
console.log('--- Environment Check ---');
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env at:', envPath);
if (fs.existsSync(envPath)) {
    console.log('.env file found.');
    require('dotenv').config();
} else {
    console.error('.env file NOT found!');
}

// 2. Check Keys
const keysToCheck = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'VAPID_PUBLIC_KEY', 
    'VAPID_PRIVATE_KEY',
    'MONGO_URI'
];

keysToCheck.forEach(key => {
    const val = process.env[key];
    if (val) {
        console.log(`✅ ${key}: Present (${val.substring(0, 10)}...)`);
    } else {
        console.error(`❌ ${key}: MISSING`);
    }
});

// 3. Test Supabase Connection
console.log('\n--- Supabase Connection Test ---');
const { createClient } = require('@supabase/supabase-js');

// Match src/index.js logic
const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('Cannot test Supabase: Missing Key');
} else {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    (async () => {
        try {
            console.log('Attempting to fetch app_users count...');
            const startTime = Date.now();
            const { count, error } = await supabase
                .from('app_users')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Supabase Error:', error.message);
                console.error('Full Error:', JSON.stringify(error, null, 2));
            } else {
                console.log(`✅ Supabase Connected! Users Count: ${count}`);
                console.log(`Latency: ${Date.now() - startTime}ms`);
            }
        } catch (e) {
            console.error('❌ Exception during Supabase request:', e.message);
        }
    })();
}
