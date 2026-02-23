const logger = require('../lib/logger');
const { verifyPin, hashPin } = require('../lib/crypto');
const { getDb, getCloudDb } = require('../lib/db');
const { addSession, isActiveSession, removeSession } = require('../services/sessionManager');

// Dev mode data store
let devAnnouncements = [
  { id: 1, title: 'Ward Maintenance Notice', body: 'Road maintenance scheduled for next week. Please avoid main street.', created_at: new Date().toISOString() },
  { id: 2, title: 'Community Meeting', body: 'Monthly community meeting on Friday at 3 PM at the ward office.', created_at: new Date().toISOString() },
  { id: 3, title: 'Bursary Applications Open', body: 'Applications for school bursaries are now open. Deadline: end of month.', created_at: new Date().toISOString() },
  { id: 4, title: 'Health Clinic Upgrade', body: 'The local health clinic has received new equipment. Free checkups available.', created_at: new Date().toISOString() },
  { id: 5, title: 'Youth Empowerment Drive', body: 'Registration for youth empowerment program is ongoing at the ward office.', created_at: new Date().toISOString() }
];

let devIssues = [
  { id: 1, ticket: 'ISS-001', category: 'Infrastructure', message: 'Pothole on main street causing accidents', phone_number: '0712345678', status: 'open', source: 'Dashboard', comments: [], created_at: new Date().toISOString() },
  { id: 2, ticket: 'ISS-002', category: 'Water', message: 'No water supply in zone B for 3 days', phone_number: '0787654321', status: 'in_progress', source: 'Dashboard', comments: ['Technician dispatched'], created_at: new Date().toISOString() },
  { id: 3, ticket: 'ISS-003', category: 'Health', message: 'Clinic is out of malaria medication', phone_number: '0723456789', status: 'resolved', source: 'Dashboard', comments: ['Stock replenished', 'Issue resolved'], created_at: new Date().toISOString() },
  { id: 4, ticket: 'ISS-004', category: 'Security', message: 'Street lights not working near the market', phone_number: '0734567890', status: 'open', source: 'USSD', comments: [], created_at: new Date().toISOString() },
  { id: 5, ticket: 'ISS-005', category: 'Education', message: 'Roof leak at the primary school', phone_number: '0745678901', status: 'in_progress', source: 'Dashboard', comments: ['Assessment completed, contractor notified'], created_at: new Date().toISOString() }
];

// Helper function for USSD to add issues
function addDevIssue(issue) {
  devIssues.push(issue);
  logger.info(`Issue added from USSD: ${issue.ticket}`);
}

// Initialize with official admin user ZAK
// PIN: 827700 (Full Access Super Admin - MCA)
// ZAK can add only ONE PA (admin role)
let devUsers = [
  {
    id: 1,
    name: 'ZAK',
    phone: '827700', // Official admin identifier
    pin_hash: '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q', // bcrypt hash of '827700'
    role: 'super_admin',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Martin',
    phone: '827700',
    pin_hash: '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q',
    role: 'super_admin',
    created_at: new Date().toISOString()
  }
];

// Citizen messages (complaints, suggestions, feedback from residents)
let devCitizenMessages = [
  { id: 1, name: 'Alice Kamau', phone_number: '0700112233', subject: 'Great Job on the Road', message: 'Thanks for fixing the potholes quickly!', status: 'unread', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 2, name: 'Brian Ochieng', phone_number: '0722334455', subject: 'Garbage Collection', message: 'The garbage collection truck missed our street this week.', status: 'read', created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 3, name: 'Cynthia Mutuku', phone_number: '0733445566', subject: 'Bursary Query', message: 'When will the bursary list be published?', status: 'replied', admin_reply: 'The list will be out by Friday.', replied_at: new Date().toISOString(), replied_by: 'Martin', created_at: new Date(Date.now() - 259200000).toISOString() }
];

let devConstituents = [
  { id: 1, phone_number: '+254712345678', national_id: '12345678', full_name: 'John Doe', first_name: 'John', middle_name: '', last_name: 'Doe', location: 'Nairobi', sublocation: 'Central', village: 'Mtaa 1', verification_status: 'verified', verified_by: 'ZAK', verified_at: new Date().toISOString(), created_at: new Date(Date.now() - 864000000).toISOString() },
  { id: 2, phone_number: '+254723456789', national_id: '23456789', full_name: 'Jane Smith', first_name: 'Jane', middle_name: 'W.', last_name: 'Smith', location: 'Mombasa', sublocation: 'Island', village: 'Mtaa 2', verification_status: 'pending', verified_by: null, verified_at: null, created_at: new Date(Date.now() - 432000000).toISOString() },
  { id: 3, phone_number: '+254734567890', national_id: '34567890', full_name: 'Peter Wamalwa', first_name: 'Peter', middle_name: '', last_name: 'Wamalwa', location: 'Kisumu', sublocation: 'Milimani', village: 'Mtaa 3', verification_status: 'rejected', verified_by: 'Martin', verified_at: new Date().toISOString(), created_at: new Date(Date.now() - 100000000).toISOString() }
];

