// Inserts an example issue into the `issues` collection for testing
// Usage: set MONGO_URI environment variable, then run `node insert-example-issue.js`

const { MongoClient } = require('mongodb');

async function main() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set. Set MONGO_URI and retry.');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const url = new URL(MONGO_URI);
    const dbName = (url.pathname || '').replace(/^\//, '') || 'voo_ward';
    const db = client.db(dbName);

    const ticket = 'TICK-' + Date.now();
    const issue = {
      ticket,
      category: 'Roads',
      message: 'Example: Pothole near main junction. Please inspect.',
      phone_number: '0722000000',
      status: 'open',
      created_at: new Date()
    };

    const res = await db.collection('issues').insertOne(issue);
    console.log('✅ Inserted example issue');
    console.log('  _id:', res.insertedId.toString());
    console.log('  ticket:', ticket);
    console.log('You can now update this issue using the admin API: PATCH /api/admin/issues/:ticket');
  } catch (err) {
    console.error('Error inserting example issue:', err && err.message);
    process.exit(2);
  } finally {
    await client.close();
  }
}

main();
