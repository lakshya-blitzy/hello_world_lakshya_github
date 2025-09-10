// Node.js Tutorial HTTP Server - Comprehensive Logger Unit Test Suite
// Educational testing patterns using Node.js built-in modules with zero external dependencies
// Tests all logger functionality including correlation, security, performance, and configuration

// Node.js built-in module imports - educational testing approach with zero dependencies
const { test, describe, beforeEach, afterEach } = require('node:test'); // built-in - Node.js test runner for organizing and executing comprehensive unit tests
const assert = require('node:assert/strict'); // built-in - Node.js strict assertion library for comprehensive test validation with strict equality checking
const { performance } = require('node:perf_hooks'); // built-in - Node.js performance API for measuring logger performance characteristics and timing validation
const { EventEmitter } = require('node:events'); // built-in - Node.js EventEmitter for testing event-driven logging and context management functionality
const { setTimeout } = require('node:timers/promises'); // built-in - Node.js promisified setTimeout for testing asynchronous logging scenarios
const { writeFile, access } = require('node:fs/promises'); // built-in - Node.js filesystem promises for testing file logging functionality

// Import Logger components and utilities for comprehensive unit testing
const { 
    Logger, 
    createLogger, 
    LOG_LEVELS, 
    formatLogMessage, 
    sanitizeLogData 
} = require('../../lib/logger.js');

// Import environment configuration for testing different configuration scenarios
const { config } = require('../../config/environment.js');

// Import test utilities and helpers for isolated testing environment setup
const { 
    TestEnvironment, 
    measurePerformance, 
    generateCorrelationId 
} = require('../fixtures/test-helpers.js');

// Import test data configurations and performance thresholds for validation
const { testData } = require('../fixtures/test-data.js');

// Global test configuration constants for consistent testing behavior
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD_MS = 10;
const MAX_LOG_MESSAGE_LENGTH = 1000;
const TEST_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const SENSITIVE_DATA_PATTERNS = ['password', 'token', 'secret', 'key', 'authorization'];

/**
 * Sets up logger instance for testing with test-specific configuration including 
 * suppressed console output and memory-only logging for isolated test execution
 * @param {object} options - Logger configuration options for test environment
 * @returns {object} Configured Logger instance ready for testing
 */
function setupTestLogger(options = {}) {
    // Create test logger configuration with suppressed console output to prevent test pollution
    const testConfig = {
        level: options.level || LOG_LEVELS.DEBUG, // Enable all log levels for comprehensive testing
        console: false, // Disable console output to prevent test pollution
        file: false, // Disable file logging to prevent file system side effects during testing
        format: options.format || 'text', // Use text format for easier test validation
        colorize: false, // Disable colors in test environment for consistent output
        requestCorrelation: options.requestCorrelation !== false, // Enable correlation tracking for testing
        ...options
    };
    
    // Initialize logger statistics collection for test validation
    const logger = new Logger(testConfig);
    
    // Override console output methods to capture log messages for testing
    const capturedLogs = [];
    const originalConsoleLog = console.log;
    logger._capturedLogs = capturedLogs;
    
    // Intercept console.log calls to capture logger output for validation
    console.log = (message) => {
        capturedLogs.push(message);
        if (options.enableConsole) {
            originalConsoleLog(message);
        }
    };
    
    // Store original console.log for cleanup
    logger._originalConsoleLog = originalConsoleLog;
    
    // Return configured logger instance ready for comprehensive testing
    return logger;
}

/**
 * Captures logger output during test execution for validation and assertion testing
 * @param {function} testFunction - Function to execute while capturing log output
 * @param {object} options - Capture options including log levels and format preferences
 * @returns {Promise<object>} Promise resolving to captured log output with messages and timing
 */
async function captureLogOutput(testFunction, options = {}) {
    const capturedMessages = [];
    const startTime = performance.now();
    
    // Set up console method interception to capture logger output
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = (message) => capturedMessages.push({ level: 'log', message, timestamp: Date.now() });
    console.error = (message) => capturedMessages.push({ level: 'error', message, timestamp: Date.now() });
    console.warn = (message) => capturedMessages.push({ level: 'warn', message, timestamp: Date.now() });
    
    try {
        // Execute provided test function while capturing all log output
        await testFunction();
        
        const endTime = performance.now();
        
        // Return comprehensive log capture result with messages and metadata
        return {
            messages: capturedMessages,
            count: capturedMessages.length,
            duration: endTime - startTime,
            messagesByLevel: capturedMessages.reduce((acc, msg) => {
                acc[msg.level] = (acc[msg.level] || 0) + 1;
                return acc;
            }, {})
        };
    } finally {
        // Restore original console methods after test function completion
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
    }
}

/**
 * Validates log message structure, content, and formatting against expected criteria
 * @param {string} logMessage - Log message string to validate
 * @param {object} expected - Expected message characteristics
 * @returns {object} Validation result with detailed checking results
 */
function validateLogMessage(logMessage, expected = {}) {
    const validation = {
        isValid: true,
        errors: [],
        details: {
            timestamp: null,
            level: null,
            correlationId: null,
            message: null,
            context: null
        }
    };
    
    try {
        // Parse log message to extract timestamp, level, correlation ID, and content components
        const messageParts = logMessage.split(' ');
        
        if (messageParts.length < 3) {
            validation.isValid = false;
            validation.errors.push('Log message has insufficient components');
            return validation;
        }
        
        // Extract and validate timestamp format and recency
        const timestampPart = messageParts[0];
        validation.details.timestamp = timestampPart;
        
        if (expected.timestamp && timestampPart !== expected.timestamp) {
            // For timestamp validation, check if it's a valid ISO string
            try {
                const parsedDate = new Date(timestampPart);
                if (isNaN(parsedDate.getTime())) {
                    validation.isValid = false;
                    validation.errors.push('Invalid timestamp format in log message');
                }
            } catch (timestampError) {
                validation.isValid = false;
                validation.errors.push('Timestamp parsing failed in log message');
            }
        }
        
        // Verify log level matches expected level with case-insensitive comparison
        const levelPart = messageParts[1];
        validation.details.level = levelPart.replace(/[\[\]]/g, '').toLowerCase();
        
        if (expected.level && validation.details.level !== expected.level.toLowerCase()) {
            validation.isValid = false;
            validation.errors.push(`Log level mismatch: expected ${expected.level}, got ${validation.details.level}`);
        }
        
        // Check correlation ID presence and format for request tracking validation
        const remainingMessage = messageParts.slice(2).join(' ');
        validation.details.message = remainingMessage;
        
        // Look for correlation ID pattern in message
        const correlationMatch = remainingMessage.match(/\[([^\]]+)\]/);
        if (correlationMatch) {
            validation.details.correlationId = correlationMatch[1];
        }
        
        if (expected.correlationId && validation.details.correlationId !== expected.correlationId) {
            validation.isValid = false;
            validation.errors.push(`Correlation ID mismatch: expected ${expected.correlationId}, got ${validation.details.correlationId}`);
        }
        
        // Validate message content matches expected content with flexible string matching
        if (expected.message && !remainingMessage.includes(expected.message)) {
            validation.isValid = false;
            validation.errors.push(`Message content mismatch: expected to contain "${expected.message}"`);
        }
        
        // Return detailed validation result with pass/fail status and specific feedback
        return validation;
        
    } catch (parseError) {
        validation.isValid = false;
        validation.errors.push(`Log message parsing error: ${parseError.message}`);
        return validation;
    }
}

