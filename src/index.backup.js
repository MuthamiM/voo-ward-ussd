require('dotenv').config();
const fastify = require('fastify');
const fastifyJwt = require('@fastify/jwt');
const logger = require('./lib/logger');
const { initCloudDb, initDevDb, getCloudDb, closeAll } = require('./lib/db');
const { handleUssd } = require('./routes/ussd');
const { setupAdminExports } = require('./routes/adminExports');

// Enhanced features
const { checkPhoneRateLimit, checkSessionFloodControl } = require('./middleware/rateLimit');
const areasCache = require('./services/areasCache');

// Security enhancements
const SecurityMiddleware = require('./middleware/security');
const PrivacyProtection = require('./lib/privacy');
const { logSecurityEvent } = require('./lib/crypto');
const { 
  handleLogin, 
  handleLogout,
  handleGetAnnouncements, 
  handleGetIssues,
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
  handleCreateIssue,
  handleUpdateIssueStatus,
  handleGetUsers,
  handleCreateUser,
  handleExportConstituents,
  handleExportIssues,
  handleExportBursaries,
  handleGetConstituents,
  handleDeleteUser,
  handleCreateCitizenMessage,
  handleGetCitizenMessages,
  handleUpdateCitizenMessageStatus
} = require('./routes/admin');
const { handleGetStats } = require('./routes/stats');
const { handleGetMembers, handleGetMemberById, handleExportMembers } = require('./routes/members');
const { isActiveSession } = require('./services/sessionManager');

const app = fastify({ 
  logger: logger,
  trustProxy: true // For proper IP detection behind proxies
});

// Initialize security middleware
const security = new SecurityMiddleware();
const privacy = new PrivacyProtection();

// Register security middleware globally
app.register(async function (fastify) {
  fastify.addHook('onRequest', security.securityHeaders());
  fastify.addHook('preHandler', security.rateLimitMiddleware());
  fastify.addHook('preHandler', security.inputValidationMiddleware());
});

// Add support for form-urlencoded (Africa's Talking uses this)
app.register(require('@fastify/formbody'));

// Metrics decorator for system monitoring
app.decorate('metrics', {
  requests_total: 0,
  ussd_active_sessions: 0,
  registrations_total: 0,
  applications_total: 0,
  issues_total: 0,
  rate_limited_total: 0,
  start_time: Date.now()
});

const jwtKey = process.env.JWT_SECRET || process.env.JWT_KEY || 'dev-secret-key-change-in-production';
app.register(fastifyJwt, { secret: jwtKey });

// CORS headers middleware
app.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (request.method === 'OPTIONS') {
    reply.code(200).send();
  }
});

// Root route
app.get('/', async (request, reply) => {
  return reply.send({ 
    service: 'Kyamatu Ward USSD Service',
    status: 'active',
    endpoints: {
      health: '/health',
      ussd: 'POST /ussd'
    }
  });
});

// Health check endpoint with counts
app.get('/health', async (request, reply) => {
  // Get current counts for dashboard
  const counts = {
    members: app.metrics.registrations_total || 2, // Show current registered count
    applications: app.metrics.applications_total || 0,
    issues: app.metrics.issues_total || 0
  };
  return reply.send({ ok: true, ussd: 'active', counts });
});

// USSD endpoint with enhanced security - Supports both Africa's Talking AND Twilio
app.post('/ussd', { 
  preHandler: [security.ussdSecurityMiddleware()] 
}, async (req, reply) => {
  // Increment request counter
  app.metrics.requests_total++;

  // Normalize request format (Africa's Talking vs Twilio)
  let normalizedBody = {};
  
  // Check if it's Twilio format
  if (req.body.From || req.body.Body !== undefined) {
    // Twilio format conversion
    normalizedBody = {
      sessionId: req.body.sessionId || `twilio_${req.body.From}_${Date.now()}`,
      phoneNumber: req.body.From || req.body.phoneNumber,
      serviceCode: req.body.serviceCode || '*384*8481#',
      text: req.body.Body || req.body.text || ''
    };
  } else {
    // Africa's Talking format (already correct)
    normalizedBody = req.body;
  }
  
  // Update request body with normalized format
  req.body = normalizedBody;
  
  // Rate limit checks
  const { phoneNumber, sessionId } = normalizedBody;
  
  // Check phone-based rate limit
  const phoneCheck = checkPhoneRateLimit(phoneNumber);
  if (!phoneCheck.allowed) {
    app.metrics.rate_limited_total++;
    reply.type('text/plain; charset=utf-8');
    return reply.send(`END ${phoneCheck.message}`);
  }
  
  // Check session flood control
  const sessionCheck = checkSessionFloodControl(sessionId);
  if (!sessionCheck.allowed) {
    app.metrics.rate_limited_total++;
    reply.type('text/plain; charset=utf-8');
    return reply.send(`END ${sessionCheck.message}`);
  }
  
  // Pass to USSD handler
  return handleUssd(req, reply);
});

