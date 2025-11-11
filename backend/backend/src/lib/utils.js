// Utility functions for USSD validation and formatting

/**
 * Normalize phone number to +2547XXXXXXXX format
 * Accepts: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
 * Returns: +2547XXXXXXXX or null if invalid
 */
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.startsWith('254') && digits.length === 12) {
    // Format: 2547XXXXXXXX
    return '+' + digits;
  } else if (digits.startsWith('0') && digits.length === 10) {
    // Format: 07XXXXXXXX -> convert to +2547XXXXXXXX
    return '+254' + digits.substring(1);
  } else if (digits.startsWith('7') && digits.length === 9) {
    // Format: 7XXXXXXXX -> convert to +2547XXXXXXXX
    return '+254' + digits;
  }
  
  return null; // Invalid format
}

/**
 * Validate Kenyan National ID
 * Must be 6-10 digits, numeric only, no leading zero
 */
function isValidID(id) {
  if (!id) return false;
  const idStr = String(id).trim();
  
  // Must be numeric
  if (!/^\d+$/.test(idStr)) return false;
  
  // Must be 6-10 digits
  if (idStr.length < 6 || idStr.length > 10) return false;
  
  // Cannot start with zero
  if (idStr.startsWith('0')) return false;
  
  return true;
}

/**
 * Validate full name
 * Letters, spaces, apostrophes, hyphens only
 * 3-80 characters
 */
function isValidName(name) {
  if (!name) return false;
  const trimmed = name.trim();
  
  // Length check
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  
  // Character check: letters, spaces, apostrophes, hyphens
  if (!/^[A-Za-z\s'\-]+$/.test(trimmed)) return false;
  
  return true;
}

/**
 * Validate year (2020-2035)
 */
function isValidYear(year) {
  const y = parseInt(year);
  return !isNaN(y) && y >= 2020 && y <= 2035;
}

/**
 * Validate amount (KES 500-100000)
 */
function isValidAmount(amount) {
  const amt = parseInt(amount);
  return !isNaN(amt) && amt >= 500 && amt <= 100000;
}

/**
 * Validate reason/description text
 * 3-240 characters
 */
function isValidReason(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length >= 3 && trimmed.length <= 240;
}

/**
 * Trim and collapse whitespace
 */
function cleanText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Generate unique reference code
 * prefix: 'BK-' for bursary, 'IS-' for issues
 * Returns: prefix + 6 uppercase alphanumeric chars
 */
function generateRef(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + code;
}

/**
 * Calculate days since a date
 * @param {string} dateIso - ISO date string
 * @returns {number} - days elapsed
 */
function daysSince(dateIso) {
  const date = new Date(dateIso);
  const now = new Date();
  const diffMs = now - date;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  normalizePhone,
  isValidID,
  isValidName,
  isValidYear,
  isValidAmount,
  isValidReason,
  cleanText,
  generateRef,
  daysSince,
  formatDate
};
