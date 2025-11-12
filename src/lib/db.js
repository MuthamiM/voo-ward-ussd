const pg = require('pg');

let cloudPool = null;
let devPool = null;

/**
 * Initialize PostgreSQL connection pool with optimized settings
 * Uses connection pooling for better performance and concurrency
 */
async function initCloudDb(url) {
  cloudPool = new pg.Pool({
    connectionString: url,
    // Connection pool settings for better performance
    max: 20,                    // Maximum number of clients in pool
    min: 2,                     // Minimum number of clients to keep
    idleTimeoutMillis: 30000,   // Close idle clients after 30s
    connectionTimeoutMillis: 5000, // Fail fast if can't get connection
    allowExitOnIdle: false,     // Keep pool alive
  });

  // Test connection
  const client = await cloudPool.connect();
  client.release();
  
  return cloudPool;
}

/**
 * Initialize development database (local PostgreSQL)
 */
async function initDevDb() {
  if (devPool) return devPool;
  
  devPool = new pg.Pool({
    connectionString: 'postgresql://postgres:23748124@localhost:5432/voo_db',
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false,
  });

  try {
    // Test connection
    const client = await devPool.connect();
    client.release();
    return devPool;
  } catch (err) {
    console.error('Dev DB connection failed:', err.message);
    devPool = null;
    return null;
  }
}

/**
 * Get the database pool (supports concurrent queries)
 */
function getCloudDb() { 
  return cloudPool; 
}

/**
 * Get development database pool
 */
function getDb() {
  return cloudPool || devPool;
}

/**
 * Close all database connections
 */
async function closeAll() {
  if (cloudPool) {
    await cloudPool.end();
    cloudPool = null;
  }
  if (devPool) {
    await devPool.end();
    devPool = null;
  }
}

module.exports = { initCloudDb, initDevDb, getCloudDb, getDb, closeAll };