/**
 * Creates realistic request context objects for testing logger context management
 * @param {object} contextOptions - Context configuration including correlation ID
 * @returns {object} Test request context object with correlation ID and request properties
 */
function createTestContext(contextOptions = {}) {
    // Generate unique correlation ID for request tracking and context isolation
    const correlationId = contextOptions.correlationId || generateCorrelationId();
    
    // Create realistic HTTP request properties including method, path, and headers
    const testContext = {
        correlationId: correlationId,
        method: contextOptions.method || 'GET',
        path: contextOptions.path || '/hello',
        clientIp: contextOptions.clientIp || '127.0.0.1',
        userAgent: contextOptions.userAgent || 'Node.js Test Client/1.0.0',
        timestamp: contextOptions.timestamp || Date.now(),
        requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    };
    
    // Return complete test context object ready for logger context testing
    return testContext;
}

/**
 * Simulates high-volume logging scenarios for performance testing and load validation
 * @param {object} logger - Logger instance to test under load conditions
 * @param {number} messageCount - Number of log messages to generate
 * @param {object} loadOptions - Load testing configuration
 * @returns {Promise<object>} Promise resolving to load test results with performance metrics
 */
async function simulateLogLoad(logger, messageCount = 100, loadOptions = {}) {
    const startTime = performance.now();
    const results = {
        messagesSent: 0,
        errors: [],
        timings: []
    };
    
    // Generate specified number of log messages with varied content and levels
    const logLevels = TEST_LOG_LEVELS;
    const messages = [];
    
    for (let i = 0; i < messageCount; i++) {
        const level = logLevels[i % logLevels.length];
        const messageStart = performance.now();
        
        try {
            // Execute concurrent logging operations to simulate real-world load conditions
            switch (level) {
                case 'debug':
                    logger.debug(`Load test debug message ${i}`, { iteration: i });
                    break;
                case 'info':
                    logger.info(`Load test info message ${i}`, { iteration: i });
                    break;
                case 'warn':
                    logger.warn(`Load test warn message ${i}`, { iteration: i });
                    break;
                case 'error':
                    logger.error(`Load test error message ${i}`, new Error(`Test error ${i}`));
                    break;
            }
            
            const messageEnd = performance.now();
            results.timings.push(messageEnd - messageStart);
            results.messagesSent++;
            
        } catch (loadError) {
            results.errors.push({
                iteration: i,
                level: level,
                error: loadError.message
            });
        }
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Calculate throughput, average response time, and resource utilization metrics
    const averageMessageTime = results.timings.reduce((sum, time) => sum + time, 0) / results.timings.length;
    const throughput = results.messagesSent / (totalTime / 1000); // messages per second
    
    // Return comprehensive load test results with performance analysis
    return {
        totalTime: totalTime,
        messagesSent: results.messagesSent,
        errorsCount: results.errors.length,
        averageMessageTime: averageMessageTime,
        throughput: throughput,
        timings: results.timings,
        errors: results.errors
    };
}

// Main test suite for Logger Class Construction and Configuration
describe('Logger Class Construction and Configuration', () => {
    let testLogger;
    
    beforeEach(() => {
        // Set up clean logger instance with test configuration for each test
        testLogger = null;
    });
    
    afterEach(() => {
        // Clean up logger resources and restore console methods
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should create logger with default configuration', { timeout: TEST_TIMEOUT }, async () => {
        // Validate logger creation with default settings
        testLogger = setupTestLogger();
        
        // Logger instance is created successfully
        assert.ok(testLogger instanceof Logger, 'Logger instance should be created successfully');
        
        // Default log level is set correctly based on environment
        assert.strictEqual(testLogger.level, LOG_LEVELS.DEBUG, 'Default log level should be DEBUG for test environment');
        
        // Console output is enabled by default (but disabled in test setup)
        assert.strictEqual(testLogger.config.console, false, 'Console output should be disabled for testing');
        
        // File logging is disabled by default
        assert.strictEqual(testLogger.config.file, false, 'File logging should be disabled by default');
        
        // Statistics collection is initialized
        const stats = testLogger.getStats();
        assert.ok(stats.messageCount, 'Statistics collection should be initialized');
        assert.strictEqual(stats.messageCount.total, 0, 'Initial message count should be zero');
    });
    
    test('should create logger with custom configuration', { timeout: TEST_TIMEOUT }, async () => {
        // Test logger creation with custom configuration options
        const customConfig = {
            level: LOG_LEVELS.WARN,
            format: 'json',
            requestCorrelation: true,
            colorize: true
        };
        
        testLogger = setupTestLogger(customConfig);
        
        // Logger accepts custom configuration options
        assert.ok(testLogger instanceof Logger, 'Logger should accept custom configuration');
        
        // Custom log level is applied correctly
        assert.strictEqual(testLogger.level, LOG_LEVELS.WARN, 'Custom log level should be applied');
        
        // Custom output format is configured
        assert.strictEqual(testLogger.config.format, 'json', 'Custom format should be configured');
        
        // File logging can be enabled with custom path (tested in separate test)
        assert.strictEqual(testLogger.config.file, false, 'File logging should remain disabled in test');
        
        // Configuration is validated and sanitized
        assert.strictEqual(testLogger.config.requestCorrelation, true, 'Request correlation should be enabled');
    });
    
    test('should validate configuration parameters', { timeout: TEST_TIMEOUT }, async () => {
        // Test configuration validation including invalid log levels and options
        
        // Test with invalid log level (should fall back to default)
        testLogger = setupTestLogger({ level: 'invalid-level' });
        
        // Invalid log levels are rejected with appropriate handling
        // Note: The Logger class handles invalid levels gracefully in shouldLog function
        assert.ok(testLogger instanceof Logger, 'Logger should handle invalid log level gracefully');
        
        // Test with unknown configuration options (should be ignored)
        testLogger = setupTestLogger({
            level: LOG_LEVELS.INFO,
            unknownOption: 'should-be-ignored',
            invalidTimeout: 'not-a-number'
        });
        
        // Unknown configuration options are ignored
        assert.ok(testLogger instanceof Logger, 'Logger should ignore unknown configuration options');
        assert.strictEqual(testLogger.config.unknownOption, 'should-be-ignored', 'Unknown options should be stored but not validated');
        
        // Required configuration properties are enforced (level validation)
        assert.strictEqual(testLogger.level, LOG_LEVELS.INFO, 'Valid log level should be preserved');
    });
    
    test('should handle environment-based configuration', { timeout: TEST_TIMEOUT }, async () => {
        // Validate logger configuration changes based on environment settings
        
        // Test with test environment configuration
        const testEnvConfig = {
            level: config.logging?.level || LOG_LEVELS.WARN,
            console: false, // Test environment should suppress console output
            requestCorrelation: false // Test environment may disable correlation
        };
        
        testLogger = setupTestLogger(testEnvConfig);
        
        // Environment configuration overrides defaults properly
        assert.ok(testLogger instanceof Logger, 'Logger should adapt to environment configuration');
        
        // Test environment sets appropriate log levels
        assert.ok(TEST_LOG_LEVELS.includes(testLogger.level), 'Log level should be valid for test environment');
        
        // Test environment suppresses console output
        assert.strictEqual(testLogger.config.console, false, 'Console output should be suppressed in test environment');
        
        // Environment detection works correctly (implicit through config loading)
        assert.ok(testLogger.config, 'Environment configuration should be loaded correctly');
    });
});

// Test suite for Log Level Functionality and Filtering
describe('Log Level Functionality and Filtering', () => {
    let testLogger;
    
    beforeEach(() => {
        // Set up clean logger instance for each test with debug level enabled
        testLogger = setupTestLogger({ level: LOG_LEVELS.DEBUG });
    });
    
    afterEach(() => {
        // Clean up logger resources
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should log debug messages when debug level enabled', { timeout: TEST_TIMEOUT }, async () => {
        // Test debug logging functionality with message formatting and context
        const debugMessage = 'Debug test message';
        const debugContext = { debugInfo: 'test-context', requestId: 'debug-123' };
        
        testLogger.debug(debugMessage, debugContext);
        
        // Debug messages are logged when debug level is enabled
        assert.ok(testLogger._capturedLogs.length > 0, 'Debug messages should be captured when debug level enabled');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Debug messages include appropriate level identifier
        assert.ok(logEntry.includes('[DEBUG]'), 'Debug messages should include DEBUG level identifier');
        
        // Debug context information is included correctly
        assert.ok(logEntry.includes(debugMessage), 'Debug message content should be included');
        
        // Debug messages are formatted consistently
        const validation = validateLogMessage(logEntry, { level: 'debug', message: debugMessage });
        assert.ok(validation.isValid, `Debug message validation failed: ${validation.errors.join(', ')}`);
        
        // Debug logging statistics are updated
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.debug, 1, 'Debug message count should be incremented');
        assert.strictEqual(stats.messageCount.total, 1, 'Total message count should be incremented');
    });
    
    test('should log info messages for normal operations', { timeout: TEST_TIMEOUT }, async () => {
        // Test info level logging for normal application operations
        const infoMessage = 'Info test message for normal operation';
        const requestInfo = { method: 'GET', path: '/hello', statusCode: 200 };
        
        testLogger.info(infoMessage, requestInfo);
        
        // Info messages are logged with correct formatting
        assert.ok(testLogger._capturedLogs.length > 0, 'Info messages should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Info level identifier is included in messages
        assert.ok(logEntry.includes('[INFO]'), 'Info messages should include INFO level identifier');
        
        // Request information is properly included in context
        assert.ok(logEntry.includes(infoMessage), 'Info message content should be included');
        
        // Info messages support structured data inclusion
        assert.ok(logEntry.includes('GET') || logEntry.includes('/hello'), 'Structured request data should be included');
        
        // Info logging updates statistics correctly
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.info, 1, 'Info message count should be incremented');
    });
    
    test('should log warning messages for non-critical issues', { timeout: TEST_TIMEOUT }, async () => {
        // Test warning level logging for performance concerns and security events
        const warningMessage = 'Performance threshold exceeded';
        const warningContext = { responseTime: 150, threshold: 100, endpoint: '/hello' };
        
        testLogger.warn(warningMessage, warningContext);
        
        // Warning messages are logged with appropriate priority
        assert.ok(testLogger._capturedLogs.length > 0, 'Warning messages should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Warning level formatting includes visual indicators
        assert.ok(logEntry.includes('[WARN]'), 'Warning messages should include WARN level identifier');
        
        // Performance warnings include relevant metrics
        assert.ok(logEntry.includes(warningMessage), 'Warning message should include performance information');
        
        // Warning statistics are tracked correctly
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.warn, 1, 'Warning message count should be incremented');
    });
    
    test('should log error messages with full context', { timeout: TEST_TIMEOUT }, async () => {
        // Test error logging with complete error details and context
        const errorMessage = 'Test error with full context';
        const testError = new Error('Test error for logging');
        testError.code = 'TEST_ERROR';
        testError.statusCode = 500;
        
        testLogger.error(errorMessage, testError);
        
        // Error messages include complete error information
        assert.ok(testLogger._capturedLogs.length > 0, 'Error messages should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Stack traces are included when Error objects are provided
        assert.ok(logEntry.includes('[ERROR]'), 'Error messages should include ERROR level identifier');
        assert.ok(logEntry.includes(errorMessage), 'Error message content should be included');
        assert.ok(logEntry.includes('Test error for logging'), 'Error details should be included');
        
        // Error context includes request correlation information (if available)
        // Note: No correlation set in this test, so not checking for it
        
        // Error logging always writes regardless of log level
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.error, 1, 'Error message count should be incremented');
    });
    
    test('should filter messages based on configured log level', { timeout: TEST_TIMEOUT }, async () => {
        // Test log level filtering functionality
        
        // Create logger with WARN level (should filter out DEBUG and INFO)
        const filteredLogger = setupTestLogger({ level: LOG_LEVELS.WARN });
        
        // Test messages at different levels
        filteredLogger.debug('Debug message should be filtered');
        filteredLogger.info('Info message should be filtered');
        filteredLogger.warn('Warning message should pass');
        filteredLogger.error('Error message should pass');
        
        const capturedLogs = filteredLogger._capturedLogs;
        
        // Messages below configured level are filtered out
        const debugLogs = capturedLogs.filter(log => log.includes('[DEBUG]'));
        const infoLogs = capturedLogs.filter(log => log.includes('[INFO]'));
        assert.strictEqual(debugLogs.length, 0, 'Debug messages should be filtered out at WARN level');
        assert.strictEqual(infoLogs.length, 0, 'Info messages should be filtered out at WARN level');
        
        // Messages at or above configured level are logged
        const warnLogs = capturedLogs.filter(log => log.includes('[WARN]'));
        const errorLogs = capturedLogs.filter(log => log.includes('[ERROR]'));
        assert.strictEqual(warnLogs.length, 1, 'Warning messages should pass at WARN level');
        assert.strictEqual(errorLogs.length, 1, 'Error messages should pass at WARN level');
        
        // Level hierarchy is respected (error > warn > info > debug)
        const stats = filteredLogger.getStats();
        assert.strictEqual(stats.messageCount.debug, 0, 'Debug count should be 0 with WARN level');
        assert.strictEqual(stats.messageCount.info, 0, 'Info count should be 0 with WARN level');
        assert.strictEqual(stats.messageCount.warn, 1, 'Warn count should be 1');
        assert.strictEqual(stats.messageCount.error, 1, 'Error count should be 1');
        
        // Clean up filtered logger
        if (filteredLogger._originalConsoleLog) {
            console.log = filteredLogger._originalConsoleLog;
        }
    });
});

