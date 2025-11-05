/**
 * Seed Users Script
 * Creates initial admin user in MongoDB
 * Run: node scripts/seed-users.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://VOOAPP:NeverBroke031@cluster0.lc9fktg.mongodb.net/voo_ward';

async function seedUsers() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    console.log('✅ Connected to MongoDB');
    
    // Check if admin exists
    const adminExists = await usersCollection.findOne({ username: 'admin' });
    
    if (adminExists) {
      console.log('⚠️  Admin user already exists');
      console.log('   Username: admin');
      console.log('   Role: MCA');
      return;
    }
    
    // Create admin user
    const adminUser = {
      username: 'admin',
      password: 'admin123', // Plain text for now
      fullName: 'MCA Administrator',
      role: 'MCA',
      createdAt: new Date()
    };
    
    const result = await usersCollection.insertOne(adminUser);
    
    console.log('✅ Admin user created successfully!');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: MCA');
    console.log('   ID:', result.insertedId);
    
    // Check if PA exists
    const paExists = await usersCollection.findOne({ username: 'pa' });
    
    if (!paExists) {
      const paUser = {
        username: 'pa',
        password: 'pa123',
        fullName: 'Personal Assistant',
        role: 'PA',
        createdAt: new Date()
      };
      
      const paResult = await usersCollection.insertOne(paUser);
      console.log('✅ PA user created successfully!');
      console.log('   Username: pa');
      console.log('   Password: pa123');
      console.log('   Role: PA');
      console.log('   ID:', paResult.insertedId);
    }
    
    // List all users
    const allUsers = await usersCollection.find({}).project({ password: 0 }).toArray();
    console.log('\n📋 All Users:');
    allUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.fullName}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n👋 Disconnected from MongoDB');
    }
  }
}

seedUsers();
