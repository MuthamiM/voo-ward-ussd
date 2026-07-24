require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL in env.");
    // try to read .env if exist?
  }
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query('SELECT id, name, username, phone, role FROM admin_users');
    console.table(res.rows);
  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await pool.end();
  }
}
main();
