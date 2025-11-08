const pg = require('pg');
const fs = require('fs');

async function checkAndMigrate() {
  const client = new pg.Client('postgresql://postgres:23748124@localhost:5432/voo_db');
  await client.connect();
  
  try {
    // Check if bursaries table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bursaries'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating bursaries table...');
      const sql = fs.readFileSync('migrations/002_create_bursary_tables.sql', 'utf8');
      // Only run the bursaries table creation, skip constituents (already exists)
      const bursarySQL = sql.split('CREATE TABLE IF NOT EXISTS bursaries')[1].split(';')[0];
      await client.query(`CREATE TABLE IF NOT EXISTS bursaries${bursarySQL};`);
      
      // Create indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bursaries_phone ON bursaries(phone_number);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bursaries_status ON bursaries(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bursaries_created ON bursaries(created_at DESC);`);
      
      console.log('✅ Bursaries table and indexes created successfully');
    } else {
      console.log('✅ Bursaries table already exists');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkAndMigrate();
