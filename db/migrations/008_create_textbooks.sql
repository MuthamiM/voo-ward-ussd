-- Migration: Create textbooks system tables
-- Date: 2025-11-03
-- Description: Textbook request, inventory, and shortage tracking

-- Textbook requests table
CREATE TABLE IF NOT EXISTS textbook_requests (
  id SERIAL PRIMARY KEY,
  ref_code VARCHAR(20) UNIQUE NOT NULL,
  phone_number VARCHAR(15) NOT NULL,
  student_name VARCHAR(200) NOT NULL,
  school_name VARCHAR(200) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  book_type VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Textbook inventory table
CREATE TABLE IF NOT EXISTS textbook_inventory (
  id SERIAL PRIMARY KEY,
  book_title VARCHAR(200) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  quantity_available INTEGER DEFAULT 0,
  quantity_allocated INTEGER DEFAULT 0,
  last_restocked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Book shortage reports table
CREATE TABLE IF NOT EXISTS book_shortage_reports (
  id SERIAL PRIMARY KEY,
  ref_code VARCHAR(20) UNIQUE NOT NULL,
  school_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(15) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  shortage_quantity INTEGER NOT NULL,
  urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'critical')),
  description TEXT,
  status VARCHAR(20) DEFAULT 'reported' CHECK (status IN ('reported', 'acknowledged', 'resolved')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_textbook_requests_phone ON textbook_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_textbook_requests_status ON textbook_requests(status);
CREATE INDEX IF NOT EXISTS idx_textbook_inventory_grade ON textbook_inventory(grade_level);
CREATE INDEX IF NOT EXISTS idx_book_shortage_reports_school ON book_shortage_reports(school_name);

-- Triggers to auto-update updated_at
CREATE OR REPLACE FUNCTION update_textbook_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_textbook_requests_updated_at
BEFORE UPDATE ON textbook_requests
FOR EACH ROW
EXECUTE FUNCTION update_textbook_requests_updated_at();

CREATE OR REPLACE FUNCTION update_textbook_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_textbook_inventory_updated_at
BEFORE UPDATE ON textbook_inventory
FOR EACH ROW
EXECUTE FUNCTION update_textbook_inventory_updated_at();

CREATE OR REPLACE FUNCTION update_book_shortage_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_book_shortage_reports_updated_at
BEFORE UPDATE ON book_shortage_reports
FOR EACH ROW
EXECUTE FUNCTION update_book_shortage_reports_updated_at();
