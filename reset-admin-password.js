require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
console.log('MongoDB URI:', uri ? 'Found (hidden)' : 'NOT FOUND');

async function resetAdminPassword() {
  if (!uri) {
    console.log('ERROR: No MONGO_URI or MONGODB_URI found in environment');
    return;
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();
    
    // Hash the new password
    const newHash = await bcrypt.hash('admin123', 10);
    
    // Update admin password
    const result = await db.collection('admin_users').updateOne(
      { username: 'admin' },
      { $set: { password: newHash } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Password reset successfully!');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('⚠️  Admin user not modified - checking users...');
      
      // List all admin users
      const users = await db.collection('admin_users').find({}).toArray();
      console.log('\nExisting admin users:');
      users.forEach(u => {
        console.log(`  - Username: ${u.username}, Role: ${u.role}, Name: ${u.full_name}`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

resetAdminPassword();
