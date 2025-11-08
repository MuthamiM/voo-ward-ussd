-- Migration: Add index on audit_events for performance
-- Run: psql -U postgres -d voo_db -f db/migrations/002_audit_index.sql

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);

-- Create index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events(event_type);

-- Create index on phone_number for user activity lookups
CREATE INDEX IF NOT EXISTS idx_audit_phone ON audit_events(phone_number);

COMMENT ON INDEX idx_audit_created IS 'Index for time-based audit queries';
COMMENT ON INDEX idx_audit_event_type IS 'Index for filtering by event type';
COMMENT ON INDEX idx_audit_phone IS 'Index for user activity lookups';
