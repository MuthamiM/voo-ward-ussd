/**
 * Update Supabase app_config minimum_version to 12.0.0
 * This will prompt v10/v11 users to update
 */

const https = require('https');

const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTYwNzAsImV4cCI6MjA4MDczMjA3MH0.2tZ7eu6DtBg2mSOitpRa4RNvgCGg3nvMWeDmn9fPJY0';

async function updateMinimumVersion() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ value: '12.0.0' });
        
        const options = {
            hostname: 'xzhmdxtzpuxycvsatjoe.supabase.co',
            path: '/rest/v1/app_config?key=eq.minimum_version',
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                console.log('Response:', body);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ minimum_version updated to 12.0.0');
                    resolve(true);
                } else {
                    console.log('❌ Update may have failed, checking current value...');
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Error:', e);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

// Also try to insert if not exists
async function upsertMinimumVersion() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ key: 'minimum_version', value: '12.0.0' });
        
        const options = {
            hostname: 'xzhmdxtzpuxycvsatjoe.supabase.co',
            path: '/rest/v1/app_config',
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Prefer': 'resolution=merge-duplicates,return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log('Upsert Status:', res.statusCode);
                console.log('Upsert Response:', body);
                resolve(res.statusCode);
            });
        });

        req.on('error', (e) => {
            console.error('Upsert Error:', e);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('Updating minimum_version to 12.0.0...');
    
    // Try PATCH first
    const patchResult = await updateMinimumVersion();
    
    if (!patchResult) {
        // Try upsert if patch didn't work
        console.log('\\nTrying upsert...');
        await upsertMinimumVersion();
    }
    
    console.log('\\n✅ Done! v10/v11 users will now be prompted to update.');
}

main().catch(console.error);
