const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function fixMartin() {
  const connectionString = 'postgresql://postgres:23748124@localhost:5432/voo_db';
  const pool = new Pool({ connectionString });
  
  try {
    const hash = await bcrypt.hash('Martin@21', 10);
    // Find martin
    const res = await pool.query("SELECT * FROM admin_users WHERE username = 'martin' OR name = 'Martin'");
    if (res.rows.length === 0) {
      console.log("Martin not found! Inserting...");
      await pool.query(
        "INSERT INTO admin_users (username, name, phone, pin_hash, role, is_permanent) VALUES ($1, $2, $3, $4, $5, $6)",
        ['martin', 'Martin', '0700000000', hash, 'mca', true]
      );
      console.log("Inserted martin with Martin@21");
    } else {
      console.log("Martin found, updating password to Martin@21");
      const id = res.rows[0].id;
      await pool.query("UPDATE admin_users SET pin_hash = $1, username = 'martin' WHERE id = $2", [hash, id]);
      console.log("Updated martin successfully");
    }
  } catch (err) {
    console.error("DB Error stack:", err.stack);
    console.error("DB Error raw:", err);
  } finally {
    await pool.end();
  }
}
fixMartin();
