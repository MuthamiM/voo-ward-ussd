const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'voo_db',
  password: '23748124',
  port: 5432
});

async function insertZAK() {
  try {
    // Check if ZAK exists
    const check = await pool.query('SELECT * FROM admin_users WHERE phone = $1', ['827700']);
    
    if (check.rows.length > 0) {
      console.log('✓ ZAK already exists in database');
      console.table(check.rows);
      await pool.end();
      return;
    }
    
    // Insert ZAK
    const result = await pool.query(
      'INSERT INTO admin_users (name, phone, pin_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      ['ZAK', '827700', '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q', 'super_admin']
    );
    
    console.log('✓ ZAK inserted successfully:');
    console.table(result.rows);
    
    await pool.end();
  } catch (err) {
    console.error('✗ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

insertZAK();