let devBursaryApplications = [
  { id: 1, ref_code: 'BUR-001', application_number: 'APP-001', phone_number: '+254712345678', category: 'University', student_name: 'John Doe Jr', institution: 'Nairobi University', amount_requested: 50000, status: 'Pending', created_at: new Date(Date.now() - 86400000).toISOString(), applicant_name: 'John Doe', applicant_location: 'Nairobi' },
  { id: 2, ref_code: 'BUR-002', application_number: 'APP-002', phone_number: '+254723456789', category: 'Secondary', student_name: 'Mary Smith', institution: 'Mombasa Girls', amount_requested: 30000, status: 'Approved', created_at: new Date(Date.now() - 172800000).toISOString(), applicant_name: 'Jane Smith', applicant_location: 'Mombasa' },
  { id: 3, ref_code: 'BUR-003', application_number: 'APP-003', phone_number: '+254734567890', category: 'College', student_name: 'James Wamalwa', institution: 'Kisumu Polytechnic', amount_requested: 25000, status: 'Under Review', created_at: new Date(Date.now() - 259200000).toISOString(), applicant_name: 'Peter Wamalwa', applicant_location: 'Kisumu' }
];

// Load PA accounts from database on startup (dev mode)
async function loadAdminUsersFromDB() {
  if (process.env.NODE_ENV !== 'development') return;

  const db = getDb();
  try {
    const result = await db.query(
      'SELECT id, name, phone, pin_hash, role, created_at FROM admin_users ORDER BY id'
    );

    if (result.rows.length > 0) {
      devUsers = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        pin_hash: row.pin_hash,
        role: row.role,
        created_at: row.created_at.toISOString()
      }));
      logger.info(`Loaded ${devUsers.length} admin users from database`);
    }
  } catch (err) {
    logger.warn('Could not load admin users from database:', err.message);
    logger.info('Using default ZAK user only');
  }
}

// Call on module load
loadAdminUsersFromDB();

