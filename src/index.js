/**
 * ============================================================================
 * VOO Citizen Platform - USSD Dashboard Server
 * ============================================================================
 * 
 * Copyright (C) 2025 Musa Muthami. All Rights Reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL - SOURCE CODE CANNOT BE EDITED BY ANYONE
 * 
 * This software is the exclusive property of Musa Muthami and is protected
 * by copyright law. Unauthorized copying, modification, distribution, or use
 * of this software or any portion thereof is strictly prohibited and may
 * result in severe civil and criminal penalties.
 * 
 * THE SOURCE CODE CANNOT BE EDITED, MODIFIED, OR ALTERED BY ANYONE except
 * the original author (Musa Muthami). This is an absolute prohibition.
 * Any unauthorized editing is ILLEGAL and will result in legal action.
 * 
 * For licensing inquiries, contact: musamwange2@gmail.com
 * See LICENSE file for complete terms and conditions.
 * ============================================================================
 */

const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const compression = require("compression");

// IMPORTANT: load ENV first
if (require.resolve("dotenv")) {
  require("dotenv").config();
}

// Initialize Sentry for error monitoring (production only)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  });
}

const app = express();

// Configure trust proxy for rate limiting and proper IP detection
app.set('trust proxy', 1);

// Enable CORS for local development (file:// access)
// CORS is handled by individual routers (admin-dashboard.js) to avoid conflicts
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }
//   next();
// });

const path = require('path');
// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Enable compression for all responses
app.use(compression());

// 1) Health check - FAST response for Render (no DB checks)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "voo-kyamatu-ussd",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check endpoint
app.get("/health/detailed", async (req, res) => {
  const detailed = {
    timestamp: new Date().toISOString(),
    service: "voo-kyamatu-ussd",
    status: "healthy",
    checks: {
      database: { status: "unknown" },
      redis: { status: "unknown" },
      memory: {
        status: "healthy",
        usage: process.memoryUsage(),
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      uptime: {
        status: "healthy",
        seconds: Math.floor(process.uptime()),
        formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
      }
    }
  };

  res.json(detailed);
});

// parsers & logs
app.use(morgan("combined"));
// Increase payload limit for base64 image uploads
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// Import USSD core handler
const { handleUssdCore } = require('./ussdCore');

// 2) USSD route with database integration
app.post("/ussd", async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || req.body?.SessionId || "SESSION";
    const phone = req.body?.phoneNumber || req.body?.From || req.body?.msisdn || "";
    const text = (req.body?.text || req.body?.Body || "").trim();
    const serviceCode = req.body?.serviceCode || "*384#";

    // Get database connection if available
    let db = null;
    if (app.locals.connectDB) {
      try {
        db = await app.locals.connectDB();
      } catch (dbErr) {
        console.error('USSD DB connection error:', dbErr.message);
      }
    }

    // Use ussdCore handler with database support
    const response = await handleUssdCore({
      text,
      sessionId,
      phoneNumber: phone,
      serviceCode,
      db
    });

    // Send response
    return res.send(response);
  } catch (e) {
    console.error('USSD error:', e);
    // never crash; show fail-safe END so aggregator doesn't retry-loop
    return res.send("END Service temporarily unavailable. Try again later.");
  }
});

// 3) (Optional) DB-backed endpoints can go below; never block startup on DB.
// Mount admin dashboard API routes (merged from admin-dashboard.js)
// Defensive: some versions of admin-dashboard manage their own server and do not
// export an express router. Only call app.use when a middleware/router is exported.
// Defensive: Try multiple candidate paths for admin-dashboard and inspect file contents
const fs = require('fs');
const candidatePaths = [
  path.resolve(__dirname, 'admin-dashboard.js'),
  path.resolve(process.cwd(), 'src/admin-dashboard.js')
];

