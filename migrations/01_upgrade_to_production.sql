-- ================================================
-- MIGRATION: 01_upgrade_to_production.sql
-- PURPOSE: Upgrade existing schema to production-grade
-- AUTHOR: System
-- DATE: 2025
-- ================================================

BEGIN;

-- ============================================
-- 1. CREATE EXTENSIONS (idempotent)
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 2. CREATE ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE issue_category AS ENUM('water', 'health', 'security', 'road', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM('new', 'ack', 'resolved', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM('planned', 'ongoing', 'completed', 'halted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bursary_stage AS ENUM('submitted', 'under_review', 'shortlisted', 'approved', 'disbursed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verify_status AS ENUM('pending', 'verified', 'rejected', 'needs_review');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM('clerk', 'mca', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. DROP CONFLICTING TRIGGERS AND CONSTRAINTS
-- ============================================

-- Drop existing update triggers to avoid conflicts
DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON admin_users;
DROP TRIGGER IF EXISTS trigger_constituents_updated_at ON constituents;
DROP TRIGGER IF EXISTS trigger_issues_updated_at ON issues;

-- Drop the functions as well
DROP FUNCTION IF EXISTS update_admin_users_updated_at();
DROP FUNCTION IF EXISTS update_constituents_updated_at();
DROP FUNCTION IF EXISTS update_issues_updated_at();

-- Drop the old role constraint (will replace with enum)
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS valid_role;

-- ============================================
-- 4. UPGRADE ADMIN_USERS TABLE
-- ============================================

-- Add username column if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'username'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN username VARCHAR(50);
    
    -- Migrate existing 'name' to 'username' (lowercase)
    UPDATE admin_users SET username = LOWER(TRIM(name));
    
    ALTER TABLE admin_users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX idx_admin_users_username ON admin_users(username);
  END IF;
END $$;

-- Add is_permanent column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'is_permanent'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN is_permanent BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Extend pin_hash column to hold bcrypt hashes (60 chars)
DO $$ BEGIN
  ALTER TABLE admin_users ALTER COLUMN pin_hash TYPE VARCHAR(255);
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Change role to use enum
DO $$ BEGIN
  -- First, ensure all roles are valid enum values
  -- Map old roles to new enum values
  UPDATE admin_users SET role = CASE
    WHEN role = 'super_admin' THEN 'mca'
    WHEN role = 'viewer' THEN 'clerk'
    WHEN role NOT IN ('clerk', 'mca', 'admin') THEN 'admin'
    ELSE role
  END;
  
  -- Alter column to use enum
  ALTER TABLE admin_users 
    ALTER COLUMN role TYPE user_role USING role::user_role;
EXCEPTION
  WHEN others THEN 
    -- If already enum type, ignore
    NULL;
END $$;

-- Add constraints
DO $$ BEGIN
  ALTER TABLE admin_users ADD CONSTRAINT chk_username_length CHECK (LENGTH(username) >= 3);
  ALTER TABLE admin_users ADD CONSTRAINT chk_username_format CHECK (username ~ '^[a-z0-9]+$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 5. INSERT ZAK SUPER ADMIN
-- ============================================

-- Insert or update ZAK
INSERT INTO admin_users (username, name, pin_hash, role, is_permanent, phone, created_at, updated_at)
VALUES (
  'zak',
  'ZAK',
  '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q', -- PIN: 827700
  'mca',
  TRUE,
  '827700',
  now(),
  now()
)
ON CONFLICT (username) DO UPDATE SET
  is_permanent = TRUE,
  role = 'mca'::user_role,
  updated_at = now();

-- Verify ZAK created
DO $$
DECLARE
  zak_count INT;
BEGIN
  SELECT COUNT(*) INTO zak_count FROM admin_users WHERE username = 'zak' AND is_permanent = TRUE;
  
  IF zak_count = 0 THEN
    RAISE EXCEPTION 'CRITICAL: ZAK super admin not created properly';
  ELSE
    RAISE NOTICE '✓ ZAK super admin verified: permanent=TRUE, role=mca';
  END IF;
END $$;

-- ============================================
-- 6. UPGRADE CONSTITUENTS TABLE
-- ============================================

-- Add id_no_hash column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'constituents' AND column_name = 'id_no_hash'
  ) THEN
    ALTER TABLE constituents ADD COLUMN id_no_hash VARCHAR(64);
    
    -- Migrate existing national_id to hash
    UPDATE constituents 
    SET id_no_hash = encode(digest(COALESCE(national_id, ''), 'sha256'), 'hex')
    WHERE national_id IS NOT NULL;
  END IF;
END $$;

-- Add id_last4 column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'constituents' AND column_name = 'id_last4'
  ) THEN
    ALTER TABLE constituents ADD COLUMN id_last4 VARCHAR(4);
    
    -- Extract last 4 digits from national_id
    UPDATE constituents 
    SET id_last4 = RIGHT(national_id, 4)
    WHERE national_id IS NOT NULL AND LENGTH(national_id) >= 4;
  END IF;
END $$;

-- Add phone_e164 column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'constituents' AND column_name = 'phone_e164'
  ) THEN
    ALTER TABLE constituents ADD COLUMN phone_e164 VARCHAR(20);
    
    -- Normalize existing phone numbers to E.164
    UPDATE constituents 
    SET phone_e164 = CASE
      WHEN phone_number LIKE '254%' THEN '+' || phone_number
      WHEN phone_number LIKE '0%' THEN '+254' || SUBSTRING(phone_number FROM 2)
      ELSE '+254' || phone_number
    END;
    
    ALTER TABLE constituents ALTER COLUMN phone_e164 SET NOT NULL;
  END IF;
END $$;

-- Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'constituents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE constituents ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Change verification_status to use enum
DO $$ BEGIN
  -- Map old values to new enum
  UPDATE constituents SET verification_status = CASE
    WHEN verification_status = 'verified' THEN 'verified'
    WHEN verification_status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END;
  
  -- Alter column to use enum
  ALTER TABLE constituents 
    ALTER COLUMN verification_status TYPE verify_status 
    USING verification_status::verify_status;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_constituents_phone_e164 ON constituents(phone_e164);
CREATE INDEX IF NOT EXISTS idx_constituents_id_hash ON constituents(id_no_hash);
CREATE INDEX IF NOT EXISTS idx_constituents_verify_status ON constituents(verification_status);

-- ============================================
-- 7. UPGRADE ISSUES TABLE
-- ============================================

-- Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE issues ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_ticket ON issues(ticket);

-- ============================================
-- 8. UPGRADE AUDIT_LOG TABLE
-- ============================================

-- Rename old audit_log if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'audit_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'entity'
  ) THEN
    ALTER TABLE audit_log RENAME TO audit_log_old;
  END IF;
END $$;

-- Create new audit_log table with production schema
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity VARCHAR(100) NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);

-- ============================================
-- 9. CREATE SCHEMA_MIGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 10. RECORD THIS MIGRATION
-- ============================================
INSERT INTO schema_migrations (name, checksum, applied_at)
VALUES (
  '01_upgrade_to_production.sql',
  encode(digest('01_upgrade_to_production_v1.0.0', 'sha256'), 'hex'),
  now()
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- FINAL VERIFICATION
-- ============================================
DO $$
DECLARE
  zak_record RECORD;
BEGIN
  SELECT username, role, is_permanent INTO zak_record
  FROM admin_users
  WHERE username = 'zak';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRITICAL: ZAK super admin not found after migration';
  END IF;
  
  IF zak_record.is_permanent <> TRUE THEN
    RAISE EXCEPTION 'CRITICAL: ZAK is not marked as permanent';
  END IF;
  
  IF zak_record.role <> 'mca' THEN
    RAISE EXCEPTION 'CRITICAL: ZAK role is not mca';
  END IF;
  
  RAISE NOTICE '✓ Migration complete: ZAK super admin (permanent=TRUE, role=mca)';
END $$;

COMMIT;
