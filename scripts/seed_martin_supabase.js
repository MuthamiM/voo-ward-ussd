/**
 * Seed Martin admin user to Supabase app_users
 * This is the correct seeder since login uses supabaseService
 */
require('dotenv').config();
const supabaseService = require('../src/services/supabaseService');

async function seedMartin() {
    console.log('🌱 Seeding Martin admin user to Supabase...');

    try {
        // Check if martin already exists
        const existing = await supabaseService.getUserByUsernameOrPhone('martin');

        if (existing) {
            console.log('ℹ️  Martin already exists in Supabase (id:', existing.id, ')');
            console.log('   Updating password and role...');

            // Update password hash (role is injected at login for known admins)
            const newHash = supabaseService.hashPassword('827700');
            await supabaseService.request('PATCH', `/rest/v1/app_users?id=eq.${existing.id}`, {
                password_hash: newHash,
                is_verified: true,
                is_active: true,
                updated_at: new Date().toISOString()
            });
            console.log('✅ Martin password & role updated successfully.');
        } else {
            console.log('   Martin not found, creating new user...');
            const passwordHash = supabaseService.hashPassword('827700');

            await supabaseService.request('POST', '/rest/v1/app_users', {
                full_name: 'Martin Admin',
                username: 'martin',
                phone: '+254700827700',
                password_hash: passwordHash,
                is_verified: true,
                is_active: true,
                created_at: new Date().toISOString()
            });
            console.log('✅ Martin added to Supabase app_users successfully.');
        }

        // Also verify 'zak' admin exists
        const zak = await supabaseService.getUserByUsernameOrPhone('zak');
        if (zak) {
            console.log('ℹ️  ZAK admin exists (id:', zak.id, ')');
        } else {
            console.log('⚠️  ZAK admin not found in Supabase');
        }

    } catch (e) {
        console.error('❌ Failed to seed Martin:', e.message || e);
    }

    // Don't exit in prestart — let the process continue
    // process.exit(0);
}

seedMartin();
