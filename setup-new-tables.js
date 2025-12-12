/**
 * Setup script for new Supabase tables: lost_ids and feedback
 * Run with: node setup-new-tables.js
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = 'xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE1NjA3MCwiZXhwIjoyMDgwNzMyMDcwfQ.uyPb8PJztNMX5BPSSOmR2bdFCTRPfPzzVefq23w4Reg';

function supabaseRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL,
            path,
            method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: body }));
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testInsertLostId() {
    console.log('\n📋 Testing lost_ids table...');
    const result = await supabaseRequest('POST', '/rest/v1/lost_ids', {
        reporter_phone: '0712345678',
        reporter_name: 'Test User',
        id_owner_name: 'John Doe',
        id_owner_phone: '0712345679',
        is_for_self: false,
        id_number: '12345678',
        last_seen_location: 'Kyamatu Market',
        date_lost: '2025-12-10',
        additional_info: 'Blue wallet'
    });
    console.log('Insert lost_id:', result.status === 201 ? '✅ Success' : `❌ Failed: ${result.data}`);
    return result;
}

async function testInsertFeedback() {
    console.log('\n💬 Testing feedback table...');
    const result = await supabaseRequest('POST', '/rest/v1/feedback', {
        user_phone: '0712345678',
        user_name: 'Test User',
        category: 'app',
        message: 'Great app!',
        rating: 5
    });
    console.log('Insert feedback:', result.status === 201 ? '✅ Success' : `❌ Failed: ${result.data}`);
    return result;
}

async function main() {
    console.log('🔧 Setting up new Supabase tables...\n');
    console.log('Note: Tables must be created manually in Supabase Dashboard SQL Editor.');
    console.log('Copy and run these SQL statements:\n');
    
    console.log('-- Table 1: Lost IDs');
    console.log(`CREATE TABLE IF NOT EXISTS lost_ids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_phone TEXT NOT NULL,
  reporter_name TEXT,
  id_owner_name TEXT NOT NULL,
  id_owner_phone TEXT,
  is_for_self BOOLEAN DEFAULT true,
  id_number TEXT,
  last_seen_location TEXT,
  date_lost DATE,
  additional_info TEXT,
  status TEXT DEFAULT 'pending',
  found_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`);

    console.log('\n-- Table 2: Feedback');
    console.log(`CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_phone TEXT,
  user_name TEXT,
  category TEXT DEFAULT 'general',
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'new',
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`);

    console.log('\n🔍 Testing if tables exist...');
    
    // Test lost_ids
    const lostIdResult = await testInsertLostId();
    
    // Test feedback  
    const feedbackResult = await testInsertFeedback();
    
    if (lostIdResult.status === 201 && feedbackResult.status === 201) {
        console.log('\n✅ Both tables exist and working!');
    } else {
        console.log('\n⚠️ Tables may not exist yet. Please create them in Supabase Dashboard.');
    }
}

main().catch(console.error);
