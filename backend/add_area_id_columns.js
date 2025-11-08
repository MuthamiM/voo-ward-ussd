const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'voo_db',
  password: '23748124',
  port: 5432
});

async function addAreaIdColumn() {
  try {
    // Check if area_id column exists in constituents
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'constituents' AND column_name = 'area_id'
    `);
    
    if (check.rows.length === 0) {
      console.log('Adding area_id column to constituents table...');
      await pool.query(`
        ALTER TABLE constituents 
        ADD COLUMN area_id INTEGER REFERENCES areas(id)
      `);
      console.log('✓ area_id column added');
      
      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_constituents_area_id ON constituents(area_id)
      `);
      console.log('✓ Index created on area_id');
      
      // Update existing records if they have location set
      await pool.query(`
        UPDATE constituents 
        SET area_id = location::integer 
        WHERE location IS NOT NULL AND location ~ '^[0-9]+$'
      `);
      console.log('✓ Existing records updated');
    } else {
      console.log('✓ area_id column already exists');
    }
    
    // Check members table
    const membersCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'members' AND column_name = 'area_id'
    `);
    
    if (membersCheck.rows.length === 0) {
      console.log('Adding area_id column to members table...');
      await pool.query(`
        ALTER TABLE members 
        ADD COLUMN area_id INTEGER REFERENCES areas(id)
      `);
      console.log('✓ area_id column added to members');
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_members_area_id ON members(area_id)
      `);
      console.log('✓ Index created on members.area_id');
    } else {
      console.log('✓ members.area_id column already exists');
    }
    
    console.log('\n✅ Database schema updated successfully!');
  } catch (err) {
    console.error('✗ Error:', err.message);
  } finally {
    pool.end();
  }
}

addAreaIdColumn();
