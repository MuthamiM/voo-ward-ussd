/**
 * Areas Cache Service
 * In-memory cache for areas with 10-minute TTL
 * Reduces database hits during USSD pagination
 */

const { getCloudDb } = require('../lib/db');
const logger = require('../lib/logger');

// Configuration
const CACHE_TTL_MS = 600000; // 10 minutes

class AreasCache {
  constructor() {
    this.cache = null;
    this.lastRefresh = null;
    this.refreshPromise = null;
    
    // Initial load disabled - will load on first access or manual refresh
    // this.refresh().catch(err => {
    //   logger.error({ error: err.message }, 'Initial areas cache load failed');
    // });
  }
  
  /**
   * Refresh cache from database
   * @returns {Promise<Object>} - { areas, count, refreshed_at }
   */
  async refresh() {
    // Prevent concurrent refreshes
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    this.refreshPromise = this._doRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  async _doRefresh() {
    try {
      logger.info('Refreshing areas cache...');
      
      const db = getCloudDb();

      
      const result = await db.query(
        'SELECT id, name FROM areas ORDER BY name ASC'
      );
      
      this.cache = result.rows;
      this.lastRefresh = Date.now();
      
      logger.info({
        count: this.cache.length,
        refreshed_at: new Date(this.lastRefresh).toISOString()
      }, 'Areas cache refreshed');
      
      return {
        areas: this.cache,
        count: this.cache.length,
        refreshed_at: new Date(this.lastRefresh).toISOString()
      };
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Error refreshing areas cache');
      
      // Keep old cache if refresh fails
      throw error;
    }
  }
  
  /**
   * Get all areas from cache
   * Auto-refreshes if expired
   * @returns {Promise<Array>} - Array of { id, name }
   */
  async getAreas() {
    // Check if cache is expired or empty
    if (!this.cache || this.isExpired()) {
      await this.refresh();
    }
    
    return this.cache || [];
  }
  
  /**
   * Get single area by ID
   * @param {number} areaId - Area ID
   * @returns {Promise<Object|null>} - { id, name } or null
   */
  async getArea(areaId) {
    const areas = await this.getAreas();
    return areas.find(a => a.id === parseInt(areaId)) || null;
  }
  
  /**
   * Search areas by name (case-insensitive)
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching areas
   */
  async searchAreas(query) {
    if (!query) return this.getAreas();
    
    const areas = await this.getAreas();
    const lowerQuery = query.toLowerCase();
    
    return areas.filter(a =>
      a.name.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Check if cache is expired
   * @returns {boolean} - True if expired
   */
  isExpired() {
    if (!this.lastRefresh) return true;
    return Date.now() - this.lastRefresh > CACHE_TTL_MS;
  }
  
  /**
   * Get cache status
   * @returns {Object} - { cached, count, age_ms, expired }
   */
  getStatus() {
    const now = Date.now();
    const ageMs = this.lastRefresh ? now - this.lastRefresh : null;
    
    return {
      cached: !!this.cache,
      count: this.cache ? this.cache.length : 0,
      age_ms: ageMs,
      expired: this.isExpired(),
      ttl_ms: CACHE_TTL_MS,
      refreshed_at: this.lastRefresh ? new Date(this.lastRefresh).toISOString() : null
    };
  }
  
  /**
   * Force clear cache
   */
  clear() {
    this.cache = null;
    this.lastRefresh = null;
    logger.info('Areas cache cleared');
  }
  
  /**
   * Get paginated areas for USSD menu
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Items per page
   * @returns {Promise<Object>} - { areas, page, totalPages, hasMore }
   */
  async getPaginatedAreas(page = 1, pageSize = 10) {
    const allAreas = await this.getAreas();
    const totalPages = Math.ceil(allAreas.length / pageSize);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    
    return {
      areas: allAreas.slice(startIdx, endIdx),
      page,
      totalPages,
      hasMore: page < totalPages,
      total: allAreas.length
    };
  }
}

// Singleton instance
const areasCache = new AreasCache();

module.exports = areasCache;