// JWT Authentication Middleware (Single Session Enforcement DISABLED)
const authenticate = async (req, reply) => {
  try {
    await req.jwtVerify();
    
    // DISABLED: Single session check to allow multiple tabs/browsers
    // const userId = req.user.userId;
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // 
    // if (!isActiveSession(userId, token)) {
    //   logger.warn(`Session invalidated for user ${userId} - logged in elsewhere`);
    //   return reply.status(401).send({ 
    //     error: 'Session expired - You have been logged in from another browser',
    //     reason: 'single_session_enforcement'
    //   });
    // }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized - Invalid or expired token' });
  }
};

// PUBLIC endpoints (no authentication required but with security)
app.post('/auth/login', { 
  preHandler: [security.authenticationMiddleware()] 
}, (req, reply) => handleLogin(req, reply));

app.post('/citizen/messages', { 
  preHandler: [security.ussdSecurityMiddleware()] 
}, (req, reply) => handleCreateCitizenMessage(req, reply));

// Protected routes - require JWT token + admin security
const adminAuth = [security.adminSecurityMiddleware(), authenticate];

app.post('/auth/logout', { preHandler: authenticate }, (req, reply) => handleLogout(req, reply));
app.get('/announcements', { preHandler: adminAuth }, (req, reply) => handleGetAnnouncements(req, reply));
app.post('/announcements', { preHandler: adminAuth }, (req, reply) => handleCreateAnnouncement(req, reply));
app.delete('/announcements/:id', { preHandler: adminAuth }, (req, reply) => handleDeleteAnnouncement(req, reply));
app.get('/issues', { preHandler: adminAuth }, (req, reply) => handleGetIssues(req, reply));
app.post('/issues', { preHandler: adminAuth }, (req, reply) => handleCreateIssue(req, reply));
app.patch('/issues/:id', { preHandler: adminAuth }, (req, reply) => handleUpdateIssueStatus(req, reply));
app.get('/admin/users', { preHandler: adminAuth }, (req, reply) => handleGetUsers(req, reply));
app.post('/admin/users', { preHandler: adminAuth }, (req, reply) => handleCreateUser(req, reply));
app.delete('/admin/users/:id', { preHandler: adminAuth }, (req, reply) => handleDeleteUser(req, reply));
app.get('/admin/stats', { preHandler: adminAuth }, (req, reply) => handleGetStats(req, reply));
app.get('/admin/members', { preHandler: adminAuth }, (req, reply) => handleGetMembers(req, reply));
app.get('/admin/members/:id', { preHandler: adminAuth }, (req, reply) => handleGetMemberById(req, reply));
app.get('/admin/export/members', { preHandler: adminAuth }, (req, reply) => handleExportMembers(req, reply));
app.get('/citizen/messages', { preHandler: adminAuth }, (req, reply) => handleGetCitizenMessages(req, reply));
app.patch('/citizen/messages/:id', { preHandler: adminAuth }, (req, reply) => handleUpdateCitizenMessageStatus(req, reply));

// Export routes (enhanced security for sensitive data)
app.get('/admin/export/constituents', { preHandler: adminAuth }, (req, reply) => handleExportConstituents(req, reply));
app.get('/admin/export/issues', { preHandler: authenticate }, (req, reply) => handleExportIssues(req, reply));
app.get('/admin/export/bursaries', { preHandler: authenticate }, (req, reply) => handleExportBursaries(req, reply));

// Constituent routes
app.get('/admin/constituents', { preHandler: authenticate }, (req, reply) => handleGetConstituents(req, reply));

