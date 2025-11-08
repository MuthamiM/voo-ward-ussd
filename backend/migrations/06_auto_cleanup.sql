-- ============================================
-- AUTO-CLEANUP SYSTEM FOR RESOLVED ISSUES
-- Migration 06: Add resolved_at column and cleanup functions
-- ============================================

-- Add resolved_at column to issues table (if not exists)
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Add index for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_issues_resolved 
ON issues(status, resolved_at);

-- ============================================
-- CLEANUP FUNCTION: Delete old resolved issues
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_resolved_issues(retention_days INTEGER DEFAULT 10)
RETURNS TABLE(deleted_count INTEGER, deleted_ids INTEGER[]) AS $$
DECLARE
  cutoff_date TIMESTAMP;
  deleted_ids_array INTEGER[];
  deleted_count INTEGER;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old resolved issues and capture IDs
  WITH deleted AS (
    DELETE FROM issues 
    WHERE status = 'resolved' 
    AND resolved_at < cutoff_date
    AND resolved_at IS NOT NULL
    RETURNING id
  )
  SELECT array_agg(id), COUNT(*)::INTEGER
  INTO deleted_ids_array, deleted_count
  FROM deleted;
  
  -- Log cleanup activity
  IF deleted_count > 0 THEN
    INSERT INTO audit_logs (action, details, timestamp)
    VALUES (
      'auto_cleanup',
      jsonb_build_object(
        'deleted_count', deleted_count,
        'cutoff_date', cutoff_date,
        'retention_days', retention_days
      ),
      NOW()
    );
    
    RAISE NOTICE 'Cleaned up % resolved issues older than % days', deleted_count, retention_days;
  ELSE
    RAISE NOTICE 'No old resolved issues to clean up';
  END IF;
  
  -- Return results
  RETURN QUERY SELECT deleted_count, deleted_ids_array;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLEANUP FUNCTION: Water issues only
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_resolved_water_issues(retention_days INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date TIMESTAMP;
  deleted_count INTEGER;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  WITH deleted AS (
    DELETE FROM issues 
    WHERE type = 'water' 
    AND status = 'resolved' 
    AND resolved_at < cutoff_date
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-set resolved_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION set_resolved_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Set resolved_at when status changes to 'resolved'
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- Clear resolved_at if status changes from 'resolved' to something else
  IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_set_resolved_timestamp ON issues;

-- Create trigger
CREATE TRIGGER trigger_set_resolved_timestamp
BEFORE UPDATE ON issues
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION set_resolved_timestamp();

-- ============================================
-- SCHEDULED CLEANUP: pg_cron (Optional)
-- Requires pg_cron extension
-- ============================================

-- Uncomment if pg_cron is installed:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
-- SELECT cron.schedule(
--   'cleanup-resolved-issues',
--   '0 2 * * *',  -- Daily at 2 AM
--   'SELECT cleanup_old_resolved_issues(10);'
-- );

-- ============================================
-- VIEW: Issues pending cleanup
-- ============================================

CREATE OR REPLACE VIEW issues_pending_cleanup AS
SELECT 
  id,
  type,
  category,
  location,
  status,
  resolved_at,
  EXTRACT(DAY FROM (NOW() - resolved_at)) AS days_since_resolved,
  (10 - EXTRACT(DAY FROM (NOW() - resolved_at))) AS days_until_deletion
FROM issues
WHERE status = 'resolved'
AND resolved_at IS NOT NULL
ORDER BY resolved_at ASC;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON issues_pending_cleanup TO voo_user;
GRANT EXECUTE ON FUNCTION cleanup_old_resolved_issues(INTEGER) TO voo_user;
GRANT EXECUTE ON FUNCTION cleanup_resolved_water_issues(INTEGER) TO voo_user;

-- ============================================
-- TEST QUERIES
-- ============================================

-- Preview what will be deleted:
-- SELECT * FROM issues_pending_cleanup WHERE days_since_resolved > 10;

-- Manual cleanup (deletes issues older than 10 days):
-- SELECT * FROM cleanup_old_resolved_issues(10);

-- Cleanup only water issues:
-- SELECT cleanup_resolved_water_issues(10);

-- View audit log of cleanups:
-- SELECT * FROM audit_logs WHERE action = 'auto_cleanup' ORDER BY timestamp DESC;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- To undo this migration:
-- DROP VIEW IF EXISTS issues_pending_cleanup;
-- DROP TRIGGER IF EXISTS trigger_set_resolved_timestamp ON issues;
-- DROP FUNCTION IF EXISTS set_resolved_timestamp();
-- DROP FUNCTION IF EXISTS cleanup_old_resolved_issues(INTEGER);
-- DROP FUNCTION IF EXISTS cleanup_resolved_water_issues(INTEGER);
-- DROP INDEX IF EXISTS idx_issues_resolved;
-- ALTER TABLE issues DROP COLUMN IF EXISTS resolved_at;

COMMENT ON COLUMN issues.resolved_at IS 'Timestamp when issue was marked as resolved. Used for auto-cleanup after 10 days.';
COMMENT ON FUNCTION cleanup_old_resolved_issues IS 'Deletes resolved issues older than specified days (default 10). Returns count and IDs of deleted issues.';
COMMENT ON VIEW issues_pending_cleanup IS 'Shows resolved issues with days until auto-deletion';