console.log('[DEBUG] CWD:', process.cwd());
let chosenPath = null;
let adminDashboard = null;
for (const p of candidatePaths) {
  try {
    const exists = fs.existsSync(p);
    console.log('[DEBUG] Checking candidate:', p, 'exists=', exists);
    if (!exists) continue;
    try {
      const stat = fs.statSync(p);
      console.log('[DEBUG] stat for', p, ':', { size: stat.size, mtime: stat.mtime });
    } catch (sErr) {
      console.warn('[WARN] Could not stat', p, sErr && sErr.message);
    }

    try {
      const sample = fs.readFileSync(p, { encoding: 'utf8' });
      const preview = sample.slice(0, 200).replace(/\n/g, '\\n');
      console.log('[DEBUG] preview for', p, ':', preview);
      const starts = preview.trim().charAt(0);
      console.log('[DEBUG] first char for', p, '->', starts);
      if (starts !== '<') {
        chosenPath = p;
        break;
      } else {
        console.warn('[WARN] Candidate looks like HTML (starts with <):', p);
      }
    } catch (rErr) {
      console.warn('[WARN] Could not read preview for', p, rErr && rErr.message);
    }
  } catch (errCheck) {
    console.warn('[WARN] Error inspecting candidate', p, errCheck && errCheck.message);
  }
}

if (!chosenPath) {
  console.error('[ERROR] No suitable admin-dashboard.js candidate found. Candidates inspected:', candidatePaths);
} else {
  console.log('[DEBUG] Requiring admin-dashboard from chosen path:', chosenPath);
  try {
    adminDashboard = require(chosenPath);
    console.log('[DEBUG] adminDashboard type:', typeof adminDashboard);
    console.log('[DEBUG] adminDashboard.handle:', typeof adminDashboard?.handle);
    
    // Mount at root since admin-dashboard's internal routes already have /api/admin prefix
    if (typeof adminDashboard === 'function' || (adminDashboard && adminDashboard.handle)) {
      app.use('/', adminDashboard);
      // Also mount at /admin to support /admin/api requests if frontend expects that (as seen in logs)
      app.use('/admin', adminDashboard);
      console.log('[DEBUG] admin-dashboard mounted at / (root) and /admin from', chosenPath);
    } else {
      console.log('ℹ️ admin-dashboard did not export a router; assuming it manages its own server. Skipping mount.');
    }
    if (adminDashboard && adminDashboard.connectDB) {
      app.locals.connectDB = adminDashboard.connectDB;
    }
  } catch (e) {
    console.error('⚠️ Failed to require admin-dashboard module from', chosenPath, 'error:', e && e.message);
    if (e && e.stack) console.error(e.stack);
  }
}

// Expose DB connector for other routers (ussd handler) if provided
if (adminDashboard && adminDashboard.connectDB) {
  app.locals.connectDB = adminDashboard.connectDB;
}

// Mount provider-agnostic USSD router at /api/ussd
try {
  const ussdRouter = require('./ussd-handler');
  app.use('/api/ussd', ussdRouter);
} catch (err) {
  console.warn('USSD router not loaded:', err.message);
}

// Mount WhatsApp webhook routes
try {
  const whatsappRouter = require('./routes/whatsapp');
  app.use('/api/whatsapp', whatsappRouter);
  console.log('✅ WhatsApp routes mounted at /api/whatsapp');
} catch (err) {
  console.warn('WhatsApp router not loaded:', err.message);
}

// Mount citizen portal routes
try {
  const citizenRouter = require('./routes/citizenPortal');
  app.use('/api/citizen', citizenRouter);
  console.log('✅ Citizen portal routes mounted at /api/citizen');
} catch (err) {
  console.warn('Citizen portal router not loaded:', err.message);
}

// Default avatar endpoint (SVG fallback for missing profile pictures)
app.get('/uploads/avatars/default-avatar.png', (req, res) => {
  const svgAvatar = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="40" fill="#6366f1"/>
    <circle cx="40" cy="32" r="12" fill="white"/>
    <path d="M16 64c0-16 10.746-24 24-24s24 8 24 24" fill="white"/>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgAvatar);
});

// Favicon endpoint
app.get('/favicon.ico', (req, res) => {
  const svgIcon = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" fill="#6366f1" rx="6"/>
    <text x="16" y="22" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">V</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgIcon);
});

const PORT = process.env.PORT || 4000;

// Create HTTP server for Socket.IO
const http = require('http');
const server = http.createServer(app);

// Initialize Socket.IO for admin chat
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store online users
const onlineUsers = new Map();

