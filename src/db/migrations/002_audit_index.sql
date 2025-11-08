-- Migration: Audit Events Index
-- Purpose: Speed up audit log queries by date range
-- Run with: psql -h localhost -U postgres -d voo_db -f src/db/migrations/002_audit_index.sql

-- Check if audit_events table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'audit_events'
    ) THEN
        -- Create index on created_at for faster date range queries
        CREATE INDEX IF NOT EXISTS idx_audit_events_created_at 
        ON audit_events(created_at DESC);
        
        -- Create index on phone for faster user lookup
        CREATE INDEX IF NOT EXISTS idx_audit_events_phone 
        ON audit_events(phone);
        
        -- Create compound index for filtered exports
        CREATE INDEX IF NOT EXISTS idx_audit_events_phone_created_at 
        ON audit_events(phone, created_at DESC);
        
        RAISE NOTICE 'Audit indexes created successfully!';
    ELSE
        RAISE NOTICE 'audit_events table does not exist yet - indexes will be created later';
    END IF;
END $$;

-- Success message
SELECT 'Audit indexes migration completed!' as status;
