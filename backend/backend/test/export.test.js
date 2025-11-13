const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

jest.setTimeout(20000);

let mongod;
let app;
let db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  // Point the admin app at the in-memory MongoDB
  process.env.MONGO_URI = uri;

  // Require app after setting MONGO_URI so it connects to the in-memory DB
  app = require('../src/admin-dashboard');

  // Wait for DB connection to be available via exported connectDB helper
  if (typeof app.connectDB === 'function') {
    db = await app.connectDB();
  } else {
    // fallback: try to get connection from mongodb native client in module (best-effort)
    throw new Error('admin-dashboard does not export connectDB');
  }

  // Ensure admin_users collection exists and create a test MCA user
  const usersCol = db.collection('admin_users');
  const hash = await bcrypt.hash('pass123', 10);
  await usersCol.insertOne({ username: 'testadmin', password: hash, full_name: 'Test Admin', role: 'MCA', created_at: new Date() });
});

afterAll(async () => {
  try { await mongod.stop(); } catch (e) { /* ignore */ }
});

test('issues export streams CSV and creates audit entry', async () => {
  // seed a couple of issues
  const issues = db.collection('issues');
  await issues.insertMany([
    { ticket: 'T1', category: 'cat1', message: 'hello', phone_number: '+100', status: 'open', created_at: new Date() },
    { ticket: 'T2', category: 'cat2', message: 'world', phone_number: '+101', status: 'resolved', created_at: new Date() }
  ]);

  // login to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'pass123' })
    .expect(200);

  expect(loginRes.body.token).toBeTruthy();
  const token = loginRes.body.token;

  const res = await request(app)
    .get('/api/admin/export?type=issues')
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res, cb) => { // collect raw buffer
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => cb(null, data));
    })
    .expect(200);

  expect(res.headers['content-type']).toMatch(/text\/csv/);
  const body = res.body.toString();
  // header + two tickets
  expect(body).toMatch(/Ticket,Category,Message,Phone,Status,Action By,Action At,Action Note,Created At/);
  expect(body).toMatch(/T1/);
  expect(body).toMatch(/T2/);

  // check audit entry
  const audit = await db.collection('admin_audit').findOne({ action: 'export', export_type: 'issues' });
  expect(audit).toBeTruthy();
  expect(audit.count).toBeGreaterThanOrEqual(2);
  expect(audit.performed_by).toBe('testadmin');
});
