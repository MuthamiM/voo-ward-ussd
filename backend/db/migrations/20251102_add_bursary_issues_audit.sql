-- Migration: Add bursary_applications, issues (new structure), and audit_events tables
-- Date: 2025-11-02
-- Database: voo_db (PostgreSQL)

-- 1) members table (if not exists) - referenced by bursary_applications
CREATE TABLE IF NOT EXISTS members(
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  national_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  area TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_national_id ON members(national_id);

-- Migrate existing constituents to members (if needed)
-- Note: constituents table has: phone_number, name, location (no national_id field yet)
-- We'll generate placeholder IDs for existing records
INSERT INTO members (phone, national_id, full_name, area, created_at)
SELECT 
  phone_number, 
  COALESCE(NULLIF(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), ''), '99999999') AS national_id,
  name, 
  location, 
  created_at
FROM constituents
WHERE phone_number NOT IN (SELECT phone FROM members)
ON CONFLICT (phone) DO NOTHING;

-- 2) bursary_applications table
CREATE TABLE IF NOT EXISTS bursary_applications(
  id SERIAL PRIMARY KEY,
  ref_code TEXT UNIQUE NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  admission_no TEXT NOT NULL,
  study_level TEXT NOT NULL CHECK (study_level IN ('Secondary','TVET','College','University','Other')),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2035),
  amount_requested INTEGER NOT NULL CHECK (amount_requested BETWEEN 500 AND 100000),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Under Review','Approved','Rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ba_member_created ON bursary_applications(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ba_status ON bursary_applications(status);
CREATE INDEX IF NOT EXISTS idx_ba_ref_code ON bursary_applications(ref_code);

-- 3) issues table (new structure for issue reporting)
CREATE TABLE IF NOT EXISTS issues_new(
  id SERIAL PRIMARY KEY,
  ref_code TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Registration','Application','Payments','Other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_issues_new_phone_created ON issues_new(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_new_ref_code ON issues_new(ref_code);
CREATE INDEX IF NOT EXISTS idx_issues_new_status ON issues_new(status);

-- 4) audit_events table
CREATE TABLE IF NOT EXISTS audit_events(
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  phone TEXT,
  ref_code TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_phone ON audit_events(phone);
CREATE INDEX IF NOT EXISTS idx_audit_events_ref_code ON audit_events(ref_code);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);

-- Note: Old 'issues' table remains for backward compatibility
-- New issue reports go to 'issues_new' table
