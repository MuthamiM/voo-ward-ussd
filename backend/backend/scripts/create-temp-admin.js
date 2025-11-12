const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set');
  process.exit(1);
}

(async function(){
  try{
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const url = new URL(MONGO_URI);
    const dbName = (url.pathname || '').replace(/^\//,'') || 'voo_ward';
    const db = client.db(dbName);

    const username = 'testadmin';
    const password = 'admin1234';
    const hash = bcrypt.hashSync(password, 10);

    const existing = await db.collection('admin_users').findOne({ username });
    if (existing) {
      await db.collection('admin_users').updateOne({ _id: existing._id }, { $set: { password: hash, full_name: 'Test Admin', role: 'MCA', updated_at: new Date() } });
      console.log('Updated existing test admin:', username);
    } else {
      const res = await db.collection('admin_users').insertOne({ username, password: hash, full_name: 'Test Admin', role: 'MCA', created_at: new Date() });
      console.log('Created test admin with id:', res.insertedId.toString());
    }

    await client.close();
    console.log('Test admin ready. username=testadmin password=admin1234');
  }catch(e){
    console.error('Error creating test admin:', e && e.message);
    process.exit(1);
  }
})();
