/**
 * Email Service for OTP delivery
 * Uses Resend HTTP API (Free: 3000 emails/month)
 * 
 * Set env var: RESEND_API_KEY=re_xxxxxxxx
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send OTP email via Resend HTTP API
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendOTPEmail(to, otp) {
    if (!RESEND_API_KEY) {
        console.log(`[Email] RESEND_API_KEY not set. OTP ${otp} for ${to}`);
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
        </div>
    `;
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'VOO Citizen <onboarding@resend.dev>',
                to: [to],
                subject: `${otp} is your VOO Citizen verification code`,
                html: html,
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log(`[Email] OTP sent to ${to} via Resend`);
            return { success: true };
        } else {
            console.error(`[Email] Resend error:`, data);
            return { success: false, error: data.message || 'Send failed', debug_otp: otp };
        }
        
    } catch (error) {
        console.error(`[Email] Failed to send to ${to}:`, error.message);
        return { success: false, error: error.message, debug_otp: otp };
    }
}

module.exports = { sendOTPEmail };