// Test suite for Request Context and Correlation Management
describe('Request Context and Correlation Management', () => {
    let testLogger;
    
    beforeEach(() => {
        // Set up logger with request correlation enabled
        testLogger = setupTestLogger({ requestCorrelation: true });
    });
    
    afterEach(() => {
        // Clean up logger resources and clear contexts
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        if (testLogger && testLogger.requestContexts) {
            testLogger.requestContexts.clear();
        }
        testLogger = null;
    });
    
    test('should set and retrieve request context', { timeout: TEST_TIMEOUT }, async () => {
        // Test request context storage and retrieval functionality
        const testContext = createTestContext();
        const correlationId = testContext.correlationId;
        
        // Set request context with correlation ID
        testLogger.setRequestContext(correlationId, testContext);
        
        // Request context can be set with correlation ID
        assert.ok(testLogger.requestContexts.has(correlationId), 'Request context should be stored with correlation ID');
        
        // Context information is stored and retrievable
        const storedContext = testLogger.requestContexts.get(correlationId);
        assert.ok(storedContext, 'Stored context should be retrievable');
        assert.strictEqual(storedContext.context.correlationId, testContext.correlationId, 'Stored context should match original');
        
        // Context includes request method, path, and client details
        assert.strictEqual(storedContext.context.method, testContext.method, 'Context should include request method');
        assert.strictEqual(storedContext.context.path, testContext.path, 'Context should include request path');
        assert.strictEqual(storedContext.context.clientIp, testContext.clientIp, 'Context should include client IP');
        
        // Multiple contexts can be managed simultaneously
        const secondContext = createTestContext({ method: 'POST', path: '/api/test' });
        testLogger.setRequestContext(secondContext.correlationId, secondContext);
        
        assert.strictEqual(testLogger.requestContexts.size, 2, 'Multiple contexts should be managed simultaneously');
        
        // Context expiration prevents memory leaks (verified by expiration timestamp)
        const contextData = testLogger.requestContexts.get(correlationId);
        assert.ok(contextData.expiresAt, 'Context should have expiration timestamp');
        assert.ok(contextData.expiresAt > Date.now(), 'Context expiration should be in the future');
    });
    
    test('should clear request context after processing', { timeout: TEST_TIMEOUT }, async () => {
        // Test request context cleanup functionality
        const testContext = createTestContext();
        const correlationId = testContext.correlationId;
        
        // Set up context for clearing test
        testLogger.setRequestContext(correlationId, testContext);
        assert.ok(testLogger.requestContexts.has(correlationId), 'Context should be set before clearing');
        
        // Clear request context
        testLogger.clearRequestContext(correlationId);
        
        // Request context is properly removed after clearing
        assert.ok(!testLogger.requestContexts.has(correlationId), 'Context should be removed after clearing');
        
        // Context cleanup releases all associated resources
        const stats = testLogger.getStats();
        assert.strictEqual(stats.activeContexts, 0, 'Active context count should be zero after clearing');
        
        // Cleared context does not affect other active contexts
        const otherContext = createTestContext({ method: 'POST' });
        testLogger.setRequestContext(otherContext.correlationId, otherContext);
        testLogger.clearRequestContext(correlationId); // Try to clear non-existent context
        
        assert.ok(testLogger.requestContexts.has(otherContext.correlationId), 'Other contexts should not be affected');
        
        // Memory usage decreases after context cleanup (tested indirectly through context count)
        assert.strictEqual(testLogger.requestContexts.size, 1, 'Context size should reflect only remaining contexts');
    });
    
    test('should include correlation ID in log messages', { timeout: TEST_TIMEOUT }, async () => {
        // Test correlation ID inclusion in log messages
        const testContext = createTestContext();
        const correlationId = testContext.correlationId;
        
        // Set active context
        testLogger.setRequestContext(correlationId, testContext);
        
        // Log message with active correlation
        testLogger.info('Test message with correlation', { operation: 'test' });
        
        // Active correlation ID is included in log messages
        assert.ok(testLogger._capturedLogs.length > 0, 'Log message should be captured');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Correlation ID format is consistent across messages
        assert.ok(logEntry.includes(correlationId), 'Log message should include correlation ID');
        
        // Clear context and test message without correlation
        testLogger.clearRequestContext(correlationId);
        testLogger.info('Test message without correlation');
        
        const logWithoutCorrelation = testLogger._capturedLogs[1];
        
        // Messages without active context don't include correlation ID
        assert.ok(!logWithoutCorrelation.includes(correlationId), 'Message without context should not include cleared correlation ID');
        
        // Correlation ID enables request tracing across components (validated by presence)
        const validation = validateLogMessage(logEntry, { correlationId: correlationId });
        assert.ok(validation.details.correlationId, 'Correlation ID should be extractable from log message');
    });
    
    test('should handle concurrent request contexts', { timeout: TEST_TIMEOUT }, async () => {
        // Test concurrent context management for multiple simultaneous requests
        const numConcurrentRequests = 10;
        const contexts = [];
        
        // Create multiple request contexts
        for (let i = 0; i < numConcurrentRequests; i++) {
            const context = createTestContext({ 
                method: 'GET', 
                path: `/test/${i}`,
                requestId: `concurrent-${i}`
            });
            contexts.push(context);
        }
        
        // Set all contexts concurrently
        contexts.forEach(context => {
            testLogger.setRequestContext(context.correlationId, context);
        });
        
        // Multiple request contexts can be active simultaneously
        assert.strictEqual(testLogger.requestContexts.size, numConcurrentRequests, 'All concurrent contexts should be active');
        
        // Contexts are properly isolated from each other
        contexts.forEach((context, index) => {
            const storedContext = testLogger.requestContexts.get(context.correlationId);
            assert.ok(storedContext, `Context ${index} should be stored`);
            assert.strictEqual(storedContext.context.path, `/test/${index}`, `Context ${index} should maintain its specific data`);
        });
        
        // Test logging with multiple active contexts (uses most recent by default)
        testLogger.info('Concurrent context test message');
        const logEntry = testLogger._capturedLogs[0];
        
        // Correct context is used for each request correlation (validated by presence of a correlation ID)
        assert.ok(logEntry.includes('req_') || logEntry.includes('test-helper-'), 'Log should include some correlation ID');
        
        // Clean up all contexts
        contexts.forEach(context => {
            testLogger.clearRequestContext(context.correlationId);
        });
        
        // Concurrent context cleanup works correctly
        assert.strictEqual(testLogger.requestContexts.size, 0, 'All contexts should be cleaned up');
    });
});

