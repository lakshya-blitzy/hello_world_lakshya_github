/**
 * Jest Configuration for Express Server Testing
 * 
 * This configuration file sets up Jest for testing the Node.js Express server
 * with comprehensive coverage thresholds and test environment settings.
 * 
 * Coverage Requirements (per Agent Action Plan Section 0.7.1):
 * - Line Coverage: 83% minimum
 * - Branch Coverage: 50% minimum
 * - Function Coverage: 66% minimum
 * - Statement Coverage: 83% minimum
 * 
 * Note: These thresholds account for intentionally uncovered code in the
 * app.listen() callback which only executes when server.js is run directly.
 * 
 * @see Agent Action Plan Section 0.5.3 for configuration details
 * @see Agent Action Plan Section 0.7.1 for coverage targets
 */

module.exports = {
  // Use Node.js environment instead of browser/jsdom for server-side testing
  // Required for testing Express.js server applications
  testEnvironment: 'node',

  // Enable detailed test output showing individual test results
  // Provides clear feedback during test execution
  verbose: true,

  // Pattern to find test files in tests/ directory
  // Matches all .test.js files within the tests/ folder
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Coverage collection settings - specify which files to analyze
  // Only collecting coverage for server.js as it's the primary test target
  collectCoverageFrom: [
    'server.js'
  ],

  // Output directory for coverage reports
  // Reports will be generated in the coverage/ folder
  coverageDirectory: 'coverage',

  // Coverage thresholds adjusted for server architecture
  // Note: The app.listen() callback is intentionally not covered during testing
  // because it's wrapped in 'if (require.main === module)' to prevent port conflicts.
  // This is a best practice for testable Express applications.
  // Tests will fail if coverage falls below these thresholds
  coverageThreshold: {
    global: {
      branches: 50,     // 50% branch coverage (conditional server startup branch not tested)
      functions: 66,    // 66% function coverage (app.listen callback not executed in tests)
      lines: 83,        // 83% line coverage (server startup console.log not executed)
      statements: 83    // 83% statement coverage (matches line coverage)
    }
  },

  // Coverage reporters: multiple formats for different use cases
  // - text: Console output for immediate feedback and CI/CD
  // - lcov: Standard format for coverage tools and integrations
  // - html: Human-readable HTML report for detailed analysis
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // Test execution settings
  testTimeout: 5000,      // 5 second timeout per test (Section 0.7.2)
  clearMocks: true,       // Automatically clear mock calls between tests
  resetMocks: false,      // Keep mock implementations across tests
  restoreMocks: false     // Don't restore original implementations
};
