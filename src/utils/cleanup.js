// AUTO-CLEANUP SYSTEM FOR RESOLVED ISSUES
// Automatically deletes resolved issues after 10 days

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Run daily (24 hours)
const RETENTION_DAYS = 10; // Keep resolved issues for 10 days

/**
 * Delete resolved issues older than 10 days
 * @param {Object} db - Database connection (PostgreSQL)
 * @param {Array} inMemoryIssues - In-memory issues array (development mode)
 * @returns {Object} Cleanup statistics
 */
async function cleanupResolvedIssues(db = null, inMemoryIssues = null) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const stats = {
    deleted: 0,
    errors: 0,
    cutoffDate: cutoffDate.toISOString(),
    timestamp: new Date().toISOString()
  };

  try {
    // PRODUCTION MODE: PostgreSQL cleanup
    if (db) {
      const result = await db.query(`
        DELETE FROM issues 
        WHERE status = 'resolved' 
        AND resolved_at < $1
        RETURNING id, type, location, resolved_at
      `, [cutoffDate]);
      
      stats.deleted = result.rowCount;
      stats.deletedIssues = result.rows;
      
      console.log(`🧹 Auto-cleanup: Deleted ${stats.deleted} resolved issues older than ${RETENTION_DAYS} days`);
      
      if (stats.deleted > 0) {
        // Log cleanup activity to audit table
        await db.query(`
          INSERT INTO audit_logs (action, details, timestamp)
          VALUES ('auto_cleanup', $1, NOW())
        `, [JSON.stringify(stats)]);
      }
    }
    
    // DEVELOPMENT MODE: In-memory cleanup
    else if (inMemoryIssues && Array.isArray(inMemoryIssues)) {
      const originalLength = inMemoryIssues.length;
      
      // Filter out old resolved issues
      const filtered = inMemoryIssues.filter(issue => {
        if (issue.status === 'resolved' && issue.resolved_at) {
          const resolvedDate = new Date(issue.resolved_at);
          return resolvedDate > cutoffDate;
        }
        return true; // Keep all non-resolved issues
      });
      
      stats.deleted = originalLength - filtered.length;
      
      // Update the array in place
      inMemoryIssues.length = 0;
      inMemoryIssues.push(...filtered);
      
      console.log(`🧹 Auto-cleanup (dev): Deleted ${stats.deleted} resolved issues older than ${RETENTION_DAYS} days`);
    }
    
  } catch (error) {
    stats.errors++;
    stats.error = error.message;
    console.error('❌ Auto-cleanup error:', error);
  }
  
  return stats;
}

/**
 * Delete resolved water issues specifically
 * @param {Object} db - Database connection
 * @param {Array} inMemoryIssues - In-memory issues array
 * @returns {Object} Cleanup statistics
 */
async function cleanupResolvedWaterIssues(db = null, inMemoryIssues = null) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const stats = {
    deleted: 0,
    errors: 0,
    type: 'water',
    cutoffDate: cutoffDate.toISOString(),
    timestamp: new Date().toISOString()
  };

  try {
    // PRODUCTION MODE
    if (db) {
      const result = await db.query(`
        DELETE FROM issues 
        WHERE type = 'water' 
        AND status = 'resolved' 
        AND resolved_at < $1
        RETURNING id, location, resolved_at, description
      `, [cutoffDate]);
      
      stats.deleted = result.rowCount;
      stats.deletedIssues = result.rows;
      
      console.log(`💧 Water cleanup: Deleted ${stats.deleted} resolved water issues`);
    }
    
    // DEVELOPMENT MODE
    else if (inMemoryIssues && Array.isArray(inMemoryIssues)) {
      const originalLength = inMemoryIssues.length;
      
      const filtered = inMemoryIssues.filter(issue => {
        if (issue.type === 'water' && issue.status === 'resolved' && issue.resolved_at) {
          const resolvedDate = new Date(issue.resolved_at);
          return resolvedDate > cutoffDate;
        }
        return true;
      });
      
      stats.deleted = originalLength - filtered.length;
      
      inMemoryIssues.length = 0;
      inMemoryIssues.push(...filtered);
      
      console.log(`💧 Water cleanup (dev): Deleted ${stats.deleted} resolved water issues`);
    }
    
  } catch (error) {
    stats.errors++;
    stats.error = error.message;
    console.error('❌ Water cleanup error:', error);
  }
  
  return stats;
}