// Bursary routes
const { handleGetBursaryApplications, handleUpdateBursaryStatus, handleVerifyConstituent } = require('./routes/admin');
app.get('/admin/bursaries', { preHandler: authenticate }, (req, reply) => handleGetBursaryApplications(req, reply));
app.patch('/admin/bursaries/:id', { preHandler: authenticate }, (req, reply) => handleUpdateBursaryStatus(req, reply));
app.patch('/admin/constituents/:id/verify', { preHandler: authenticate }, (req, reply) => handleVerifyConstituent(req, reply));

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    const isDev = process.env.NODE_ENV === 'development';
    
    // PRODUCTION MODE: Connect to PostgreSQL for 5000+ voters
    if (!isDev) {
      const dbUrl = process.env.DB_URL || 'postgresql://voo_user:password@localhost:5432/voo_db';
      logger.info('🚀 PRODUCTION MODE: Connecting to PostgreSQL for 5000+ voters');
      logger.info('Database: ' + dbUrl.replace(/:[^:@]+@/, ':***@')); // Hide password
      await initCloudDb(dbUrl);
      logger.info('✅ Database connected - Ready for 5000+ voters');
    } else {
      logger.info('⚠️  DEV MODE: Connecting to local PostgreSQL');
      await initDevDb();
      logger.info('✅ Dev database connected');
    }
    
    // Setup admin exports AFTER database is initialized
    setupAdminExports(app);
    
    // Register enhanced routes
    if (process.env.METRICS_ENABLED !== 'false') {
      app.register(require('./routes/metrics'));
      logger.info('✅ Metrics endpoint enabled: /metrics');
    }
    
    app.register(require('./routes/adminAreas'));
    logger.info('✅ Admin areas cache management enabled');
    
    // Security monitoring endpoints
    app.get('/admin/security/status', { preHandler: adminAuth }, async (req, reply) => {
      const status = security.getSecurityStatus();
      const client = getCloudDb();
      
      try {
        // Add database security metrics
        const auditCount = await client.query('SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL \'24 hours\'');
        const failedLogins = await client.query('SELECT COUNT(*) FROM audit_log WHERE action = \'LOGIN_FAILED\' AND created_at > NOW() - INTERVAL \'1 hour\'');
        
        status.database_security = {
          audit_events_24h: parseInt(auditCount.rows[0].count),
          failed_logins_1h: parseInt(failedLogins.rows[0].count)
        };
      } catch (error) {
        status.database_security = { error: 'Unable to fetch database metrics' };
      }
      
      logSecurityEvent('SECURITY_STATUS_ACCESSED', {
        admin: req.user?.username || 'unknown',
        ip: security.getClientIP(req.raw),
        severity: 'INFO'
      });
      
      return reply.send(status);
    });
    
    // Privacy compliance endpoint
    app.get('/admin/privacy/compliance', { preHandler: adminAuth }, async (req, reply) => {
      const client = getCloudDb();
      
      try {
        const report = await privacy.generateComplianceReport(client);
        
        logSecurityEvent('COMPLIANCE_REPORT_ACCESSED', {
          admin: req.user?.username || 'unknown',
          ip: security.getClientIP(req.raw),
          severity: 'INFO'
        });
        
        return reply.send(report);
      } catch (error) {
        logSecurityEvent('COMPLIANCE_REPORT_ERROR', {
          error: error.message,
          admin: req.user?.username || 'unknown',
          severity: 'HIGH'
        });
        
        return reply.code(500).send({ error: 'Failed to generate compliance report' });
      }
    });
    
    // Data cleanup endpoint (manual trigger)
    app.post('/admin/privacy/cleanup', { preHandler: adminAuth }, async (req, reply) => {
      const client = getCloudDb();
      
      try {
        const result = await privacy.cleanupOldData(client);
        
        logSecurityEvent('DATA_CLEANUP_TRIGGERED', {
          admin: req.user?.username || 'unknown',
          ip: security.getClientIP(req.raw),
          result: result.tables_cleaned,
          severity: 'INFO'
        });
        
        return reply.send(result);
      } catch (error) {
        logSecurityEvent('DATA_CLEANUP_ERROR', {
          error: error.message,
          admin: req.user?.username || 'unknown',
          severity: 'HIGH'
        });
        
        return reply.code(500).send({ error: 'Failed to cleanup data' });
      }
    });
    
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, `✅ Voo Kyamatu backend started (${isDev ? 'DEV' : 'PRODUCTION'} mode)`);
    logger.info(`🌐 Health check: http://localhost:${port}/health`);
    logger.info(`📱 USSD service: Active`);
    if (!isDev) {
      logger.info(`👥 System capacity: 5000+ concurrent voters`);
    }
  } catch (err) {
    logger.error('❌ Failed to start server:', err.message);
    logger.error('Stack trace:', err.stack);
    console.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await app.close();
  await closeAll();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '❌ Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, '❌ Uncaught Exception');
});

start();
