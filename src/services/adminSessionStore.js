/**
 * Redis Admin Session Store
 * Production-grade session management for admin dashboard with Redis backend
 * Replaces in-memory Map sessions for scalability and persistence
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class RedisAdminSessionStore {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.fallbackSessions = new Map(); // In-memory fallback
    
    // Session configuration
    this.sessionTTL = parseInt(process.env.SESSION_TIMEOUT_MS) || 1800000; // 30 minutes
    this.prefix = 'admin_session:';
    
    this.init();
  }

  /**
   * Initialize Redis connection
   */
  init() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.log('⚠️ REDIS_URL not set, using in-memory admin session fallback');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        console.log('🔗 Redis admin session store connected');
        this.connected = true;
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis admin session store error:', err.message);
        this.connected = false;
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Redis admin session store connection closed');
        this.connected = false;
      });

      // Connect
      this.redis.connect().catch(err => {
        console.error('❌ Redis admin session store connect failed:', err.message);
      });

    } catch (error) {
      console.error('❌ Redis admin session store init failed:', error.message);
    }
  }

  /**
   * Generate session token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session
   */
  async create(user) {
    const token = this.generateToken();
    const sessionData = {
      user: {
        id: user._id?.toString() || user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name || user.fullName,
        photo_url: user.photo_url || null,
        settings: user.settings || {}
      },
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    if (this.connected && this.redis) {
      try {
        const key = `${this.prefix}${token}`;
        await this.redis.setex(key, Math.floor(this.sessionTTL / 1000), JSON.stringify(sessionData));
        console.log(`✅ Admin session created in Redis for user: ${user.username}`);
      } catch (err) {
        console.error('❌ Redis admin session create failed, using fallback:', err.message);
        this.fallbackSessions.set(token, sessionData);
      }
    } else {
      this.fallbackSessions.set(token, sessionData);
    }

    return token;
  }

  /**
   * Get session by token - compatible with existing sessions Map interface
   */
  get(token) {
    // Synchronous get for backwards compatibility - returns from fallback only
    if (!token || token === 'null' || token === 'undefined') {
      return undefined;
    }
    return this.fallbackSessions.get(token);
  }

  /**
   * Async get session by token
   */
  async getAsync(token) {
    if (!token || token === 'null' || token === 'undefined') {
      return null;
    }

    if (this.connected && this.redis) {
      try {
        const key = `${this.prefix}${token}`;
        const data = await this.redis.get(key);
        
        if (data) {
          const session = JSON.parse(data);
          
          // Update last activity and refresh TTL
          session.lastActivity = new Date().toISOString();
          await this.redis.setex(key, Math.floor(this.sessionTTL / 1000), JSON.stringify(session));
          
          return session;
        }
        return null;
      } catch (err) {
        console.error('❌ Redis admin session get failed:', err.message);
        // Try fallback
        return this.fallbackSessions.get(token) || null;
      }
    }

    // Fallback to in-memory
    const session = this.fallbackSessions.get(token);
    if (session) {
      // Check expiry for fallback sessions
      const createdAt = new Date(session.createdAt);
      if (Date.now() - createdAt.getTime() > this.sessionTTL) {
        this.fallbackSessions.delete(token);
        return null;
      }
    }
    return session || null;
  }

  /**
   * Set session - compatible with Map interface
   */
  set(token, sessionData) {
    // Synchronous set for backwards compatibility
    this.fallbackSessions.set(token, sessionData);
    
    // Also set in Redis if connected (fire and forget)
    if (this.connected && this.redis) {
      const key = `${this.prefix}${token}`;
      this.redis.setex(key, Math.floor(this.sessionTTL / 1000), JSON.stringify(sessionData))
        .catch(err => console.error('Redis set error:', err.message));
    }
  }

  /**
   * Delete session - compatible with Map interface
   */
  delete(token) {
    if (!token) return false;

    // Remove from fallback
    this.fallbackSessions.delete(token);

    // Also remove from Redis if connected (fire and forget)
    if (this.connected && this.redis) {
      const key = `${this.prefix}${token}`;
      this.redis.del(key).catch(err => console.error('Redis delete error:', err.message));
    }

    return true;
  }

  /**
   * Get all active sessions (for admin/debugging)
   */
  async getAllSessions() {
    const sessions = [];

    if (this.connected && this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}*`);
        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            const session = JSON.parse(data);
            sessions.push({
              token: key.replace(this.prefix, '').substring(0, 10) + '...',
              user: session.user?.username,
              role: session.user?.role,
              createdAt: session.createdAt,
              lastActivity: session.lastActivity
            });
          }
        }
      } catch (err) {
        console.error('❌ Failed to get all admin sessions:', err.message);
      }
    }

    // Add fallback sessions
    for (const [token, session] of this.fallbackSessions) {
      sessions.push({
        token: token.substring(0, 10) + '...',
        user: session.user?.username,
        role: session.user?.role,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        source: 'fallback'
      });
    }

    return sessions;
  }

  /**
   * Get session count
   */
  async count() {
    let redisCount = 0;
    
    if (this.connected && this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}*`);
        redisCount = keys.length;
      } catch (err) {
        console.error('❌ Failed to count Redis admin sessions:', err.message);
      }
    }

    return {
      redis: redisCount,
      fallback: this.fallbackSessions.size,
      total: redisCount + this.fallbackSessions.size
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const counts = await this.count();
    
    return {
      healthy: true,
      redisConnected: this.connected,
      sessions: counts,
      ttlSeconds: Math.floor(this.sessionTTL / 1000)
    };
  }

  /**
   * Cleanup expired fallback sessions
   */
  cleanupFallback() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, session] of this.fallbackSessions) {
      const createdAt = new Date(session.createdAt);
      if (now - createdAt.getTime() > this.sessionTTL) {
        this.fallbackSessions.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired admin fallback sessions`);
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.redis && this.connected) {
      console.log('🔌 Disconnecting Redis admin session store...');
      await this.redis.quit();
      this.connected = false;
    }
  }
}

// Singleton instance
const adminSessionStore = new RedisAdminSessionStore();

// Periodic cleanup of fallback sessions
setInterval(() => {
  adminSessionStore.cleanupFallback();
}, 900000); // 15 minutes

// Graceful shutdown
process.on('SIGTERM', async () => {
  await adminSessionStore.disconnect();
});

module.exports = adminSessionStore;
