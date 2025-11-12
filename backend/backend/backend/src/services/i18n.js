/**
 * Internationalization (i18n) Service
 * Provides English (EN) and Swahili (SW) translations for USSD
 */

const logger = require('../lib/logger');
const { getLanguagePreference } = require('../db/preferences');

// Message dictionaries
const MESSAGES = {
  EN: {
    // Universal hints
    hints: '0:Back 00:Home',
    
    // Language selection
    language_select: 'Select Language\n1. English\n2. Kiswahili',
    language_changed: 'Language changed to English',
    
    // Main menu
    main_menu: 'KYAMATU WARD\n1. News\n2. Report Issue\n3. Apply Bursary\n4. Projects\n5. Application Status\n6. Profile\n7. Language\n0. Exit',
    
    // Registration
    register: 'Register',
    enter_id: 'Enter your 8-digit National ID:',
    invalid_id: 'Invalid ID. Must be 8 digits.',
    enter_names: 'Enter full name (First Middle Last):',
    invalid_names: 'Invalid. Enter 3 names (2-30 chars each).',
    enter_area: 'Select your area:',
    enter_village: 'Enter your village (3-40 chars):',
    invalid_village: 'Invalid village name.',
    registration_success: 'Registration successful!',
    registration_error: 'Registration failed. Try again.',
    
    // News
    news_title: 'NEWS & ANNOUNCEMENTS',
    no_news: 'No news available.',
    
    // Report Issue
    report_issue_title: 'REPORT ISSUE',
    select_issue_category: 'Select category:',
    enter_issue_description: 'Describe the issue (5-140 chars):',
    invalid_description: 'Description too short (min 5 chars).',
    issue_reported: 'Issue reported successfully!',
    ticket: 'Ticket',
    category: 'Category',
    
    // Bursary
    bursary_title: 'APPLY FOR BURSARY',
    select_bursary_type: 'Select category:',
    enter_student_name: 'Enter student full name (3+ chars):',
    enter_institution: 'Enter school/institution (3+ chars):',
    enter_amount: 'Enter amount needed (KSh):',
    invalid_amount: 'Invalid amount. Enter numbers only.',
    invalid_name: 'Name too short (min 3 chars).',
    invalid_institution: 'Institution too short (min 3 chars).',
    bursary_submitted: 'Bursary application submitted!',
    application_number: 'Application No',
    will_contact: 'We will contact you soon.',
    
    // Projects
    projects_title: 'ONGOING PROJECTS',
    project_status: 'Status',
    project_completion: 'Completion',
    no_projects: 'No projects available.',
    
    // Status
    status_title: 'APPLICATION STATUS',
    enter_ref_code: 'Enter your reference code:',
    status_not_found: 'Application not found.',
    
    // Profile
    profile_title: 'YOUR PROFILE',
    not_registered: 'Not registered. Choose option 1 to register.',
    
    // Generic
    back: '0. Back',
    home: '00. Home',
    exit: 'Thank you!',
    invalid_choice: 'Invalid choice. Try again.',
    error_occurred: 'An error occurred. Try again later.',
    
    // Rate limiting
    rate_limit: 'Too many requests. Try later.',
    flood_control: 'Session limit reached. Start new.'
  },
  
  SW: {
    // Universal hints
    hints: '0:Nyuma 00:Nyumbani',
    
    // Language selection
    language_select: 'Chagua Lugha\n1. English\n2. Kiswahili',
    language_changed: 'Lugha imebadilishwa kuwa Kiswahili',
    
    // Main menu
    main_menu: 'KYAMATU WARD\n1. Habari\n2. Ripoti Tatizo\n3. Omba Bursary\n4. Miradi\n5. Hali ya Maombi\n6. Wasifu\n7. Lugha\n0. Toka',
    
    // Registration
    register: 'Jisajili',
    enter_id: 'Weka nambari ya Kitambulisho (tarakimu 8):',
    invalid_id: 'Kitambulisho si sahihi. Lazima iwe tarakimu 8.',
    enter_names: 'Weka jina kamili (Kwanza Kati Mwisho):',
    invalid_names: 'Si sahihi. Weka majina 3 (herufi 2-30 kila moja).',
    enter_area: 'Chagua eneo lako:',
    enter_village: 'Weka kijiji chako (herufi 3-40):',
    invalid_village: 'Jina la kijiji si sahihi.',
    registration_success: 'Usajili umefanikiwa!',
    registration_error: 'Usajili umeshindikana. Jaribu tena.',
    
    // News
    news_title: 'HABARI NA MATANGAZO',
    no_news: 'Hakuna habari kwa sasa.',
    
    // Report Issue
    report_issue_title: 'RIPOTI TATIZO',
    select_issue_category: 'Chagua aina:',
    enter_issue_description: 'Eleza tatizo (herufi 5-140):',
    invalid_description: 'Maelezo mafupi mno (angalau herufi 5).',
    issue_reported: 'Tatizo limepokelewa!',
    ticket: 'Tiketi',
    category: 'Aina',
    
    // Bursary
    bursary_title: 'OMBA BURSARY',
    select_bursary_type: 'Chagua aina:',
    enter_student_name: 'Weka jina la mwanafunzi (herufi 3+):',
    enter_institution: 'Weka shule/chuo (herufi 3+):',
    enter_amount: 'Weka kiasi unahitaji (KSh):',
    invalid_amount: 'Kiasi si sahihi. Weka nambari tu.',
    invalid_name: 'Jina fupi mno (angalau herufi 3).',
    invalid_institution: 'Jina la shule fupi mno (angalau herufi 3).',
    bursary_submitted: 'Ombi lako limepokelewa!',
    application_number: 'Nambari ya Ombi',
    will_contact: 'Tutawasiliana nawe hivi karibuni.',
    
    // Projects
    projects_title: 'MIRADI INAYOENDELEA',
    project_status: 'Hali',
    project_completion: 'Kukamilika',
    no_projects: 'Hakuna miradi kwa sasa.',
    
    // Status
    status_title: 'HALI YA OMBI',
    enter_ref_code: 'Weka nambari ya kumbukumbu:',
    status_not_found: 'Ombi halijapatikana.',
    
    // Profile
    profile_title: 'WASIFU WAKO',
    not_registered: 'Hujajisajili. Chagua nambari 1 kujisajili.',
    
    // Generic
    back: '0. Nyuma',
    home: '00. Nyumbani',
    exit: 'Asante!',
    invalid_choice: 'Chaguo si sahihi. Jaribu tena.',
    error_occurred: 'Kosa limetokea. Jaribu baadaye.',
    
    // Rate limiting
    rate_limit: 'Maombi mengi mno. Jaribu baadaye.',
    flood_control: 'Kikao kimefika kikomo. Anza kipya.'
  }
};

