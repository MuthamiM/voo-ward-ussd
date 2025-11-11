const { Pool } = require('pg');

const db = new Pool({
  connectionString: 'postgresql://postgres:23748124@localhost:5432/voo_db'
});

async function addVerificationColumns() {
  try {
    console.log('Adding verification columns...');
    
    await db.query(`
      ALTER TABLE constituents 
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending'
    `);
    console.log('✅ verification_status column added');
    
    await db.query(`
      ALTER TABLE constituents 
      ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255)
    `);
    console.log('✅ verified_by column added');
    
    await db.query(`
      ALTER TABLE constituents 
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ
    `);
    console.log('✅ verified_at column added');
    
    await db.query(`
      ALTER TABLE constituents 
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
    console.log('✅ rejection_reason column added');
    
    console.log('\n✅ All verification columns added successfully!');
    db.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    db.end();
  }
}

addVerificationColumns();
