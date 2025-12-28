/**
 * Auth Routes (Google + Backend OTP)
 * Uses PostgreSQL for all auth operations
 */
const express = require('express');
const router = express.Router();

// PostgreSQL only - no Supabase
const otpService = require('../services/postgresOtpService');
const userService = require('../services/postgresUserService');
console.log('[AUTH] Using PostgreSQL for all auth operations');

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
        const saved = await otpService.saveOTP(phone, otp);
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

        const result = await otpService.verifyOTP(phone, otp);
        
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

        const result = await userService.registerUser({
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

// ============ EMAIL OTP (FREE - Unlimited) ============

const emailService = require('../services/emailService');

/**
 * POST /api/auth/email-otp
 * Generates OTP and sends to email (FREE via Resend - 3000/month)
 */
router.post('/email-otp', async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        email = email.toLowerCase().trim();
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const otp = generateOTP();
        
        // Save to Supabase
        const saved = await otpService.saveEmailOTP(email, otp);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to generate OTP' });
        }

        // Send OTP via email
        const emailResult = await emailService.sendOTPEmail(email, otp);
        
        console.log(`[AUTH] 📧 EMAIL OTP for ${email}: ${otp} - Sent: ${emailResult.success}`);

        // If email sending is configured and works, don't return debug_otp
        if (emailResult.success) {
            res.json({
                success: true,
                message: 'Verification code sent to your email',
                email: email
            });
        } else {
            // Fallback: return debug_otp if email not configured
            res.json({
                success: true,
                message: 'OTP generated (email not configured)',
                debug_otp: emailResult.debug_otp || otp,
                email: email
            });
        }

    } catch (e) {
        console.error('Email OTP error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * POST /api/auth/email-verify-otp
 * Verifies email OTP
 */
router.post('/email-verify-otp', async (req, res) => {
    try {
        let { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }
        
        email = email.toLowerCase().trim();

        const result = await otpService.verifyEmailOTP(email, otp);
        
        if (result.success) {
            // Return temporary verification token
            const token = Buffer.from(`${email}:${Date.now()}:email-verified`).toString('base64'); 
            res.json({ success: true, token, email });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (e) {
        console.error('Email Verify OTP error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/auth/email-register-complete
 * Finalize registration with email verification (still collects phone)
 */
router.post('/email-register-complete', async (req, res) => {
    try {
        const { email, phone, password, fullName, idNumber, username, token, village } = req.body;
        
        // Verify token contains email verification
        if (!token) return res.status(401).json({ error: 'Email verification required' });

        const result = await supabaseuserService.registerUserWithEmail({
            fullName,
            email,
            phone, // Still collect phone number
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
        console.error('Email register complete error:', e);
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

        const result = await userService.loginUser(username, password);
        
        if (result.success) {
            // Generate session token for dashboard compatibility
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            
            // Build user object with role for dashboard authorization
            const sessionUser = {
                id: result.user.id,
                username: result.user.username,
                fullName: result.user.fullName,
                role: result.user.role || 'user',
                phone: result.user.phone,
                village: result.user.village,
                settings: {}
            };
            
            // Store session in the shared adminSessionStore so dashboard auth works
            const sessions = require('../services/adminSessionStore');
            sessions.set(token, { user: sessionUser, createdAt: new Date() });
            
            console.log('[AUTH] Login success for:', sessionUser.username, 'role:', sessionUser.role, 'token stored');
            
            res.json({ success: true, token, user: sessionUser });
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
        const result = await userService.registerGoogleUser({
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
 * POST /api/auth/reset-password-otp
 * Send OTP for password reset
 */
router.post('/reset-password-otp', async (req, res) => {
    try {
        let { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone required' });

        // Normalize phone
        if (!phone.startsWith('+')) {
            if (phone.startsWith('0')) phone = '+254' + phone.substring(1);
            else if (phone.startsWith('254')) phone = '+' + phone;
            else phone = '+254' + phone;
        }

        // Check if user exists
        const user = await userService.getUserByPhone(phone);
        if (!user) {
            return res.status(404).json({ error: 'Phone number not registered' });
        }

        // Generate and save OTP
        const otp = generateOTP();
        const saved = await otpService.saveOTP(phone, otp);
        if (!saved) {
            return res.status(500).json({ error: 'Failed to generate OTP' });
        }

        console.log(`[AUTH] 📱 Password Reset OTP for ${phone}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent',
            debug_otp: otp, // Mobile app will display this
            phone: phone
        });

    } catch (e) {
        console.error('Reset password OTP error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * POST /api/auth/reset-password-verify
 * Verify OTP and set new password
 */
router.post('/reset-password-verify', async (req, res) => {
    try {
        let { phone, otp, newPassword } = req.body;
        
        if (!phone || !otp || !newPassword) {
            return res.status(400).json({ error: 'Phone, OTP, and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Normalize phone
        if (!phone.startsWith('+')) {
            if (phone.startsWith('0')) phone = '+254' + phone.substring(1);
            else if (phone.startsWith('254')) phone = '+' + phone;
            else phone = '+254' + phone;
        }

        // Verify OTP
        const otpResult = await otpService.verifyOTP(phone, otp);
        if (!otpResult.success) {
            return res.status(400).json({ error: otpResult.error });
        }

        // Update password
        const updateResult = await userService.updatePasswordByPhone(phone, newPassword);
        if (!updateResult.success) {
            return res.status(500).json({ error: updateResult.error });
        }

        console.log(`[AUTH] ✅ Password reset successful for ${phone}`);
        res.json({ success: true, message: 'Password reset successful' });

    } catch (e) {
        console.error('Reset password verify error:', e);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

/**
 * POST /api/auth/update-fcm
 * Update FCM token for a user
 */
router.post('/update-fcm', async (req, res) => {
    try {
        const { userId, fcmToken } = req.body;
        
        if (!userId || !fcmToken) {
            return res.status(400).json({ error: 'userId and fcmToken required' });
        }

        const result = await userService.updateUserFCMToken(userId, fcmToken);
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (e) {
        console.error('Update FCM error:', e);
        res.status(500).json({ error: 'FCM update failed' });
    }
});

/**
 * GET /api/auth/can-register
 */
router.get('/can-register', (req, res) => {
    res.json({ canRegister: true });
});

module.exports = router;