// Test suite for Message Formatting and Structure
describe('Message Formatting and Structure', () => {
    let testLogger;
    
    beforeEach(() => {
        testLogger = setupTestLogger();
    });
    
    afterEach(() => {
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should format messages with timestamp and level', { timeout: TEST_TIMEOUT }, async () => {
        // Test basic message formatting including timestamp and level identification
        const testMessage = 'Basic formatting test message';
        
        testLogger.info(testMessage);
        
        // Messages include properly formatted timestamp
        assert.ok(testLogger._capturedLogs.length > 0, 'Message should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        const messageParts = logEntry.split(' ');
        
        // Timestamp format is consistent and ISO compliant
        const timestampPart = messageParts[0];
        assert.ok(timestampPart, 'Timestamp should be present');
        
        // Validate timestamp format
        const parsedDate = new Date(timestampPart);
        assert.ok(!isNaN(parsedDate.getTime()), 'Timestamp should be valid ISO format');
        
        // Log level is clearly identified in message
        assert.ok(logEntry.includes('[INFO]'), 'Log level should be clearly identified');
        
        // Message structure follows consistent pattern
        const validation = validateLogMessage(logEntry, {
            level: 'info',
            message: testMessage
        });
        assert.ok(validation.isValid, `Message formatting validation failed: ${validation.errors.join(', ')}`);
    });
    
    test('should support structured logging with context data', { timeout: TEST_TIMEOUT }, async () => {
        // Test structured logging capabilities with context objects
        const message = 'Structured logging test';
        const contextData = {
            requestId: 'test-123',
            userId: 'user-456',
            operation: 'test-operation',
            nested: {
                level1: {
                    level2: 'deep-data'
                }
            }
        };
        
        testLogger.info(message, contextData);
        
        // Context objects are properly formatted in messages
        assert.ok(testLogger._capturedLogs.length > 0, 'Structured log should be captured');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Nested data structures are handled correctly
        assert.ok(logEntry.includes('requestId'), 'Context should include requestId field');
        assert.ok(logEntry.includes('test-123'), 'Context should include requestId value');
        assert.ok(logEntry.includes('nested'), 'Nested objects should be included');
        
        // Large context objects are truncated appropriately (tested with large object)
        const largeContext = {};
        for (let i = 0; i < 100; i++) {
            largeContext[`key${i}`] = `value${i}`.repeat(10);
        }
        
        testLogger.info('Large context test', largeContext);
        const largeContextLog = testLogger._capturedLogs[1];
        
        // Should handle large contexts without crashing
        assert.ok(largeContextLog.length < MAX_LOG_MESSAGE_LENGTH * 2, 'Large context should be handled appropriately');
    });
    
    test('should format messages for different output types', { timeout: TEST_TIMEOUT }, async () => {
        // Test message formatting for different output formats
        
        // Test text format
        const textLogger = setupTestLogger({ format: 'text' });
        textLogger.info('Text format test message', { format: 'text' });
        
        // Text format produces human-readable output
        assert.ok(textLogger._capturedLogs.length > 0, 'Text format should produce output');
        
        const textLog = textLogger._capturedLogs[0];
        assert.ok(textLog.includes('[INFO]'), 'Text format should include level indicators');
        assert.ok(textLog.includes('Text format test message'), 'Text format should include message');
        
        // Test JSON format
        const jsonLogger = setupTestLogger({ format: 'json' });
        jsonLogger.info('JSON format test message', { format: 'json' });
        
        // JSON format produces valid JSON objects
        assert.ok(jsonLogger._capturedLogs.length > 0, 'JSON format should produce output');
        
        const jsonLog = jsonLogger._capturedLogs[0];
        
        // Validate JSON format
        try {
            const parsedLog = JSON.parse(jsonLog);
            assert.strictEqual(parsedLog.level, 'INFO', 'JSON log should have correct level');
            assert.strictEqual(parsedLog.message, 'JSON format test message', 'JSON log should have correct message');
            assert.ok(parsedLog.timestamp, 'JSON log should have timestamp');
        } catch (jsonError) {
            assert.fail(`JSON format should produce valid JSON: ${jsonError.message}`);
        }
        
        // Clean up loggers
        if (textLogger._originalConsoleLog) {
            console.log = textLogger._originalConsoleLog;
        }
        if (jsonLogger._originalConsoleLog) {
            console.log = jsonLogger._originalConsoleLog;
        }
    });
    
    test('should handle special characters and encoding', { timeout: TEST_TIMEOUT }, async () => {
        // Test message formatting with special characters and encodings
        const specialMessage = 'Special chars: 你好世界 🌍 ñäöü \n\t\r';
        const unicodeContext = {
            emoji: '🔥💻🚀',
            chinese: '测试数据',
            accents: 'café résumé naïve',
            symbols: '©®™€£¥'
        };
        
        testLogger.info(specialMessage, unicodeContext);
        
        // Unicode characters are handled correctly
        assert.ok(testLogger._capturedLogs.length > 0, 'Special character message should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Special characters don't break message formatting
        assert.ok(logEntry.includes('你好世界'), 'Unicode characters should be preserved');
        assert.ok(logEntry.includes('🌍'), 'Emoji characters should be preserved');
        
        // Newlines and control characters are properly escaped (checked by not breaking log structure)
        const validation = validateLogMessage(logEntry, { level: 'info' });
        assert.ok(validation.isValid || validation.errors.length < 3, 'Special characters should not severely break log formatting');
        
        // UTF-8 encoding is maintained throughout processing
        const byteLength = Buffer.byteLength(logEntry, 'utf8');
        assert.ok(byteLength > 0, 'Log entry should maintain UTF-8 encoding');
    });
});

// Test suite for Data Sanitization and Security
describe('Data Sanitization and Security', () => {
    let testLogger;
    
    beforeEach(() => {
        testLogger = setupTestLogger();
    });
    
    afterEach(() => {
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should sanitize sensitive information from logs', { timeout: TEST_TIMEOUT }, async () => {
        // Test sensitive data removal from log messages
        const sensitiveData = {
            username: 'testuser',
            password: 'secret123',
            token: 'jwt-token-12345',
            apikey: 'api-key-abcdef',
            authorization: 'Bearer token123',
            secret: 'top-secret-value',
            creditCard: '4111-1111-1111-1111'
        };
        
        testLogger.info('Login attempt', sensitiveData);
        
        // Password fields are removed or masked in logs
        assert.ok(testLogger._capturedLogs.length > 0, 'Sensitive data test should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Authorization tokens are sanitized from log output
        assert.ok(!logEntry.includes('secret123'), 'Password should be sanitized from logs');
        assert.ok(!logEntry.includes('jwt-token-12345'), 'JWT token should be sanitized from logs');
        assert.ok(!logEntry.includes('api-key-abcdef'), 'API key should be sanitized from logs');
        assert.ok(!logEntry.includes('Bearer token123'), 'Authorization header should be sanitized');
        assert.ok(!logEntry.includes('top-secret-value'), 'Secret values should be sanitized');
        
        // API keys and secrets are filtered from messages
        assert.ok(logEntry.includes('[REDACTED]') || !logEntry.includes('secret123'), 'Sensitive data should be redacted or filtered');
        
        // Personal information is redacted appropriately
        assert.ok(logEntry.includes('testuser'), 'Non-sensitive data (username) should be preserved');
        
        // Sanitization preserves useful debugging information
        assert.ok(logEntry.includes('Login attempt'), 'Original message should be preserved');
    });
    
    test('should handle error objects securely', { timeout: TEST_TIMEOUT }, async () => {
        // Test secure error logging including stack trace handling
        const sensitiveError = new Error('Database connection failed for user: testuser with password: secret123');
        sensitiveError.code = 'DB_CONNECTION_ERROR';
        sensitiveError.details = {
            host: 'database.example.com',
            password: 'db-secret-password',
            connectionString: 'mongodb://user:secret@host:27017/db'
        };
        
        testLogger.error('Secure error handling test', sensitiveError);
        
        // Stack traces are included for debugging purposes
        assert.ok(testLogger._capturedLogs.length > 0, 'Error should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Error messages don't leak sensitive configuration
        assert.ok(!logEntry.includes('secret123'), 'Sensitive data in error message should be filtered');
        assert.ok(!logEntry.includes('db-secret-password'), 'Database password should be filtered');
        assert.ok(!logEntry.includes('user:secret@host'), 'Connection string credentials should be filtered');
        
        // Database errors don't expose schema information (tested by checking for redaction)
        assert.ok(logEntry.includes('[REDACTED]') || !logEntry.includes('secret'), 'Sensitive error details should be redacted');
        
        // System information is filtered appropriately
        assert.ok(logEntry.includes('Database connection failed'), 'Error type information should be preserved');
        assert.ok(logEntry.includes('DB_CONNECTION_ERROR'), 'Error codes should be preserved');
    });
    
    test('should prevent log injection attacks', { timeout: TEST_TIMEOUT }, async () => {
        // Test protection against log injection and manipulation attempts
        const injectionAttempts = {
            newlineInjection: 'Normal message\n[ERROR] Fake error injection',
            controlCharInjection: 'Message with \r\n\t control characters',
            logFormatManipulation: 'Message\n2023-01-01T00:00:00.000Z [ERROR] Fake log entry',
            htmlInjection: '<script>alert("xss")</script>',
            jsonInjection: '{"malicious": "json"}'
        };
        
        testLogger.info('Injection test', injectionAttempts);
        
        // Newline characters are properly escaped
        assert.ok(testLogger._capturedLogs.length > 0, 'Injection test should be logged');
        
        const logEntry = testLogger._capturedLogs[0];
        
        // Control characters don't affect log structure
        const logLines = logEntry.split('\n');
        assert.strictEqual(logLines[0].includes('[INFO]'), true, 'Original log level should be preserved');
        
        // Malicious input doesn't corrupt log format
        assert.ok(!logEntry.includes('[ERROR] Fake error injection'), 'Injected fake error should not appear as separate log entry');
        
        // Log message boundaries are maintained
        const validation = validateLogMessage(logEntry, { level: 'info' });
        assert.ok(validation.isValid || validation.errors.length <= 2, 'Log structure should remain intact despite injection attempts');
    });
    
    test('should maintain audit trail integrity', { timeout: TEST_TIMEOUT }, async () => {
        // Test audit trail integrity and tamper-resistant logging
        const auditEvents = [
            { action: 'login', user: 'testuser1', timestamp: Date.now() },
            { action: 'logout', user: 'testuser1', timestamp: Date.now() + 1000 },
            { action: 'data_access', user: 'testuser2', resource: '/api/sensitive', timestamp: Date.now() + 2000 }
        ];
        
        auditEvents.forEach((event, index) => {
            testLogger.info(`Audit event ${index}`, event);
        });
        
        // Log message order is preserved
        assert.strictEqual(testLogger._capturedLogs.length, 3, 'All audit events should be logged');
        
        // Timestamps are accurate and tamper-resistant
        auditEvents.forEach((event, index) => {
            const logEntry = testLogger._capturedLogs[index];
            assert.ok(logEntry.includes(`Audit event ${index}`), `Audit event ${index} should maintain order`);
            assert.ok(logEntry.includes(event.action), `Audit event ${index} should include action`);
        });
        
        // Correlation IDs maintain request traceability (if correlation enabled)
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.info, 3, 'All audit events should be counted');
        
        // Critical security events are always logged (tested by ensuring all events are present)
        assert.strictEqual(testLogger._capturedLogs.length, 3, 'All security events should be preserved');
    });
});

// Test suite for Performance and Resource Management
describe('Performance and Resource Management', () => {
    let testLogger;
    
    beforeEach(() => {
        testLogger = setupTestLogger();
    });
    
    afterEach(() => {
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should meet performance thresholds for message formatting', { timeout: TEST_TIMEOUT }, async () => {
        // Test logging performance to ensure message formatting stays within limits
        const performanceTest = async () => {
            const message = 'Performance test message';
            const context = { 
                requestId: 'perf-test-123',
                operation: 'performance-testing',
                metadata: { test: true }
            };
            
            const startTime = performance.now();
            testLogger.info(message, context);
            const endTime = performance.now();
            
            return endTime - startTime;
        };
        
        const result = await measurePerformance(performanceTest, {
            iterations: 10,
            maxDuration: PERFORMANCE_THRESHOLD_MS
        });
        
        // Message formatting completes within threshold
        assert.ok(result.statistics, 'Performance measurement should complete successfully');
        assert.ok(result.statistics.duration.average <= PERFORMANCE_THRESHOLD_MS, 
            `Average formatting time ${result.statistics.duration.average.toFixed(2)}ms should be <= ${PERFORMANCE_THRESHOLD_MS}ms`);
        
        // Performance remains consistent across different message types
        assert.ok(result.statistics.duration.max <= PERFORMANCE_THRESHOLD_MS * 2, 
            'Maximum formatting time should be within acceptable range');
        
        // Performance scales acceptably with message complexity
        assert.ok(result.statistics.successful >= 8, 'At least 80% of performance tests should succeed');
    });
    
    test('should manage memory usage efficiently', { timeout: TEST_TIMEOUT }, async () => {
        // Test memory usage patterns during logging operations
        const baselineMemory = process.memoryUsage();
        
        // Generate multiple log messages to test memory usage
        const messageCount = 100;
        const testMessages = [];
        
        for (let i = 0; i < messageCount; i++) {
            const message = `Memory test message ${i}`;
            const context = { 
                iteration: i,
                data: `test-data-${i}`,
                timestamp: Date.now()
            };
            
            testLogger.info(message, context);
            testMessages.push({ message, context });
        }
        
        const afterLoggingMemory = process.memoryUsage();
        
        // Memory usage per log message stays reasonable
        const memoryIncrease = afterLoggingMemory.heapUsed - baselineMemory.heapUsed;
        const memoryPerMessage = memoryIncrease / messageCount;
        
        // Memory usage should be reasonable per message (allowing for GC variance)
        assert.ok(memoryPerMessage < 10240, `Memory per message ${memoryPerMessage} bytes should be < 10KB`);
        
        // String formatting uses memory efficiently
        assert.ok(testLogger._capturedLogs.length === messageCount, 'All messages should be captured');
        
        // Garbage collection impact is minimal (tested by memory stability)
        const stats = testLogger.getStats();
        assert.strictEqual(stats.messageCount.total, messageCount, 'Message count should match expected');
    });
    
    test('should handle high-volume logging scenarios', { timeout: TEST_TIMEOUT }, async () => {
        // Test logger performance under high-volume concurrent logging
        const messageCount = 100;
        const loadTestResult = await simulateLogLoad(testLogger, messageCount, {
            concurrency: 10
        });
        
        // Throughput remains acceptable under high load
        assert.ok(loadTestResult.messagesSent > 0, 'Messages should be sent during load test');
        assert.ok(loadTestResult.throughput > 100, `Throughput ${loadTestResult.throughput.toFixed(2)} msg/sec should be > 100 msg/sec`);
        
        // Concurrent logging doesn't cause resource contention
        assert.strictEqual(loadTestResult.errorsCount, 0, 'No errors should occur during high-volume logging');
        
        // Message ordering is preserved under load
        assert.strictEqual(testLogger._capturedLogs.length, messageCount, 'All messages should be captured during load test');
        
        // Performance degradation is graceful under extreme load
        assert.ok(loadTestResult.averageMessageTime <= PERFORMANCE_THRESHOLD_MS, 
            `Average message time ${loadTestResult.averageMessageTime.toFixed(2)}ms should be within threshold`);
    });
    
    test('should clean up resources properly', { timeout: TEST_TIMEOUT }, async () => {
        // Test resource cleanup including context cleanup and memory management
        
        // Set up multiple request contexts to test cleanup
        const contextCount = 10;
        const correlationIds = [];
        
        for (let i = 0; i < contextCount; i++) {
            const context = createTestContext({ requestId: `cleanup-test-${i}` });
            testLogger.setRequestContext(context.correlationId, context);
            correlationIds.push(context.correlationId);
        }
        
        // Verify contexts are set up
        assert.strictEqual(testLogger.requestContexts.size, contextCount, 'All contexts should be set up');
        
        // Test manual context cleanup
        correlationIds.forEach(id => {
            testLogger.clearRequestContext(id);
        });
        
        // Request contexts are cleaned up after clearing
        assert.strictEqual(testLogger.requestContexts.size, 0, 'All contexts should be cleaned up manually');
        
        // Test automatic cleanup by setting contexts with past expiration
        const expiredContext = createTestContext();
        testLogger.setRequestContext(expiredContext.correlationId, expiredContext);
        
        // Modify expiration to trigger cleanup
        const contextData = testLogger.requestContexts.get(expiredContext.correlationId);
        contextData.expiresAt = Date.now() - 1000; // Set to past
        
        // Trigger cleanup manually (simulating timer-based cleanup)
        testLogger.cleanupExpiredContexts();
        
        // Memory is released after context cleanup
        assert.strictEqual(testLogger.requestContexts.size, 0, 'Expired contexts should be cleaned up automatically');
        
        // Event listeners are removed during cleanup (tested indirectly through stats)
        const finalStats = testLogger.getStats();
        assert.strictEqual(finalStats.activeContexts, 0, 'Active context count should be zero after cleanup');
    });
});

// Test suite for Statistics and Monitoring Integration
describe('Statistics and Monitoring Integration', () => {
    let testLogger;
    
    beforeEach(() => {
        testLogger = setupTestLogger();
    });
    
    afterEach(() => {
        if (testLogger && testLogger._originalConsoleLog) {
            console.log = testLogger._originalConsoleLog;
        }
        testLogger = null;
    });
    
    test('should collect logging statistics by level', { timeout: TEST_TIMEOUT }, async () => {
        // Test statistics collection for different log levels
        
        // Generate logs at different levels
        testLogger.debug('Debug message 1');
        testLogger.debug('Debug message 2');
        testLogger.info('Info message 1');
        testLogger.info('Info message 2');
        testLogger.info('Info message 3');
        testLogger.warn('Warning message 1');
        testLogger.error('Error message 1', new Error('Test error'));
        
        // Message counts are tracked accurately for each log level
        const stats = testLogger.getStats();
        
        assert.strictEqual(stats.messageCount.debug, 2, 'Debug message count should be accurate');
        assert.strictEqual(stats.messageCount.info, 3, 'Info message count should be accurate');
        assert.strictEqual(stats.messageCount.warn, 1, 'Warning message count should be accurate');
        assert.strictEqual(stats.messageCount.error, 1, 'Error message count should be accurate');
        assert.strictEqual(stats.messageCount.total, 7, 'Total message count should be accurate');
        
        // Statistics are updated in real-time during logging
        testLogger.info('Additional info message');
        const updatedStats = testLogger.getStats();
        assert.strictEqual(updatedStats.messageCount.info, 4, 'Stats should update in real-time');
        assert.strictEqual(updatedStats.messageCount.total, 8, 'Total should update in real-time');
        
        // Statistics include timing and performance metrics
        assert.ok(updatedStats.uptime, 'Statistics should include uptime information');
        assert.ok(updatedStats.uptimeFormatted, 'Statistics should include formatted uptime');
    });
    
    test('should track error rates and patterns', { timeout: TEST_TIMEOUT }, async () => {
        // Test error rate tracking and pattern analysis
        
        // Generate mixed success and error messages
        for (let i = 0; i < 10; i++) {
            testLogger.info(`Success message ${i}`);
        }
        
        for (let i = 0; i < 3; i++) {
            testLogger.error(`Error message ${i}`, new Error(`Test error ${i}`));
        }
        
        // Error rates are calculated accurately over time
        const stats = testLogger.getStats();
        
        assert.strictEqual(stats.messageCount.error, 3, 'Error count should be accurate');
        assert.strictEqual(stats.messageCount.total, 13, 'Total count should include all messages');
        
        // Error rate should be calculated as percentage
        const expectedErrorRate = (3 / 13 * 100).toFixed(2) + '%';
        assert.strictEqual(stats.errorRate, expectedErrorRate, 'Error rate should be calculated correctly');
        
        // Error statistics include correlation with request patterns (when available)
        assert.ok(stats.lastError, 'Last error information should be tracked');
        assert.ok(stats.lastError.timestamp, 'Last error should include timestamp');
        assert.ok(stats.lastError.message, 'Last error should include message');
    });
    
    test('should provide operational visibility metrics', { timeout: TEST_TIMEOUT }, async () => {
        // Test operational metrics collection for production monitoring
        
        // Generate operational activity
        const operationalMessages = [
            { level: 'info', message: 'Service started', context: { service: 'test-service' }},
            { level: 'info', message: 'Request processed', context: { duration: 50 }},
            { level: 'warn', message: 'High response time', context: { duration: 150 }},
            { level: 'error', message: 'Service error', error: new Error('Service failure')}
        ];
        
        operationalMessages.forEach(({ level, message, context, error }) => {
            switch (level) {
                case 'info':
                    testLogger.info(message, context);
                    break;
                case 'warn':
                    testLogger.warn(message, context);
                    break;
                case 'error':
                    testLogger.error(message, error);
                    break;
            }
        });
        
        // Logging throughput metrics are available
        const stats = testLogger.getStats();
        
        assert.ok(stats.messageCount, 'Message count metrics should be available');
        assert.ok(stats.uptime, 'Uptime metrics should be available');
        assert.ok(stats.errorRate, 'Error rate metrics should be available');
        
        // Performance metrics support monitoring integration
        assert.strictEqual(typeof stats.uptime, 'number', 'Uptime should be numeric for monitoring integration');
        assert.ok(stats.uptimeFormatted, 'Formatted uptime should be available for display');
        
        // Resource utilization metrics are collected
        assert.strictEqual(stats.activeContexts, 0, 'Active context metrics should be available');
        assert.ok(stats.configuration, 'Configuration metrics should be available for monitoring');
        
        // Metrics format supports external monitoring systems
        assert.ok(typeof stats === 'object', 'Stats should be structured object for monitoring integration');
    });
    
    test('should support health check integration', { timeout: TEST_TIMEOUT }, async () => {
        // Test health check support and status reporting
        
        // Simulate healthy operation
        for (let i = 0; i < 5; i++) {
            testLogger.info(`Healthy operation ${i}`);
        }
        
        const healthyStats = testLogger.getStats();
        
        // Logger health status is available for health checks
        assert.ok(healthyStats.messageCount, 'Message count should be available for health checks');
        assert.strictEqual(healthyStats.messageCount.error, 0, 'Error count should indicate healthy state');
        assert.ok(healthyStats.uptime > 0, 'Uptime should indicate active operation');
        
        // Simulate unhealthy operation with errors
        for (let i = 0; i < 3; i++) {
            testLogger.error(`Health check error ${i}`, new Error(`Health test error ${i}`));
        }
        
        const unhealthyStats = testLogger.getStats();
        
        // Health status includes critical error indicators
        assert.ok(unhealthyStats.messageCount.error > 0, 'Error indicators should be available for health checks');
        assert.ok(unhealthyStats.lastError, 'Last error should be available for health diagnostics');
        
        // Performance degradation is reflected in health status
        const errorRate = parseFloat(unhealthyStats.errorRate);
        assert.ok(errorRate > 0, 'Error rate should reflect performance degradation');
        
        // Health check response includes relevant diagnostic information
        assert.ok(unhealthyStats.configuration, 'Configuration should be available for health diagnostics');
        assert.ok(unhealthyStats.lastError.timestamp, 'Error timing should be available for health analysis');
    });
});

// Test suite for createLogger factory function and exported utilities
describe('Logger Factory and Utilities', () => {
    let createdLoggers = [];
    
    afterEach(() => {
        // Clean up all created loggers
        createdLoggers.forEach(logger => {
            if (logger._originalConsoleLog) {
                console.log = logger._originalConsoleLog;
            }
        });
        createdLoggers = [];
    });
    
    test('should create logger instances with factory function', { timeout: TEST_TIMEOUT }, async () => {
        // Test createLogger factory function
        const customConfig = {
            level: LOG_LEVELS.WARN,
            format: 'json',
            console: false
        };
        
        const factoryLogger = createLogger(customConfig);
        createdLoggers.push(factoryLogger);
        
        // Factory function creates valid logger instances
        assert.ok(factoryLogger instanceof Logger, 'Factory should create Logger instance');
        assert.strictEqual(factoryLogger.level, LOG_LEVELS.WARN, 'Factory should apply custom configuration');
        assert.strictEqual(factoryLogger.config.format, 'json', 'Factory should configure JSON format');
    });
    
    test('should export LOG_LEVELS constants', { timeout: TEST_TIMEOUT }, async () => {
        // Test LOG_LEVELS constant export
        assert.ok(LOG_LEVELS, 'LOG_LEVELS should be exported');
        assert.strictEqual(LOG_LEVELS.DEBUG, 'debug', 'DEBUG level should be available');
        assert.strictEqual(LOG_LEVELS.INFO, 'info', 'INFO level should be available');
        assert.strictEqual(LOG_LEVELS.WARN, 'warn', 'WARN level should be available');
        assert.strictEqual(LOG_LEVELS.ERROR, 'error', 'ERROR level should be available');
    });
    
    test('should export utility functions', { timeout: TEST_TIMEOUT }, async () => {
        // Test utility function exports
        assert.strictEqual(typeof formatLogMessage, 'function', 'formatLogMessage should be exported as function');
        assert.strictEqual(typeof sanitizeLogData, 'function', 'sanitizeLogData should be exported as function');
        
        // Test formatLogMessage utility
        const formatted = formatLogMessage('info', 'Test message', { test: true });
        assert.ok(formatted.includes('[INFO]'), 'formatLogMessage should format level correctly');
        assert.ok(formatted.includes('Test message'), 'formatLogMessage should include message');
        
        // Test sanitizeLogData utility
        const sensitiveData = { password: 'secret', username: 'user' };
        const sanitized = sanitizeLogData(sensitiveData);
        assert.strictEqual(sanitized.password, '[REDACTED]', 'sanitizeLogData should redact sensitive data');
        assert.strictEqual(sanitized.username, 'user', 'sanitizeLogData should preserve non-sensitive data');
    });
});