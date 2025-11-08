-- Migration: User Preferences Table
-- Purpose: Store user language preferences for multilingual USSD
-- Run with: psql -h localhost -U postgres -d voo_db -f src/db/migrations/001_preferences.sql

-- Create preferences table
CREATE TABLE IF NOT EXISTS preferences (
    phone VARCHAR(15) PRIMARY KEY,
    lang VARCHAR(2) DEFAULT 'EN' CHECK (lang IN ('EN', 'SW')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_preferences_lang ON preferences(lang);

-- Insert default preference for testing
INSERT INTO preferences (phone, lang) VALUES ('254712345678', 'EN')
ON CONFLICT (phone) DO NOTHING;

-- Display table info
\d preferences

-- Success message
SELECT 
    'Preferences table created successfully!' as status,
    COUNT(*) as initial_rows
FROM preferences;
