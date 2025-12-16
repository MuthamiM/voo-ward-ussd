require('dotenv').config();
const service = require('../src/services/supabaseService');

async function resetPin() {
    const phone = '+2540114181357'; // User 'muthami'
    const newPin = '1234';
    
    console.log(`Resetting PIN for ${phone} to '${newPin}'...`);
    
    // 1. Get user to find ID
    const user = await service.getUserByPhone(phone);
    if (!user) {
        console.error('User not found!');
        process.exit(1);
    }

    // 2. Hash new pin
    const newHash = service.hashPassword(newPin);
    
    // 3. Update directly using REST (since updateAppUser isn't exposed, we use request)
    // SupabaseService.request(method, path, data)
    try {
        const result = await service.request('PATCH', `/rest/v1/app_users?id=eq.${user.id}`, {
            password_hash: newHash,
            updated_at: new Date().toISOString()
        });
        
        console.log('[SUCCESS] PIN Reset Successfully.');
        console.log(`You can now login with: Username: ${user.username} | PIN: ${newPin}`);
        
    } catch (e) {
        console.error('[FAIL] Reset failed:', e);
    }
}

resetPin();
