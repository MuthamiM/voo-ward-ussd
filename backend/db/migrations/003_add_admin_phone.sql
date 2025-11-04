-- Add phone column to admin_users table
-- This allows tracking admin user phone numbers

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_phone ON admin_users(phone);

-- Add comment
COMMENT ON COLUMN admin_users.phone IS 'Admin user phone number for contact and identification';
