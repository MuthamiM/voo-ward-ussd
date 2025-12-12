/**
 * Migration Script: MongoDB Issues → Supabase
 * 
 * This script migrates all issues from MongoDB to Supabase,
 * including Cloudinary image URLs so they display in the dashboard.
 * 
 * Run with: node migrate-issues-to-supabase.js
 */

require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const https = require('https');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

// Supabase credentials
const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not set in environment');
    process.exit(1);
}

if (!SUPABASE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in environment');
    process.exit(1);
}

// Supabase REST API helper
function supabaseRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
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
                    const result = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(result);
                    } else {
                        reject({ status: res.statusCode, error: result });
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function migrateIssues() {
    console.log('🔄 Starting MongoDB → Supabase issues migration...\n');

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
        tls: true,
    });

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('voo_ward');
        const issues = await db.collection('issues').find({}).toArray();
        console.log(`📋 Found ${issues.length} issues in MongoDB\n`);

        let migrated = 0;
        let skipped = 0;
        let failed = 0;

        for (const issue of issues) {
            try {
                // Map MongoDB fields to Supabase schema (only use columns that exist)
                const supabaseIssue = {
                    issue_number: issue.ticket || `ISS-${Date.now().toString().slice(-6)}`,
                    title: issue.title || issue.category,
                    category: issue.category,
                    description: issue.description || issue.message,
                    location: typeof issue.location === 'object' ? JSON.stringify(issue.location) : issue.location,
                    images: issue.images || [],
                    user_phone: issue.phone_number || issue.phone || '',
                    user_id: issue.user_id || null,
                    status: issue.status === 'open' ? 'Pending' : 
                            issue.status === 'resolved' ? 'Resolved' : 
                            (issue.status || 'Pending'),
                    resolution_notes: issue.action_note || issue.resolution_notes || null,
                    created_at: issue.created_at ? new Date(issue.created_at).toISOString() : new Date().toISOString()
                };

                // Check if issue already exists
                const existing = await supabaseRequest('GET', 
                    `/rest/v1/issues?issue_number=eq.${encodeURIComponent(supabaseIssue.issue_number)}&select=id`);
                
                if (existing && existing.length > 0) {
                    console.log(`⏭️  Skipping ${supabaseIssue.issue_number} (already exists)`);
                    skipped++;
                    continue;
                }

                // Insert into Supabase
                await supabaseRequest('POST', '/rest/v1/issues', supabaseIssue);
                console.log(`✅ Migrated: ${supabaseIssue.issue_number} - ${supabaseIssue.title} (${supabaseIssue.images.length} images)`);
                migrated++;

            } catch (err) {
                console.error(`❌ Failed to migrate ${issue.ticket || 'unknown'}:`, err.error || err.message);
                failed++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Migrated: ${migrated}`);
        console.log(`   ⏭️  Skipped:  ${skipped}`);
        console.log(`   ❌ Failed:   ${failed}`);
        console.log('='.repeat(50));

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.close();
        console.log('\n🔒 MongoDB connection closed');
    }
}

// Run migration
migrateIssues().catch(console.error);
