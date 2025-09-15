/**
 * Jest Test Configuration
 * 
 * Configures Jest test runner for Node.js HTTP server testing with comprehensive
 * coverage reporting and threshold enforcement. Supports both unit and integration
 * testing as part of the minimal test philosophy - achieving high coverage with
 * minimal test count.
 * 
 * Coverage Thresholds:
 * - Lines: 80% minimum (critical for identifying untested code paths)
 * - Branches: 70% minimum (ensuring conditional logic coverage)  
 * - Functions: 100% (complete function coverage required)
 * - Statements: 80% minimum (comprehensive statement execution)
 * 
 * Test Organization:
 * - Unit tests: tests/unit/*.test.js
 * - Integration tests: tests/integration/*.test.js
 * - Coverage output: coverage/ directory with multiple formats
 */

module.exports = {
  // Set test environment to Node.js for server-side testing
  testEnvironment: 'node',

  // Configure coverage collection and output directory
  coverageDirectory: 'coverage',

  // Specify files to include in coverage collection
  // Includes all JavaScript files while excluding dependencies and output directories
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],

  // Define coverage threshold enforcement
  // Jest will fail if any threshold is not met, ensuring quality gates
  coverageThreshold: {
    global: {
      lines: 80,      // 80% line coverage minimum
      branches: 70,   // 70% branch coverage minimum  
      functions: 100, // 100% function coverage required
      statements: 80  // 80% statement coverage minimum
    }
  },

  // Test file pattern matching
  // Matches all .test.js files in any directory for flexibility
  testMatch: [
    '**/*.test.js'
  ],

  // Enable verbose output for detailed test results
  // Provides comprehensive feedback during test execution
  verbose: true,

  // Configure multiple coverage report formats
  // - 'text': Console summary for immediate feedback
  // - 'lcov': Machine-readable format for CI/CD integration  
  // - 'html': Interactive browser-viewable report
  coverageReporters: [
    'text',
    'lcov', 
    'html'
  ],

  // Additional Jest configuration for optimal testing experience
  
  // Clear mocks between test runs to prevent state leakage
  clearMocks: true,

  // Collect coverage automatically when tests run (no --coverage flag needed)
  collectCoverage: true,

  // Set timeout for individual tests (10 seconds to handle server startup/shutdown)
  testTimeout: 10000,

  // Ensure tests run in series to avoid port conflicts during server testing
  maxWorkers: 1,

  // Configure setup and teardown file locations (if needed in the future)
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Error handling configuration
  // Report uncaught promises as test failures
  detectOpenHandles: true,
  forceExit: true
};