/**
 * Get text for a key in user's preferred language
 * @param {string} phone - User's phone number
 * @param {string} key - Message key
 * @param {string} defaultLang - Default language if no preference
 * @returns {Promise<string>} - Translated text
 */
async function getText(phone, key, defaultLang = 'EN') {
  try {
    // Get user's language preference
    let lang = defaultLang;
    
    if (phone) {
      const pref = await getLanguagePreference(phone);
      if (pref && pref.lang) {
        lang = pref.lang.toUpperCase();
      }
    }
    
    // Ensure valid language
    if (!['EN', 'SW'].includes(lang)) {
      lang = 'EN';
    }
    
    // Get message
    const message = MESSAGES[lang]?.[key];
    
    if (!message) {
      logger.warn({ phone, key, lang }, 'Missing translation key');
      return MESSAGES.EN[key] || `[${key}]`;
    }
    
    return message;
  } catch (error) {
    logger.error({ error: error.message, phone, key }, 'Error getting text');
    return MESSAGES.EN[key] || `[${key}]`;
  }
}

/**
 * Get multiple texts at once
 * @param {string} phone - User's phone number
 * @param {string[]} keys - Array of message keys
 * @param {string} defaultLang - Default language
 * @returns {Promise<Object>} - Object with key-value pairs
 */
async function getTexts(phone, keys, defaultLang = 'EN') {
  const result = {};
  
  for (const key of keys) {
    result[key] = await getText(phone, key, defaultLang);
  }
  
  return result;
}

/**
 * Get all messages for a language
 * @param {string} lang - Language code (EN or SW)
 * @returns {Object} - All messages
 */
function getAllMessages(lang = 'EN') {
  const upperLang = lang.toUpperCase();
  return MESSAGES[upperLang] || MESSAGES.EN;
}

/**
 * Format message with hints
 * @param {string} message - Base message
 * @param {string} phone - User's phone number
 * @param {boolean} includeHints - Whether to include navigation hints
 * @returns {Promise<string>} - Formatted message
 */
async function formatWithHints(message, phone, includeHints = true) {
  if (!includeHints) {
    return message;
  }
  
  const hints = await getText(phone, 'hints');
  return `${message}\n\n${hints}`;
}

/**
 * Sanitize user input
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Remove control characters
 * - Enforce max length
 * @param {string} input - Raw input
 * @param {number} maxLength - Maximum allowed length (default 140)
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input, maxLength = 140) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input
    .trim()
    // Remove control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ');
  
  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

module.exports = {
  getText,
  getTexts,
  getAllMessages,
  formatWithHints,
  sanitizeInput,
  MESSAGES
};
