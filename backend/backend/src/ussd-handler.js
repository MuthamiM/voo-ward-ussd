const express = require('express');

// Lightweight USSD handler compatible with common providers.
// Exposes POST /api/ussd which accepts provider payloads and manages a simple menu
// flow to check bursary application status by reference code.

const router = express.Router();

// Helper: normalize incoming text from provider
function getText(req) {
  // Providers vary: 'text' (Africa's Talking), 'Body' (Twilio), or req.body.input
  return (req.body.text || req.body.Body || req.body.input || '').trim();
}

// Provider-agnostic response helper
function sendUssdResponse(res, message, end = true) {
  // For simplicity we return JSON that many providers accept.
  // If your provider expects plain text, configure your webhook accordingly.
  res.json({
    message,
    end
  });
}

// POST /api/ussd
// Example expected flow:
// - User selects option 2 (Check Bursary)
// - Provider posts text with '2' -> respond 'Enter reference code:' end=false
// - Provider posts subsequent text with the code -> lookup DB and respond status end=true

router.post('/', async (req, res) => {
  try {
    const text = getText(req);
    const sessions = req.app.get('ussdSessions') || new Map();

    // Providers usually include sessionId, phoneNumber, etc. We'll try to read them.
    const sessionId = req.body.sessionId || req.body.SessionId || req.body.session || req.body.session_id || req.body.uuid || req.body.transactionId || (req.ip + '|' + (req.body.phoneNumber || req.body.From || 'unknown'));
    const msisdn = req.body.phoneNumber || req.body.From || req.body.msisdn || 'unknown';

    // Ensure session store attached to app
    req.app.set('ussdSessions', sessions);

    const state = sessions.get(sessionId) || { step: 'menu' };

    if (state.step === 'menu') {
      // Top-level menu. We'll accept '1' for something else and '2' for bursary check.
      if (!text) {
        const menu = 'Welcome to VOO Service:\n1. Main Menu\n2. Check Bursary Status\nReply with option number';
        sessions.set(sessionId, { step: 'menu' });
        return sendUssdResponse(res, menu, false);
      }

      if (text === '2' || /check/i.test(text)) {
        sessions.set(sessionId, { step: 'awaiting_ref' });
        return sendUssdResponse(res, 'Please enter your bursary reference code:', false);
      }

      // Unknown option -> re-show menu
      sessions.set(sessionId, { step: 'menu' });
      return sendUssdResponse(res, 'Invalid option. Reply 2 to check bursary status.', false);
    }

    if (state.step === 'awaiting_ref') {
      const ref = text.trim();
      if (!ref) {
        return sendUssdResponse(res, 'Reference code required. Please enter it now:', false);
      }

      // Lookup bursary application
      const db = await req.app.locals.connectDB();
      if (!db) return sendUssdResponse(res, 'Service temporarily unavailable. Try again later.', true);

      const app = await db.collection('bursary_applications').findOne({ ref_code: ref });
      sessions.delete(sessionId);

      if (!app) {
        return sendUssdResponse(res, `No application found for ref ${ref}. Please check and try again.`, true);
      }

      const status = app.status || 'Pending';
      const notes = app.admin_notes ? ` Notes: ${app.admin_notes}` : '';
      const message = `Ref ${ref} - Status: ${status}.${notes}`;
      return sendUssdResponse(res, message, true);
    }

    // Fallback
    sessions.delete(sessionId);
    return sendUssdResponse(res, 'Session ended. Thank you.', true);
  } catch (err) {
    console.error('USSD handler error:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

module.exports = router;
