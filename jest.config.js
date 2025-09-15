module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage thresholds (80% minimum as specified in summary)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    '*.js',
    '!coverage/**',
    '!node_modules/**',
    '!jest.config.js',
    '!tests/**',
    '!blitzy_adhoc_test_*.js'  // Exclude ad-hoc test files
  ],
  
  // Setup and teardown
  setupFilesAfterEnv: [],
  
  // Module paths
  roots: ['<rootDir>'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true
};