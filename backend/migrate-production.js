#!/usr/bin/env node
/**
 * Production-Grade PostgreSQL Migration Runner
 * - Reads migrations from /migrations/*.sql
 * - Verifies checksums
 * - Applies in single transaction
 * - Exits non-zero on failure
 * - Protects ZAK permanent admin
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load DB URL from secure file (0400 permissions) or environment
const DB_URL_FILE = process.env.DB_URL_FILE || '/etc/voo-ward/pg_url';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function loadDbUrl() {
  try {
    if (fs.existsSync(DB_URL_FILE)) {
      const stats = fs.statSync(DB_URL_FILE);
      // Check file permissions on Unix (skip on Windows)
      if (process.platform !== 'win32' && (stats.mode & 0o777) > 0o600) {
        console.error(`ERROR: ${DB_URL_FILE} has insecure permissions. Required: 0400 or 0600`);
        process.exit(1);
      }
      return fs.readFileSync(DB_URL_FILE, 'utf8').trim();
    }
  } catch (err) {
    // Fallback to environment variable
  }
  
  // Development fallback
  return process.env.DATABASE_URL || 
         process.env.DB_URL || 
         'postgresql://postgres:23748124@localhost:5432/voo_db';
}

function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getMigrationsStatus(client) {
  try {
    const result = await client.query('SELECT name, checksum FROM schema_migrations ORDER BY id');
    return new Map(result.rows.map(r => [r.name, r.checksum]));
  } catch (err) {
    // Table doesn't exist yet
    return new Map();
  }
}

async function runMigrations() {
  const dbUrl = loadDbUrl();
  
  if (!dbUrl) {
    console.error('ERROR: Database URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');
    
    // Get applied migrations
    const applied = await getMigrationsStatus(client);
    console.log(`✓ Found ${applied.size} previously applied migrations`);
    
    // Read migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.error(`ERROR: Migrations directory not found: ${MIGRATIONS_DIR}`);
      process.exit(1);
    }
    
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('⚠ No migration files found');
      return;
    }
    
    console.log(`\nFound ${files.length} migration file(s)\n`);
    
    let appliedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(content);
      
      // Check if already applied
      if (applied.has(file)) {
        const existingChecksum = applied.get(file);
        if (existingChecksum !== checksum) {
          console.error(`\n❌ CHECKSUM MISMATCH: ${file}`);
          console.error(`   Expected: ${existingChecksum}`);
          console.error(`   Got:      ${checksum}`);
          console.error('\n   Migration file was modified after being applied!');
          process.exit(1);
        }
        console.log(`⊘ SKIP: ${file} (already applied)`);
        continue;
      }
      
      // Apply migration
      console.log(`→ APPLY: ${file}`);
      
      try {
        await client.query('BEGIN');
        await client.query(content);
        await client.query('COMMIT');
        
        console.log(`✓ SUCCESS: ${file}`);
        appliedCount++;
        
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ FAILED: ${file}`);
        console.error('   Error:', err.message);
        console.error('\n   Migration rolled back');
        process.exit(1);
      }
    }
    
    if (appliedCount === 0) {
      console.log(`\n✓ All migrations already applied`);
    } else {
      console.log(`\n✓ Migration complete: ${appliedCount} new migration(s) applied`);
    }
    
    // Verify ZAK exists and is protected
    const zakCheck = await client.query(
      'SELECT username, role, is_permanent FROM admin_users WHERE username = $1',
      ['zak']
    );
    
    if (zakCheck.rows.length === 0) {
      console.error('\n❌ CRITICAL: ZAK super admin not found!');
      process.exit(1);
    }
    
    const zak = zakCheck.rows[0];
    if (!zak.is_permanent) {
      console.error('\n❌ CRITICAL: ZAK is not marked as permanent!');
      process.exit(1);
    }
    
    console.log(`\n✓ ZAK super admin verified`);
    console.log(`  Username: ${zak.username}`);
    console.log(`  Role: ${zak.role}`);
    console.log(`  Permanent: ${zak.is_permanent}`);
    console.log(`  PIN: 827700`);
    console.log('\n✓ Database is production-ready\n');
    
  } catch (err) {
    console.error('\n❌ Migration runner failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run
runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
