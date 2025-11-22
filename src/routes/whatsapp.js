/**
 * WhatsApp Routes
 * Handles incoming WhatsApp messages via Twilio webhook
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// Store active WhatsApp sessions (in-memory for now)
const sessions = new Map();

/**
 * Twilio WhatsApp Webhook
 * Receives incoming messages from citizens via WhatsApp
 */
router.post('/webhook', async (req, res) => {
    const { From, Body, MediaUrl0, NumMedia } = req.body;

    logger.info(`WhatsApp message from ${From}: ${Body}`);

    const phoneNumber = From.replace('whatsapp:', '');
    const message = (Body || '').trim();

    try {
        // Get or create session
        let session = sessions.get(phoneNumber) || { step: 'language', data: {} };

        let response = '';

        // Language selection
        if (session.step === 'language') {
            if (['1', '2', '3'].includes(message)) {
                session.data.language = message === '1' ? 'en' : message === '2' ? 'sw' : 'kam';
                session.step = 'main_menu';
                response = getMainMenu(session.data.language);
            } else {
                response = getLanguageMenu();
            }
        }
        // Main menu
        else if (session.step === 'main_menu') {
            if (message === '1') {
                session.step = 'report_category';
                response = getReportCategoryMenu(session.data.language);
            } else if (message === '2') {
                session.step = 'track_issue';
                response = getTrackIssuePrompt(session.data.language);
            } else if (message === '3') {
                response = await getAnnouncements(session.data.language);
                session.step = 'main_menu';
            } else {
                response = getMainMenu(session.data.language);
            }
        }
        // Report issue - category selection
        else if (session.step === 'report_category') {
            if (['1', '2', '3', '4', '5'].includes(message)) {
                const categories = ['Roads & Infrastructure', 'Water & Sanitation', 'Security', 'Health Services', 'Other'];
                session.data.category = categories[parseInt(message) - 1];
                session.step = 'report_description';
                response = getDescriptionPrompt(session.data.language);
            } else {
                response = getReportCategoryMenu(session.data.language);
            }
        }
        // Report issue - description
        else if (session.step === 'report_description') {
            session.data.description = message;

            // Check if media was sent
            if (NumMedia && parseInt(NumMedia) > 0) {
                session.data.photoUrl = MediaUrl0;
            }

            // Create issue in database
            const issue = await createIssueFromWhatsApp(phoneNumber, session.data);

            response = getIssueCreatedConfirmation(issue.ticket, session.data.language);
            session.step = 'main_menu';
        }
        // Track issue
        else if (session.step === 'track_issue') {
            const issues = await getUserIssues(phoneNumber);
            response = formatIssuesList(issues, session.data.language);
            session.step = 'main_menu';
        }

        // Update session
        sessions.set(phoneNumber, session);

        // Send response via Twilio
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${response}</Message>
</Response>`;

        res.type('text/xml').send(twiml);

    } catch (err) {
        logger.error('WhatsApp webhook error:', err);
        res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, an error occurred. Please try again.</Message>
</Response>`);
    }
});

// Helper functions

function getLanguageMenu() {
    return `🏛️ *KYAMATU WARD SERVICES*

Select Language / Chagua Lugha / Thuura Rũthiomi:

1️⃣ English
2️⃣ Swahili
3️⃣ Kamba`;
}

function getMainMenu(language) {
    const menus = {
        en: `🏛️ *KYAMATU WARD*

1️⃣ Report an Issue
2️⃣ Track My Issues
3️⃣ View Announcements
4️⃣ Bursary Status

Reply with a number`,
        sw: `🏛️ *KYAMATU WARD*

1️⃣ Ripoti Tatizo
2️⃣ Fuatilia Malalamiko Yangu
3️⃣ Tazama Matangazo
4️⃣ Hali ya Bursary

Jibu na nambari`,
        kam: `🏛️ *KYAMATU WARD*

1️⃣ Ũmbia Mbesa
2️⃣ Lola Mbesa Syakwa
3️⃣ Lola Matangazo
4️⃣ Hali ya Bursary

Tũma na namba`
    };
    return menus[language] || menus.en;
}

