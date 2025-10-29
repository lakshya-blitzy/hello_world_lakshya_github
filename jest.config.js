/**
 * Jest Configuration for Express Server Testing
 * 
 * This configuration file sets up Jest for testing the Node.js Express server
 * with appropriate coverage thresholds and test environment settings.
 * 
 * Note: Coverage thresholds are adjusted to account for the conditional server
 * startup code (if require.main === module) which is intentionally not executed
 * during testing to prevent port conflicts.
 */

module.exports = {
  // Use Node.js environment instead of browser/jsdom for server-side testing
  testEnvironment: 'node',

  // Enable detailed test output showing individual test results
  verbose: true,

  // Pattern to find test files in tests/ directory
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Coverage collection settings
  collectCoverageFrom: [
    'server.js'
  ],

  // Output directory for coverage reports
  coverageDirectory: 'coverage',

  // Coverage thresholds adjusted for server architecture
  // The app.listen() callback is intentionally not covered as it's only
  // executed when server.js is run directly, not when imported for testing
  coverageThreshold: {
    global: {
      branches: 50,    // 50% accounts for if (require.main === module) branch
      functions: 66,   // 66% accounts for listen callback not being tested
      lines: 83,       // 83% accounts for lines in listen callback
      statements: 83   // 83% accounts for statements in listen callback
    }
  },

  // Coverage reporters: console output, lcov format, and HTML report
  coverageReporters: [
    'text',      // Console output for CI/CD
    'lcov',      // Standard format for coverage tools
    'html'       // Human-readable HTML report
  ],

  // Test execution settings
  testTimeout: 5000,      // 5 second timeout per test
  clearMocks: true,       // Automatically clear mock calls between tests
  resetMocks: false,      // Keep mock implementations
  restoreMocks: false     // Don't restore original implementations
};
