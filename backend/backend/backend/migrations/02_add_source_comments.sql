-- Migration: Add source and comments fields to issues table
-- This supports tracking where issues come from (USSD, Dashboard, Web)
-- and allows MCA/PA to add comments to issues

-- Add source column to track issue origin
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'Dashboard';

-- Add comments column to store JSON array of comments
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- Create index for faster source filtering
CREATE INDEX IF NOT EXISTS idx_issues_source ON issues(source);

-- Update existing issues to have Dashboard as source
UPDATE issues SET source = 'Dashboard' WHERE source IS NULL;

-- Add check constraint for valid sources
ALTER TABLE issues DROP CONSTRAINT IF EXISTS valid_source;
ALTER TABLE issues ADD CONSTRAINT valid_source 
CHECK (source IN ('USSD', 'Dashboard', 'Web'));

-- Create citizen_messages table for web contact form
CREATE TABLE IF NOT EXISTS citizen_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'unread',
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for citizen messages
CREATE INDEX IF NOT EXISTS idx_citizen_messages_status ON citizen_messages(status);
CREATE INDEX IF NOT EXISTS idx_citizen_messages_created ON citizen_messages(created_at DESC);

-- Add constraint for valid message status
ALTER TABLE citizen_messages DROP CONSTRAINT IF EXISTS valid_message_status;
ALTER TABLE citizen_messages ADD CONSTRAINT valid_message_status 
CHECK (status IN ('unread', 'read', 'responded'));

COMMENT ON COLUMN issues.source IS 'Origin of issue: USSD (citizens dialing *340*75#), Dashboard (MCA/PA creating), Web (contact form)';
COMMENT ON COLUMN issues.comments IS 'Array of comment objects with admin_name, comment text, and timestamp';
COMMENT ON TABLE citizen_messages IS 'Messages submitted by citizens through web contact form';
