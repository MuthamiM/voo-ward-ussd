/**
 * Cache Service
 * Redis-based caching for improved performance
 */

const logger = require('../lib/logger');
let redisClient = null;

// Initialize Redis client
async function initializeRedis() {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        logger.warn('Redis URL not configured. Caching disabled.');
        return null;
    }

    try {
        const redis = require('redis');
        redisClient = redis.createClient({ url: redisUrl });

        redisClient.on('error', (err) => {
            logger.error('Redis error:', err);
        });

        redisClient.on('connect', () => {
            logger.info('✅ Redis client connected');
        });

        await redisClient.connect();
        return redisClient;
    } catch (err) {
        logger.error('Failed to initialize Redis:', err);
        return null;
    }
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} Cached value or null
 */
async function get(key) {
    const client = await initializeRedis();
    if (!client) return null;

    try {
        const value = await client.get(key);
        if (value) {
            logger.debug(`Cache HIT: ${key}`);
            return JSON.parse(value);
        }
        logger.debug(`Cache MISS: ${key}`);
        return null;
    } catch (err) {
        logger.error(`Cache get error for ${key}:`, err);
        return null;
    }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 */
async function set(key, value, ttl = 300) {
    const client = await initializeRedis();
    if (!client) return false;

    try {
        await client.setEx(key, ttl, JSON.stringify(value));
        logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
    } catch (err) {
        logger.error(`Cache set error for ${key}:`, err);
        return false;
    }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
async function del(key) {
    const client = await initializeRedis();
    if (!client) return false;

    try {
        await client.del(key);
        logger.debug(`Cache DEL: ${key}`);
        return true;
    } catch (err) {
        logger.error(`Cache delete error for ${key}:`, err);
        return false;
    }
}

/**
 * Delete all keys matching pattern
 * @param {string} pattern - Key pattern (e.g., 'issues:*')
 */
async function delPattern(pattern) {
    const client = await initializeRedis();
    if (!client) return false;

    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
            logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
        }
        return true;
    } catch (err) {
        logger.error(`Cache delete pattern error for ${pattern}:`, err);
        return false;
    }
}

/**
 * Check if caching is enabled
 */
function isCacheEnabled() {
    return !!process.env.REDIS_URL;
}

module.exports = {
    get,
    set,
    del,
    delPattern,
    isCacheEnabled
};
