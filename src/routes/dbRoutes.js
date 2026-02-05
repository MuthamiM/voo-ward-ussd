const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../services/postgresDataService');

router.post('/users', async (req, res) => {
  try {
    const { full_name, phone, id_number, password_hash, village, username, email } = req.body;
    
    const existing = await queryOne(
      'SELECT id FROM app_users WHERE phone = $1 OR (id_number IS NOT NULL AND id_number = $2)',
      [phone, id_number]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Phone or ID already registered' });
    }

    const result = await query(
      `INSERT INTO app_users (full_name, phone, id_number, password_hash, village, username, email, is_verified, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, NOW()) RETURNING *`,
      [full_name, phone, id_number, password_hash, village, username || phone.replace('+254', ''), email]
    );

    res.status(201).json({ success: true, user: result[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/users/reset-password', async (req, res) => {
  try {
    const { phone, id_number, password_hash } = req.body;
    
    const user = await queryOne(
      'SELECT id FROM app_users WHERE phone = $1 AND id_number = $2',
      [phone, id_number]
    );
    
    if (!user) {
      return res.status(400).json({ error: 'Phone and ID do not match' });
    }

    await query('UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await queryOne('SELECT * FROM app_users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const fields = Object.keys(req.body).map((k, i) => `${k} = $${i+1}`).join(', ');
    const values = Object.values(req.body);
    values.push(req.params.id);
    await query(`UPDATE app_users SET ${fields}, updated_at = NOW() WHERE id = $${values.length}`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await query('DELETE FROM app_users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/issues', async (req, res) => {
  try {
    const { user_id } = req.query;
    let sql = 'SELECT * FROM issues';
    const params = [];
    if (user_id) {
      sql += ' WHERE user_id = $1';
      params.push(user_id);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const issues = await query(sql, params);
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get issues' });
  }
});

router.post('/issues', async (req, res) => {
  try {
    const { user_id, issue_number, title, category, description, location, images, status } = req.body;
    const result = await query(
      `INSERT INTO issues (user_id, issue_number, title, category, description, location, images, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [user_id, issue_number, title, category, description, location, JSON.stringify(images || []), status || 'pending']
    );
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

router.delete('/issues/:id', async (req, res) => {
  try {
    await query('DELETE FROM issues WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/bursaries', async (req, res) => {
  try {
    const { user_id } = req.query;
    let sql = 'SELECT * FROM bursary_applications';
    const params = [];
    if (user_id) {
      sql += ' WHERE user_id = $1';
      params.push(user_id);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const apps = await query(sql, params);
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

router.post('/bursaries', async (req, res) => {
  try {
    const { user_id, application_number, institution_name, course, year_of_study, institution_type, amount_requested, reason, status } = req.body;
    const result = await query(
      `INSERT INTO bursary_applications (user_id, application_number, institution_name, course, year_of_study, institution_type, amount_requested, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
      [user_id, application_number, institution_name, course, year_of_study, institution_type, amount_requested, reason, status || 'pending']
    );
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Create bursary error:', err);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const announcements = await query(
      "SELECT * FROM announcements WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY priority DESC, created_at DESC LIMIT 20"
    );
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

router.get('/emergency-contacts', async (req, res) => {
  try {
    const contacts = await query(
      "SELECT * FROM emergency_contacts WHERE is_active = true ORDER BY display_order"
    );
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await query("SELECT * FROM app_config");
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

router.get('/config/:key', async (req, res) => {
  try {
    const config = await queryOne("SELECT * FROM app_config WHERE key = $1", [req.params.key]);
    res.json(config || { key: req.params.key, value: null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

router.post('/lost-ids', async (req, res) => {
  try {
    const { report_number, reporter_name, id_owner_name, id_number, reporter_phone, additional_info, status } = req.body;
    const result = await query(
      `INSERT INTO lost_ids (report_number, reporter_name, id_owner_name, id_number, reporter_phone, additional_info, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [report_number, reporter_name, id_owner_name, id_number, reporter_phone, additional_info, status || 'pending']
    );
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Create lost ID error:', err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { message, user_id } = req.body;
    const result = await query(
      `INSERT INTO app_feedback (message, user_id, created_at) VALUES ($1, $2, NOW()) RETURNING *`,
      [message, user_id]
    );
    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.post('/yps-photos', async (req, res) => {
  try {
    const { user_id, device_id, file_name, local_path, captured_at } = req.body;
    const result = await query(
      `INSERT INTO yps_photos (user_id, device_id, file_name, local_path, captured_at, synced_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [user_id, device_id, file_name, local_path, captured_at]
    );
    res.status(201).json({ success: true, photo: result[0] });
  } catch (err) {
    console.error('YPS photo error:', err);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

module.exports = router;
