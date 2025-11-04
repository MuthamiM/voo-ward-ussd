-- Migration: Add preferences table for user language settings
-- Run: psql -U postgres -d voo_db -f db/migrations/001_preferences.sql

-- Create preferences table if not exists
CREATE TABLE IF NOT EXISTS preferences(
  phone TEXT PRIMARY KEY,
  lang TEXT NOT NULL CHECK (lang IN ('EN','SW')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on updated_at for cache refresh queries
CREATE INDEX IF NOT EXISTS idx_preferences_updated ON preferences(updated_at DESC);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_preferences_timestamp ON preferences;
CREATE TRIGGER trigger_preferences_timestamp
  BEFORE UPDATE ON preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_preferences_timestamp();

COMMENT ON TABLE preferences IS 'User language preferences for USSD sessions';
COMMENT ON COLUMN preferences.phone IS 'Phone number in E.164 format';
COMMENT ON COLUMN preferences.lang IS 'Language code: EN (English) or SW (Swahili)';
