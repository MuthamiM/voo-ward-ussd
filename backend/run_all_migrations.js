const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'voo_db',
  password: '23748124',
  port: 5432
});

const migrations = [
  '006_create_admin_users.sql',
  '007_create_areas.sql',
  '008_create_textbooks.sql',
  '009_create_audit_archive.sql'
];

async function runMigrations() {
  console.log('\n🔄 Running all missing migrations...\n');
  
  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'db', 'migrations', migration);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${migration} - file not found`);
      continue;
    }
    
    try {
      console.log(`📄 Running ${migration}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`✓ ${migration} completed successfully\n`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`✓ ${migration} - tables already exist (skipped)\n`);
      } else {
        console.error(`✗ ${migration} failed:`, err.message, '\n');
      }
    }
  }
  
  // Verify all tables
  console.log('📊 Verifying tables...\n');
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('✓ Database tables:');
    result.rows.forEach(r => console.log(`  - ${r.tablename}`));
    console.log('');
    
    // Check row counts
    const tables = ['admin_users', 'areas', 'members', 'issues', 'bursary_applications'];
    console.log('📈 Row counts:');
    for (const table of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  - ${table}: ${count.rows[0].count} rows`);
      } catch (err) {
        console.log(`  - ${table}: table not found`);
      }
    }
    
    console.log('\n✅ All migrations completed!\n');
  } catch (err) {
    console.error('Error verifying tables:', err.message);
  } finally {
    pool.end();
  }
}

runMigrations();
