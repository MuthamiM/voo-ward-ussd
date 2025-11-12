const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'voo_db',
  password: '23748124',
  port: 5432
});

async function runMigration() {
  try {
    // Check if table exists
    const check = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users' 
      ORDER BY ordinal_position
    `);
    
    if (check.rows.length > 0) {
      console.log('✓ admin_users table already exists with columns:');
      check.rows.forEach(r => console.log(`    ${r.column_name} (${r.data_type})`));
      pool.end();
      return;
    }
    
    // Run migration
    const sql = fs.readFileSync('db/migrations/006_create_admin_users.sql', 'utf8');
    await pool.query(sql);
    console.log('✓ Migration completed successfully');
    console.log('✓ admin_users table created');
    console.log('✓ ZAK account inserted');
    
  } catch (err) {
    console.error('✗ Migration error:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

runMigration();
