const logger = require('../lib/logger');
const { hashPhone, generateTicket } = require('../lib/crypto');
const { getCloudDb } = require('../lib/db');

const MCA_PHONE = '0706757140';

const MESSAGES = {
  en: {
    language_prompt: 'KYAMATU WARD - FREE SERVICE\n\nSelect Language:\n1. English\n2. Swahili\n3. Kamba',
    not_registered: 'You must register first.',
    register_menu: 'REGISTER\n\n1. Start\n0. Exit',
    enter_id: 'Enter National ID or Huduma Number:',
    enter_name: 'Enter 3 names: First Middle Surname',
    enter_location: 'Enter Location:',
    enter_sublocation: 'Enter Sub-Location:',
    enter_village: 'Enter Village/Area:',
    registration_success: 'REGISTERED!\n\nDial again to access services.',
    already_registered: 'Already registered!',
    id_already_used: 'This ID is registered to another number.',
    invalid_id: 'Invalid ID. Enter 7-12 digits only.',
    invalid_names: 'Invalid. Enter exactly 3 names: First Middle Surname',
    main_menu: 'KYAMATU WARD\n\n1. News\n2. Report Issue\n3. Apply Bursary\n4. Projects\n0. Exit',
    news_title: 'NEWS',
    select_issue_category: 'REPORT ISSUE\n\nSelect Category:',
    report_issue: 'Describe the problem',
    issue_reported: '✅ MESSAGE SENT',
    ticket: 'Ticket',
    category: 'Category',
    office_contact: 'MCA Office:',
    thank_you: 'Your issue has been sent to the MCA office. We will contact you soon!',
    bursary_title: 'APPLY FOR BURSARY',
    select_bursary_type: 'Select Category:',
    enter_student_name: 'Enter Student Full Name:',
    enter_institution: 'Enter School/Institution:',
    enter_amount: 'Enter Amount Needed (KSh):',
    bursary_submitted: 'BURSARY APPLICATION SUBMITTED',
    application_number: 'Application No',
    will_contact: 'We will contact you soon.',
    projects_title: 'WARD PROJECTS',
    project_status: 'Status',
    project_completion: 'Completion',
    error_saving: 'Error. Try again.',
    invalid_amount: 'Invalid amount. Enter numbers only.',
    back: '0. Back',
    exit: '0. Exit',
    main_menu_option: '0. Main Menu'
  },
  sw: {
    language_prompt: 'WADI YA KYAMATU - HUDUMA BURE\n\nChagua Lugha:\n1. Kiingereza\n2. Kiswahili\n3. Kikamba',
    not_registered: 'Lazima usajiliwe kwanza.',
    register_menu: 'SAJILI\n\n1. Anza\n0. Toka',
    enter_id: 'Weka ID au Huduma Namba:',
    enter_name: 'Weka majina 3: Kwanza Kati Mwisho',
    enter_location: 'Weka Location:',
    enter_sublocation: 'Weka Sub-Location:',
    enter_village: 'Weka Kijiji/Eneo:',
    registration_success: 'UMESAJILIWA!\n\nPiga tena kupata huduma.',
    already_registered: 'Tayari umesajiliwa!',
    id_already_used: 'ID hii imetumika na simu nyingine.',
    invalid_id: 'ID batili. Weka tarakimu 7-12 tu.',
    invalid_names: 'Batili. Weka majina 3: Kwanza Kati Mwisho',
    main_menu: 'WADI YA KYAMATU\n\n1. Habari\n2. Ripoti Tatizo\n3. Omba Bursary\n4. Miradi\n0. Toka',
    news_title: 'HABARI',
    select_issue_category: 'Chagua Aina ya Tatizo:',
    report_issue: 'Eleza tatizo:',
    issue_reported: '✅ UJUMBE UMETUMWA',
    ticket: 'Nambari',
    category: 'Aina',
    office_contact: 'Ofisi itakupigia:',
    thank_you: 'Asante!',
    bursary_title: 'OMBA BURSARY',
    select_bursary_type: 'Chagua Aina:',
    enter_student_name: 'Weka Jina Kamili la Mwanafunzi:',
    enter_institution: 'Weka Shule/Chuo:',
    enter_amount: 'Weka Kiasi (KSh):',
    bursary_submitted: 'OMBI LIMEPOKELEWA',
    application_number: 'Nambari ya Ombi',
    will_contact: 'Tutakupigia hivi karibuni.',
    projects_title: 'MIRADI YA WADI',
    project_status: 'Hali',
    project_completion: 'Kumaliza',
    error_saving: 'Hitilafu. Jaribu tena.',
    invalid_amount: 'Kiasi batili. Weka nambari tu.',
    back: '0. Rudi',
    exit: '0. Toka',
    main_menu_option: '0. Menyu Kuu'
  },
  ka: {
    language_prompt: 'WADI WA KYAMATU - NDUNGATA YA WATHI\n\nThuua Mwimbo:\n1. English\n2. Swahili\n3. Kikamba',
    not_registered: 'Wikwĩwa kwandikithya mbee.',
    register_menu: 'ANDIKITHYA\n\n1. Ambĩĩia\n0. Uma',
    enter_id: 'Inya ID kana Huduma Namba:',
    enter_name: 'Inya matawa 3: Kwa mbee Gati Kuma thuuthi',
    enter_location: 'Inya Location:',
    enter_sublocation: 'Inya Sub-Location:',
    enter_village: 'Inya Kitui/Wendi:',
    registration_success: 'NIWANDIKITHITHWE!\n\nPiga ingi ona ndungata.',
    already_registered: 'Niwandikithithwe!',
    id_already_used: 'ID eyo ĩndumiwe nĩ simu ingi.',
    invalid_id: 'ID ti mĩega. Inya namba 7-12 tu.',
    invalid_names: 'Ti mĩega. Inya matawa 3: Kwa mbee Gati Kuma thuuthi',
    main_menu: 'WADI WA KYAMATU\n\n1. Mawĩtũ\n2. Tuma Thina\n3. Ũthĩthi Bursary\n4. Milimo\n0. Uma',
    news_title: 'MAWĨTŨ',
    select_issue_category: 'Thuua Mũthemba wa Thina:',
    report_issue: 'Thamba thina:',
    issue_reported: 'THINA NIMWITIKIWE',
    ticket: 'Namba',
    category: 'Mũthemba',
    office_contact: 'Ofisi ĩkakupigia:',
    thank_you: 'Nĩ wega!',
    bursary_title: 'ŨTHĨTHI BURSARY',
    select_bursary_type: 'Thuua Mũthemba:',
    enter_student_name: 'Inya Itwa Yothe ya Mwana:',
    enter_institution: 'Inya Sukulu/Chuo:',
    enter_amount: 'Inya Mbeca (KSh):',
    bursary_submitted: 'ŨTHĨTHI NIMWITIKIE',
    application_number: 'Namba ya Ũthĩthi',
    will_contact: 'Tũkakupigia o na.',
    projects_title: 'MILIMO YA WADI',
    project_status: 'Hali',
    project_completion: 'Kũmalĩka',
    error_saving: 'Kũĩ ũndũ ũkĩũkĩte. Inya ingi.',
    invalid_amount: 'Mbeca ti syinzĩ. Inya namba.',
    back: '0. Syoka',
    exit: '0. Uma',
    main_menu_option: '0. Menyu Ya Mbee'
  }
};

