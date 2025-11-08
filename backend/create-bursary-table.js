const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:23748124@localhost:5432/voo_db'
});

async function alterBursaryTable() {
  try {
    console.log('\n🔧 Updating bursary_applications table...\n');
    
    // Add new columns if they don't exist
    const columns = [
      { name: 'phone_number', type: 'VARCHAR(20)' },
      { name: 'application_number', type: 'VARCHAR(20) UNIQUE' },
      { name: 'category', type: 'VARCHAR(50)' },
      { name: 'student_name', type: 'VARCHAR(100)' }
    ];
    
    for (const col of columns) {
      try {
        await pool.query(`ALTER TABLE bursary_applications ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`✅ Added/checked column: ${col.name}`);
      } catch (err) {
        console.log(`  Column ${col.name} might already exist`);
      }
    }
    
    // Check final structure
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'bursary_applications'
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal Table Structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
    });
    
    console.log('\n✅ Migration complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

alterBursaryTable();
