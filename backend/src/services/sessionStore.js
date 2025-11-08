/**
 * Session Store Service
 * LRU cache with TTL for transient USSD session state
 * Max 10k sessions, 10-minute TTL
 */

const logger = require('../lib/logger');

// Configuration
const MAX_SESSIONS = 10000;
const SESSION_TTL_MS = 600000; // 10 minutes

class SessionStore {
  constructor() {
    this.sessions = new Map(); // sessionId -> { data, timestamp, accessCount }
    this.accessOrder = []; // LRU tracking
    
    // Start cleanup timer
    this.startCleanup();
    
    logger.info({
      maxSessions: MAX_SESSIONS,
      ttlMs: SESSION_TTL_MS
    }, 'Session store initialized');
  }
  
  /**
   * Set session data
   */
  set(sessionId, data) {
    if (!sessionId) return;
    
    const now = Date.now();
    
    // Check capacity and evict if needed
    if (!this.sessions.has(sessionId) && this.sessions.size >= MAX_SESSIONS) {
      this.evictOldest();
    }
    
    // Update or create session
    this.sessions.set(sessionId, {
      data,
      timestamp: now,
      accessCount: (this.sessions.get(sessionId)?.accessCount || 0) + 1
    });
    
    // Update LRU order
    this.updateAccessOrder(sessionId);
    
    logger.debug({
      sessionId,
      dataKeys: Object.keys(data),
      storeSize: this.sessions.size
    }, 'Session data set');
  }
  
  /**
   * Get session data
   */
  get(sessionId) {
    if (!sessionId) return null;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    const now = Date.now();
    if (now - session.timestamp > SESSION_TTL_MS) {
      this.delete(sessionId);
      logger.debug({ sessionId }, 'Session expired');
      return null;
    }
    
    // Update access count and order
    session.accessCount++;
    this.updateAccessOrder(sessionId);
    
    logger.debug({
      sessionId,
      accessCount: session.accessCount,
      ageMs: now - session.timestamp
    }, 'Session data retrieved');
    
    return session.data;
  }
  
  /**
   * Update session data (merge)
   */
  update(sessionId, updates) {
    if (!sessionId) return;
    
    const current = this.get(sessionId);
    const merged = { ...(current || {}), ...updates };
    this.set(sessionId, merged);
  }
  
  /**
   * Delete session
   */
  delete(sessionId) {
    if (!sessionId) return;
    
    this.sessions.delete(sessionId);
    this.accessOrder = this.accessOrder.filter(id => id !== sessionId);
    
    logger.debug({
      sessionId,
      storeSize: this.sessions.size
    }, 'Session deleted');
  }
  
  /**
   * Clear session (alias for delete, used on END responses)
   */
  clear(sessionId) {
    this.delete(sessionId);
  }
  
  /**
   * Update LRU access order
   */
  updateAccessOrder(sessionId) {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(id => id !== sessionId);
    // Add to end (most recently used)
    this.accessOrder.push(sessionId);
  }
  
  /**
   * Evict oldest session (LRU)
   */
  evictOldest() {
    if (this.accessOrder.length === 0) return;
    
    const oldestId = this.accessOrder[0];
    const session = this.sessions.get(oldestId);
    
    logger.info({
      sessionId: oldestId,
      ageMs: session ? Date.now() - session.timestamp : 0,
      accessCount: session?.accessCount || 0
    }, 'Evicting oldest session (capacity limit)');
    
    this.delete(oldestId);
  }
  
  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.timestamp > SESSION_TTL_MS) {
        this.delete(sessionId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.info({
        expiredCount,
        remainingCount: this.sessions.size
      }, 'Session cleanup completed');
    }
  }
  
  /**
   * Start periodic cleanup (every 2 minutes)
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 120000); // 2 minutes
    
    // Don't keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  /**
   * Get store metrics
   */
  getMetrics() {
    return {
      active_sessions: this.sessions.size,
      max_capacity: MAX_SESSIONS,
      ttl_ms: SESSION_TTL_MS
    };
  }
  
  /**
   * Get all session stats (for debugging)
   */
  getStats() {
    const now = Date.now();
    const stats = {
      total: this.sessions.size,
      byAge: { '<1min': 0, '1-5min': 0, '5-10min': 0 },
      byAccess: { '1': 0, '2-5': 0, '6+': 0 }
    };
    
    for (const session of this.sessions.values()) {
      const ageMs = now - session.timestamp;
      const ageMin = ageMs / 60000;
      
      if (ageMin < 1) stats.byAge['<1min']++;
      else if (ageMin < 5) stats.byAge['1-5min']++;
      else stats.byAge['5-10min']++;
      
      if (session.accessCount === 1) stats.byAccess['1']++;
      else if (session.accessCount <= 5) stats.byAccess['2-5']++;
      else stats.byAccess['6+']++;
    }
    
    return stats;
  }
}

// Singleton instance
const sessionStore = new SessionStore();

module.exports = sessionStore;