// Dynamic data arrays - admin will populate these via dashboard
const announcements = [
  { id: 1, title: 'Water pipeline repair', date: 'Wed 10am, Nov 6' },
  { id: 2, title: 'Community meeting', date: 'Fri 2pm, Nov 8' },
  { id: 3, title: 'Bursary applications open', date: 'Until Dec 15' }
];

const projects = [
  { id: 1, name: 'Road expansion - Kyamatu to Mwala', status: 'In Progress', completion: 'Jan 2026' },
  { id: 2, name: 'Water system upgrade', status: 'Completed', completion: 'Oct 2025' },
  { id: 3, name: 'Health center construction', status: 'Planning', completion: 'Jun 2026' }
];

const bursaryCategories = [
  { id: 1, name: 'Primary School' },
  { id: 2, name: 'Secondary School' },
  { id: 3, name: 'College/University' },
  { id: 4, name: 'Vocational Training' }
];

const issueCategories = [
  { id: 1, name: 'Water & Sanitation' },
  { id: 2, name: 'Roads & Infrastructure' },
  { id: 3, name: 'Health Services' },
  { id: 4, name: 'Education' },
  { id: 5, name: 'Security' },
  { id: 6, name: 'Other' }
];

let devIssues = [];
let bursaryApplications = [];
const userSessions = new Map();

