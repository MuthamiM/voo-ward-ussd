const { logSecurityEvent, sanitizeInput, RateLimiter, anonymizePhone } = require('../lib/crypto');

// Enhanced security middleware for all endpoints
class SecurityMiddleware {
  constructor() {
    // Rate limiters for different endpoints
    this.globalLimiter = new RateLimiter(100, 1); // 100 requests per second globally
    this.ussdLimiter = new RateLimiter(10, 0.1); // 10 requests per 10 seconds for USSD
    this.adminLimiter = new RateLimiter(20, 0.05); // 20 requests per 20 seconds for admin
    this.loginLimiter = new RateLimiter(5, 0.01); // 5 attempts per 100 seconds for login
    
    // Failed attempt tracking
    this.failedAttempts = new Map();
    this.blockedIPs = new Set();
  }

  // Get client IP (works with both Express and Fastify)
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  // Detect suspicious activity patterns
  detectSuspiciousActivity(req) {
    const userAgent = req.get ? req.get('User-Agent') : req.headers['user-agent'];
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scanner/i,
      /sqlmap/i, /nmap/i, /nikto/i, /burp/i
    ];
    
    return suspiciousPatterns.some(pattern => 
      userAgent && pattern.test(userAgent)
    );
  }

  // Express-compatible middleware functions
  globalRateLimiter(req, res, next) {
    const ip = this.getClientIP(req);
    
    if (this.blockedIPs.has(ip)) {
      logSecurityEvent('BLOCKED_IP_ATTEMPT', {
        ip,
        url: req.url,
        severity: 'HIGH'
      });
      return res.status(429).json({ error: 'IP temporarily blocked' });
    }
    
    if (!this.globalLimiter.isAllowed(ip)) {
      this.trackFailedAttempt(ip);
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip,
        url: req.url,
        severity: 'MEDIUM'
      });
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    next();
  }

  ussdRateLimiter(req, res, next) {
    const ip = this.getClientIP(req);
    
    if (!this.ussdLimiter.isAllowed(ip)) {
      this.trackFailedAttempt(ip);
      logSecurityEvent('USSD_RATE_LIMIT_EXCEEDED', {
        ip,
        severity: 'MEDIUM'
      });
      return res.status(429).json({ error: 'Too many USSD requests' });
    }
    
    next();
  }

  adminRateLimiter(req, res, next) {
    const ip = this.getClientIP(req);
    
    if (!this.adminLimiter.isAllowed(ip)) {
      this.trackFailedAttempt(ip);
      logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', {
        ip,
        severity: 'HIGH'
      });
      return res.status(429).json({ error: 'Too many admin requests' });
    }
    
    next();
  }

  authRateLimiter(req, res, next) {
    const ip = this.getClientIP(req);
    
    if (!this.loginLimiter.isAllowed(ip)) {
      this.trackFailedAttempt(ip);
      logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
        ip,
        severity: 'HIGH'
      });
      return res.status(429).json({ error: 'Too many login attempts' });
    }
    
    next();
  }

  // Enhanced input validation and sanitization (Express)
  inputValidationMiddleware(req, res, next) {
    const ip = this.getClientIP(req);
    
    // Sanitize all text inputs
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }

    // Check for malicious patterns
    const suspiciousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|SCRIPT)\b)/i,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ];

    const requestStr = JSON.stringify(req.body || {}) + JSON.stringify(req.query || {});
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestStr)) {
        this.trackFailedAttempt(ip, 'MALICIOUS_INPUT');
        
        logSecurityEvent('MALICIOUS_INPUT_DETECTED', {
          ip,
          endpoint: req.url,
          pattern: pattern.source,
          input: requestStr.slice(0, 200),
          severity: 'HIGH'
        });
        
        return res.status(400).json({ error: 'Invalid input detected' });
      }
    }
    
    next();
  }

  // Authentication attempt monitoring (Express)
  authenticationMiddleware(req, res, next) {
    const ip = this.getClientIP(req);
    
    // Log authentication attempt
    logSecurityEvent('AUTH_ATTEMPT', {
      ip,
      username: req.body?.username ? sanitizeInput(req.body.username) : 'unknown',
      severity: 'INFO'
    });
    
    next();
  }

  // USSD-specific security middleware
  ussdSecurityMiddleware(req, res, next) {
    const ip = this.getClientIP(req);
    
    // Validate USSD-specific fields
    if (req.body) {
      const { phoneNumber, sessionId, text } = req.body;
      
      // Validate phone number format
      if (phoneNumber && !/^\+254[0-9]{9}$/.test(phoneNumber)) {
        logSecurityEvent('INVALID_PHONE_FORMAT', {
          ip,
          phone: anonymizePhone(phoneNumber),
          severity: 'MEDIUM'
        });
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      
      // Validate session ID
      if (sessionId && (typeof sessionId !== 'string' || sessionId.length > 100)) {
        logSecurityEvent('INVALID_SESSION_ID', {
          ip,
          severity: 'MEDIUM'
        });
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      
      // Sanitize text input
      if (text && typeof text === 'string') {
        req.body.text = sanitizeInput(text);
      }
    }
    
    next();
  }

  // Admin-specific security middleware
  adminSecurityMiddleware(req, res, next) {
    const ip = this.getClientIP(req);
    
    // Enhanced logging for admin endpoints
    logSecurityEvent('ADMIN_ENDPOINT_ACCESS', {
      ip,
      endpoint: req.url,
      method: req.method,
      userAgent: req.get('User-Agent') || 'unknown',
      severity: 'INFO'
    });
    
    // Additional admin-specific validation
    this.inputValidationMiddleware(req, res, next);
  }

  // Track failed attempts and implement progressive blocking
  trackFailedAttempt(ip, reason = 'GENERAL') {
    if (!this.failedAttempts.has(ip)) {
      this.failedAttempts.set(ip, []);
    }
    
    const attempts = this.failedAttempts.get(ip);
    attempts.push({
      timestamp: Date.now(),
      reason
    });
    
    // Clean old attempts (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > oneHourAgo);
    this.failedAttempts.set(ip, recentAttempts);
    
    // Progressive blocking - 10 failed attempts = 24 hour block
    if (recentAttempts.length >= 10) {
      this.blockedIPs.add(ip);
      
      logSecurityEvent('IP_BLOCKED', {
        ip,
        attempts: recentAttempts.length,
        reasons: recentAttempts.map(a => a.reason),
        severity: 'CRITICAL'
      });
      
      // Auto-unblock after 24 hours
      setTimeout(() => {
        this.blockedIPs.delete(ip);
        logSecurityEvent('IP_UNBLOCKED', {
          ip,
          severity: 'INFO'
        });
      }, 24 * 60 * 60 * 1000);
    }
  }

  // Recursively sanitize object properties
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return typeof obj === 'string' ? sanitizeInput(obj) : obj;
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeInput(key);
      
      if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? sanitizeInput(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeInput(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }

  // Get security status for monitoring
  getSecurityStatus() {
    return {
      blocked_ips: this.blockedIPs.size,
      failed_attempts: Array.from(this.failedAttempts.entries()).map(([ip, attempts]) => ({
        ip: ip.replace(/\d+\.\d+\.\d+\./, 'xxx.xxx.xxx.'),  // Anonymize IP
        recent_attempts: attempts.length,
        last_attempt: attempts.length > 0 ? new Date(Math.max(...attempts.map(a => a.timestamp))).toISOString() : null
      })),
      rate_limiters: {
        global: this.globalLimiter.constructor.name,
        ussd: this.ussdLimiter.constructor.name,
        admin: this.adminLimiter.constructor.name,
        login: this.loginLimiter.constructor.name
      },
      security_features: [
        'IP_BLOCKING',
        'RATE_LIMITING', 
        'INPUT_VALIDATION',
        'SECURITY_HEADERS',
        'AUDIT_LOGGING'
      ],
      last_updated: new Date().toISOString()
    };
  }
}

module.exports = SecurityMiddleware;