require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) return console.error('MONGO_URI not set in env');
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const url = new URL(uri);
    const dbName = (url.pathname || '').replace(/^\//, '') || 'voo_ward';
    const db = client.db(dbName);
    const users = db.collection('admin_users');
    const admin = await users.findOne({ username: 'admin' });
    if (!admin) {
      console.log('No admin user found; inserting default admin');
      const res = await users.insertOne({ username: 'admin', password: bcrypt.hashSync('admin123', 10), full_name: 'Zak', role: 'MCA', created_at: new Date() });
      console.log('Inserted admin id', res.insertedId.toString());
    } else {
      const newHash = bcrypt.hashSync('admin123', 10);
      await users.updateOne({ _id: admin._id }, { $set: { password: newHash, updated_at: new Date() } });
      console.log('Updated admin password to admin123 for user', admin.username);
    }
  } catch (e) {
    console.error('Error:', e && e.message);
  } finally {
    await client.close();
  }
})();
