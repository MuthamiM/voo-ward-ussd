const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const KB_PATH = path.join(__dirname, 'chatbot_kb.json');

// Helper: lightweight DB connector for on-demand stats (reused connection)
let _mongoClient;
async function getDb() {
  if (_mongoClient && _mongoClient.isConnected && _mongoClient.topology && _mongoClient.topology.isConnected()) {
    return _mongoClient.db();
  }
  const uri = process.env.MONGO_URI;
  if (!uri) return null;
  _mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await _mongoClient.connect();
  // extract db name from URI
  try {
    // Explain parsed_text field and show an example
    if (ltext.includes('what is parsed_text') || ltext.includes('what does parsed_text') || ltext.includes('explain parsed_text')) {
      try {
        const db = await getDb();
        if (!db) return 'parsed_text is a structured representation of user input (JSON) produced by the USSD parser; I cannot access the DB right now to show an example.';
        const ex = await db.collection('ussd_interactions').find({ parsed_text: { $exists: true, $ne: null } }).sort({ created_at: -1 }).limit(1).toArray();
        if (!ex || ex.length === 0) return 'parsed_text is a structured representation of user input (JSON). No examples are available in the database yet.';
        return `parsed_text is the structured JSON the USSD parser saved. Example:\n${JSON.stringify(ex[0].parsed_text, null, 2).slice(0,1000)}`;
      } catch (e) { /* fall through */ }
    }

    // Show interactions for a specific phone number (simple phone regex)
    const phoneMatch = (ltext.match(/(\+?\d{6,15})/) || [])[0];
    if (phoneMatch && (ltext.includes('show interactions for') || ltext.includes('interactions for') || ltext.includes('show interactions'))) {
      try {
        const db = await getDb();
        if (!db) return 'I cannot access the database from here — check server configuration (MONGO_URI).';
        const rows = await db.collection('ussd_interactions').find({ phone_number: { $regex: phoneMatch } }).sort({ created_at: -1 }).limit(10).toArray();
        if (!rows || rows.length === 0) return `No USSD interactions found for ${phoneMatch}.`;
        const summary = rows.map(r => `${new Date(r.created_at).toLocaleString()}: ${String(r.text || r.response || '').slice(0,80)}`).join('\n');
        return `Recent interactions for ${phoneMatch}:\n${summary}`;
      } catch (e) { console.warn('Chatbot phone lookup failed', e && e.message); }
    }

    // Count unresolved issues that have an associated phone number (likely USSD-originated reports)
    if (ltext.includes('unresolved issues') && ltext.includes('ussd')) {
      try {
        const db = await getDb();
        if (!db) return 'I cannot access the database from here — check server configuration (MONGO_URI).';
        const count = await db.collection('issues').countDocuments({ phone_number: { $exists: true, $ne: null }, status: { $ne: 'resolved' } });
        return `There are ${count} unresolved issues that include a reporter phone number (likely from USSD).`;
      } catch (e) { console.warn('Chatbot unresolved-issues lookup failed', e && e.message); }
    }
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
  const t = (text || '').toLowerCase().trim();
  if (!t) return 'Hi — tell me what you need help with. Try: "resolve issues", "export issues", "change password".';

  // Enhanced greeting detection (handles hey, hi, hello, yo, sup, greetings, etc.)
  const greetings = ['hey', 'hi', 'hello', 'yo', 'sup', 'greetings', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.some(g => t.startsWith(g) || t === g)) {
    return 'Hi there! I\'m Mai, your Voo Kyamatu Ward AI Assistant. I can help with:\n• Resolving issues\n• Managing announcements\n• Exporting data\n• User management\n• USSD interactions\n• Dashboard features\n\nWhat would you like help with?';
  }

  const KB = loadKB();
  if (Array.isArray(KB) && KB.length) {
    for (const entry of KB) {
      if (!entry.keys || !entry.reply) continue;
      for (const k of entry.keys) {
        // Fuzzy matching: check if keyword is contained in message OR message starts with keyword
        const keyword = k.toLowerCase().trim();
        if (t.includes(keyword) || t.startsWith(keyword)) return entry.reply;
      }
    }
  }

  // USSD specific canned answers
  if (t.includes('ussd') || t.includes('ussd interactions') || t.includes('parsed_text')) {
    return 'USSD interactions are logged under the USSD tab. You can export them as CSV using Export > USSD Interactions, or ask me how many interactions exist.';
  }

  // Fallback hard-coded answers if KB didn't match
  if (t.includes('help')) return 'I can help with: "resolve issues", "export issues", "change password", "ussd interactions", or ask a specific question.';
  return 'I\'m not sure about that. Try asking about: resolving issues, managing announcements, exporting data, user management, or USSD interactions.';
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
    return fallbackReply(text);
  }

  try {
    const payload = {
      model,
      messages: [
        { role: 'system', content: 'You are the Voo Kyamatu Ward Admin Assistant. Your goal is to help the admin manage the dashboard efficiently. You can assist with: \n1. Explaining dashboard features (Announcements, Issues, Bursaries, Constituents, Stats, Users).\n2. Providing step-by-step instructions for tasks like adding announcements, resolving issues, or managing users.\n3. Answering questions about USSD interactions and data.\n\nKeep your answers concise (1-3 sentences) and action-oriented. If the user asks about something outside the dashboard scope, politely redirect them to dashboard tasks.' },
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
