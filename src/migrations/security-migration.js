const { Client } = require('pg');

async function runSecurityMigration() {
  const client = new Client(process.env.DB_URL || 'postgresql://postgres:23748124@localhost:5432/voo_db');
  
  try {
    await client.connect();
    console.log('[INFO] Connected to database for security migration');
    
    // Enhance existing audit log table with security columns
    await client.query(`
      ALTER TABLE audit_log 
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS username VARCHAR(100),
      ADD COLUMN IF NOT EXISTS endpoint VARCHAR(200),
      ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'INFO';
    `);
    console.log('[SUCCESS] Security columns added to audit_log table');
    
    // Create indexes for security queries
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type) WHERE event_type IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_ip ON audit_log(ip_address) WHERE ip_address IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity) WHERE severity IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username) WHERE username IS NOT NULL;'
    ];
    
    for (const query of indexQueries) {
      try {
        await client.query(query);
      } catch (error) {
        console.log(`[INFO] Index might already exist: ${error.message}`);
      }
    }
    console.log('[SUCCESS] Security indexes created');
    
    // Add encryption columns to constituents  
    await client.query(`
      ALTER TABLE constituents 
      ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS id_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS data_retention_date TIMESTAMP;
    `);
    console.log('[SUCCESS] Constituent encryption columns added');
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_constituents_retention ON constituents(data_retention_date);');
    console.log('[SUCCESS] Retention index created');
    
    // Add enhanced admin security columns
    await client.query(`
      ALTER TABLE admin_users 
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('[SUCCESS] Enhanced admin security columns added');
    
    // Add security settings table
    const securitySettingsQuery = `
      CREATE TABLE IF NOT EXISTS security_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL,
        updated_by VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT INTO security_settings (setting_key, setting_value, updated_by) 
      VALUES 
        ('rate_limiting', '{"enabled": true, "max_requests_per_hour": 1000}', 'system'),
        ('ip_blocking', '{"enabled": true, "max_failures": 10, "block_duration_hours": 24}', 'system'),
        ('encryption', '{"enabled": true, "algorithm": "AES-256-GCM"}', 'system')
      ON CONFLICT (setting_key) DO NOTHING;
    `;
    
    await client.query(securitySettingsQuery);
    console.log('[SUCCESS] Security settings table created');
    
    console.log('[SUCCESS] Security database migration completed successfully');
    
  } catch (error) {
    console.error('[ERROR] Database migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runSecurityMigration().catch(console.error);
}

module.exports = { runSecurityMigration };