function getUserLanguage(phoneNumber) {
  const session = userSessions.get(phoneNumber);
  if (session && (Date.now() - session.lastActivity < 300000)) {
    return session.language;
  }
  return null;
}

function setUserLanguage(phoneNumber, language) {
  userSessions.set(phoneNumber, { language, lastActivity: Date.now() });
}

function getMessages(phoneNumber) {
  const lang = getUserLanguage(phoneNumber) || 'en';
  return MESSAGES[lang];
}

function isEightDigitID(id) {
  // Accept old (7-8 digits) and new (9-12 digits) Kenyan National IDs
  // Old format: 12345678
  // New Huduma Namba format: 123456789012 (up to 12 digits)
  return /^[0-9]{7,12}$/.test(String(id).trim());
}

function splitThreeNames(fullName) {
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  if (parts.length !== 3) return null;
  for (const part of parts) {
    if (part.length < 2 || part.length > 30) return null;
    if (!/^[A-Za-z'\-]+$/.test(part)) return null;
  }
  return { first: parts[0], middle: parts[1], last: parts[2] };
}

function isValidVillage(village) {
  const v = String(village).trim();
  return v.length >= 3 && v.length <= 40 && /^[A-Za-z0-9' \-]{3,40}$/.test(v);
}

async function handleUssd(req, res) {
  try {
    const { phoneNumber, text } = req.body;
    
    // Safety checks
    if (!phoneNumber) {
      return res.type('text/plain').send('END Invalid request - phone number required');
    }
    
    const phoneHash = hashPhone(phoneNumber);
    const userText = text || ''; // Handle undefined/null text
    const segments = userText.split('*').filter(s => s.trim());
    logger.info({ phone: phoneNumber, path: segments.join('>'), free: 'YES' }, 'USSD Access');
    
    if (segments.length === 0 || userText.trim() === '') {
      const response = 'CON ' + MESSAGES.en.language_prompt;
      logger.info({ phone: phoneNumber, action: 'LANGUAGE_SELECT' }, 'Language selection');
      return res.type('text/plain').send(response);
    }
    
    const choice = segments[0];
    
    // ALWAYS set language from first segment if it's a language choice (1, 2, or 3)
    // This allows users to change language at any time and ensures multi-segment requests work
    if (choice === '1' || choice === '2' || choice === '3') {
      const lang = choice === '1' ? 'en' : choice === '2' ? 'sw' : 'ka';
      const currentLang = getUserLanguage(phoneNumber);
      if (currentLang !== lang) {
        setUserLanguage(phoneNumber, lang);
        logger.info({ phone: phoneNumber, language: lang, previousLanguage: currentLang }, 'Language set/changed from first segment');
      }
    }
    
    // If language selection only (single segment), show menu
    if (segments.length === 1 && (choice === '1' || choice === '2' || choice === '3')) {
      const db = getCloudDb();
      let isRegistered = false;
      let isVerified = false;
      let verificationStatus = null;
      if (db) {
        try {
          const result = await db.query('SELECT id, verification_status FROM constituents WHERE phone_number = $1', [phoneNumber]);
          isRegistered = result.rows.length > 0;
          if (isRegistered) {
            verificationStatus = result.rows[0].verification_status;
            isVerified = verificationStatus === 'verified';
          }
        } catch (err) {
          logger.error({ err, phone: phoneNumber }, 'Error checking registration');
        }
      }
      const msg = getMessages(phoneNumber);
      if (!isRegistered) {
        return res.type('text/plain').send('CON ' + msg.register_menu);
      } else if (isRegistered && !isVerified) {
        // Registered but not verified yet - ALLOW ALL SERVICES (restrictions removed)
        if (verificationStatus === 'rejected') {
          return res.type('text/plain').send('CON ❌ Registration REJECTED\n\n' + msg.main_menu.replace('CON ', ''));
        } else {
          return res.type('text/plain').send('CON ⏳ Pending Verification\n\n' + msg.main_menu.replace('CON ', ''));
        }
      } else {
        return res.type('text/plain').send('CON ' + msg.main_menu);
      }
    }
    
    const msg = getMessages(phoneNumber);
    const menuChoice = segments.length > 1 ? segments[1] : null;
    
    // Check if user is registered AND verification status
    const db = getCloudDb();
    let isRegistered = false;
    let isVerified = false;
    let userVerificationStatus = null;
    if (db && getUserLanguage(phoneNumber)) {
      try {
        const result = await db.query('SELECT id, verification_status FROM constituents WHERE phone_number = $1', [phoneNumber]);
        isRegistered = result.rows.length > 0;
        if (isRegistered) {
          userVerificationStatus = result.rows[0].verification_status;
          isVerified = userVerificationStatus === 'verified';
        }
      } catch (err) {
        logger.error({ err, phone: phoneNumber }, 'Error checking registration status');
      }
    }
    
    // REGISTERED USERS - Main Menu Navigation (verified OR unverified with limited access)
    if (isRegistered && getUserLanguage(phoneNumber) && segments.length >= 2) {
      
      // Handle "0" Back button at any depth
      const lastInput = segments[segments.length - 1];
      if (lastInput === '0' && segments.length > 2) {
        // Go back to main menu (ALL USERS get full menu now)
        if (userVerificationStatus === 'rejected') {
          return res.type('text/plain').send('CON ❌ Registration REJECTED\n\n' + msg.main_menu.replace('CON ', ''));
        } else if (!isVerified) {
          return res.type('text/plain').send('CON ⏳ Pending Verification\n\n' + msg.main_menu.replace('CON ', ''));
        } else {
          return res.type('text/plain').send('CON ' + msg.main_menu);
        }
      }
      
      // OPTION 1: NEWS (Allowed for ALL registered users)
      if (menuChoice === '1') {
        const newsMenu = `CON ${msg.news_title}\n\n` + announcements.map((a, i) => `${i+1}. ${a.title} (${a.date})`).join('\n') + `\n\n${msg.back}`;
        return res.type('text/plain').send(newsMenu);
      }
      
      // OPTION 2: REPORT ISSUE (Allowed for ALL registered users)
      if (menuChoice === '2') {
        // Step 1: Select category
        if (segments.length === 2) {
          const categoryMenu = `CON ${msg.select_issue_category}\n\n` + issueCategories.map((c, i) => `${i+1}. ${c.name}`).join('\n') + `\n\n${msg.back}`;
          return res.type('text/plain').send(categoryMenu);
        }
        // Step 2: Enter description (max 100 characters)
        if (segments.length === 3) {
          const categoryIndex = parseInt(segments[2]) - 1;
          if (categoryIndex >= 0 && categoryIndex < issueCategories.length) {
            const category = issueCategories[categoryIndex];
            return res.type('text/plain').send(`CON ${msg.report_issue}\n\nMax 100 characters\n\n${msg.back}`);
          } else {
            return res.type('text/plain').send('END Invalid selection.');
          }
        }
        // Step 3: Save issue FAST - respond immediately, save in background
        if (segments.length === 4) {
          const categoryIndex = parseInt(segments[2]) - 1;
          let description = segments[3].trim();
          
          // Validate description
          if (description.length < 5) {
            return res.type('text/plain').send('END Description too short (min 5 chars). Please try again.');
          }
          
          // Limit to 100 characters
          if (description.length > 100) {
            description = description.substring(0, 100);
          }
          
          const category = issueCategories[categoryIndex];
          const ticket = generateTicket();
          
          // Increment issues counter
          if (req.server && req.server.metrics) {
            req.server.metrics.issues_total++;
          }
          
          // BACKGROUND: Save to database (don't wait for it)
          setImmediate(async () => {
            try {
              const db = getCloudDb();
              if (!db) {
                logger.error({ ticket, phoneNumber }, 'Database not initialized - cannot save issue');
                return;
              }
              
              // Get user's name from database
              const userResult = await db.query(
                'SELECT full_name FROM constituents WHERE phone_number = $1',
                [phoneNumber]
              );
              
              const userName = userResult.rows.length > 0 ? userResult.rows[0].full_name : 'Unknown';
              
              // Save to database with timestamp (status must be: open, in_progress, or resolved)
              await db.query(
                `INSERT INTO issues (ticket, category, message, phone_number, full_name, status, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [ticket, category.name, description, phoneNumber, userName, 'open']
              );
              
              logger.info({ phone: phoneNumber, name: userName, ticket, category: category.name }, 'Issue saved to database');
            } catch (error) {
              logger.error({ error: error.message, stack: error.stack, ticket, phoneNumber }, 'Failed to save issue to database');
            }
          });
          
          // FAST: Send response IMMEDIATELY after starting background save
          const response = `END ${msg.issue_reported}\n\n${msg.ticket}: ${ticket}\n\n${msg.thank_you}`;
          return res.type('text/plain').send(response);
        }
      }
      
      // OPTION 3: APPLY FOR BURSARY (Now open to all registered users)
      if (menuChoice === '3') {
        // Step 1: Select bursary category
        if (segments.length === 2) {
          const bursaryMenu = `CON ${msg.bursary_title}\n\n${msg.select_bursary_type}\n` + bursaryCategories.map((b, i) => `${i+1}. ${b.name}`).join('\n') + `\n\n${msg.back}`;
          return res.type('text/plain').send(bursaryMenu);
        }
        // Step 2: Enter student name
        if (segments.length === 3) {
          const catIndex = parseInt(segments[2]) - 1;
          if (catIndex >= 0 && catIndex < bursaryCategories.length) {
            return res.type('text/plain').send(`CON ${msg.enter_student_name}\n\n${msg.back}`);
          } else {
            return res.type('text/plain').send('END Invalid selection.');
          }
        }
        // Step 3: Enter institution
        if (segments.length === 4) {
          const studentName = segments[3].trim();
          if (studentName.length < 3) {
            return res.type('text/plain').send('END Name too short. Please try again.');
          }
          return res.type('text/plain').send(`CON ${msg.enter_institution}\n\n${msg.back}`);
        }
        // Step 4: Enter amount
        if (segments.length === 5) {
          const institution = segments[4].trim();
          if (institution.length < 3) {
            return res.type('text/plain').send('END Institution name too short. Please try again.');
          }
          return res.type('text/plain').send(`CON ${msg.enter_amount}\n\n${msg.back}`);
        }
        // Step 5: Submit application
        if (segments.length === 6) {
          const catIndex = parseInt(segments[2]) - 1;
          const studentName = segments[3].trim();
          const institution = segments[4].trim();
          const amount = segments[5].trim();
          
          // Validate amount is numeric
          if (!/^[0-9]+$/.test(amount)) {
            return res.type('text/plain').send(`END ${msg.invalid_amount}`);
          }
          
          const category = bursaryCategories[catIndex];
          const appNumber = generateTicket();
          
          bursaryApplications.push({
            applicationNumber: appNumber,
            phone: phoneNumber,
            category: category.name,
            studentName,
            institution,
            amount: parseInt(amount),
            created_at: new Date()
          });
          
          // Save to database if available
          if (db) {
            try {
              await db.query(
                `INSERT INTO bursary_applications (ref_code, phone_number, application_number, category, student_name, institution, amount_requested, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [appNumber, phoneNumber, appNumber, category.name, studentName, institution, parseInt(amount), 'Pending']
              );
              logger.info({ phone: phoneNumber, appNumber, category: category.name }, 'Bursary application submitted');
            } catch (err) {
              logger.error({ err }, 'Error saving bursary application');
            }
          }
          
          return res.type('text/plain').send(`END ${msg.bursary_submitted}\n\n${msg.application_number}: ${appNumber}\n${msg.category}: ${category.name}\nAmount: KSh ${amount}\n\n${msg.will_contact}`);
        }
      }
      
      // OPTION 4: PROJECTS (Now open to all registered users)
      if (menuChoice === '4') {
        const projectsMenu = `CON ${msg.projects_title}\n\n` + projects.map((p, i) => {
          return `${i+1}. ${p.name}\n   ${msg.project_status}: ${p.status}\n   ${msg.project_completion}: ${p.completion}`;
        }).join('\n\n') + `\n\n${msg.back}`;
        return res.type('text/plain').send(projectsMenu);
      }
      
      // OPTION 0: Exit
      if (menuChoice === '0') {
        const exitMsg = msg.thank_you + '\n\nKYAMATU WARD';
        return res.type('text/plain').send('END ' + exitMsg);
      }
    }
    
    // UNREGISTERED USERS - Registration Flow
    if (!isRegistered && getUserLanguage(phoneNumber) && segments.length >= 2) {
      const depth = segments.length;
      // Handle 0 - Exit during registration
      if (depth === 2 && segments[1] === '0') {
        return res.type('text/plain').send(`END ${msg.thank_you}`);
      }
      if (depth === 2 && segments[1] === '1') {
        return res.type('text/plain').send(`CON ${msg.enter_id}`);
      }
      if (depth === 3 && segments[1] === '1') {
        const nationalId = segments[2].trim();
        if (!isEightDigitID(nationalId)) {
          return res.type('text/plain').send(`CON ${msg.invalid_id}\n\n${msg.enter_id}`);
        }
        return res.type('text/plain').send(`CON ${msg.enter_name}`);
      }
      if (depth === 4 && segments[1] === '1') {
        const fullName = segments[3].trim();
        const names = splitThreeNames(fullName);
        if (!names) {
          return res.type('text/plain').send(`CON ${msg.invalid_names}\n\n${msg.enter_name}`);
        }
        return res.type('text/plain').send(`CON ${msg.enter_location}`);
      }
      if (depth === 5 && segments[1] === '1') {
        return res.type('text/plain').send(`CON ${msg.enter_sublocation}`);
      }
      if (depth === 6 && segments[1] === '1') {
        return res.type('text/plain').send(`CON ${msg.enter_village}`);
      }
      if (depth === 7 && segments[1] === '1') {
        const nationalId = segments[2].trim();
        const fullName = segments[3].trim();
        const location = segments[4].trim().toUpperCase();
        const sublocation = segments[5].trim();
        const village = segments[6].trim();
        if (!isEightDigitID(nationalId)) return res.type('text/plain').send(`END ${msg.invalid_id}`);
        const names = splitThreeNames(fullName);
        if (!names) return res.type('text/plain').send(`END ${msg.invalid_names}`);
        if (location.length < 2) return res.type('text/plain').send(`END Location too short.`);
        
        // VERIFY LOCATION IS IN KYAMATU WARD
        const validLocations = ['KYAMATU', 'KIKIMA', 'MBONDONI', 'NGULUNI', 'KITHYOKO', 'MUTITUNI'];
        if (!validLocations.includes(location)) {
          return res.type('text/plain').send(`END Invalid location. Must be in Kyamatu Ward.\n\nValid: Kyamatu, Kikima, Mbondoni, Nguluni, Kithyoko, Mutituni`);
        }
        
        if (sublocation.length < 2) return res.type('text/plain').send(`END Sub-location too short.`);
        if (!isValidVillage(village)) return res.type('text/plain').send(`END Village invalid.`);
        try {
          const phoneCheck = await db.query('SELECT id FROM constituents WHERE phone_number = $1', [phoneNumber]);
          if (phoneCheck.rows.length > 0) {
            return res.type('text/plain').send(`END ${msg.already_registered}`);
          }
          const idCheck = await db.query('SELECT phone_number FROM constituents WHERE national_id = $1 AND phone_number != $2', [nationalId, phoneNumber]);
          if (idCheck.rows.length > 0) {
            return res.type('text/plain').send(`END ${msg.id_already_used}`);
          }
          // Save with PENDING status - admin must verify ID and location
          await db.query(`INSERT INTO constituents (phone_number, national_id, first_name, middle_name, last_name, location, sublocation, village, full_name, verification_status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())`, [phoneNumber, nationalId, names.first, names.middle, names.last, location, sublocation, village, fullName]);
          logger.info({ phone: phoneNumber, nationalId, location, action: 'REGISTERED_PENDING' }, 'User registered - pending verification');
          // Show success message with pending notice
          return res.type('text/plain').send(`END ✅ REGISTERED!\n\n${fullName}\nID: ${nationalId}\nLocation: ${location}\n\n⏳ Your registration is pending verification by the MCA office.\n\nYou will be notified once approved.`);
        } catch (err) {
          logger.error({ err }, 'Registration error');
          return res.type('text/plain').send(`END ${msg.error_saving}`);
        }
      }
    }
    
    // Fallback - show main menu or registration
    if (getUserLanguage(phoneNumber)) {
      if (isRegistered) {
        return res.type('text/plain').send('CON ' + msg.main_menu);
      } else {
        return res.type('text/plain').send('CON ' + msg.register_menu);
      }
    }
    
    return res.type('text/plain').send('CON ' + MESSAGES.en.language_prompt);
  } catch (err) {
    logger.error(err, 'USSD error');
    return res.type('text/plain').send('END Service error. Please try again.');
  }
}

module.exports = { 
  handleUssd,
  handleUSSD: handleUssd, // Alias for compatibility
  MESSAGES, 
  devIssues, 
  bursaryApplications,
  announcements,
  projects,
  bursaryCategories,
  issueCategories
};
