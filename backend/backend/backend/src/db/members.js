/**
 * Members Database Module
 * Enhanced with filtering capabilities for admin exports
 */

const { getCloudDb } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * List members with optional filters
 * @param {Object} filters - { q, from, to, area_id, limit, offset }
 * @returns {Promise<Array>} - Array of member records
 */
async function listMembersWithArea(filters = {}) {
  const {
    q = null,           // Search query
    from = null,        // Date from (YYYY-MM-DD)
    to = null,          // Date to (YYYY-MM-DD)
    area_id = null,     // Area filter
    limit = 1000,
    offset = 0
  } = filters;
  
  try {
    let query = `
      SELECT 
        c.phone_number,
        c.national_id,
        c.first_name,
        c.middle_name,
        c.last_name,
        c.full_name,
        c.location as area,
        c.village,
        c.created_at,
        a.name as area_name
      FROM constituents c
      LEFT JOIN areas a ON c.location::integer = a.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Search filter (case-insensitive across multiple fields)
    if (q && q.trim()) {
      paramCount++;
      query += ` AND (
        LOWER(c.phone_number) LIKE LOWER($${paramCount}) OR
        LOWER(c.national_id) LIKE LOWER($${paramCount}) OR
        LOWER(c.first_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.middle_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.last_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.full_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.location) LIKE LOWER($${paramCount}) OR
        LOWER(c.village) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${q.trim()}%`);
    }
    
    // Date range filter (created_at)
    if (from) {
      paramCount++;
      query += ` AND c.created_at >= $${paramCount}::date`;
      params.push(from);
    }
    
    if (to) {
      paramCount++;
      query += ` AND c.created_at <= $${paramCount}::date + interval '1 day'`;
      params.push(to);
    }
    
    // Area filter
    if (area_id) {
      paramCount++;
      query += ` AND c.location = $${paramCount}::text`;
      params.push(area_id.toString());
    }
    
    // Order by
    query += ` ORDER BY c.created_at DESC`;
    
    // Pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);
    
    logger.debug({
      filters,
      paramCount,
      params
    }, 'Executing members query with filters');
    
    const db = getCloudDb();
    const result = await db.query(query, params);
    
    logger.info({
      count: result.rows.length,
      filters
    }, 'Members retrieved with filters');
    
    return result.rows;
  } catch (error) {
    logger.error({
      error: error.message,
      filters
    }, 'Error listing members with filters');
    throw error;
  }
}

/**
 * Count members with filters (for pagination)
 * @param {Object} filters - { q, from, to, area_id }
 * @returns {Promise<number>} - Total count
 */
async function countMembersWithArea(filters = {}) {
  const {
    q = null,
    from = null,
    to = null,
    area_id = null
  } = filters;
  
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM constituents c
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Search filter
    if (q && q.trim()) {
      paramCount++;
      query += ` AND (
        LOWER(c.phone_number) LIKE LOWER($${paramCount}) OR
        LOWER(c.national_id) LIKE LOWER($${paramCount}) OR
        LOWER(c.first_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.middle_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.last_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.full_name) LIKE LOWER($${paramCount}) OR
        LOWER(c.location) LIKE LOWER($${paramCount}) OR
        LOWER(c.village) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${q.trim()}%`);
    }
    
    // Date range filter
    if (from) {
      paramCount++;
      query += ` AND c.created_at >= $${paramCount}::date`;
      params.push(from);
    }
    
    if (to) {
      paramCount++;
      query += ` AND c.created_at <= $${paramCount}::date + interval '1 day'`;
      params.push(to);
    }
    
    // Area filter
    if (area_id) {
      paramCount++;
      query += ` AND c.location = $${paramCount}::text`;
      params.push(area_id.toString());
    }
    
    const db = getCloudDb();
    const result = await db.query(query, params);
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    logger.error({
      error: error.message,
      filters
    }, 'Error counting members');
    return 0;
  }
}

/**
 * Get member by phone number
 * @param {string} phone - Phone number
 * @returns {Promise<Object|null>} - Member record or null
 */
async function getMemberByPhone(phone) {
  if (!phone) return null;
  
  try {
    const db = getCloudDb();
    const result = await db.query(
      `SELECT 
        c.*,
        a.name as area_name
       FROM constituents c
       LEFT JOIN areas a ON c.location::integer = a.id
       WHERE c.phone_number = $1`,
      [phone]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error({
      error: error.message,
      phone
    }, 'Error getting member by phone');
    return null;
  }
}

/**
 * Check if member exists
 * @param {string} phone - Phone number
 * @returns {Promise<boolean>} - True if exists
 */
async function memberExists(phone) {
  if (!phone) return false;
  
  try {
    const db = getCloudDb();
    const result = await db.query(
      'SELECT 1 FROM constituents WHERE phone_number = $1 LIMIT 1',
      [phone]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error({
      error: error.message,
      phone
    }, 'Error checking member existence');
    return false;
  }
}

module.exports = {
  listMembersWithArea,
  countMembersWithArea,
  getMemberByPhone,
  memberExists
};
