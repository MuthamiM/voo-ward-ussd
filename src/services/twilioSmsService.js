/**
 * Twilio SMS Service for OTP
 */
const logger = require('../lib/logger');

let twilioClient = null;

// OTP storage (in production, use Redis or database)
const otpStore = new Map();

/**
 * Initialize Twilio client
 */
function initializeTwilio() {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        logger.warn('⚠️ Twilio credentials not configured. SMS features disabled.');
        return null;
    }

    try {
        const twilio = require('twilio');
        twilioClient = twilio(accountSid, authToken);
        logger.info('✅ Twilio SMS client initialized');
        return twilioClient;
    } catch (err) {
        logger.error('Failed to initialize Twilio:', err);
        return null;
    }
}

/**
 * Generate 6-digit OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format phone number to E.164 format
 */
function formatPhone(phone) {
    let formatted = phone.replace(/\s+/g, '').replace(/-/g, '');

    if (formatted.startsWith('0')) {
        formatted = '+254' + formatted.substring(1);
    } else if (formatted.startsWith('254')) {
        formatted = '+' + formatted;
    } else if (!formatted.startsWith('+')) {
        formatted = '+254' + formatted;
    }

    return formatted;
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, message) {
    const client = initializeTwilio();

    if (!client) {
        logger.warn('Cannot send SMS: Twilio not configured');
        // In dev mode, log the message
        console.log(`📱 [DEV SMS] To: ${to}, Message: ${message}`);
        return { success: true, dev: true };
    }

    const formattedPhone = formatPhone(to);
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    try {
        const msgOptions = {
            to: formattedPhone,
            body: message
        };

        // Use Messaging Service SID if available, otherwise use phone number
        if (messagingServiceSid) {
            msgOptions.messagingServiceSid = messagingServiceSid;
        } else if (fromNumber) {
            msgOptions.from = fromNumber;
        } else {
            logger.error('No Twilio sender configured (TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER)');
            return { success: false, error: 'No sender configured' };
        }

        const result = await client.messages.create(msgOptions);
        logger.info(`✅ SMS sent to ${formattedPhone}: ${result.sid}`);
        return { success: true, messageSid: result.sid };
    } catch (err) {
        logger.error(`❌ SMS failed to ${formattedPhone}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Generate and send OTP to phone
 * Returns the OTP (for storing as password)
 */
async function sendOTP(phone) {
    const otp = generateOTP();
    const formattedPhone = formatPhone(phone);

    // Store OTP with 10 min expiry
    otpStore.set(formattedPhone, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000
    });

    const message = `Your VOO Ward verification code is: ${otp}. This is your initial password. You can change it after logging in.`;

    const result = await sendSMS(phone, message);

    if (result.success) {
        logger.info(`OTP sent to ${formattedPhone}`);
        return { success: true, otp }; // Return OTP so it can be used as password
    } else {
        return { success: false, error: result.error };
    }
}

/**
 * Verify OTP (optional - for verification before registration)
 */
function verifyOTP(phone, code) {
    const formattedPhone = formatPhone(phone);
    const stored = otpStore.get(formattedPhone);

    if (!stored) {
        return { valid: false, error: 'No OTP found for this phone' };
    }

    if (Date.now() > stored.expiresAt) {
        otpStore.delete(formattedPhone);
        return { valid: false, error: 'OTP expired' };
    }

    if (stored.otp !== code) {
        return { valid: false, error: 'Invalid OTP' };
    }

    // OTP is valid - remove from store
    otpStore.delete(formattedPhone);
    return { valid: true };
}

/**
 * Check if Twilio is configured
 */
function isTwilioConfigured() {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

module.exports = {
    sendSMS,
    sendOTP,
    verifyOTP,
    generateOTP,
    formatPhone,
    isTwilioConfigured
};
