-- Migration: Add recovery_points table
-- Date: 2025-12-08
-- Database: voo_db (PostgreSQL)

-- Recovery Points Table - tracks password/PIN reset attempts for members and admins
CREATE TABLE IF NOT EXISTS recovery_points (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
  recovery_type TEXT NOT NULL CHECK (recovery_type IN ('member_pin', 'admin_pin')),
  recovery_token TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recovery_points_phone ON recovery_points(phone);
CREATE INDEX IF NOT EXISTS idx_recovery_points_member_id ON recovery_points(member_id);
CREATE INDEX IF NOT EXISTS idx_recovery_points_admin_user_id ON recovery_points(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_points_status ON recovery_points(status);
CREATE INDEX IF NOT EXISTS idx_recovery_points_created ON recovery_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_points_expires ON recovery_points(expires_at);

-- Constraint: must have either member_id or admin_user_id based on type
ALTER TABLE recovery_points ADD CONSTRAINT chk_recovery_user CHECK (
  (recovery_type = 'member_pin' AND member_id IS NOT NULL) OR
  (recovery_type = 'admin_pin' AND admin_user_id IS NOT NULL)
);
