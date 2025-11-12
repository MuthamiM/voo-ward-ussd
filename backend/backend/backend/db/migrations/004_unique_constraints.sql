-- Add unique constraints for members table
-- Ensures one phone can only register once and national IDs are unique

-- Add unique constraint on phone
CREATE UNIQUE INDEX IF NOT EXISTS ux_members_phone ON members(phone);

-- Add unique constraint on national_id  
CREATE UNIQUE INDEX IF NOT EXISTS ux_members_national_id ON members(national_id);

-- Add comment
COMMENT ON INDEX ux_members_phone IS 'Ensures one phone number can only register once';
COMMENT ON INDEX ux_members_national_id IS 'Ensures national IDs are unique across all members';
