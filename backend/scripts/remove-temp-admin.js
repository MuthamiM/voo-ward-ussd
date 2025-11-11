const { MongoClient } = require('mongodb');
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

    // Remove any test admin accounts by username 'testadmin'
    const res = await db.collection('admin_users').deleteMany({ username: 'testadmin' });
    console.log('Removed testadmin count:', res.deletedCount);

    await client.close();
    process.exit(0);
  }catch(e){
    console.error('Error removing test admin:', e && e.message);
    process.exit(1);
  }
})();
