
const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const KB_PATH = path.join(__dirname, 'chatbot_kb.json');

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

  if (t.includes('ussd') || t.includes('ussd interactions') || t.includes('parsed_text')) {
    return 'USSD interactions are logged under the USSD tab. You can export them as CSV or ask me how many interactions exist.';
  }

  if (t.includes('help') || t === 'hi' || t === 'hello') return 'I can help with: "resolve issues", "export issues", "change password", "ussd interactions".';
  return 'Sorry — I did not understand that. Try: "resolve issues", "export issues", or "change password".';
}

async function generateReply(message, user) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const text = (message || '').toString().trim();
  const ltext = text.toLowerCase();

  // Try DB-powered answers for simple queries when possible
  try {
    if (ltext.includes('how many ussd') || ltext.includes('ussd count') || ltext.includes('number of ussd')) {
        const db = await (async () => {
          try { const { MongoClient } = require('mongodb'); const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); await c.connect(); const url = new URL(process.env.MONGO_URI); const pathDb = (url.pathname||'').replace(/^\//,'')||'voo_ward'; return c.db(pathDb); } catch (e) { return null; }
        })();
        if (!db) return { reply: fallbackReply(text), source: 'kb' };
        const count = await db.collection('ussd_interactions').countDocuments();
        return { reply: `There are currently ${count} USSD interactions recorded in the database.`, source: 'db' };
      }
  } catch (dbErr) {
    console.warn('Chatbot DB lookup failed:', dbErr && dbErr.message);
  }

  if (!OPENAI_API_KEY) return { reply: fallbackReply(text), source: 'kb' };

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
      return { reply: data.choices[0].message.content.trim(), source: 'openai' };
    }

    return { reply: fallbackReply(text), source: 'kb' };
  } catch (e) {
    console.error('Chatbot LLM error', e && e.message);
    return { reply: fallbackReply(text), source: 'kb' };
  }
}

module.exports = { generateReply };
