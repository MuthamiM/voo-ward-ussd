/**
 * Script to add test issues to Supabase with Cloudinary images
 */
const https = require('https');

const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTYwNzAsImV4cCI6MjA4MDczMjA3MH0.2tZ7eu6DtBg2mSOitpRa4RNvgCGg3nvMWeDmn9fPJY0';

// Sample Cloudinary test images (public placeholder images)
const testIssues = [
  {
    title: 'Pothole on Main Road',
    issue_number: 'ISS-001',
    category: 'Roads',
    description: 'Large pothole near the market junction causing accidents. Needs urgent repair.',
    location: 'Kyamatu Market Junction',
    status: 'pending',
    images: ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
    user_id: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'Broken Water Pipe',
    issue_number: 'ISS-002',
    category: 'Water',
    description: 'Water pipe burst near primary school, water wasting for 3 days now.',
    location: 'Kyamatu Primary School',
    status: 'pending',
    images: ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
    user_id: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'Streetlight Not Working',
    issue_number: 'ISS-003',
    category: 'Electricity',
    description: 'Streetlight at the bus stage has been off for 2 weeks. Security concern.',
    location: 'Kyamatu Bus Stage',
    status: 'Resolved',
    images: ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
    user_id: null,
    resolution_notes: 'Fixed by KPLC team',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'Garbage Dumping',
    issue_number: 'ISS-004',
    category: 'Sanitation',
    description: 'Illegal garbage dumping site near the health center. Health hazard.',
    location: 'Kyamatu Health Center',
    status: 'In Progress',
    images: ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
    user_id: null,
    resolution_notes: 'Cleanup scheduled',
    created_at: new Date().toISOString(),
  },
];

async function insertIssue(issue) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(issue);
    
    const options = {
      hostname: 'xzhmdxtzpuxycvsatjoe.supabase.co',
      path: '/rest/v1/issues',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Added: ${issue.title}`);
          resolve(body);
        } else {
          console.log(`❌ Failed: ${issue.title} - ${res.statusCode}: ${body}`);
          reject(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Adding test issues to Supabase...\n');
  
  for (const issue of testIssues) {
    try {
      await insertIssue(issue);
    } catch (e) {
      console.error('Error:', e);
    }
  }
  
  console.log('\nDone! Refresh dashboard to see issues.');
}

main();
