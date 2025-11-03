-- ============================================
-- TEXTBOOK DISTRIBUTION SYSTEM DATABASE
-- Migration 05: Textbook Tracking Tables
-- ============================================

-- Drop tables if they exist (for clean migrations)
DROP TABLE IF EXISTS book_shortage_reports CASCADE;
DROP TABLE IF EXISTS textbook_requests CASCADE;
DROP TABLE IF EXISTS textbook_inventory CASCADE;

-- ============================================
-- TABLE 1: Textbook Inventory
-- Tracks available books in ward storage
-- ============================================
CREATE TABLE textbook_inventory (
  id SERIAL PRIMARY KEY,
  book_title VARCHAR(200) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  class_level VARCHAR(50) NOT NULL,
  publisher VARCHAR(200),
  total_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  damaged_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_quantities CHECK (
    total_quantity >= 0 AND 
    available_quantity >= 0 AND 
    reserved_quantity >= 0 AND 
    damaged_quantity >= 0
  )
);

-- Index for fast lookups
CREATE INDEX idx_textbook_subject ON textbook_inventory(subject);
CREATE INDEX idx_textbook_class ON textbook_inventory(class_level);

-- ============================================
-- TABLE 2: Textbook Requests
-- Individual student textbook requests
-- ============================================
CREATE TABLE textbook_requests (
  id SERIAL PRIMARY KEY,
  student_name VARCHAR(200) NOT NULL,
  student_id VARCHAR(50),
  phone_number VARCHAR(20) NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  class_level VARCHAR(50) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  book_title VARCHAR(200) NOT NULL,
  quantity_requested INTEGER DEFAULT 1,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dispatch_date TIMESTAMP,
  delivery_date TIMESTAMP,
  tracking_number VARCHAR(20) UNIQUE NOT NULL,
  notes TEXT,
  
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'approved', 'dispatched', 'delivered', 'rejected')
  ),
  CONSTRAINT positive_quantity CHECK (quantity_requested > 0)
);

-- Indexes for fast queries
CREATE INDEX idx_textbook_req_status ON textbook_requests(status);
CREATE INDEX idx_textbook_req_tracking ON textbook_requests(tracking_number);
CREATE INDEX idx_textbook_req_phone ON textbook_requests(phone_number);
CREATE INDEX idx_textbook_req_school ON textbook_requests(school_id);

-- ============================================
-- TABLE 3: Book Shortage Reports
-- School-level textbook shortage tracking
-- ============================================
CREATE TABLE book_shortage_reports (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id),
  reporter_name VARCHAR(200) NOT NULL,
  reporter_phone VARCHAR(20) NOT NULL,
  class_level VARCHAR(50) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  students_affected INTEGER NOT NULL,
  books_needed INTEGER NOT NULL,
  books_available INTEGER DEFAULT 0,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  reference_number VARCHAR(20) UNIQUE,
  
  CONSTRAINT valid_shortage_status CHECK (
    status IN ('pending', 'investigating', 'approved', 'resolved', 'rejected')
  ),
  CONSTRAINT positive_students CHECK (students_affected > 0),
  CONSTRAINT positive_books_needed CHECK (books_needed > 0)
);

-- Indexes
CREATE INDEX idx_shortage_status ON book_shortage_reports(status);
CREATE INDEX idx_shortage_school ON book_shortage_reports(school_id);
CREATE INDEX idx_shortage_subject ON book_shortage_reports(subject);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample textbook inventory
INSERT INTO textbook_inventory (book_title, subject, class_level, publisher, total_quantity, available_quantity, reserved_quantity, damaged_quantity)
VALUES
('Math Grade 7', 'Mathematics', 'Grade 7', 'Longhorn Publishers', 500, 320, 120, 60),
('Math Grade 8', 'Mathematics', 'Grade 8', 'Longhorn Publishers', 500, 234, 156, 110),
('English Grade 7', 'English', 'Grade 7', 'Oxford University Press', 600, 456, 89, 55),
('English Grade 8', 'English', 'Grade 8', 'Oxford University Press', 600, 401, 134, 65),
('Kiswahili Darasa la 7', 'Kiswahili', 'Grade 7', 'Jomo Kenyatta Foundation', 450, 298, 98, 54),
('Science Grade 7', 'Science', 'Grade 7', 'Kenya Literature Bureau', 550, 387, 112, 51),
('Social Studies Grade 8', 'Social Studies', 'Grade 8', 'East African Educational Publishers', 400, 245, 98, 57);

