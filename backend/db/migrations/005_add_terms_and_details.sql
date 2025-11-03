-- Add terms acceptance and enhanced member details
-- Ensures members consent to data sharing and stores complete registration info

-- Add new columns to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS middle_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS area_id INTEGER,
ADD COLUMN IF NOT EXISTS village TEXT,
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update full_name trigger to auto-generate from parts
CREATE OR REPLACE FUNCTION update_full_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_name IS NOT NULL AND NEW.middle_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name || ' ' || NEW.middle_name || ' ' || NEW.last_name;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_full_name ON members;
CREATE TRIGGER trg_update_full_name
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_full_name();

-- Add comments
COMMENT ON COLUMN members.terms_accepted IS 'User consent for data sharing - MCA access only';
COMMENT ON COLUMN members.terms_accepted_at IS 'Timestamp when terms were accepted during registration';
COMMENT ON COLUMN members.first_name IS 'First name (from 3-part name validation)';
COMMENT ON COLUMN members.middle_name IS 'Middle name (from 3-part name validation)';
COMMENT ON COLUMN members.last_name IS 'Surname/Last name (from 3-part name validation)';
COMMENT ON COLUMN members.village IS 'Village/sub-location within the area';
