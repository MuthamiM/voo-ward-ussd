// Jest setup file - runs before all tests
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/voo-ward-test';

// Global test utilities
global.mockUser = {
    id: 1,
    name: 'Test User',
    role: 'super_admin',
    phone: '827700'
};

global.mockIssue = {
    id: 1,
    ticket: 'ISS-001',
    category: 'Infrastructure',
    message: 'Test issue',
    phone_number: '0712345678',
    status: 'open',
    created_at: new Date().toISOString()
};

// Clean up after all tests
afterAll(async () => {
    // Close any open database connections
    await new Promise(resolve => setTimeout(resolve, 500));
});
