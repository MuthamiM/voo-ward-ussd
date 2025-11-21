/**
 * Redis Cache Service - Production-grade caching implementation
 * Multi-level caching strategy for VOO Ward Admin Dashboard
 * Part of comprehensive performance optimization strategy
 */

const Redis = require('ioredis');
const logger = require('../lib/logger');

class RedisCache {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
    
    // Cache TTL configurations (in seconds)
    this.ttlConfig = {
      dashboard_metrics: 300,        // 5 minutes - Dashboard statistics
      user_session: 3600,            // 1 hour - User sessions
      areas_data: 1800,              // 30 minutes - Areas list
      issues_list: 600,              // 10 minutes - Issues list
      bursaries_list: 900,           // 15 minutes - Bursaries list
      constituents_list: 1200,       // 20 minutes - Constituents list
      export_data: 180,              // 3 minutes - Export data cache
      search_results: 300,           // 5 minutes - Search results
      analytics_data: 1800,          // 30 minutes - Analytics charts
      system_config: 7200,           // 2 hours - System configuration
      audit_logs: 3600,              // 1 hour - Audit logs cache
      notification_queue: 600        // 10 minutes - Notification queue
    };
    
    this.init();
  }
  
  /**
   * Initialize Redis connection with production settings
   */
  init() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        db: process.env.REDIS_DB || 0,
        
        // Production optimizations
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        
        // Connection pool settings
        family: 4,
        keepAlive: true,
        
        // Timeouts
        connectTimeout: 5000,
        commandTimeout: 3000,
        
        // Retry strategy
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: null,
        
        // Additional options for production
        compression: 'gzip',
        enableOfflineQueue: false
      };
      
      this.redis = new Redis(redisConfig);
      
      // Event handlers
      this.redis.on('connect', () => {
        logger.info('🔗 Redis connection established');
        this.connected = true;
        this.retryAttempts = 0;
      });
      
      this.redis.on('ready', () => {
        logger.info('✅ Redis ready for operations');
      });
      
      this.redis.on('error', (err) => {
        logger.error({ error: err.message }, '❌ Redis connection error');
        this.connected = false;
        this.handleConnectionError();
      });
      
      this.redis.on('close', () => {
        logger.warn('⚠️ Redis connection closed');
        this.connected = false;
      });
      
      this.redis.on('reconnecting', () => {
        this.retryAttempts++;
        logger.info(`🔄 Redis reconnecting... (attempt ${this.retryAttempts})`);
      });
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize Redis');
      this.connected = false;
    }
  }
  
  /**
   * Handle connection errors with exponential backoff
   */
  handleConnectionError() {
    if (this.retryAttempts >= this.maxRetries) {
      logger.error(`Redis max retry attempts (${this.maxRetries}) exceeded`);
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
    setTimeout(() => {
      logger.info(`Retrying Redis connection in ${delay}ms...`);
      this.init();
    }, delay);
  }
  
  /**
   * Generate cache key with namespace
   */
  generateKey(type, identifier = '') {
    const namespace = process.env.CACHE_NAMESPACE || 'voo_ward';
    return `${namespace}:${type}:${identifier}`;
  }
  
  /**
   * Set cache with automatic TTL
   */
  async set(type, key, value, customTtl = null) {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping cache set');
      return false;
    }
    
    try {
      const cacheKey = this.generateKey(type, key);
      const serializedValue = JSON.stringify(value);
      const ttl = customTtl || this.ttlConfig[type] || 300;
      
      await this.redis.setex(cacheKey, ttl, serializedValue);
      
      logger.debug({
        key: cacheKey,
        ttl,
        size: serializedValue.length
      }, 'Cache set successfully');
      
      return true;
    } catch (error) {
      logger.error({ 
        error: error.message,
        type,
        key 
      }, 'Failed to set cache');
      return false;
    }
  }
  
  /**
   * Get cache with automatic deserialization
   */
  async get(type, key) {
    if (!this.connected) {
      logger.warn('Redis not connected, cache miss');
      return null;
    }
    
    try {
      const cacheKey = this.generateKey(type, key);
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        logger.debug({ key: cacheKey }, 'Cache miss');
        return null;
      }
      
      const value = JSON.parse(cached);
      logger.debug({ key: cacheKey }, 'Cache hit');
      return value;
      
    } catch (error) {
      logger.error({
        error: error.message,
        type,
        key
      }, 'Failed to get cache');
      return null;
    }
  }
  
  /**
   * Delete specific cache entry
   */
  async del(type, key) {
    if (!this.connected) return false;
    
    try {
      const cacheKey = this.generateKey(type, key);
      await this.redis.del(cacheKey);
      logger.debug({ key: cacheKey }, 'Cache deleted');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete cache');
      return false;
    }
  }
  
  /**
   * Clear all cache entries of a specific type
   */
  async clearType(type) {
    if (!this.connected) return false;
    
    try {
      const pattern = this.generateKey(type, '*');
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info({ type, count: keys.length }, 'Cache type cleared');
      }
      
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to clear cache type');
      return false;
    }
  }
  
  /**
   * Get or set cache with callback (cache-aside pattern)
   */
  async getOrSet(type, key, fetchFunction, customTtl = null) {
    // Try to get from cache first
    let cached = await this.get(type, key);
    
    if (cached !== null) {
      return cached;
    }
    
    // Cache miss - fetch from source
    try {
      const fresh = await fetchFunction();
      
      // Store in cache for next time
      await this.set(type, key, fresh, customTtl);
      
      return fresh;
    } catch (error) {
      logger.error({
        error: error.message,
        type,
        key
      }, 'Failed to fetch data for cache');
      throw error;
    }
  }
  
  /**
   * Increment counter (for rate limiting, analytics)
   */
  async incr(type, key, amount = 1, ttl = 3600) {
    if (!this.connected) return 0;
    
    try {
      const cacheKey = this.generateKey(type, key);
      
      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.incrby(cacheKey, amount);
      pipeline.expire(cacheKey, ttl);
      
      const results = await pipeline.exec();
      return results[0][1]; // Return new counter value
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to increment counter');
      return 0;
    }
  }
  
  /**
   * Add to sorted set (for leaderboards, rankings)
   */
  async zadd(type, key, score, member, ttl = null) {
    if (!this.connected) return false;
    
    try {
      const cacheKey = this.generateKey(type, key);
      await this.redis.zadd(cacheKey, score, member);
      
      if (ttl) {
        await this.redis.expire(cacheKey, ttl);
      }
      
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to add to sorted set');
      return false;
    }
  }
  
  /**
   * Get top N from sorted set
   */
  async zrange(type, key, start = 0, stop = -1, withScores = false) {
    if (!this.connected) return [];
    
    try {
      const cacheKey = this.generateKey(type, key);
      
      if (withScores) {
        return await this.redis.zrange(cacheKey, start, stop, 'WITHSCORES');
      } else {
        return await this.redis.zrange(cacheKey, start, stop);
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get sorted set range');
      return [];
    }
  }
  
  /**
   * Cache invalidation patterns
   */
  async invalidateRelated(type, patterns = []) {
    if (!this.connected) return false;
    
    try {
      const keys = [];
      
      // Add main type
      const mainPattern = this.generateKey(type, '*');
      const mainKeys = await this.redis.keys(mainPattern);
      keys.push(...mainKeys);
      
      // Add related patterns
      for (const pattern of patterns) {
        const relatedKeys = await this.redis.keys(this.generateKey(pattern, '*'));
        keys.push(...relatedKeys);
      }
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info({
          type,
          patterns,
          cleared: keys.length
        }, 'Related caches invalidated');
      }
      
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to invalidate related caches');
      return false;
    }
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    if (!this.connected) {
      return { healthy: false, error: 'Not connected' };
    }
    
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseMemoryInfo(info);
      
      return {
        healthy: true,
        connected: this.connected,
        latency: `${latency}ms`,
        memory: memoryUsage,
        uptime: await this.redis.lastsave()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Parse Redis memory info
   */
  parseMemoryInfo(info) {
    const lines = info.split('\r\n');
    const memory = {};
    
    lines.forEach(line => {
      if (line.startsWith('used_memory:')) {
        memory.used = parseInt(line.split(':')[1]);
      } else if (line.startsWith('used_memory_human:')) {
        memory.used_human = line.split(':')[1];
      } else if (line.startsWith('used_memory_peak_human:')) {
        memory.peak_human = line.split(':')[1];
      }
    });
    
    return memory;
  }
  
  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.connected) {
      return { error: 'Redis not connected' };
    }
    
    try {
      const info = await this.redis.info();
      const keyCount = await this.redis.dbsize();
      
      return {
        connected: this.connected,
        keys: keyCount,
        info: this.parseRedisInfo(info),
        ttl_config: this.ttlConfig
      };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  /**
   * Parse Redis info for relevant stats
   */
  parseRedisInfo(info) {
    const stats = {};
    const lines = info.split('\r\n');
    
    const relevantKeys = [
      'redis_version',
      'connected_clients',
      'used_memory_human',
      'used_memory_peak_human',
      'keyspace_hits',
      'keyspace_misses',
      'instantaneous_ops_per_sec'
    ];
    
    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (relevantKeys.includes(key)) {
        stats[key] = value;
      }
    });
    
    return stats;
  }
  
  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.redis && this.connected) {
      logger.info('🔌 Disconnecting from Redis...');
      await this.redis.quit();
      this.connected = false;
      logger.info('✅ Redis disconnected gracefully');
    }
  }
}

// Singleton instance
const redisCache = new RedisCache();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await redisCache.disconnect();
});

process.on('SIGINT', async () => {
  await redisCache.disconnect();
});

module.exports = redisCache;