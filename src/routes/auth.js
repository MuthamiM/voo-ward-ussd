/**
 * Auth Routes (Google + Backend OTP)
 * Centralizes auth logic for both USSD Dashboard and Mobile App.
 */
const express = require('express');
const router = express.Router();
const service = require('../services/supabaseService');

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/register-otp
 * Generates OTP, saves to Supabase, returns it in debug_message (Free 'SMS')
 */
router.post('/register-otp', async (req, res) => {
    try {
        let { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone required' });

        // Normalize phone
        if (!phone.startsWith('+')) {
            if (phone.startsWith('0')) phone = '+254' + phone.substring(1);
            else if (phone.startsWith('254')) phone = '+' + phone;
            else phone = '+254' + phone;
        }

        const otp = generateOTP();
        
        // Save to Supabase
        const saved = await service.saveOTP(phone, otp);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to generate OTP' });
        }

        // SIMULATED SMS: Return OTP in response so UI can show it
        console.log(`[AUTH] 📱 SIMULATED SMS for ${phone}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP generated',
            debug_otp: otp, // Mobile app will display this
            phone: phone
        });

    } catch (e) {
        console.error('Register OTP error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * POST /api/auth/register-verify-otp
 * Verifies OTP against Supabase
 */
router.post('/register-verify-otp', async (req, res) => {
    try {
        let { phone, otp } = req.body;
        
        // Normalize phone
        if (phone && !phone.startsWith('+')) {
            if (phone.startsWith('0')) phone = '+254' + phone.substring(1);
            else if (phone.startsWith('254')) phone = '+' + phone;
            else phone = '+254' + phone;
        }

        const result = await service.verifyOTP(phone, otp);
        
        if (result.success) {
            // Return temporary verification token
            const token = Buffer.from(`${phone}:${Date.now()}:verified`).toString('base64'); 
            res.json({ success: true, token });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (e) {
        console.error('Verify OTP error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/auth/register-complete
 * Finalize registration
 */
router.post('/register-complete', async (req, res) => {
    try {
        const { phone, password, fullName, idNumber, username, role, token, village } = req.body;
        
        // In a real app, verify 'token' to ensure OTP was passed
        if (!token) return res.status(401).json({ error: 'Verification required' });

        const result = await service.registerUser({
            fullName,
            phone,
            idNumber,
            password,
            username,
            village: village || 'N/A'
        });

        if (result.success) {
            res.json({ success: true, user: result.user });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (e) {
        console.error('Register complete error:', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Standard Phone/Password Login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username/Phone and password required' });
        }

        const result = await service.loginUser(username, password);
        
        if (result.success) {
            res.json({ success: true, user: result.user });
        } else {
            res.status(401).json({ error: result.error });
        }
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/google
 * Handle Google Sign-In
 */
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body; // Google ID Token
        
        if (!credential) {
             return res.status(400).json({ error: 'Google credential required' });
        }
        
        // 1. Verify token with Google using Axios (more robust)
        const axios = require('axios');
        
        let profile;
        try {
            const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
            profile = googleRes.data;
        } catch (axiosErr) {
            console.error('[Google-Auth] Token verification failed:', axiosErr.response?.data || axiosErr.message);
            // Return the specific error from Google if available
            const msg = axiosErr.response?.data?.error_description || 'Invalid Google Token';
            return res.status(401).json({ success: false, error: msg });
        }

        if (profile.error || !profile.email) {
            console.error('[Google-Auth] Invalid profile:', profile);
            return res.status(401).json({ success: false, error: 'Invalid Google Profile' });
        }
        
        console.log(`[Google-Auth] Verified: ${profile.email} (${profile.name})`);

        // 2. Register/Login user in Supabase
        const result = await service.registerGoogleUser({
            id: profile.sub,
            email: profile.email,
            name: profile.name,
            picture: profile.picture
        });

        if (result.success) {
            res.json({ success: true, user: result.user });
        } else {
            res.status(400).json({ error: result.error });
        }

    } catch (e) {
        console.error('Google Auth Error:', e);
        res.status(500).json({ error: 'Google Sign-In Failed' });
    }
});

/**
 * GET /api/auth/can-register
 */
router.get('/can-register', (req, res) => {
    res.json({ canRegister: true });
});

module.exports = router;
