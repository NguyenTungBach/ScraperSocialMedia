/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['app/**/*.js', '!app/**/*.test.js', '!app/Models/index.js'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 30000,
    verbose: true,
    // Run tests sequentially to avoid database conflicts
    maxWorkers: 1
};
