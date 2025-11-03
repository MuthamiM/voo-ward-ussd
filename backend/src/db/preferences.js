/**
 * User Preferences Database Module
 * Manages language preferences for USSD users
 */

const { getCloudDb } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * Get user's language preference
 * @param {string} phone - Phone number
 * @returns {Promise<Object|null>} - { phone, lang, updated_at } or null
 */
async function getLanguagePreference(phone) {
  if (!phone) return null;
  
  try {
    const db = getCloudDb();
    const result = await db.query(
      'SELECT phone, lang, updated_at FROM preferences WHERE phone = $1',
      [phone]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error({
      error: error.message,
      phone
    }, 'Error getting language preference');
    return null;
  }
}

/**
 * Set user's language preference
 * @param {string} phone - Phone number
 * @param {string} lang - Language code (EN or SW)
 * @returns {Promise<boolean>} - Success status
 */
async function setLanguagePreference(phone, lang) {
  if (!phone || !lang) return false;
  
  // Validate language code
  const upperLang = lang.toUpperCase();
  if (!['EN', 'SW'].includes(upperLang)) {
    logger.warn({ phone, lang }, 'Invalid language code');
    return false;
  }
  
  try {
    const db = getCloudDb();
    const result = await db.query(
      `INSERT INTO preferences (phone, lang, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (phone)
       DO UPDATE SET lang = $2, updated_at = NOW()
       RETURNING phone, lang, updated_at`,
      [phone, upperLang]
    );
    
    logger.info({
      phone,
      lang: upperLang,
      updated_at: result.rows[0]?.updated_at
    }, 'Language preference saved');
    
    return true;
  } catch (error) {
    logger.error({
      error: error.message,
      phone,
      lang: upperLang
    }, 'Error setting language preference');
    return false;
  }
}

/**
 * Delete user's language preference (reset to default)
 * @param {string} phone - Phone number
 * @returns {Promise<boolean>} - Success status
 */
async function deleteLanguagePreference(phone) {
  if (!phone) return false;
  
  try {
    const db = getCloudDb();
    await db.query(
      'DELETE FROM preferences WHERE phone = $1',
      [phone]
    );
    
    logger.info({ phone }, 'Language preference deleted');
    return true;
  } catch (error) {
    logger.error({
      error: error.message,
      phone
    }, 'Error deleting language preference');
    return false;
  }
}

/**
 * Get all preferences (for admin/debugging)
 * @param {number} limit - Max results
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} - Array of preferences
 */
async function getAllPreferences(limit = 100, offset = 0) {
  try {
    const db = getCloudDb();
    const result = await db.query(
      `SELECT phone, lang, updated_at
       FROM preferences
       ORDER BY updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Error getting all preferences');
    return [];
  }
}

/**
 * Get preference statistics
 * @returns {Promise<Object>} - Stats by language
 */
async function getPreferenceStats() {
  try {
    const db = getCloudDb();
    const result = await db.query(
      `SELECT lang, COUNT(*) as count
       FROM preferences
       GROUP BY lang
       ORDER BY count DESC`
    );
    
    const stats = {
      total: 0,
      by_language: {}
    };
    
    for (const row of result.rows) {
      stats.by_language[row.lang] = parseInt(row.count);
      stats.total += parseInt(row.count);
    }
    
    return stats;
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Error getting preference stats');
    return { total: 0, by_language: {} };
  }
}

module.exports = {
  getLanguagePreference,
  setLanguagePreference,
  deleteLanguagePreference,
  getAllPreferences,
  getPreferenceStats
};
