// Script to list all users in Supabase app_users table
const https = require('https');

const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTYwNzAsImV4cCI6MjA4MDczMjA3MH0.2tZ7eu6DtBg2mSOitpRa4RNvgCGg3nvMWeDmn9fPJY0';

const options = {
  hostname: 'xzhmdxtzpuxycvsatjoe.supabase.co',
  path: '/rest/v1/app_users?select=id,username,full_name,phone,email&order=created_at.desc&limit=20',
  method: 'GET',
  headers: {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const users = JSON.parse(body);
      console.log(`\n=== Total Users Found: ${users.length} ===\n`);
      users.forEach((u, i) => {
        console.log(`${i+1}. Username: ${u.username || '(none)'} | Name: ${u.full_name || '(none)'} | Phone: ${u.phone || '(none)'} | Email: ${u.email || '(none)'}`);
      });
    } catch (e) {
      console.error('Parse error:', e);
      console.log('Raw response:', body);
    }
  });
});

req.on('error', error => console.error('Request error:', error));
req.end();