-- Insert sample textbook request (for testing)
INSERT INTO textbook_requests (
  student_name, student_id, phone_number, school_id, class_level, 
  subject, book_title, quantity_requested, reason, tracking_number, status
)
VALUES
('Jane Wanjiru', 'VOO2025001', '0712345678', 1, 'Grade 8', 'Mathematics', 'Math Grade 8', 1, 'Never received at start of term', 'TBK001234', 'pending'),
('John Kamau', 'VOO2025002', '0723456789', 1, 'Grade 7', 'English', 'English Grade 7', 1, 'Lost book during transfer', 'TBK001235', 'approved'),
('Mary Akinyi', 'VOO2025003', '0734567890', 2, 'Grade 8', 'Science', 'Science Grade 8', 1, 'Inadequate supply at school', 'TBK001236', 'dispatched');

-- Insert sample shortage report
INSERT INTO book_shortage_reports (
  school_id, reporter_name, reporter_phone, class_level, subject,
  students_affected, books_needed, books_available, description, reference_number
)
VALUES
(1, 'Principal John Doe', '0722334455', 'Grade 8', 'Mathematics', 156, 156, 0, 'Completely out of Math Grade 8 textbooks. 156 students without books since September.', 'SHT001001'),
(2, 'Teacher Sarah Mwangi', '0733445566', 'Grade 7', 'English', 89, 50, 39, 'Need 50 more English Grade 7 books. Current stock insufficient.', 'SHT001002');

-- ============================================
-- FUNCTIONS & TRIGGERS (Auto-update timestamps)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_textbook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for textbook_inventory
CREATE TRIGGER update_textbook_inventory_timestamp
BEFORE UPDATE ON textbook_inventory
FOR EACH ROW
EXECUTE FUNCTION update_textbook_timestamp();

-- ============================================
-- VIEWS (For easy reporting)
-- ============================================

-- View: Textbook requests summary by school
CREATE VIEW textbook_requests_by_school AS
SELECT 
  s.name AS school_name,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_requests,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_requests,
  SUM(CASE WHEN status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched_requests,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_requests
FROM textbook_requests tr
JOIN schools s ON tr.school_id = s.id
GROUP BY s.name;

-- View: Current book shortages
CREATE VIEW current_book_shortages AS
SELECT 
  s.name AS school_name,
  bsr.class_level,
  bsr.subject,
  bsr.students_affected,
  bsr.books_needed,
  bsr.books_available,
  (bsr.books_needed - bsr.books_available) AS shortage_quantity,
  bsr.reported_at
FROM book_shortage_reports bsr
JOIN schools s ON bsr.school_id = s.id
WHERE bsr.status != 'resolved'
ORDER BY bsr.students_affected DESC;

-- View: Inventory status (books running low)
CREATE VIEW low_stock_books AS
SELECT 
  book_title,
  subject,
  class_level,
  available_quantity,
  reserved_quantity,
  total_quantity,
  ROUND((available_quantity::DECIMAL / NULLIF(total_quantity, 0)) * 100, 2) AS availability_percentage
FROM textbook_inventory
WHERE available_quantity < (total_quantity * 0.2) -- Less than 20% available
ORDER BY availability_percentage ASC;

-- ============================================
-- PERMISSIONS (Grant access to app user)
-- ============================================

-- Grant permissions to voo_user (adjust if your user is different)
GRANT SELECT, INSERT, UPDATE ON textbook_inventory TO voo_user;
GRANT SELECT, INSERT, UPDATE ON textbook_requests TO voo_user;
GRANT SELECT, INSERT, UPDATE ON book_shortage_reports TO voo_user;
GRANT SELECT ON textbook_requests_by_school TO voo_user;
GRANT SELECT ON current_book_shortages TO voo_user;
GRANT SELECT ON low_stock_books TO voo_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO voo_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Run this with: psql -U voo_user -d voo_db -f 05_textbook_system.sql
