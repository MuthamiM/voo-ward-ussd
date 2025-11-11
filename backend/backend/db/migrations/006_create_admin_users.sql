-- Migration: Create admin_users table for persistent PA accounts
-- Date: 2025-11-02
-- Description: Store admin users (ZAK + PA) in database instead of memory

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_phone ON admin_users(phone);

-- Insert ZAK (MCA) as default super_admin
-- PIN: 827700, Hash: $2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q
INSERT INTO admin_users (name, phone, pin_hash, role) 
VALUES ('ZAK', '827700', '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q', 'super_admin')
ON CONFLICT (phone) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_admin_users_updated_at();