// Socket.IO event handlers for admin chat
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  
  // Admin joins chat
  socket.on('chat:join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      fullName: userData.fullName || userData.username,
      role: userData.role
    };
    onlineUsers.set(socket.id, user);
    
    // Broadcast updated online users list
    io.emit('chat:users', Array.from(onlineUsers.values()));
    console.log(`👤 ${user.fullName} joined chat`);
  });
  
  // Handle chat message (supports text, image, voice)
  socket.on('chat:message', async (data) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    
    let imageUrl = null;
    let voiceUrl = null;
    
    // Upload image to Cloudinary if present
    if (data.image && data.image.startsWith('data:')) {
      try {
        const cloudinary = require('cloudinary').v2;
        const result = await cloudinary.uploader.upload(data.image, {
          folder: 'voo-ward/chat',
          resource_type: 'auto'
        });
        imageUrl = result.secure_url;
        console.log('📷 Chat image uploaded to Cloudinary');
      } catch (e) {
        console.error('Failed to upload chat image:', e.message);
        imageUrl = data.image; // fallback to base64 if upload fails
      }
    }
    
    // Upload voice to Cloudinary if present
    if (data.voice && data.voice.startsWith('data:')) {
      try {
        const cloudinary = require('cloudinary').v2;
        const result = await cloudinary.uploader.upload(data.voice, {
          folder: 'voo-ward/chat',
          resource_type: 'video' // audio uses video resource type
        });
        voiceUrl = result.secure_url;
        console.log('🎤 Chat voice uploaded to Cloudinary');
      } catch (e) {
        console.error('Failed to upload chat voice:', e.message);
        voiceUrl = data.voice; // fallback to base64 if upload fails
      }
    }
    
    const message = {
      id: Date.now().toString(),
      sender: sender.username,
      senderName: sender.fullName,
      senderRole: sender.role,
      text: data.text || '',
      image: imageUrl,
      voice: voiceUrl,
      timestamp: new Date().toISOString()
    };
    
    // Save to Supabase
    try {
      const supabaseService = require('./services/supabaseService');
      await supabaseService.request('POST', '/rest/v1/admin_chat_messages', {
        sender: message.sender,
        sender_name: message.senderName,
        sender_role: message.senderRole,
        message_text: message.text,
        image_url: message.image,
        voice_url: message.voice,
        created_at: message.timestamp
      });
    } catch (e) {
      console.error('Failed to save chat message:', e.message || e);
    }
    
    // Broadcast message to all connected admins
    io.emit('chat:message', message);
    const preview = data.text ? data.text.substring(0, 30) : (data.image ? '[Image]' : '[Voice]');
    console.log(`💬 ${sender.fullName}: ${preview}...`);
  });
  
  // Handle typing indicator
  socket.on('chat:typing', (isTyping) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    
    socket.broadcast.emit('chat:typing', {
      username: sender.username,
      fullName: sender.fullName,
      isTyping
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    
    if (user) {
      io.emit('chat:users', Array.from(onlineUsers.values()));
      console.log(`👋 ${user.fullName} left chat`);
    }
  });
});

// REST endpoint for chat history (from Supabase)
app.get('/admin/api/admin/chat/messages', async (req, res) => {
  try {
    const supabaseService = require('./services/supabaseService');
    const messages = await supabaseService.request('GET', '/rest/v1/admin_chat_messages?order=created_at.desc&limit=100');
    
    // Map to frontend format
    const formatted = (Array.isArray(messages) ? messages : []).map(m => ({
      id: m.id,
      sender: m.sender,
      senderName: m.sender_name,
      senderRole: m.sender_role,
      text: m.message_text,
      image: m.image_url,
      voice: m.voice_url,
      timestamp: m.created_at
    })).reverse();
    
    res.json(formatted);
  } catch (e) {
    console.error('Failed to fetch chat history:', e.message || e);
    res.json([]);
  }
});

server.listen(PORT, () => {
  console.log(`[PRODUCTION] VOO Kyamatu Ward USSD API listening on :${PORT}`);
  console.log("Health:", `http://localhost:${PORT}/health`);
  console.log("USSD:", `http://localhost:${PORT}/ussd`);
  console.log("Citizen Portal:", `http://localhost:${PORT}/api/citizen`);
  console.log("Admin Chat: WebSocket enabled ✅");
});
