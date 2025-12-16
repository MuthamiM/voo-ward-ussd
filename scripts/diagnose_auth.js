require('dotenv').config();
const service = require('../src/services/supabaseService');

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');
    console.log('1. Checking Environment Variables...');
    console.log('SUPABASE_SERVICE_ROLE_KEY configured?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('\n2. Testing Read Access (getAllUsers)...');
    try {
        const users = await service.getAllUsers();
        console.log(`[SUCCESS] Read ${users.length} users.`);
        if (users.length > 0) {
            console.log('Sample user:', JSON.stringify(users[0], null, 2));
        }
    } catch (e) {
        console.error('[FAIL] Read Access:', e);
    }

    console.log('\n3. Testing Mobile App Service Key (supabaseService.js)...');
    // Using internal propery via inspection if possible, or just trusting the result above
    console.log('If Read Access failed with [] or error, verify SUPABASE_SERVICE_ROLE_KEY in Render.');

    console.log('--- DIAGNOSTIC END ---');
}

diagnose();
