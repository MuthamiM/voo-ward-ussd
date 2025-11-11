const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

function fallbackReply(text) {
  const t = (text || '').toLowerCase();
  if (!t) return 'Hi — tell me what you need help with. Try: "resolve issues", "export issues", "change password".';
  if (t.includes('resolve') || t.includes('bulk resolve')) return 'To resolve issues: select the checkboxes next to issues, click "Resolve Selected", provide an optional action note, then confirm. This will mark issues as resolved in the system.';
  if (t.includes('export') || t.includes('csv')) return 'To export issues as CSV: open the Issues tab and click "Export CSV". A file named issues.csv will be downloaded containing ticket, category, message, phone, status and action metadata.';
  if (t.includes('password') || t.includes('change password')) return 'To change your password: click the "Change Password" button in the top-right, provide your current and new password, then submit.';
  if (t.includes('ussd') || t.includes('interactions')) return 'USSD interactions are visible under the USSD tab. You can review recent interactions, phone numbers, parsed input and responses there.';
  if (t.includes('notification')) return 'Notifications (SMS) have been disabled in this deployment. Reporters will not receive SMS. Use the in-dashboard tools to manage and update reports.';
  if (t.includes('help') || t === 'hi' || t === 'hello') return 'I can help with: "resolve issues", "export issues", "change password", "ussd interactions", or ask a specific question.';
  return 'Sorry — I did not understand that. Try: "resolve issues", "export issues", or "change password".';
}

async function generateReply(message, user) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const text = (message || '').toString().trim();
  if (!OPENAI_API_KEY) {
    return fallbackReply(text);
  }

  try {
    const payload = {
      model,
      messages: [
        { role: 'system', content: 'You are a concise assistant that helps admins use a web dashboard. Answer in 1-3 short sentences and, when appropriate, give step-by-step instructions.' },
        { role: 'user', content: text }
      ],
      temperature: 0.2,
      max_tokens: 300
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (resp.ok && data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content.trim();
    }

    // fallback on unexpected response
    return fallbackReply(text);
  } catch (e) {
    console.error('Chatbot LLM error', e && e.message);
    return fallbackReply(text);
  }
}

module.exports = { generateReply };
