const supabaseService = require('./src/services/supabaseService');

async function testLogin() {
    console.log('🧪 Testing local login logic...');

    // svc is already instantiated
    const svc = supabaseService;
    
    // Test Zak
    console.log('Testing login for "zak" with password "827700"...');
    const result = await svc.loginUser('zak', '827700');
    
    if (result.success) {
        console.log('✅ Login SUCCESS!');
        console.log('User:', result.user);
    } else {
        console.log('❌ Login FAILED:', result.error);
    }

    // Test Muthami
    console.log('\nTesting login for "muthami" with password "admin123"...');
    const result2 = await svc.loginUser('muthami', 'admin123');
    
    if (result2.success) {
        console.log('✅ Login SUCCESS!');
        console.log('User:', result2.user);
    } else {
        console.log('❌ Login FAILED:', result2.error);
    }
}

testLogin();
