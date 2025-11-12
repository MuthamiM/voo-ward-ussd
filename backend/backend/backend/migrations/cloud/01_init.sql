-- Voo Ward Platform - PostgreSQL Schema
-- Production cloud database schema

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  ticket VARCHAR(20) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  phone_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS constituents (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'planning',
  budget DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bursaries (
  id SERIAL PRIMARY KEY,
  student_name VARCHAR(255) NOT NULL,
  school VARCHAR(255),
  amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  admin_user_id INT REFERENCES admin_users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INT,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_created ON issues(created_at DESC);
CREATE INDEX idx_constituents_phone ON constituents(phone_number);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_audit_log_admin ON audit_log(admin_user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Constraints
ALTER TABLE issues ADD CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'resolved'));
ALTER TABLE admin_users ADD CONSTRAINT valid_role CHECK (role IN ('viewer', 'admin', 'super_admin'));
