-- Migration: Create areas table for location management
-- Date: 2025-11-03
-- Description: Store ward areas/villages for constituent registration

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  population INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_areas_name ON areas(name);

-- Insert Kyamatu Ward areas
INSERT INTO areas (name, description) VALUES
  ('Ndili', 'Ndili area'),
  ('Katulani', 'Katulani area'),
  ('Kyamatu', 'Kyamatu central area'),
  ('Nzunguni', 'Nzunguni area'),
  ('Wikililye', 'Wikililye area'),
  ('Mbiuni', 'Mbiuni area'),
  ('Kasikeu', 'Kasikeu area'),
  ('Kwa Munyao', 'Kwa Munyao area'),
  ('Miandani', 'Miandani area'),
  ('Nguutani', 'Nguutani area')
ON CONFLICT (name) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_areas_updated_at
BEFORE UPDATE ON areas
FOR EACH ROW
EXECUTE FUNCTION update_areas_updated_at();
