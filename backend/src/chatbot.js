const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const fs = require('fs'); // This line is unchanged
const path = require('path');
const { MongoClient } = require('mongodb');
const KB_PATH = path.join(__dirname, 'chatbot_kb.json');

// Helper: lightweight DB connector for on-demand stats (reused connection)
let _mongoClient;
async function getDb() {
  if (_mongoClient && _mongoClient.topology && _mongoClient.topology.isConnected && _mongoClient.topology.isConnected()) {
    try { return _mongoClient.db(); } catch (e) { /* fall through to reconnect */ }
  }
  const uri = process.env.MONGO_URI;
  if (!uri) return null;
  _mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await _mongoClient.connect();
  // extract db name from URI
  try {
    const url = new URL(uri);
    const pathDb = (url.pathname || '').replace(/^\//, '') || 'voo_ward';
    return _mongoClient.db(pathDb);
  } catch (e) {
    return _mongoClient.db();
  }
}

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

  // USSD specific canned answers
  if (t.includes('ussd') || t.includes('ussd interactions') || t.includes('parsed_text')) {
    return 'USSD interactions are logged under the USSD tab. You can export them as CSV using Export > USSD Interactions, or ask me how many interactions exist.';
  }

  // Fallback hard-coded answers if KB didn't match
  if (t.includes('help') || t === 'hi' || t === 'hello') return 'I can help with: "resolve issues", "export issues", "change password", "ussd interactions", or ask a specific question.';
  return 'Sorry — I did not understand that. Try: "resolve issues", "export issues", or "change password".';
}

async function generateReply(message, user) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const text = (message || '').toString().trim();
  const ltext = text.toLowerCase();
  // If the admin asks about USSD counts, answer directly from DB without calling LLM
  try {
    if (ltext.includes('how many ussd') || ltext.includes('ussd count') || ltext.includes('number of ussd')) {
      const db = await getDb();
      if (!db) return 'I cannot access the database from here — check server configuration (MONGO_URI).';
      const count = await db.collection('ussd_interactions').countDocuments();
      return `There are currently ${count} USSD interactions recorded in the database.`;
    }
    if (ltext.includes('recent ussd') || ltext.includes('latest ussd') || ltext.includes('recent interactions')) {
      const db = await getDb();
      if (!db) return 'I cannot access the database from here — check server configuration (MONGO_URI).';
      const rows = await db.collection('ussd_interactions').find({}).sort({ created_at: -1 }).limit(5).toArray();
      if (!rows || rows.length === 0) return 'No USSD interactions found.';
      const summary = rows.map(r => `${r.phone_number || r.phone || 'unknown'}: ${String(r.text || r.response || '').slice(0,60)}`).join('\n');
      return `Latest USSD interactions (top ${rows.length}):\n${summary}`;
    }
  } catch (dbErr) {
    // fall through to LLM/fallback if DB read fails
    console.warn('Chatbot DB lookup failed:', dbErr && dbErr.message);
  }
  if (!OPENAI_API_KEY) {
    // Enforce OpenAI usage only. If key not configured, return clear guidance to operator.
    return 'Chatbot is not configured: set OPENAI_API_KEY on the server to enable assistant responses.';
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
    return 'The help service returned an unexpected response. Please check server logs.';
  } catch (e) {
    console.error('Chatbot LLM error', e && e.message);
    return 'Chatbot encountered an internal error while contacting the language service.';
  }
}

module.exports = { generateReply };
