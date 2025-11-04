-- Create bursary-related tables for Kyamatu Ward USSD System

-- Table to store registered constituents (residents)
CREATE TABLE IF NOT EXISTS constituents (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    national_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    residence VARCHAR(100) NOT NULL, -- Area within Kyamatu Ward
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store bursary applications
CREATE TABLE IF NOT EXISTS bursaries (
    id SERIAL PRIMARY KEY,
    constituent_id INTEGER REFERENCES constituents(id) ON DELETE CASCADE,
    phone_number VARCHAR(15) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    institution_name VARCHAR(200) NOT NULL,
    admission_number VARCHAR(50) NOT NULL,
    study_level VARCHAR(50) NOT NULL CHECK (study_level IN ('Primary', 'Secondary', 'TVET', 'College', 'University')),
    year_of_study INTEGER NOT NULL,
    amount_requested INTEGER NOT NULL CHECK (amount_requested BETWEEN 1000 AND 150000),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Approved', 'Rejected')),
    ticket VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_constituents_phone ON constituents(phone_number);
CREATE INDEX IF NOT EXISTS idx_constituents_national_id ON constituents(national_id);
CREATE INDEX IF NOT EXISTS idx_bursaries_phone ON bursaries(phone_number);
CREATE INDEX IF NOT EXISTS idx_bursaries_status ON bursaries(status);
CREATE INDEX IF NOT EXISTS idx_bursaries_created ON bursaries(created_at DESC);
