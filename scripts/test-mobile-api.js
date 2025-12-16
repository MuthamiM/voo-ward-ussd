const axios = require('axios');

const BASE_URL = 'http://localhost:4000'; // Make sure backend is running

async function testMobileAPI() {
    console.log('📱 Testing Mobile API Endpoints...\n');

    // 1. Report Lost ID
    console.log('--- Testing Report Lost ID ---');
    try {
        const lostIdData = {
            reporter_phone: '+254712345678',
            reporter_name: 'Test Reporter',
            id_owner_name: 'John Doe',
            id_owner_phone: '+254787654321', // Optional
            is_for_self: false,
            id_number: '12345678',
            last_seen_location: 'Market Center',
            date_lost: new Date().toISOString().split('T')[0],
            additional_info: 'Lost near the bus stop'
        };

        const res = await axios.post(`${BASE_URL}/api/citizen/lost-ids`, lostIdData);
        console.log('✅ Lost ID Reported:', res.data);
    } catch (e) {
        console.error('❌ Report Lost ID Failed:', e.response ? e.response.data : e.message);
    }

    // 2. Create & Delete Issue Test (Verify Permissions)
    console.log('\n--- Testing Create & Delete Issue Flow ---');
    try {
        // Step A: Create Issue
        const issueData = {
            phoneNumber: '+254712345678',
            title: 'Test Issue for Deletion',
            category: 'Roads',
            description: 'This is a test issue to verify deletion logic.',
            location: 'Test Location',
            images: [],
            userId: 'test-user-id',
            fullName: 'Test User'
        };
        
        console.log('Creating Issue...');
        const createRes = await axios.post(`${BASE_URL}/api/citizen/mobile/issues`, issueData);
        
        if (createRes.data.success) {
            const ticket = createRes.data.ticket; // e.g. ISS-001
            const id = createRes.data.issue._id || createRes.data.issue.id; // Could be MongoDB _id or Supabase ID depending on fallback
            console.log(`✅ Issue Created: ${ticket} (ID: ${id})`);
            
            // Step B: Delete Issue
            console.log(`Deleting Issue ${ticket}...`);
            const deleteRes = await axios.delete(`${BASE_URL}/api/citizen/mobile/issues/${ticket}`);
            console.log('✅ Delete Issue Response:', deleteRes.data);
        } else {
            console.error('❌ Failed to create issue, cannot test delete.');
        }
    } catch (e) {
        console.error('❌ Create/Delete Flow Failed:', e.response ? e.response.data : e.message);
    }
}

testMobileAPI();

async function testMobileAPI() {
    console.log('📱 Testing Mobile API Endpoints...\n');

    // --- AUTH TESTS ---
    console.log('--- Testing Auth Flow (OTP) ---');
    let verifyToken = null;
    const testPhone = '+254700112233';
    
    try {
        // 1. Get OTP
        console.log(`Requesting OTP for ${testPhone}...`);
        const otpRes = await axios.post(`${BASE_URL}/api/auth/register-otp`, { phone: testPhone });
        console.log('✅ OTP Generated:', otpRes.data);
        
        const otp = otpRes.data.debug_otp;
        
        if (otp) {
            // 2. Verify OTP
            console.log(`Verifying OTP ${otp}...`);
            const verifyRes = await axios.post(`${BASE_URL}/api/auth/register-verify-otp`, { 
                phone: testPhone, 
                otp: otp 
            });
            console.log('✅ OTP Verified. Token:', verifyRes.data.token);
            verifyToken = verifyRes.data.token;
        }
        
    } catch (e) {
        console.error('❌ Auth Flow Failed:', e.response ? e.response.data : e.message);
    }

    // --- REPORT LOST ID ---
    console.log('\n--- Testing Report Lost ID ---');
    try {
        const lostIdData = {
            reporter_phone: testPhone,
            reporter_name: 'Test Reporter',
            id_owner_name: 'John Doe',
            id_owner_phone: '+254787654321', // Optional
            is_for_self: false,
            id_number: '12345678',
            last_seen_location: 'Market Center',
            date_lost: new Date().toISOString().split('T')[0],
            additional_info: 'Lost near the bus stop'
        };

        const res = await axios.post(`${BASE_URL}/api/citizen/lost-ids`, lostIdData);
        console.log('✅ Lost ID Reported:', res.data);
    } catch (e) {
        console.error('❌ Report Lost ID Failed:', e.response ? e.response.data : e.message);
    }

    // --- ISSUES TEST ---
    console.log('\n--- Testing Create & Delete Issue Flow ---');
    try {
        // Step A: Create Issue
        const issueData = {
            phoneNumber: testPhone,
            title: 'Test Issue using new Auth',
            category: 'Roads',
            description: 'This is a test issue.',
            location: 'Test Location',
            images: [],
            userId: 'test-user-id', // In real flow, get this from auth response
            fullName: 'Test User'
        };
        
        console.log('Creating Issue...');
        const createRes = await axios.post(`${BASE_URL}/api/citizen/mobile/issues`, issueData);
        
        if (createRes.data.success) {
            const ticket = createRes.data.ticket; 
            const id = createRes.data.issue._id || createRes.data.issue.id;
            console.log(`✅ Issue Created: ${ticket}`);
            
            // Step B: Delete Issue
            console.log(`Deleting Issue ${ticket}...`);
            const deleteRes = await axios.delete(`${BASE_URL}/api/citizen/mobile/issues/${ticket}`);
            console.log('✅ Delete Issue Response:', deleteRes.data);
        } else {
            console.error('❌ Failed to create issue, cannot test delete.');
        }
    } catch (e) {
        console.error('❌ Create/Delete Flow Failed:', e.response ? e.response.data : e.message);
    }
}
