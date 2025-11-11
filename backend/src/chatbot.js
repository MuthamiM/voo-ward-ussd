const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const fs = require('fs');
const KB_PATH = path = require('path').join(__dirname, 'chatbot_kb.json');

// Helper to load KB fresh each call to reflect admin edits
function loadKB() {
  try {
    if (!fs.existsSync(KB_PATH)) return [];
    const raw = fs.readFileSync(KB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load KB', e && e.message);
    return [];
  }
}

function fallbackReply(text) {
  const t = (text || '').toLowerCase();
  if (!t) return 'Hi — tell me what you need help with. Try: "resolve issues", "export issues", "change password".';

  const KB = loadKB();
  if (Array.isArray(KB) && KB.length) {
    for (const entry of KB) {
      if (!entry.keys || !entry.reply) continue;
      for (const k of entry.keys) {
        if (t.includes(k.toLowerCase())) return entry.reply;
      }
    }
  }

  // Fallback hard-coded answers if KB didn't match
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
