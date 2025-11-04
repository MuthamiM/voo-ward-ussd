-- Migration: Create audit and archive tables
-- Date: 2025-11-03
-- Description: Audit logging and issue archival system

-- Audit logs table for system actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  user_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Issues archive table for old/resolved issues
CREATE TABLE IF NOT EXISTS issues_archive (
  id INTEGER NOT NULL,
  ticket VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  message TEXT,
  phone_number VARCHAR(15),
  status VARCHAR(20),
  source VARCHAR(20),
  comments JSONB,
  created_at TIMESTAMP,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, archived_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_issues_archive_ticket ON issues_archive(ticket);
CREATE INDEX IF NOT EXISTS idx_issues_archive_archived_at ON issues_archive(archived_at DESC);