async function handleLogin(req, reply) {
  const { username, pin } = req.body;

  // Validate username (min 3 chars, letters and numbers only)
  if (!username || username.length < 3) {
    return reply.status(400).send({ error: 'Username must be at least 3 characters' });
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return reply.status(400).send({ error: 'Username can only contain letters and numbers' });
  }

  // Validate PIN (digits only, any length)
  if (!pin || !/^\d+$/.test(pin)) {
    return reply.status(400).send({ error: 'Password must contain only digits' });
  }

  logger.info(`Login attempt for username: ${username}`);

  // Dev mode: check against database first, then fallback to dev users
  if (process.env.NODE_ENV === 'development') {
    const db = getDb();
    if (db) {
      try {
        const res = await db.query('SELECT id, name, pin_hash, role, phone, username FROM admin_users WHERE LOWER(username) = LOWER($1)', [username]);
        if (res.rows.length > 0) {
          const user = res.rows[0];
          if (!verifyPin(pin, user.pin_hash)) {
            logger.warn(`Invalid PIN for username: ${username}`);
            return reply.status(401).send({ error: 'Invalid username or PIN' });
          }

          const token = req.server.jwt.sign({
            userId: user.id,
            role: user.role,
            name: user.name,
            phone: user.phone
          });

          // Update last_login
          await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [user.id]);

          // Add session (invalidates any previous session)
          addSession(user.id, token);

          logger.info(`User ${user.name} (${user.role}) logged in - new session created`);
          return reply.send({
            token,
            user: {
              id: user.id,
              name: user.name,
              role: user.role,
              phone: user.phone,
              username: user.username,
              roleLabel: user.role === 'mca' ? 'MCA (Full Access)' : 'PA (Admin)'
            },
            sessionInfo: 'Only one browser session allowed. Previous sessions invalidated.'
          });
        }
      } catch (dbErr) {
        console.log('Database login failed, trying dev users:', dbErr.message);
      }
    }

    // Fallback to dev users
    const user = devUsers.find(u => u.name.toLowerCase() === username.toLowerCase() && verifyPin(pin, u.pin_hash));
    if (!user) {
      logger.warn(`Invalid credentials for username: ${username}`);
      return reply.status(401).send({ error: 'Invalid username or PIN' });
    }

    const token = req.server.jwt.sign({
      userId: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone
    });

    // Add session (invalidates any previous session)
    addSession(user.id, token);

    logger.info(`User ${user.name} (${user.role}) logged in - new session created`);
    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        roleLabel: user.role === 'super_admin' ? 'MCA (Full Access)' : 'PA (Admin)'
      },
      sessionInfo: 'Only one browser session allowed. Previous sessions invalidated.'
    });
  }

  // Production mode: check database using username AND verifyPin
  const db = getCloudDb();
  try {
    const res = await db.query('SELECT id, name, pin_hash, role, phone, username FROM admin_users WHERE LOWER(username) = LOWER($1)', [username]);
    if (res.rows.length === 0) {
      logger.warn(`Username not found: ${username}`);
      return reply.status(401).send({ error: 'Invalid username or PIN' });
    }

    // Verify PIN against the user's hash
    const user = res.rows[0];
    if (!verifyPin(pin, user.pin_hash)) {
      logger.warn(`Invalid PIN for username: ${username}`);
      return reply.status(401).send({ error: 'Invalid username or PIN' });
    }

    const token = req.server.jwt.sign({
      userId: user.id,
      role: user.role,
      name: user.name
    });

    logger.info(`User ${user.name} (${user.role}) logged in`);
    return reply.send({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    logger.error('Login error:', err);
    return reply.status(500).send({ error: 'Login failed' });
  }
}

async function handleGetAnnouncements(req, reply) {
  // Dev mode: return dev data
  if (process.env.NODE_ENV === 'development') {
    return reply.send(devAnnouncements);
  }

  const db = getCloudDb();
  try {
    const res = await db.query('SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC');
    return reply.send(res.rows);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleGetIssues(req, reply) {
  // Dev mode: return dev data
  if (process.env.NODE_ENV === 'development') {
    return reply.send(devIssues);
  }

  const db = getCloudDb();
  try {
    const res = await db.query(`
      SELECT id, ticket, category, message, phone_number, full_name, status, created_at 
      FROM issues 
      ORDER BY created_at DESC
    `);
    return reply.send(res.rows);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleCreateAnnouncement(req, reply) {
  const { title, body } = req.body;

  // Dev mode: add to dev data
  if (process.env.NODE_ENV === 'development') {
    const newAnnouncement = {
      id: devAnnouncements.length + 1,
      title,
      body,
      created_at: new Date().toISOString()
    };
    devAnnouncements.unshift(newAnnouncement);
    return reply.status(201).send(newAnnouncement);
  }

  const db = getCloudDb();
  try {
    const res = await db.query(
      'INSERT INTO announcements (title, body) VALUES ($1, $2) RETURNING id, title, body, created_at',
      [title, body]
    );
    return reply.status(201).send(res.rows[0]);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleDeleteAnnouncement(req, reply) {
  const { id } = req.params;

  // Dev mode: remove from dev data
  if (process.env.NODE_ENV === 'development') {
    devAnnouncements = devAnnouncements.filter(a => a.id !== parseInt(id));
    return reply.send({ success: true });
  }

  const db = getCloudDb();
  try {
    await db.query('DELETE FROM announcements WHERE id = $1', [id]);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleCreateIssue(req, reply) {
  const { category, message, phone_number } = req.body;

  // Dev mode: add to dev data
  if (process.env.NODE_ENV === 'development') {
    const ticket = `ISS-${String(devIssues.length + 1).padStart(3, '0')}`;
    const newIssue = {
      id: devIssues.length + 1,
      ticket,
      category,
      message,
      phone_number,
      status: 'open',
      source: 'Dashboard',
      comments: [],
      created_at: new Date().toISOString()
    };
    devIssues.unshift(newIssue);
    return reply.status(201).send(newIssue);
  }

  const db = getCloudDb();
  try {
    const ticketRes = await db.query('SELECT COUNT(*) as count FROM issues');
    const ticket = `ISS-${String(ticketRes.rows[0].count + 1).padStart(3, '0')}`;

    const res = await db.query(
      'INSERT INTO issues (ticket, category, message, phone_number, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, ticket, category, message, phone_number, status, created_at',
      [ticket, category, message, phone_number, 'open']
    );
    return reply.status(201).send(res.rows[0]);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleUpdateIssueStatus(req, reply) {
  const { id } = req.params;
  const { status, comment } = req.body;

  // Validate status
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return reply.status(400).send({ error: 'Invalid status' });
  }

  // Dev mode: update dev data
  if (process.env.NODE_ENV === 'development') {
    const issue = devIssues.find(i => i.id === parseInt(id));
    if (!issue) {
      return reply.status(404).send({ error: 'Issue not found' });
    }
    issue.status = status;
    if (comment) {
      if (!issue.comments) issue.comments = [];
      issue.comments.push(comment);
    }
    return reply.send(issue);
  }

  const db = getCloudDb();
  try {
    const res = await db.query(
      'UPDATE issues SET status = $1 WHERE id = $2 RETURNING id, ticket, category, message, phone_number, status, created_at',
      [status, id]
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Issue not found' });
    }
    return reply.send(res.rows[0]);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleGetUsers(req, reply) {
  // Dev mode: return dev data (without pin_hash for security)
  if (process.env.NODE_ENV === 'development') {
    const db = getDb();
    if (db) {
      try {
        const res = await db.query('SELECT id, name, role, username, is_permanent, created_by, created_at FROM admin_users ORDER BY created_at DESC');
        return reply.send(res.rows);
      } catch (err) {
        console.log('Database error, falling back to dev data:', err.message);
        return reply.send(devUsers.map(u => ({ id: u.id, name: u.name, role: u.role, created_at: u.created_at })));
      }
    }
    return reply.send(devUsers.map(u => ({ id: u.id, name: u.name, role: u.role, created_at: u.created_at })));
  }

  const db = getCloudDb();
  try {
    const res = await db.query('SELECT id, name, role, username, is_permanent, created_by, created_at FROM admin_users ORDER BY created_at DESC');
    return reply.send(res.rows);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function handleCreateUser(req, reply) {
  const { name, pin, role } = req.body;

  if (!name || !pin || !role) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  if (!/^\d+$/.test(pin)) {
    return reply.status(400).send({ error: 'Password must contain only digits' });
  }

  // Only allow super_admin (MCA) and admin (PA) roles
  if (!['super_admin', 'admin'].includes(role)) {
    return reply.status(400).send({ error: 'Invalid role. Only super_admin (MCA) and admin (PA) allowed' });
  }

  // Dev mode: add to dev data
  if (process.env.NODE_ENV === 'development') {
    // Only super_admin (ZAK) can create users
    if (req.user.role !== 'super_admin') {
      return reply.status(403).send({
        error: 'Only ZAK (Super Admin) can add new users.'
      });
    }

    // ZAK can ONLY add ONE PA (admin role)
    // Cannot add another super_admin
    if (role === 'super_admin') {
      return reply.status(400).send({
        error: 'Cannot create another Super Admin. Only ZAK has full access.',
        hint: 'You can only add a PA (admin role)'
      });
    }

    // Check if PA already exists
    const existingPA = devUsers.find(u => u.role === 'admin');
    if (existingPA) {
      return reply.status(400).send({
        error: `A PA (Admin) already exists: ${existingPA.name}`,
        hint: 'Only ONE PA can be added. Delete the existing PA first if needed.'
      });
    }

    // LIMIT: Maximum 2 users total (ZAK + 1 PA)
    if (devUsers.length >= 2) {
      return reply.status(400).send({
        error: 'Maximum users reached: ZAK (Super Admin) + 1 PA (Admin)',
        current_users: devUsers.map(u => `${u.name} (${u.role})`)
      });
    }

    const pin_hash = hashPin(pin);

    // Save to database
    const db = getDb();
    try {
      const result = await db.query(
        'INSERT INTO admin_users (name, phone, pin_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, role, created_at',
        [name, pin, pin_hash, role]
      );

      const newUser = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        phone: result.rows[0].phone,
        pin_hash: pin_hash,
        role: result.rows[0].role,
        created_at: result.rows[0].created_at.toISOString()
      };

      // Add to memory
      devUsers.push(newUser);

      logger.info(`New PA created by ${req.user.name}: ${name} (${role})`);
      return reply.status(201).send({
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
        created_at: newUser.created_at,
        message: `PA "${name}" created successfully. They can login with PIN: ${pin}`
      });
    } catch (dbErr) {
      logger.error('Database error creating PA:', dbErr);
      return reply.status(500).send({ error: 'Failed to create PA account' });
    }
  }

  // Production mode
  const db = getCloudDb();
  try {
    // Only super_admin (ZAK) can create users
    if (req.user.role !== 'super_admin') {
      return reply.status(403).send({
        error: 'Only ZAK (Super Admin) can add new users.'
      });
    }

    // ZAK can ONLY add ONE PA (admin role)
    // Cannot add another super_admin
    if (role === 'super_admin') {
      return reply.status(400).send({
        error: 'Cannot create another Super Admin. Only ZAK has full access.',
        hint: 'You can only add a PA (admin role)'
      });
    }

    // Check if PA already exists
    const existingPA = await db.query('SELECT name FROM admin_users WHERE role = $1', ['admin']);
    if (existingPA.rows.length > 0) {
      return reply.status(400).send({
        error: `A PA (Admin) already exists: ${existingPA.rows[0].name}`,
        hint: 'Only ONE PA can be added. Delete the existing PA first if needed.'
      });
    }

    // Check total user count (should be max 2: ZAK + 1 PA)
    const countRes = await db.query('SELECT COUNT(*) as count FROM admin_users');
    if (countRes.rows[0].count >= 2) {
      return reply.status(400).send({
        error: 'Maximum users reached: ZAK (Super Admin) + 1 PA (Admin)'
      });
    }

    const hashedPin = hashPin(pin);
    const username = name.toLowerCase(); // Create username from name
    const res = await db.query(
      'INSERT INTO admin_users (name, pin_hash, role, phone, username, created_by, is_permanent) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, role, phone, username, created_at',
      [name, hashedPin, role, pin, username, req.user.name, false]
    );
    logger.info(`New PA created by ${req.user.name}: ${name} (${role})`);
    return reply.status(201).send({
      ...res.rows[0],
      message: `PA "${name}" created successfully. They can login with username: ${username}, PIN: ${pin}`
    });
  } catch (err) {
    logger.error('Create user error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

async function handleDeleteUser(req, reply) {
  const { id } = req.params;
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;

  // Only super_admin (MCA) can delete users
  if (requestingUserRole !== 'super_admin') {
    return reply.status(403).send({
      error: 'Only the MCA (Super Admin) can delete user accounts.'
    });
  }

  // Cannot delete yourself
  if (parseInt(id) === requestingUserId) {
    return reply.status(400).send({
      error: 'You cannot delete your own account.'
    });
  }

  // Dev mode: remove from dev data AND database
  if (process.env.NODE_ENV === 'development') {
    const userToDelete = devUsers.find(u => u.id === parseInt(id));
    if (!userToDelete) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Delete from database
    const db = getDb();
    try {
      await db.query('DELETE FROM admin_users WHERE id = $1', [id]);
    } catch (dbErr) {
      logger.error('Database error deleting PA:', dbErr);
      return reply.status(500).send({ error: 'Failed to delete PA account' });
    }

    // Remove from memory
    devUsers = devUsers.filter(u => u.id !== parseInt(id));
    logger.info(`User deleted by ${req.user.name}: ${userToDelete.name} (${userToDelete.role})`);
    return reply.send({ success: true, message: `${userToDelete.name} deleted successfully` });
  }

  const db = getCloudDb();
  try {
    const userCheck = await db.query('SELECT name, role FROM admin_users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await db.query('DELETE FROM admin_users WHERE id = $1', [id]);
    logger.info(`User deleted by ${req.user.name}: ${userCheck.rows[0].name} (${userCheck.rows[0].role})`);
    return reply.send({ success: true, message: `${userCheck.rows[0].name} deleted successfully` });
  } catch (err) {
    logger.error('Delete user error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

// PUBLIC ENDPOINT: Citizens can send messages without authentication
async function handleCreateCitizenMessage(req, reply) {
  const { name, phone_number, subject, message } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return reply.status(400).send({ error: 'Name is required' });
  }

  if (!phone_number || phone_number.length < 10) {
    return reply.status(400).send({ error: 'Valid phone number is required (10 digits)' });
  }

  if (!subject || !subject.trim()) {
    return reply.status(400).send({ error: 'Subject is required' });
  }

  if (!message || !message.trim()) {
    return reply.status(400).send({ error: 'Message is required' });
  }

  // Dev mode: add to in-memory store
  if (process.env.NODE_ENV === 'development') {
    const newMessage = {
      id: devCitizenMessages.length + 1,
      name: name.trim(),
      phone_number: phone_number.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'unread',
      created_at: new Date().toISOString()
    };
    devCitizenMessages.push(newMessage);
    logger.info(`New citizen message from ${name}: ${subject}`);
    return reply.status(201).send({
      success: true,
      message: 'Your message has been sent to the MCA office. You will receive a response soon.',
      ticket_id: `MSG-${String(newMessage.id).padStart(3, '0')}`
    });
  }

  // Production mode: save to database
  const db = getCloudDb();
  try {
    const res = await db.query(
      `INSERT INTO citizen_messages (name, phone_number, subject, message, status) 
       VALUES ($1, $2, $3, $4, 'unread') 
       RETURNING id, name, phone_number, subject, message, status, created_at`,
      [name.trim(), phone_number.trim(), subject.trim(), message.trim()]
    );
    logger.info(`New citizen message from ${name}: ${subject}`);
    return reply.status(201).send({
      success: true,
      message: 'Your message has been sent to the MCA office. You will receive a response soon.',
      ticket_id: `MSG-${String(res.rows[0].id).padStart(3, '0')}`
    });
  } catch (err) {
    logger.error('Create citizen message error:', err);
    return reply.status(500).send({ error: 'Failed to send message. Please try again.' });
  }
}

// ADMIN ENDPOINT: Get all citizen messages (requires authentication)
async function handleGetCitizenMessages(req, reply) {
  // Dev mode: return in-memory data
  if (process.env.NODE_ENV === 'development') {
    return reply.send(devCitizenMessages.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    ));
  }

  // Production mode: fetch from database
  const db = getCloudDb();
  try {
    const res = await db.query(`
      SELECT id, name, phone_number, subject, message, status, created_at 
      FROM citizen_messages 
      ORDER BY created_at DESC
    `);
    return reply.send(res.rows);
  } catch (err) {
    logger.error('Get citizen messages error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

// ADMIN ENDPOINT: Mark citizen message as read/replied
async function handleUpdateCitizenMessageStatus(req, reply) {
  const { id } = req.params;
  const { status, admin_reply } = req.body;

  if (!status || !['unread', 'read', 'replied'].includes(status)) {
    return reply.status(400).send({ error: 'Invalid status. Must be: unread, read, or replied' });
  }

  // Dev mode: update in-memory data
  if (process.env.NODE_ENV === 'development') {
    const message = devCitizenMessages.find(m => m.id === parseInt(id));
    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }
    message.status = status;
    if (admin_reply) {
      message.admin_reply = admin_reply.trim();
      message.replied_at = new Date().toISOString();
      message.replied_by = req.user.name;
    }
    logger.info(`Citizen message ${id} marked as ${status} by ${req.user.name}`);
    return reply.send(message);
  }

  // Production mode: update database
  const db = getCloudDb();
  try {
    let query, params;
    if (admin_reply) {
      query = `UPDATE citizen_messages 
               SET status = $1, admin_reply = $2, replied_at = NOW(), replied_by = $3 
               WHERE id = $4 
               RETURNING *`;
      params = [status, admin_reply.trim(), req.user.name, id];
    } else {
      query = `UPDATE citizen_messages 
               SET status = $1 
               WHERE id = $2 
               RETURNING *`;
      params = [status, id];
    }
    const res = await db.query(query, params);
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Message not found' });
    }
    logger.info(`Citizen message ${id} marked as ${status} by ${req.user.name}`);
    return reply.send(res.rows[0]);
  } catch (err) {
    logger.error('Update citizen message error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

// Export handlers for CSV downloads
async function handleExportConstituents(req, reply) {
  logger.info('Export constituents requested');

  // Dev mode: return sample data
  if (process.env.NODE_ENV === 'development') {
    const csv = 'Phone Number,National ID,Full Name,Area,Registered At\n' +
      '+254712345678,12345678,John Doe,Nairobi,2025-01-01T10:00:00Z\n' +
      '+254723456789,23456789,Jane Smith,Mombasa,2025-01-02T11:00:00Z';
    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="constituents.csv"')
      .send(csv);
  }

  // Production mode: query database
  const db = getCloudDb();
  try {
    const res = await db.query('SELECT phone_number, national_id, full_name, first_name, middle_name, last_name, location, sublocation, village, created_at FROM constituents ORDER BY created_at DESC');

    let csv = 'Phone Number,National ID,Full Name,First Name,Middle Name,Last Name,Location,Sub-Location,Village,Registered At\n';
    for (const row of res.rows) {
      csv += `${row.phone_number},"${row.national_id}","${row.full_name}","${row.first_name}","${row.middle_name}","${row.last_name}","${row.location}","${row.sublocation || ''}","${row.village}",${row.created_at}\n`;
    }

    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="constituents.csv"')
      .send(csv);
  } catch (err) {
    logger.error('Export constituents error:', err);
    return reply.status(500).send({ error: 'Export failed' });
  }
}

async function handleExportIssues(req, reply) {
  logger.info('Export issues requested');

  // Dev mode: return sample data
  if (process.env.NODE_ENV === 'development') {
    const csv = 'Ticket,Category,Message,Phone Number,Status,Source,Created At\n' +
      'ISS-001,Infrastructure,Pothole on main street,0712345678,open,Dashboard,2025-01-01T10:00:00Z\n' +
      'ISS-002,Water,No water supply in zone B,0787654321,in_progress,Dashboard,2025-01-02T11:00:00Z';
    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="issues.csv"')
      .send(csv);
  }

  // Production mode: query database
  const db = getCloudDb();
  try {
    const res = await db.query('SELECT ticket, category, message, phone_number, status, source, created_at FROM issues ORDER BY created_at DESC');

    let csv = 'Ticket,Category,Message,Phone Number,Status,Source,Created At\n';
    for (const row of res.rows) {
      // Escape quotes in message
      const message = row.message.replace(/"/g, '""');
      csv += `"${row.ticket}","${row.category}","${message}","${row.phone_number}","${row.status}","${row.source}",${row.created_at}\n`;
    }

    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="issues.csv"')
      .send(csv);
  } catch (err) {
    logger.error('Export issues error:', err);
    return reply.status(500).send({ error: 'Export failed' });
  }
}

async function handleExportBursaries(req, reply) {
  logger.info('Export bursaries requested');

  // Dev mode: return sample data
  if (process.env.NODE_ENV === 'development') {
    const csv = 'Constituent Phone,Student Name,Institution,Amount Requested,Status,Created At\n' +
      '+254712345678,Mary Wanjiru,Nairobi University,50000,pending,2025-01-01T10:00:00Z\n' +
      '+254723456789,James Kamau,Mombasa College,30000,approved,2025-01-02T11:00:00Z';
    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="bursaries.csv"')
      .send(csv);
  }

  // Production mode: query database
  const db = getCloudDb();
  try {
    const res = await db.query(`
      SELECT c.phone_number, b.student_name, b.institution_name, b.amount_requested, b.status, b.created_at
      FROM bursaries b
      LEFT JOIN constituents c ON b.constituent_id = c.id
      ORDER BY b.created_at DESC
    `);

    let csv = 'Constituent Phone,Student Name,Institution,Amount Requested,Status,Created At\n';
    for (const row of res.rows) {
      csv += `"${row.phone_number || 'N/A'}","${row.student_name}","${row.institution_name}",${row.amount_requested},"${row.status}",${row.created_at}\n`;
    }

    return reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename="bursaries.csv"')
      .send(csv);
  } catch (err) {
    logger.error('Export bursaries error:', err);
    return reply.status(500).send({ error: 'Export failed' });
  }
}

async function handleGetConstituents(req, reply) {
  logger.info('Get constituents requested');

  // Dev mode: return dev data
  if (process.env.NODE_ENV === 'development') {
    return reply.send(devConstituents);
  }

  // Query database
  const db = getDb();
  if (!db) {
    return reply.send([]); // Return empty array in dev mode if DB not connected
  }

  try {
    const res = await db.query('SELECT id, phone_number, national_id, full_name, first_name, middle_name, last_name, location, sublocation, village, verification_status, verified_by, verified_at, created_at FROM constituents ORDER BY created_at DESC');
    return reply.send(res.rows);
  } catch (err) {
    logger.error('Get constituents error:', err);
    return reply.send([]); // Return empty array on error
  }
}

async function handleGetBursaryApplications(req, reply) {
  logger.info('Get bursary applications requested');

  // Dev mode: return dev data
  if (process.env.NODE_ENV === 'development') {
    return reply.send(devBursaryApplications);
  }

  // Query database for bursary applications
  const db = getDb();
  if (!db) {
    return reply.send([]); // Return empty array in dev mode if DB not connected
  }

  try {
    const res = await db.query(`
      SELECT 
        ba.id,
        ba.ref_code,
        ba.application_number,
        ba.phone_number,
        ba.category,
        ba.student_name,
        ba.institution,
        ba.amount_requested,
        ba.status,
        ba.created_at,
        c.full_name as applicant_name,
        c.location as applicant_location
      FROM bursary_applications ba
      LEFT JOIN constituents c ON ba.phone_number = c.phone_number
      ORDER BY ba.created_at DESC
    `);
    return reply.send(res.rows);
  } catch (err) {
    logger.error('Get bursary applications error:', err);
    return reply.send([]); // Return empty array on error
  }
}

async function handleUpdateBursaryStatus(req, reply) {
  const { id } = req.params;
  const { status, admin_notes } = req.body;

  // Validate status
  if (!['Pending', 'Under Review', 'Approved', 'Rejected', 'Disbursed'].includes(status)) {
    return reply.status(400).send({ error: 'Invalid status' });
  }

  const db = getDb();
  if (!db) {
    return reply.status(503).send({ error: 'Database not connected' });
  }

  try {
    let query, params;
    if (admin_notes) {
      query = `UPDATE bursary_applications 
               SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW() 
               WHERE id = $4 
               RETURNING *`;
      params = [status, admin_notes.trim(), req.user.name, id];
    } else {
      query = `UPDATE bursary_applications 
               SET status = $1, reviewed_by = $2, reviewed_at = NOW() 
               WHERE id = $3 
               RETURNING *`;
      params = [status, req.user.name, id];
    }

    const res = await db.query(query, params);
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Bursary application not found' });
    }

    logger.info(`Bursary application ${id} updated to ${status} by ${req.user.name}`);
    return reply.send(res.rows[0]);
  } catch (err) {
    logger.error('Update bursary status error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

async function handleVerifyConstituent(req, reply) {
  const { id } = req.params;
  const { verification_status, rejection_reason } = req.body;

  // Validate status
  if (!['pending', 'verified', 'rejected'].includes(verification_status)) {
    return reply.status(400).send({ error: 'Invalid verification status' });
  }

  const db = getDb();
  if (!db) {
    return reply.status(503).send({ error: 'Database not connected' });
  }

  try {
    let query, params;
    if (verification_status === 'rejected' && rejection_reason) {
      query = `UPDATE constituents 
               SET verification_status = $1, rejection_reason = $2, verified_by = $3, verified_at = NOW() 
               WHERE id = $4 
               RETURNING *`;
      params = [verification_status, rejection_reason.trim(), req.user.name, id];
    } else {
      query = `UPDATE constituents 
               SET verification_status = $1, verified_by = $2, verified_at = NOW() 
               WHERE id = $3 
               RETURNING *`;
      params = [verification_status, req.user.name, id];
    }

    const res = await db.query(query, params);
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Constituent not found' });
    }

    logger.info(`Constituent ${id} ${verification_status} by ${req.user.name}`);
    return reply.send(res.rows[0]);
  } catch (err) {
    logger.error('Verify constituent error:', err);
    return reply.status(500).send({ error: err.message });
  }
}

async function handleForgotPassword(req, reply) {
  const { identifier } = req.body; // username or phone

  if (!identifier) {
    return reply.status(400).send({ error: 'Username or phone number is required' });
  }

  logger.info(`Forgot password request for: ${identifier}`);

  // Dev mode: simulate success
  if (process.env.NODE_ENV === 'development') {
    const user = devUsers.find(u =>
      u.name.toLowerCase() === identifier.toLowerCase() ||
      u.phone === identifier
    );

    if (!user) {
      // Security: don't reveal user existence
      return reply.send({
        success: true,
        message: 'If an account exists, a reset code has been sent.'
      });
    }

    // Generate mock token
    const resetToken = 'RESET-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    logger.info(`[DEV] Reset token for ${user.name}: ${resetToken}`);

    return reply.send({
      success: true,
      message: 'Reset code sent successfully (Check console in dev mode)',
      dev_token: resetToken // Only for dev convenience
    });
  }

  const db = getCloudDb();
  try {
    const res = await db.query(
      'SELECT id, name, phone FROM admin_users WHERE LOWER(username) = LOWER($1) OR phone = $1',
      [identifier]
    );

    if (res.rows.length === 0) {
      return reply.send({
        success: true,
        message: 'If an account exists, a reset code has been sent.'
      });
    }

    const user = res.rows[0];
    const resetToken = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store token in DB (assuming a password_resets table or similar, but for now we'll just log it as requested)
    // Ideally: await db.query('INSERT INTO password_resets ...')

    // For this implementation without email service:
    logger.info(`[RESET] Token for ${user.name} (${user.phone}): ${resetToken}`);

    return reply.send({
      success: true,
      message: 'Reset code has been generated. Please contact the system administrator.'
    });

  } catch (err) {
    logger.error('Forgot password error:', err);
    return reply.status(500).send({ error: 'Request failed' });
  }
}

async function handleResetPassword(req, reply) {
  const { token, new_pin } = req.body;

  if (!token || !new_pin) {
    return reply.status(400).send({ error: 'Token and new PIN are required' });
  }

  if (new_pin.length !== 6 || !/^\d+$/.test(new_pin)) {
    return reply.status(400).send({ error: 'PIN must be exactly 6 digits' });
  }

  // Dev mode: accept any token starting with RESET-
  if (process.env.NODE_ENV === 'development') {
    if (!token.startsWith('RESET-')) {
      return reply.status(400).send({ error: 'Invalid reset token' });
    }

    // Update ZAK's pin for demo purposes if it matches
    // In real dev flow, we'd track the token to the user
    logger.info(`[DEV] Password reset with token ${token} to PIN ${new_pin}`);
    return reply.send({ success: true, message: 'Password reset successfully. Please login with your new PIN.' });
  }

  // Production: Verify token logic would go here
  // For now, since we don't have a token store, we'll return a placeholder error
  return reply.status(501).send({ error: 'Password reset verification not fully implemented without email service.' });
}

async function handleSocialLogin(req, reply) {
  const { provider, profile_id, name, email } = req.body;

  if (!provider || !profile_id || !name) {
    return reply.status(400).send({ error: 'Missing social profile information' });
  }

  logger.info(`Social login attempt: ${provider} - ${name}`);

  // Dev mode
  if (process.env.NODE_ENV === 'development') {
    // Simulate finding or creating user
    let user = devUsers.find(u => u.social_id === profile_id);

    if (!user) {
      // Create new social user
      user = {
        id: devUsers.length + 1,
        name: name,
        role: 'admin', // Default to PA role
        phone: '000000', // Placeholder
        username: name.replace(/\s+/g, '').toLowerCase(),
        social_id: profile_id,
        social_provider: provider,
        created_at: new Date().toISOString()
      };
      devUsers.push(user);
      logger.info(`Created new dev user from social login: ${name}`);
    }

    const token = req.server.jwt.sign({
      userId: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone
    });

    addSession(user.id, token);

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        username: user.username,
        roleLabel: 'PA (Social Login)'
      }
    });
  }

  const db = getCloudDb();
  try {
    // Check if user exists by social_id
    // Note: Schema update might be needed to add social_id/provider columns
    // For now, we'll simulate by checking name match or creating new

    // This is a simplified flow. In production, you'd alter table to add social columns.
    // await db.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS social_id VARCHAR(255)');

    // Fallback logic for demo:
    return reply.status(200).send({
      token: 'SOCIAL-DEMO-TOKEN',
      user: {
        id: 999,
        name: name,
        role: 'admin',
        roleLabel: 'PA (Social Demo)'
      }
    });

  } catch (err) {
    logger.error('Social login error:', err);
    return reply.status(500).send({ error: 'Social login failed' });
  }
}

module.exports = {
  handleLogin,
  handleForgotPassword,
  handleResetPassword,
  handleSocialLogin,
  handleGetAnnouncements,
  handleGetIssues,
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
  handleCreateIssue,
  handleUpdateIssueStatus,
  handleGetUsers,
  handleCreateUser,
  handleDeleteUser,
  handleCreateCitizenMessage,
  handleGetCitizenMessages,
  handleUpdateCitizenMessageStatus,
  handleExportConstituents,
  handleExportIssues,
  handleExportBursaries,
  handleGetConstituents,
  handleGetBursaryApplications,
  handleUpdateBursaryStatus,
  handleVerifyConstituent,
  handleLogout,
  addDevIssue // Export for USSD integration
};

// Logout handler
async function handleLogout(req, reply) {
  const userId = req.user.userId;
  removeSession(userId);
  logger.info(`User ${req.user.name} logged out - session terminated`);
  return reply.send({ success: true, message: 'Logged out successfully' });
}
