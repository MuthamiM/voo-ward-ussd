const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:23748124@localhost:5432/voo_db'
});

async function checkAndAddColumn() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if full_name column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'issues' AND column_name = 'full_name'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('❌ full_name column does NOT exist');
      console.log('➕ Adding full_name column...');
      
      await client.query(`
        ALTER TABLE issues 
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)
      `);
      
      console.log('✅ full_name column added!');
    } else {
      console.log('✅ full_name column already exists');
    }

    // Show current issues table structure
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'issues' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Issues table structure:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkAndAddColumn();
