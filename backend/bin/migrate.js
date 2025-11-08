#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const DB_URL = process.env.DB_URL || 'postgresql://voo_user:change_me@db:5432/voo_db';

async function runMigrations() {
  const client = new pg.Client(DB_URL);
  
  try {
    console.log('DB_URL:', DB_URL);
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected!');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/cloud/01_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migrations...');
    await client.query(sql);
    console.log('Migrations completed successfully!');
    
    // Seed initial data
    console.log('Seeding initial data...');
    
    const bcrypt = require('bcrypt');
    const hashedPin = await bcrypt.hash('123456', 12);
    
    await client.query(
      'INSERT INTO admin_users (name, pin_hash, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      ['Admin', hashedPin, 'super_admin']
    );
    
    console.log('Database ready!');
    
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
