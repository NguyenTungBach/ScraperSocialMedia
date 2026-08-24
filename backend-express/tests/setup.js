require('dotenv').config();

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';

if (!process.env.FE_URL) {
    process.env.FE_URL = 'http://localhost:5173';
}

// Test database configuration (use development environment if no actual database)
if (!process.env.DB_NAME_TEST) {
    process.env.DB_NAME_TEST = process.env.DB_NAME || 'atmtc_db';
}

// Close database connections after all tests
afterAll(async () => {
    const db = require('../app/Models');
    if (db && db.sequelize) {
        try {
            await db.sequelize.close();
        } catch (error) {
            // Ignore errors when closing connection
            console.warn('Error closing database connection:', error.message);
        }
    }
});