function getReportCategoryMenu(language) {
    const menus = {
        en: `📋 *SELECT ISSUE CATEGORY*

1️⃣ Roads & Infrastructure
2️⃣ Water & Sanitation
3️⃣ Security
4️⃣ Health Services
5️⃣ Other

Reply with a number`,
        sw: `📋 *CHAGUA AINA YA TATIZO*

1️⃣ Barabara na Miundombinu
2️⃣ Maji na Usafi
3️⃣ Usalama
4️⃣ Huduma za Afya
5️⃣ Nyingine

Jibu na nambari`,
        kam: `📋 *THUURA MŨTHEMBA WA MBESA*

1️⃣ Nzĩa na Mĩaka
2️⃣ Maĩ na Ũtheu
3️⃣ Ũtitũ
4️⃣ Wĩa wa Ũũgĩ
5️⃣ Ĩla Ĩngĩ

Tũma na namba`
    };
    return menus[language] || menus.en;
}

function getDescriptionPrompt(language) {
    const prompts = {
        en: `📝 *DESCRIBE THE ISSUE*

Please describe the problem in detail. You can also send a photo.`,
        sw: `📝 *ELEZA TATIZO*

Tafadhali eleza tatizo kwa undani. Unaweza pia tuma picha.`,
        kam: `📝 *ŨMBĨE MBESA*

Tafadhali ũmbĩe mbesa kwa ũndani. Ũnakwĩa kũtũma picha.`
    };
    return prompts[language] || prompts.en;
}

function getIssueCreatedConfirmation(ticket, language) {
    const messages = {
        en: `✅ *ISSUE REPORTED*

Your issue has been recorded.
Ticket: *${ticket}*

You will receive updates via WhatsApp.

Thank you!`,
        sw: `✅ *TATIZO LIMEPOKELEWA*

Tatizo lako limerekodiwa.
Tiketi: *${ticket}*

Utapokea habari kupitia WhatsApp.

Asante!`,
        kam: `✅ *MBESA NĨYAMŨKĨĨTWE*

Mbesa yaku nĩyandĩkĩtwe.
Tiketi: *${ticket}*

Ũkaamũkĩa mawĩa kũgera WhatsApp.

Twathokia!`
    };
    return messages[language] || messages.en;
}

function getTrackIssuePrompt(language) {
    const prompts = {
        en: `🔍 *YOUR ISSUES*

Fetching your reported issues...`,
        sw: `🔍 *MALALAMIKO YAKO*

Inapata malalamiko yako...`,
        kam: `🔍 *MBESA SYAKU*

Ĩĩ kũleta mbesa syaku...`
    };
    return prompts[language] || prompts.en;
}

// Database helper functions (to be implemented)
async function createIssueFromWhatsApp(phoneNumber, data) {
    // This will integrate with your existing database
    // For now, return mock data
    return {
        ticket: 'ISS-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        category: data.category,
        message: data.description,
        phone_number: phoneNumber,
        status: 'open',
        photo_url: data.photoUrl
    };
}

async function getUserIssues(phoneNumber) {
    // Fetch from database
    return [];
}

async function getAnnouncements(language) {
    return `📢 *ANNOUNCEMENTS*\n\nNo new announcements at this time.`;
}

function formatIssuesList(issues, language) {
    if (issues.length === 0) {
        return language === 'en' ? 'You have no reported issues.' :
            language === 'sw' ? 'Huna malalamiko yaliyoripotiwa.' :
                'Ndũna mbesa syakwĩa.';
    }

    let list = '📋 *YOUR ISSUES*\n\n';
    issues.forEach(issue => {
        list += `${issue.ticket}: ${issue.category}\nStatus: ${issue.status}\n\n`;
    });
    return list;
}

module.exports = router;