/**
 * Start automatic cleanup scheduler
 * Runs daily to clean up old resolved issues
 * @param {Object} db - Database connection
 * @param {Array} inMemoryIssues - In-memory issues array
 */
function startAutoCleanup(db = null, inMemoryIssues = null) {
  console.log(`🕒 Auto-cleanup scheduler started (runs every 24 hours)`);
  console.log(`📅 Retention period: ${RETENTION_DAYS} days for resolved issues`);
  
  // Run cleanup immediately on startup
  cleanupResolvedIssues(db, inMemoryIssues);
  
  // Schedule daily cleanup
  const interval = setInterval(() => {
    cleanupResolvedIssues(db, inMemoryIssues);
  }, CLEANUP_INTERVAL);
  
  // Return interval ID so it can be cleared if needed
  return interval;
}

/**
 * Manual cleanup trigger (for admin dashboard)
 * @param {Object} db - Database connection
 * @param {Array} inMemoryIssues - In-memory issues array
 * @returns {Object} Cleanup statistics
 */
async function manualCleanup(db = null, inMemoryIssues = null) {
  console.log('🧹 Manual cleanup triggered by admin');
  return await cleanupResolvedIssues(db, inMemoryIssues);
}

/**
 * Get cleanup preview (what would be deleted)
 * @param {Object} db - Database connection
 * @param {Array} inMemoryIssues - In-memory issues array
 * @returns {Object} Preview data
 */
async function getCleanupPreview(db = null, inMemoryIssues = null) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const preview = {
    cutoffDate: cutoffDate.toISOString(),
    retentionDays: RETENTION_DAYS,
    issuesAffected: []
  };

  try {
    // PRODUCTION MODE
    if (db) {
      const result = await db.query(`
        SELECT id, type, location, status, resolved_at, 
               EXTRACT(DAY FROM (NOW() - resolved_at)) as days_since_resolved
        FROM issues 
        WHERE status = 'resolved' 
        AND resolved_at < $1
        ORDER BY resolved_at ASC
      `, [cutoffDate]);
      
      preview.issuesAffected = result.rows;
      preview.count = result.rowCount;
    }
    
    // DEVELOPMENT MODE
    else if (inMemoryIssues && Array.isArray(inMemoryIssues)) {
      preview.issuesAffected = inMemoryIssues.filter(issue => {
        if (issue.status === 'resolved' && issue.resolved_at) {
          const resolvedDate = new Date(issue.resolved_at);
          if (resolvedDate < cutoffDate) {
            const daysSince = Math.floor((Date.now() - resolvedDate.getTime()) / (1000 * 60 * 60 * 24));
            return { ...issue, days_since_resolved: daysSince };
          }
        }
        return false;
      });
      
      preview.count = preview.issuesAffected.length;
    }
    
  } catch (error) {
    preview.error = error.message;
  }
  
  return preview;
}

/**
 * Archive resolved issues instead of deleting
 * Moves issues to archive table (production only)
 * @param {Object} db - Database connection
 */
async function archiveResolvedIssues(db) {
  if (!db) {
    throw new Error('Archive requires database connection');
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  try {
    // Create archive table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS issues_archive (
        LIKE issues INCLUDING ALL,
        archived_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Move old resolved issues to archive
    const result = await db.query(`
      WITH moved AS (
        DELETE FROM issues 
        WHERE status = 'resolved' 
        AND resolved_at < $1
        RETURNING *
      )
      INSERT INTO issues_archive 
      SELECT *, NOW() as archived_at FROM moved
      RETURNING id
    `, [cutoffDate]);
    
    console.log(`📦 Archived ${result.rowCount} resolved issues`);
    
    return {
      archived: result.rowCount,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Archive error:', error);
    throw error;
  }
}

module.exports = {
  cleanupResolvedIssues,
  cleanupResolvedWaterIssues,
  startAutoCleanup,
  manualCleanup,
  getCleanupPreview,
  archiveResolvedIssues,
  RETENTION_DAYS,
  CLEANUP_INTERVAL
};
