/**
 * Email Service for OTP delivery
 * Uses Nodemailer with Resend SMTP (Free: 3000 emails/month)
 * 
 * To use Resend:
 * 1. Sign up at https://resend.com (free)
 * 2. Get your API key
 * 3. Set env var: RESEND_API_KEY=re_xxxxxxxx
 * 
 * Or use Gmail:
 * 1. Enable 2FA on your Google account
 * 2. Create an App Password at https://myaccount.google.com/apppasswords
 * 3. Set env vars: SMTP_USER=your@gmail.com, SMTP_PASS=app_password
 */

const nodemailer = require('nodemailer');

// Email configuration from environment
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.resend.com';
const SMTP_PORT = process.env.SMTP_PORT || 465;
const SMTP_USER = process.env.SMTP_USER || 'resend';
const SMTP_PASS = process.env.SMTP_PASS || RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'VOO Citizen App <noreply@voocitizen.app>';

// Create transporter
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    
    // Check if we have credentials
    if (!SMTP_PASS && !RESEND_API_KEY) {
        console.warn('[Email] No SMTP credentials configured. Set RESEND_API_KEY or SMTP_PASS env var.');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: parseInt(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS || RESEND_API_KEY,
        },
    });
    
    return transporter;
}

/**
 * Send OTP email
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendOTPEmail(to, otp) {
    const transport = getTransporter();
    
    if (!transport) {
        console.log(`[Email] Would send OTP ${otp} to ${to} (no SMTP configured)`);
        return { success: false, error: 'Email not configured', debug_otp: otp };
    }
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #FF8C00; margin: 0;">VOO Citizen App</h1>
                <p style="color: #666; margin: 5px 0;">Your Verification Code</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 20px;">
                <p style="color: #fff; margin: 0 0 10px 0; font-size: 14px;">Enter this code to verify your email:</p>
                <div style="background: #fff; border-radius: 8px; padding: 15px 30px; display: inline-block;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
                </div>
            </div>
            
            <p style="color: #888; font-size: 12px; text-align: center;">
                This code expires in 10 minutes.<br>
                If you didn't request this, please ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="color: #aaa; font-size: 11px; text-align: center;">
                VOO Ward Community App<br>
                Serving the community of Voo Ward
            </p>
        </div>
    `;
    
    try {
        await transport.sendMail({
            from: FROM_EMAIL,
            to: to,
            subject: `${otp} is your VOO Citizen verification code`,
            html: html,
            text: `Your VOO Citizen App verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
        });
        
        console.log(`[Email] ✅ OTP sent to ${to}`);
        return { success: true };
        
    } catch (error) {
        console.error(`[Email] ❌ Failed to send to ${to}:`, error.message);
        return { success: false, error: error.message, debug_otp: otp };
    }
}

module.exports = { sendOTPEmail };
