/**
 * WhatsApp Service
 * Handles WhatsApp messaging via Twilio API
 */

const logger = require('../lib/logger');

let twilioClient = null;

// Initialize Twilio client
function initializeTwilio() {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        logger.warn('Twilio credentials not configured. WhatsApp features disabled.');
        return null;
    }

    try {
        const twilio = require('twilio');
        twilioClient = twilio(accountSid, authToken);
        logger.info('✅ Twilio WhatsApp client initialized');
        return twilioClient;
    } catch (err) {
        logger.error('Failed to initialize Twilio:', err);
        return null;
    }
}

/**
 * Send WhatsApp message
 * @param {string} to - Recipient phone number (E.164 format: +254712345678)
 * @param {string} message - Message text
 * @returns {Promise<object>} Message SID and status
 */
async function sendWhatsAppMessage(to, message) {
    const client = initializeTwilio();
    if (!client) {
        logger.warn('Cannot send WhatsApp message: Twilio not configured');
        return { success: false, error: 'WhatsApp not configured' };
    }

    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    // Ensure 'to' number has whatsapp: prefix
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
        const result = await client.messages.create({
            from: from,
            to: toNumber,
            body: message
        });

        logger.info(`WhatsApp message sent to ${to}: ${result.sid}`);
        return {
            success: true,
            messageSid: result.sid,
            status: result.status
        };
    } catch (err) {
        logger.error(`Failed to send WhatsApp to ${to}:`, err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Send WhatsApp message with media (photo)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {string} mediaUrl - URL to media file
 * @returns {Promise<object>}
 */
async function sendWhatsAppMedia(to, message, mediaUrl) {
    const client = initializeTwilio();
    if (!client) {
        return { success: false, error: 'WhatsApp not configured' };
    }

    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
        const result = await client.messages.create({
            from: from,
            to: toNumber,
            body: message,
            mediaUrl: [mediaUrl]
        });

        logger.info(`WhatsApp media sent to ${to}: ${result.sid}`);
        return {
            success: true,
            messageSid: result.sid,
            status: result.status
        };
    } catch (err) {
        logger.error(`Failed to send WhatsApp media to ${to}:`, err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Send issue status update notification
 * @param {string} phoneNumber - Citizen phone number
 * @param {object} issue - Issue object
 * @param {string} language - Language code (en, sw, kam)
 */
async function sendIssueStatusUpdate(phoneNumber, issue, language = 'en') {
    const messages = {
        en: {
            open: `Your issue ${issue.ticket} has been received and is being reviewed.`,
            in_progress: `Good news! Your issue ${issue.ticket} (${issue.category}) is now being worked on.`,
            resolved: `Your issue ${issue.ticket} has been resolved. Thank you for your patience!`,
            closed: `Issue ${issue.ticket} has been closed.`
        },
        sw: {
            open: `Tatizo lako ${issue.ticket} limepokewa na linakaguliwa.`,
            in_progress: `Habari njema! Tatizo lako ${issue.ticket} (${issue.category}) linashughulikiwa sasa.`,
            resolved: `Tatizo lako ${issue.ticket} limetatuliwa. Asante kwa uvumilivu wako!`,
            closed: `Tatizo ${issue.ticket} limefungwa.`
        },
        kam: {
            open: `Mbesa yaku ${issue.ticket} nĩyamũkĩĩtwe na ĩĩ kũlolwa.`,
            in_progress: `Mawĩa manene! Mbesa yaku ${issue.ticket} (${issue.category}) ĩĩ kũthondekethwa ĩndĩ ĩĩ.`,
            resolved: `Mbesa yaku ${issue.ticket} nĩyathondekethĩtwe. Twathokia nĩ ũndũ wa ũkĩĩthĩĩa waku!`,
            closed: `Mbesa ${issue.ticket} nĩyahingĩĩtwe.`
        }
    };

    const lang = messages[language] || messages.en;
    const message = lang[issue.status] || lang.open;

    return await sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Send bursary application update
 * @param {string} phoneNumber - Applicant phone number
 * @param {object} application - Bursary application object
 * @param {string} language - Language code
 */
async function sendBursaryUpdate(phoneNumber, application, language = 'en') {
    const messages = {
        en: {
            pending: `Your bursary application ${application.reference} is under review.`,
            approved: `Congratulations! Your bursary application ${application.reference} for KES ${application.amount} has been approved.`,
            rejected: `We regret to inform you that bursary application ${application.reference} was not approved this time.`,
            disbursed: `Your bursary of KES ${application.amount} has been disbursed. Check your M-Pesa.`
        },
        sw: {
            pending: `Ombi lako la bursary ${application.reference} linakaguliwa.`,
            approved: `Hongera! Ombi lako la bursary ${application.reference} la KES ${application.amount} limeidhinishwa.`,
            rejected: `Tunasikitika kukujulisha kwamba ombi la bursary ${application.reference} halikuidhinishwa wakati huu.`,
            disbursed: `Bursary yako ya KES ${application.amount} imetolewa. Angalia M-Pesa yako.`
        },
        kam: {
            pending: `Ĩtũma yaku ya bursary ${application.reference} ĩĩ kũlolwa.`,
            approved: `Syongithya! Ĩtũma yaku ya bursary ${application.reference} ya KES ${application.amount} nĩyetĩkĩĩtwe.`,
            rejected: `Tũthemba kũkwĩa atĩ ĩtũma ya bursary ${application.reference} ndyetĩkĩĩtwe wakati ũyũ.`,
            disbursed: `Bursary yaku ya KES ${application.amount} nĩyatumĩtwe. Lola M-Pesa yaku.`
        }
    };

    const lang = messages[language] || messages.en;
    const message = lang[application.status] || lang.pending;

    return await sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Check if WhatsApp is configured
 */
function isWhatsAppEnabled() {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

module.exports = {
    sendWhatsAppMessage,
    sendWhatsAppMedia,
    sendIssueStatusUpdate,
    sendBursaryUpdate,
    isWhatsAppEnabled
};
