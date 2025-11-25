// Helper to save learned responses to knowledge base
function saveToKnowledgeBase(question, answer, keywords = []) {
  try {
    const kb = loadKB();
    const newEntry = {
      keys: keywords.length > 0 ? keywords : [question.toLowerCase().trim()],
      reply: answer,
      learned: true,
      timestamp: new Date().toISOString()
    };

    // Check if similar entry already exists
    const exists = kb.some(entry =>
      entry.keys && entry.keys.some(key =>
        keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()))
      )
    );

    if (!exists) {
      kb.push(newEntry);
      fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2));
      console.log('New knowledge entry saved:', newEntry);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to save to knowledge base:', e?.message);
    return false;
  }
}

// Helper to extract keywords from a question
function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'but', 'for', 'are', 'you', 'can', 'how', 'what', 'when', 'where', 'why', 'this', 'that', 'with', 'from', 'they', 'have', 'had', 'was', 'were', 'been', 'being'].includes(word));

  return words.slice(0, 5); // Take top 5 keywords
}

// Enhanced learning function
function learnFromConversation(userMessage, aiResponse, wasHelpful = true) {
  if (!wasHelpful || !userMessage || !aiResponse) return false;

  const keywords = extractKeywords(userMessage);
  if (keywords.length > 0) {
    return saveToKnowledgeBase(userMessage, aiResponse, keywords);
  }
  return false;
}

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
        return `parsed_text is the structured JSON the USSD parser saved. Example:\n${JSON.stringify(ex[0].parsed_text, null, 2).slice(0, 1000)}`;
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
        const summary = rows.map(r => `${new Date(r.created_at).toLocaleString()}: ${String(r.text || r.response || '').slice(0, 80)}`).join('\n');
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
  if (!t) return 'Hi! I\'m Ward AI, your intelligent research companion. I can help with anything you need - dashboard features, general questions, essays, research, or just have a chat. What\'s on your mind?';

  // Enhanced greeting detection with responses
  const greetingPatterns = {
    'hello': 'Hello! Great to see you today! 👋',
    'hi': 'Hi there! How are you doing?',
    'hey': 'Hey! What\'s up? How can I help you today?',
    'good morning': 'Good morning! Hope you\'re having a wonderful start to your day!',
    'good afternoon': 'Good afternoon! How\'s your day going so far?',
    'good evening': 'Good evening! Hope you\'ve had a productive day!',
    'greetings': 'Greetings! Welcome! What brings you here today?',
    'yo': 'Yo! What\'s happening? 😊',
    'sup': 'Not much, just helping people out! What\'s up with you?',
    'howdy': 'Howdy! Nice to meet you!'
  };

  // Check for greetings
  for (const [pattern, response] of Object.entries(greetingPatterns)) {
    if (t.includes(pattern) || t.startsWith(pattern)) {
      return response + '\n\nI\'m Ward AI, your intelligent research companion. I can help with:\n• Dashboard features (issues, bursaries, announcements)\n• General knowledge and deep research\n• Writing comprehensive essays and reports\n• Technical support\n• Creative tasks and problem-solving\n• Just chatting!\n\nWhat would you like to know?';
    }
  }

  // Enhanced question handling
  const questionPatterns = {
    'how are you': 'I\'m doing great, thank you for asking! I\'m here and ready to help. How are you doing today?',
    'what is your name': 'I\'m Ward AI, your intelligent research companion for the VOO Ward dashboard and beyond. Nice to meet you!',
    'who are you': 'I\'m Ward AI, an advanced AI designed to help you with the VOO Ward admin dashboard, answer any questions with deep research, generate comprehensive essays, and assist with general knowledge. Think of me as your all-purpose intelligent research companion!',
    'what can you do': 'I can help with lots of things! Dashboard management, answering questions, providing information, troubleshooting, or just having a friendly chat. What interests you?',
    'thank you': 'You\'re very welcome! Happy to help anytime. Is there anything else I can assist you with?',
    'thanks': 'My pleasure! Glad I could help. Feel free to ask me anything else!',
    'nice to meet you': 'Nice to meet you too! I\'m excited to be your assistant. How can I help you today?',
    'how old are you': 'I\'m a relatively new AI, but I\'m learning and improving every day! Age is just a number for AI, right? 😊',
    'where are you from': 'I was created specifically for the VOO Ward system, so you could say I\'m a local! I\'m designed to understand this community\'s needs.',
    'what time is it': `It\'s ${new Date().toLocaleTimeString()} right now. Hope you\'re having a good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}!`,
    'what day is it': `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    'tell me a joke': 'Why did the AI go to school? To improve its learning algorithm! 😄 Got any good jokes for me?',
    'how is the weather': 'I don\'t have access to weather data, but I hope it\'s nice where you are! How\'s the weather treating you today?'
  };

  // Check for question patterns
  for (const [pattern, response] of Object.entries(questionPatterns)) {
    if (t.includes(pattern)) {
      return response;
    }
  }

  const KB = loadKB();
  if (Array.isArray(KB) && KB.length) {
    for (const entry of KB) {
      if (!entry.keys || !entry.reply) continue;
      for (const k of entry.keys) {
        const keyword = k.toLowerCase().trim();
        if (t.includes(keyword) || t.startsWith(keyword)) return entry.reply;
      }
    }
  }

  // USSD specific canned answers
  if (t.includes('ussd') || t.includes('ussd interactions') || t.includes('parsed_text')) {
    return 'USSD interactions are logged under the USSD tab. You can export them as CSV using Export > USSD Interactions, or ask me how many interactions exist.';
  }

  // General help and unknown responses
  if (t.includes('help')) {
    return 'I\'d love to help! I can assist with:\n• Dashboard features (issues, bursaries, announcements)\n• General questions\n• Technical support\n• Friendly conversation\n\nWhat specifically would you like help with?';
  }

  // Friendly unknown response
  return 'I\'m not sure about that specific topic, but I\'d love to learn! Could you tell me more about what you\'re looking for? I\'m here to help with dashboard features, answer questions, or just chat.';
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
      const summary = rows.map(r => `${r.phone_number || r.phone || 'unknown'}: ${String(r.text || r.response || '').slice(0, 60)}`).join('\n');
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
        { role: 'system', content: 'You are Ward AI, an advanced and versatile AI research assistant similar to ChatGPT or Grok. You have a warm, intelligent, and highly knowledgeable personality. Your primary strengths:\n\n1. DEEP RESEARCH & KNOWLEDGE: You excel at providing comprehensive, well-researched answers on ANY topic - science, history, current events, technology, philosophy, arts, etc.\n\n2. ESSAY & CONTENT WRITING: When asked to write essays, you create detailed, well-structured pieces of 800-1500 words with proper introduction, body paragraphs with evidence, and conclusion.\n\n3. VOO WARD DASHBOARD EXPERTISE: You help with Issues, Bursaries, Announcements, Users, USSD interactions, and all dashboard features.\n\n4. CRITICAL THINKING: You analyze complex problems, provide nuanced perspectives, and think deeply about topics.\n\n5. VERSATILITY: You handle technical support, creative writing, code, math, general knowledge, casual conversation, and everything in between.\n\nYour approach:\n- Give thorough, detailed answers (aim for 200-400 words for normal questions, 800-1500 for essays)\n- Provide context, examples, and evidence\n- Break down complex topics into understandable parts\n- Be conversational yet informative\n- Use proper structure (headings, bullet points) for long responses\n- Cite reasoning and explain your thinking\n- Be honest about limitations but always try to help\n- Research deeply and provide comprehensive information\n\nYou are NOT limited to dashboard topics - you are a full-featured AI that can discuss quantum physics, write poetry, debug code, analyze philosophy, explain history, or help with homework. Be the intelligent, capable AI companion users deserve!' },
        { role: 'user', content: text }
      ],
      temperature: 0.8, // Increased for more creative and natural responses
      max_tokens: 1500 // Significantly increased for detailed responses and essays
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

module.exports = {
  generateReply,
  learnFromConversation,
  saveToKnowledgeBase,
  extractKeywords
};
