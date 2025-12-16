require('dotenv').config();
const service = require('../src/services/supabaseService');

async function testLogin() {
    console.log('--- LOGIN LOGIC TEST ---');
    
    // 1. Get the user 'muthami' we saw earlier
    const phone = '+2540114181357'; 
    console.log(`Fetching user ${phone}...`);
    const user = await service.getUserByPhone(phone);
    
    if (!user) {
        console.error('User not found!');
        return;
    }
    
    console.log('User found:', user.username);
    console.log('Stored Hash:', user.password_hash);
    
    // 2. Test Hashing
    const testPin = '1234'; // Asumming a common pin, or valid one if known.
    // Since I don't know the real pin, I will Create a dummy hash for '1234' and see if it works
    
    console.log('\nTesting Logic with known pin "1234"...');
    // Generate hash for '1234'
    const generatedHash = service.hashPassword('1234');
    console.log('Generated Hash for "1234":', generatedHash);
    
    // Verify it back
    const isValid = service.verifyPassword('1234', generatedHash);
    console.log('Verification valid?', isValid);
    
    if (isValid) {
        console.log('[SUCCESS] Hashing logic works.');
    } else {
        console.error('[FAIL] Hashing logic is broken.');
    }

    console.log('--- END ---');
}

testLogin();
