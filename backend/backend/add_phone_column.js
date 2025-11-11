const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'voo_db',
  password: '23748124',
  port: 5432
});

async function addPhoneColumn() {
  try {
    // Check if phone column exists
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users' AND column_name = 'phone'
    `);
    
    if (check.rows.length > 0) {
      console.log('✓ phone column already exists in admin_users table');
      await pool.end();
      return;
    }
    
    // Add phone column
    await pool.query("ALTER TABLE admin_users ADD COLUMN phone VARCHAR(20) UNIQUE NOT NULL DEFAULT '827700'");
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_users_phone ON admin_users(phone)');
    
    // Update ZAK's phone
    await pool.query('UPDATE admin_users SET phone = $1 WHERE role = $2', ['827700', 'super_admin']);
    
    console.log('✓ phone column added to admin_users table');
    console.log('✓ ZAK phone updated to 827700');
    
    await pool.end();
  } catch (err) {
    console.error('✗ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

addPhoneColumn();
