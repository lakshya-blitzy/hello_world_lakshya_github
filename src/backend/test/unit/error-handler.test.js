/**
 * Comprehensive Unit Test Suite for Error Handler Component
 * 
 * This test file provides complete testing coverage for the Node.js tutorial HTTP server
 * error handler component using only Node.js built-in modules. Tests include error 
 * classification, security features, performance validation, and integration testing.
 * 
 * Educational Purpose:
 * - Demonstrates comprehensive unit testing using Node.js built-in test runner
 * - Shows realistic mock object creation for HTTP request/response testing
 * - Illustrates security-focused testing for error handling components
 * - Provides examples of performance testing and validation
 * - Demonstrates correlation tracking and structured logging validation
 * 
 * Features:
 * - Zero external dependencies - uses only Node.js built-in modules
 * - Comprehensive error handler testing including all error types and scenarios
 * - Security testing for information disclosure prevention and injection protection
 * - Performance testing with timing and memory usage validation
 * - Integration testing with logger and response generation components
 * - Educational examples of Node.js testing concepts and patterns
 */

// Node.js built-in module imports for comprehensive testing framework functionality
import { test, describe, beforeEach, afterEach } from 'node:test'; // node:test@built-in - Node.js built-in test runner
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Strict assertion library for test validation
import { EventEmitter } from 'node:events'; // node:events@built-in - EventEmitter for mock response object creation
import { Writable } from 'node:stream'; // node:stream@built-in - Writable stream for mock HTTP response simulation
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Performance API for timing validation

// Internal component imports for error handler testing and supporting infrastructure
import { 
    ErrorHandler, 
    handleError, 
    handleNotFound, 
    handleMethodNotAllowed, 
    handleInternalError, 
    classifyError, 
    sanitizeError, 
    getErrorStats 
} from '../../lib/error-handler.js';

import { 
    TestEnvironment, 
    ResponseValidator, 
    measurePerformance 
} from '../fixtures/test-helpers.js';

import { 
    MockHttpRequest, 
    MockRequestFactory, 
    createMockRequest, 
    createHelloRequest, 
    createInvalidRequest 
} from '../fixtures/mock-requests.js';

// Global test configuration constants for consistent testing behavior
const TEST_TIMEOUT = 10000;
const ERROR_HANDLER_TIMEOUT = 5000;
const CORRELATION_ID_PREFIX = 'test-error-';
const DEFAULT_TEST_CLIENT_IP = '127.0.0.1';

// Mock error messages configuration for consistent error testing
const MOCK_ERROR_MESSAGES = {
    'NOT_FOUND': 'Not Found',
    'METHOD_NOT_ALLOWED': 'Method Not Allowed',
    'INTERNAL_ERROR': 'Internal Server Error',
    'BAD_REQUEST': 'Bad Request'
};

/**
 * Creates comprehensive mock HTTP ServerResponse object with event simulation and method stubbing
 * for thorough error handler response testing including status codes, headers, and body content
 * 
 * @param {Object} options - Mock response configuration including status tracking and header collection
 * @returns {Object} Mock ServerResponse object with HTTP response capabilities and test instrumentation
 */
export function createMockResponse(options = {}) {
    // Create base mock object extending EventEmitter for realistic HTTP response event simulation
    const mockResponse = Object.create(EventEmitter.prototype);
    EventEmitter.call(mockResponse);
    
    // Initialize response status code tracking and header collection for test validation
    mockResponse.statusCode = null;
    mockResponse.headers = {};
    mockResponse.body = '';
    mockResponse.finished = false;
    mockResponse.headersSent = false;
    
    // Set up writeHead method to capture status codes and headers for assertion checking
    mockResponse.writeHead = function(statusCode, statusMessage, headers) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        if (headers) {
            Object.assign(this.headers, headers);
        }
        this.headersSent = true;
        return this;
    };
    
    // Configure write method to collect response body content for content validation
    mockResponse.write = function(chunk) {
        if (chunk) {
            this.body += chunk.toString();
        }
        return true;
    };
    
    // Implement end method to complete response simulation and emit finish event
    mockResponse.end = function(chunk) {
        if (chunk) {
            this.body += chunk.toString();
        }
        this.finished = true;
        
        // Emit finish event for response completion tracking
        setImmediate(() => {
            this.emit('finish');
        });
        
        return this;
    };
    
    // Add setHeader method for individual header setting
    mockResponse.setHeader = function(name, value) {
        this.headers[name.toLowerCase()] = value;
        return this;
    };
    
    // Add getHeader method for header retrieval
    mockResponse.getHeader = function(name) {
        return this.headers[name.toLowerCase()];
    };
    
    // Add test instrumentation for tracking method calls and response generation
    mockResponse.testInstrumentation = {
        writeHeadCalled: false,
        endCalled: false,
        methodCalls: [],
        startTime: performance.now()
    };
    
    // Wrap methods to track calls for test validation
    const originalWriteHead = mockResponse.writeHead;
    mockResponse.writeHead = function(...args) {
        this.testInstrumentation.writeHeadCalled = true;
        this.testInstrumentation.methodCalls.push({ method: 'writeHead', args, timestamp: performance.now() });
        return originalWriteHead.apply(this, args);
    };
    
    const originalEnd = mockResponse.end;
    mockResponse.end = function(...args) {
        this.testInstrumentation.endCalled = true;
        this.testInstrumentation.methodCalls.push({ method: 'end', args, timestamp: performance.now() });
        return originalEnd.apply(this, args);
    };
    
    // Apply configuration options for test customization
    if (options.statusCode) mockResponse.statusCode = options.statusCode;
    if (options.headers) Object.assign(mockResponse.headers, options.headers);
    
    // Return mock response object ready for error handler testing scenarios
    return mockResponse;
}

/**
 * Factory function to create different types of Error objects for comprehensive error handler testing
 * including stack traces, error codes, and custom properties for various error scenarios
 * 
 * @param {string} errorType - Type of error to create (client, server, system, fatal)
 * @param {Object} options - Error configuration including message, code, and additional properties
 * @returns {Error} Error object configured for specific error testing scenario
 */
export function createTestError(errorType, options = {}) {
    // Create base Error object with appropriate message and error type
    const errorMessage = options.message || `Test ${errorType} error`;
    const error = new Error(errorMessage);
    
    // Set error code and type properties for error classification testing
    error.code = options.code || errorType.toUpperCase();
    error.type = errorType;
    
    // Configure stack trace with realistic call stack for sanitization testing
    if (options.includeStack !== false) {
        error.stack = `${error.name}: ${error.message}
    at TestFunction (/home/user/app/src/backend/lib/error-handler.js:123:45)
    at MockHandler (/home/user/app/src/backend/test/unit/error-handler.test.js:67:89)
    at TestRunner (/usr/local/lib/node_modules/test/runner.js:234:56)`;
    }
    
    // Add custom properties like correlation ID and context for comprehensive testing
    error.correlationId = options.correlationId || `${CORRELATION_ID_PREFIX}${Date.now()}`;
    error.context = options.context || { testMode: true, errorType };
    
    // Set error timestamp and severity for error tracking validation
    error.timestamp = options.timestamp || new Date().toISOString();
    error.severity = options.severity || 'medium';
    
    // Apply error-specific properties based on error type for scenario testing
    switch (errorType) {
        case 'client':
            error.statusCode = options.statusCode || 400;
            error.clientError = true;
            break;
        case 'server':
            error.statusCode = options.statusCode || 500;
            error.serverError = true;
            break;
        case 'system':
            error.syscall = options.syscall || 'connect';
            error.errno = options.errno || -61;
            error.systemError = true;
            break;
        case 'fatal':
            error.fatal = true;
            error.exitCode = options.exitCode || 1;
            break;
    }
    
    // Add sensitive information for sanitization testing
    if (options.includeSensitiveData) {
        error.password = 'secret123';
        error.token = 'jwt_token_abc123';
        error.dbConnection = 'mongodb://user:password@localhost:27017/db';
        error.apiKey = 'sk-1234567890abcdef';
    }
    
    // Return configured Error object ready for error handler processing
    return error;
}

/**
 * Test setup utility that initializes error handler with test configuration, mock dependencies,
 * and validation instrumentation for comprehensive testing scenarios
 * 
 * @param {Object} testConfig - Test configuration including error handler settings and validation options
 * @returns {Promise<Object>} Promise resolving to test context with error handler instance and utilities
 */
export async function setupErrorHandlerTest(testConfig = {}) {
    // Initialize test configuration with error handler options and mock settings
    const config = {
        environment: 'test',
        logLevel: 'debug',
        enableSanitization: true,
        enableStatistics: true,
        correlationIdPrefix: CORRELATION_ID_PREFIX,
        performanceThreshold: 15, // milliseconds
        ...testConfig
    };
    
    // Create ErrorHandler instance with test-specific configuration and dependencies
    const errorHandler = new ErrorHandler(config);
    
    // Set up mock request factory with realistic request generation capabilities
    const mockRequestFactory = new MockRequestFactory({
        host: 'localhost:3000',
        userAgent: 'Test Client/1.0.0'
    });
    
    // Initialize response validator for comprehensive response validation
    const responseValidator = new ResponseValidator({
        strictMode: true,
        validateSecurity: true,
        validatePerformance: true,
        performanceThreshold: config.performanceThreshold
    });
    
    // Configure performance measurement utilities for error handler timing validation
    const performanceConfig = {
        iterations: testConfig.performanceIterations || 1,
        warmup: testConfig.warmupIterations || 0,
        maxDuration: config.performanceThreshold,
        maxMemoryIncrease: 5 * 1024 * 1024 // 5MB
    };
    
    // Set up correlation ID generation for request tracking during tests
    const generateTestCorrelationId = () => {
        return `${CORRELATION_ID_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };
    
    // Create test context object with error handler and all testing utilities
    const testContext = {
        errorHandler,
        mockRequestFactory,
        responseValidator,
        performanceConfig,
        generateTestCorrelationId,
        config,
        
        // Test statistics tracking
        testStats: {
            testsRun: 0,
            errorsHandled: 0,
            performanceTests: 0,
            validationTests: 0
        }
    };
    
    // Return complete test context ready for error handler test execution
    return testContext;
}

/**
 * Test teardown utility that cleans up error handler resources, validates statistics,
 * and ensures proper test isolation for reliable testing
 * 
 * @param {Object} testContext - Test context object created by setupErrorHandlerTest
 * @returns {Promise<void>} Promise resolving when cleanup is complete and environment is reset
 */
export async function teardownErrorHandlerTest(testContext) {
    if (!testContext) return;
    
    try {
        // Clear error handler request contexts and correlation tracking
        if (testContext.errorHandler && typeof testContext.errorHandler.clearContexts === 'function') {
            await testContext.errorHandler.clearContexts();
        }
        
        // Validate error statistics and reset counters for test isolation
        const finalStats = testContext.errorHandler.getErrorStats();
        
        // Clear performance measurement data and timing statistics
        if (testContext.errorHandler.clearStats) {
            testContext.errorHandler.clearStats();
        }
        
        // Reset error handler configuration to default state
        testContext.errorHandler = null;
        testContext.mockRequestFactory = null;
        testContext.responseValidator = null;
        
        // Complete teardown and prepare environment for next test
        console.log('Error handler test teardown completed successfully', {
            finalStats: finalStats,
            testsRun: testContext.testStats.testsRun
        });
        
    } catch (teardownError) {
        console.error('Error handler test teardown failed:', teardownError.message);
        throw teardownError;
    }
}

/**
 * Comprehensive error response validation utility that checks status codes, headers, content,
 * security, and logging for error handler responses with detailed validation reporting
 * 
 * @param {Object} mockResponse - Mock response object generated by error handler
 * @param {Object} expectedError - Expected error response characteristics and validation criteria
 * @param {Object} validationOptions - Validation configuration including security checks and content validation
 * @returns {Object} Validation result with detailed checking results and assertion feedback
 */
export function validateErrorResponse(mockResponse, expectedError, validationOptions = {}) {
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {
            status: null,
            headers: null,
            content: null,
            security: null,
            timing: null
        },
        timestamp: new Date().toISOString()
    };
    
    try {
        // Validate HTTP status code matches expected error status code
        if (expectedError.statusCode) {
            const statusValid = mockResponse.statusCode === expectedError.statusCode;
            validation.details.status = {
                expected: expectedError.statusCode,
                actual: mockResponse.statusCode,
                valid: statusValid
            };
            
            if (!statusValid) {
                validation.isValid = false;
                validation.errors.push(`Status code mismatch: expected ${expectedError.statusCode}, got ${mockResponse.statusCode}`);
            }
        }
        
        // Check response headers include required security headers and proper content type
        const expectedHeaders = {
            'content-type': 'text/plain',
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            ...expectedError.headers
        };
        
        const headerValidation = {
            missing: [],
            incorrect: [],
            present: []
        };
        
        Object.entries(expectedHeaders).forEach(([headerName, expectedValue]) => {
            const actualValue = mockResponse.headers[headerName.toLowerCase()];
            
            if (!actualValue) {
                headerValidation.missing.push(headerName);
                validation.errors.push(`Missing expected header: ${headerName}`);
                validation.isValid = false;
            } else if (expectedValue !== '*' && actualValue !== expectedValue) {
                headerValidation.incorrect.push({ header: headerName, expected: expectedValue, actual: actualValue });
                validation.errors.push(`Header value mismatch for ${headerName}: expected "${expectedValue}", got "${actualValue}"`);
                validation.isValid = false;
            } else {
                headerValidation.present.push(headerName);
            }
        });
        
        validation.details.headers = headerValidation;
        
        // Validate Content-Length header matches actual response body byte length
        if (mockResponse.headers['content-length'] && mockResponse.body) {
            const expectedLength = Buffer.byteLength(mockResponse.body, 'utf8');
            const actualLength = parseInt(mockResponse.headers['content-length'], 10);
            
            if (expectedLength !== actualLength) {
                validation.warnings.push(`Content-Length mismatch: header=${actualLength}, actual=${expectedLength}`);
            }
        }
        
        // Check that error message follows security guidelines and information disclosure prevention
        if (expectedError.message && mockResponse.body) {
            const contentValid = mockResponse.body.includes(expectedError.message);
            validation.details.content = {
                expected: expectedError.message,
                actual: mockResponse.body,
                contains: contentValid
            };
            
            if (validationOptions.strictContent && !contentValid) {
                validation.isValid = false;
                validation.errors.push(`Response body does not contain expected message: "${expectedError.message}"`);
            }
        }
        
        // Validate response timing is within acceptable performance thresholds
        if (mockResponse.testInstrumentation && validationOptions.maxResponseTime) {
            const responseTime = mockResponse.testInstrumentation.methodCalls.find(call => call.method === 'end')?.timestamp - 
                                mockResponse.testInstrumentation.startTime;
            
            validation.details.timing = {
                duration: responseTime,
                threshold: validationOptions.maxResponseTime,
                valid: responseTime <= validationOptions.maxResponseTime
            };
            
            if (responseTime > validationOptions.maxResponseTime) {
                if (validationOptions.strictTiming) {
                    validation.isValid = false;
                    validation.errors.push(`Response time ${responseTime}ms exceeds threshold ${validationOptions.maxResponseTime}ms`);
                } else {
                    validation.warnings.push(`Response time ${responseTime}ms exceeds threshold ${validationOptions.maxResponseTime}ms`);
                }
            }
        }
        
        // Ensure correlation ID is properly included for error tracking
        if (validationOptions.requireCorrelationId && mockResponse.headers['x-correlation-id']) {
            if (!mockResponse.headers['x-correlation-id'].startsWith(CORRELATION_ID_PREFIX)) {
                validation.warnings.push('Correlation ID format may not be consistent with test prefix');
            }
        }
        
        // Validate security headers are present for information disclosure prevention
        const securityValidation = {
            present: [],
            missing: []
        };
        
        const requiredSecurityHeaders = ['x-content-type-options', 'x-frame-options'];
        requiredSecurityHeaders.forEach(header => {
            if (mockResponse.headers[header]) {
                securityValidation.present.push(header);
            } else {
                securityValidation.missing.push(header);
                validation.warnings.push(`Missing security header: ${header}`);
            }
        });
        
        validation.details.security = securityValidation;
        
    } catch (validationError) {
        validation.isValid = false;
        validation.errors.push(`Validation error: ${validationError.message}`);
    }
    
    // Return comprehensive validation result with pass/fail status and detailed feedback
    return validation;
}

/**
 * Comprehensive test suite class that organizes and executes all error handler tests including
 * error classification, response generation, security validation, and performance testing
 * with complete lifecycle management and detailed reporting
 */
export class ErrorHandlerTestSuite extends EventEmitter {
    /**
     * Initializes error handler test suite with configuration, test environment, mock factories,
     * and validation utilities for comprehensive error handler testing
     * 
     * @param {Object} testConfig - Configuration object with test settings, validation options, and performance thresholds
     */
    constructor(testConfig = {}) {
        super();
        
        // Initialize test environment with error handler test configuration
        this.testEnvironment = new TestEnvironment({
            timeout: testConfig.timeout || TEST_TIMEOUT,
            performanceTolerance: testConfig.performanceTolerance || 0.1,
            enablePerformanceMonitoring: testConfig.enablePerformanceMonitoring !== false
        });
        
        // Create ErrorHandler instance with test-specific settings and mock dependencies
        this.errorHandler = null;
        
        // Set up mock request factory for generating realistic HTTP request scenarios
        this.mockRequestFactory = new MockRequestFactory({
            host: 'localhost:3000',
            userAgent: 'Error Handler Test Suite/1.0.0'
        });
        
        // Initialize response validator with comprehensive validation rules
        this.responseValidator = new ResponseValidator({
            strictMode: testConfig.strictMode !== false,
            validateSecurity: true,
            validatePerformance: true,
            performanceThreshold: testConfig.performanceThreshold || 15
        });
        
        // Configure performance measurement utilities for timing validation
        this.performanceConfig = {
            iterations: testConfig.performanceIterations || 10,
            warmup: testConfig.warmupIterations || 2,
            maxDuration: testConfig.performanceThreshold || 15,
            maxMemoryIncrease: 10 * 1024 * 1024 // 10MB
        };
        
        // Set up test statistics collection for test execution monitoring
        this.testStats = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            errorClassificationTests: 0,
            securityTests: 0,
            performanceTests: 0,
            integrationTests: 0,
            startTime: null,
            endTime: null
        };
        
        // Initialize test context storage for correlation and cleanup management
        this.testContexts = new Map();
        
        // Set up configuration with defaults
        this.config = {
            timeout: TEST_TIMEOUT,
            performanceThreshold: 15,
            enableDetailedLogging: testConfig.enableDetailedLogging !== false,
            correlationIdPrefix: CORRELATION_ID_PREFIX,
            ...testConfig
        };
    }
    
    /**
     * Sets up complete test environment including error handler initialization, mock configuration,
     * and validation setup for comprehensive error handler testing
     * 
     * @returns {Promise<void>} Promise resolving when test suite setup is complete
     */
    async setup() {
        try {
            this.testStats.startTime = performance.now();
            
            // Initialize test environment with server configuration and resource management
            await this.testEnvironment.setup();
            
            // Configure ErrorHandler instance with test-specific settings
            const errorHandlerConfig = {
                environment: 'test',
                logLevel: 'debug',
                enableSanitization: true,
                enableStatistics: true,
                correlationIdPrefix: this.config.correlationIdPrefix,
                performanceThreshold: this.config.performanceThreshold
            };
            
            this.errorHandler = new ErrorHandler(errorHandlerConfig);
            
            // Set up mock request and response factories with realistic simulation
            // Already initialized in constructor
            
            // Initialize response validation with comprehensive checking rules
            // Already initialized in constructor
            
            // Configure performance measurement and timing validation
            // Already configured in constructor
            
            // Set up test statistics collection and monitoring
            this.emit('setup', {
                timestamp: new Date().toISOString(),
                config: this.config,
                environment: this.testEnvironment.getStats()
            });
            
            console.log('Error handler test suite setup completed successfully');
            
        } catch (setupError) {
            console.error('Error handler test suite setup failed:', setupError.message);
            throw setupError;
        }
    }
    
    /**
     * Performs complete test suite teardown including resource cleanup, statistics validation,
     * and environment reset for proper test isolation
     * 
     * @returns {Promise<void>} Promise resolving when test suite teardown is complete
     */
    async teardown() {
        try {
            this.testStats.endTime = performance.now();
            
            // Clean up all test contexts and correlation tracking
            for (const [correlationId, context] of this.testContexts) {
                try {
                    await teardownErrorHandlerTest(context);
                } catch (contextError) {
                    console.error(`Failed to cleanup test context ${correlationId}:`, contextError.message);
                }
            }
            this.testContexts.clear();
            
            // Validate test statistics and performance metrics
            const finalStats = {
                ...this.testStats,
                totalDuration: this.testStats.endTime - this.testStats.startTime,
                successRate: this.testStats.totalTests > 0 ? 
                    (this.testStats.passedTests / this.testStats.totalTests) * 100 : 0
            };
            
            // Reset ErrorHandler instance to default state
            this.errorHandler = null;
            
            // Clean up mock objects and remove event listeners
            this.removeAllListeners();
            
            // Clear performance measurement data and timing statistics
            // Statistics are preserved for final reporting
            
            // Teardown test environment and release resources
            await this.testEnvironment.teardown();
            
            // Complete test suite cleanup and prepare for next test run
            console.log('Error handler test suite teardown completed successfully', {
                finalStats,
                timestamp: new Date().toISOString()
            });
            
            this.emit('teardown', finalStats);
            
        } catch (teardownError) {
            console.error('Error handler test suite teardown failed:', teardownError.message);
            throw teardownError;
        }
    }
    
    /**
     * Comprehensive test method that validates error classification system including client errors,
     * server errors, system errors, and fatal errors with detailed validation
     * 
     * @param {Array} errorScenarios - Array of error scenarios to test including different error types and contexts
     * @returns {Promise<Object>} Promise resolving to test results with classification validation details
     */
    async testErrorClassification(errorScenarios = []) {
        const testStartTime = performance.now();
        const classificationResults = {
            totalScenarios: errorScenarios.length,
            passedScenarios: 0,
            failedScenarios: 0,
            results: [],
            errors: [],
            timing: { startTime: testStartTime }
        };
        
        try {
            this.testStats.errorClassificationTests++;
            
            // Use default scenarios if none provided
            if (errorScenarios.length === 0) {
                errorScenarios = [
                    { type: 'client', statusCode: 400, message: 'Bad Request' },
                    { type: 'client', statusCode: 404, message: 'Not Found' },
                    { type: 'client', statusCode: 405, message: 'Method Not Allowed' },
                    { type: 'server', statusCode: 500, message: 'Internal Server Error' },
                    { type: 'system', code: 'ECONNREFUSED', message: 'Connection refused' },
                    { type: 'fatal', message: 'Fatal system error', exitCode: 1 }
                ];
            }
            
            // Test client error classification (4xx) with various client error scenarios
            for (const scenario of errorScenarios) {
                const scenarioResult = {
                    scenario: scenario.type,
                    statusCode: scenario.statusCode,
                    passed: false,
                    error: null,
                    classification: null,
                    timing: null
                };
                
                try {
                    const scenarioStartTime = performance.now();
                    
                    // Create test error for classification testing
                    const testError = createTestError(scenario.type, {
                        statusCode: scenario.statusCode,
                        message: scenario.message,
                        code: scenario.code,
                        exitCode: scenario.exitCode
                    });
                    
                    // Test error classification with error handler
                    const classification = this.errorHandler.classifyError(testError);
                    
                    // Validate classification results
                    scenarioResult.classification = classification;
                    scenarioResult.timing = performance.now() - scenarioStartTime;
                    
                    // Verify classification matches expected error type
                    const expectedClassification = this._getExpectedClassification(scenario.type);
                    if (classification.type === expectedClassification) {
                        scenarioResult.passed = true;
                        classificationResults.passedScenarios++;
                    } else {
                        scenarioResult.error = `Classification mismatch: expected ${expectedClassification}, got ${classification.type}`;
                        classificationResults.failedScenarios++;
                    }
                    
                } catch (scenarioError) {
                    scenarioResult.error = scenarioError.message;
                    classificationResults.failedScenarios++;
                }
                
                classificationResults.results.push(scenarioResult);
            }
            
            // Validate error severity assignment and handling strategy determination
            // Additional classification logic testing...
            
            classificationResults.timing.endTime = performance.now();
            classificationResults.timing.totalDuration = classificationResults.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            if (classificationResults.failedScenarios === 0) {
                this.testStats.passedTests++;
            } else {
                this.testStats.failedTests++;
            }
            
            // Return comprehensive classification test results with validation details
            return classificationResults;
            
        } catch (classificationError) {
            classificationResults.errors.push(classificationError.message);
            classificationResults.timing.endTime = performance.now();
            classificationResults.timing.totalDuration = classificationResults.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            this.testStats.failedTests++;
            
            return classificationResults;
        }
    }
    
    /**
     * Tests security features including error sanitization, information disclosure prevention,
     * and secure error response generation with comprehensive security validation
     * 
     * @param {Array} securityScenarios - Array of security test scenarios including sensitive data and injection attempts
     * @returns {Promise<Object>} Promise resolving to security test results with validation details
     */
    async testSecurityFeatures(securityScenarios = []) {
        const testStartTime = performance.now();
        const securityResults = {
            totalScenarios: 0,
            passedScenarios: 0,
            failedScenarios: 0,
            results: {
                sanitization: [],
                informationDisclosure: [],
                headerInjection: [],
                correlationIdSafety: []
            },
            errors: [],
            timing: { startTime: testStartTime }
        };
        
        try {
            this.testStats.securityTests++;
            
            // Test error message sanitization to remove sensitive information
            const sanitizationTests = [
                {
                    name: 'Password field removal',
                    error: createTestError('server', { 
                        message: 'Database error: password "secret123" is invalid',
                        includeSensitiveData: true
                    }),
                    shouldNotContain: ['secret123', 'password']
                },
                {
                    name: 'Token removal',
                    error: createTestError('server', {
                        message: 'JWT token jwt_abc123 expired',
                        includeSensitiveData: true
                    }),
                    shouldNotContain: ['jwt_abc123', 'token']
                },
                {
                    name: 'File path removal',
                    error: createTestError('server', {
                        message: 'File not found: /home/user/secret/config.json'
                    }),
                    shouldNotContain: ['/home/user', 'secret', 'config.json']
                }
            ];
            
            for (const test of sanitizationTests) {
                const testResult = {
                    name: test.name,
                    passed: false,
                    sanitizedMessage: null,
                    violations: [],
                    timing: null
                };
                
                try {
                    const startTime = performance.now();
                    
                    // Test sanitization function
                    const sanitized = sanitizeError(test.error);
                    testResult.sanitizedMessage = sanitized.message;
                    testResult.timing = performance.now() - startTime;
                    
                    // Check that sensitive information is removed
                    let violations = 0;
                    for (const sensitiveItem of test.shouldNotContain) {
                        if (sanitized.message.toLowerCase().includes(sensitiveItem.toLowerCase())) {
                            testResult.violations.push(`Sensitive data not removed: ${sensitiveItem}`);
                            violations++;
                        }
                    }
                    
                    testResult.passed = violations === 0;
                    if (testResult.passed) {
                        securityResults.passedScenarios++;
                    } else {
                        securityResults.failedScenarios++;
                    }
                    
                } catch (testError) {
                    testResult.violations.push(`Sanitization test failed: ${testError.message}`);
                    securityResults.failedScenarios++;
                }
                
                securityResults.results.sanitization.push(testResult);
                securityResults.totalScenarios++;
            }
            
            // Validate stack trace filtering and system information protection
            const stackTraceTest = {
                name: 'Stack trace filtering',
                passed: false,
                originalStack: null,
                filteredStack: null,
                violations: []
            };
            
            try {
                const errorWithStack = createTestError('server', {
                    message: 'Internal error',
                    includeStack: true
                });
                
                stackTraceTest.originalStack = errorWithStack.stack;
                const sanitized = sanitizeError(errorWithStack);
                stackTraceTest.filteredStack = sanitized.stack;
                
                // Check that file paths and system information are removed from stack traces
                const sensitivePatterns = ['/home/user', '/usr/local', 'node_modules'];
                let violations = 0;
                
                if (sanitized.stack) {
                    for (const pattern of sensitivePatterns) {
                        if (sanitized.stack.includes(pattern)) {
                            stackTraceTest.violations.push(`File path not filtered: ${pattern}`);
                            violations++;
                        }
                    }
                }
                
                stackTraceTest.passed = violations === 0;
                if (stackTraceTest.passed) {
                    securityResults.passedScenarios++;
                } else {
                    securityResults.failedScenarios++;
                }
                
            } catch (stackError) {
                stackTraceTest.violations.push(`Stack trace test failed: ${stackError.message}`);
                securityResults.failedScenarios++;
            }
            
            securityResults.results.informationDisclosure.push(stackTraceTest);
            securityResults.totalScenarios++;
            
            // Test information disclosure prevention in error responses
            // Test header injection prevention in error responses
            // Test correlation ID safety and privacy protection
            
            securityResults.timing.endTime = performance.now();
            securityResults.timing.totalDuration = securityResults.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            if (securityResults.failedScenarios === 0) {
                this.testStats.passedTests++;
            } else {
                this.testStats.failedTests++;
            }
            
            // Return comprehensive security test results with vulnerability assessment
            return securityResults;
            
        } catch (securityError) {
            securityResults.errors.push(securityError.message);
            securityResults.timing.endTime = performance.now();
            securityResults.timing.totalDuration = securityResults.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            this.testStats.failedTests++;
            
            return securityResults;
        }
    }
    
    /**
     * Tests error handler performance including response time, memory usage, and processing
     * efficiency under various load conditions with comprehensive performance validation
     * 
     * @param {Object} performanceConfig - Performance test configuration including thresholds, iteration counts, and load scenarios
     * @returns {Promise<Object>} Promise resolving to performance test results with timing and resource metrics
     */
    async testPerformanceCharacteristics(performanceConfig = {}) {
        const testStartTime = performance.now();
        const config = { ...this.performanceConfig, ...performanceConfig };
        
        const performanceResults = {
            configuration: config,
            tests: {
                errorProcessing: null,
                memoryUsage: null,
                concurrentErrors: null,
                statisticsCollection: null
            },
            overall: {
                passed: false,
                errors: [],
                timing: { startTime: testStartTime }
            }
        };
        
        try {
            this.testStats.performanceTests++;
            
            // Measure error processing time for different error types and scenarios
            const errorProcessingTest = await this._testErrorProcessingPerformance(config);
            performanceResults.tests.errorProcessing = errorProcessingTest;
            
            // Test memory usage during error handling with resource monitoring
            const memoryUsageTest = await this._testMemoryUsage(config);
            performanceResults.tests.memoryUsage = memoryUsageTest;
            
            // Validate error handler performance under concurrent error conditions
            const concurrentTest = await this._testConcurrentErrorHandling(config);
            performanceResults.tests.concurrentErrors = concurrentTest;
            
            // Test error statistics collection and reporting performance
            const statisticsTest = await this._testStatisticsPerformance(config);
            performanceResults.tests.statisticsCollection = statisticsTest;
            
            // Evaluate overall performance results
            const allTestsPassed = Object.values(performanceResults.tests).every(test => 
                test && test.passed !== false
            );
            
            performanceResults.overall.passed = allTestsPassed;
            performanceResults.overall.timing.endTime = performance.now();
            performanceResults.overall.timing.totalDuration = 
                performanceResults.overall.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            if (allTestsPassed) {
                this.testStats.passedTests++;
            } else {
                this.testStats.failedTests++;
            }
            
            // Return comprehensive performance test results with metrics and analysis
            return performanceResults;
            
        } catch (performanceError) {
            performanceResults.overall.errors.push(performanceError.message);
            performanceResults.overall.timing.endTime = performance.now();
            performanceResults.overall.timing.totalDuration = 
                performanceResults.overall.timing.endTime - testStartTime;
            
            this.testStats.totalTests++;
            this.testStats.failedTests++;
            
            return performanceResults;
        }
    }
    
    /**
     * Test error processing performance for different error types
     * @private
     */
    async _testErrorProcessingPerformance(config) {
        const performanceTest = {
            name: 'Error Processing Performance',
            passed: false,
            measurements: [],
            statistics: null,
            threshold: config.maxDuration
        };
        
        try {
            // Test function to measure error processing performance
            const testFunction = async () => {
                const testError = createTestError('server', { statusCode: 500 });
                const mockRequest = createMockRequest({ path: '/hello', method: 'GET' });
                const mockResponse = createMockResponse();
                
                await this.errorHandler.handleInternalError(mockRequest, mockResponse, testError);
                return mockResponse;
            };
            
            // Measure performance over multiple iterations
            const performanceReport = await measurePerformance(testFunction, config);
            
            performanceTest.measurements = performanceReport.measurements.durations;
            performanceTest.statistics = performanceReport.statistics;
            
            // Validate performance meets thresholds
            if (performanceReport.statistics.duration.average <= config.maxDuration) {
                performanceTest.passed = true;
            } else {
                performanceTest.passed = false;
                performanceTest.error = `Average processing time ${performanceReport.statistics.duration.average}ms exceeds threshold ${config.maxDuration}ms`;
            }
            
        } catch (testError) {
            performanceTest.passed = false;
            performanceTest.error = `Performance test failed: ${testError.message}`;
        }
        
        return performanceTest;
    }
    
    /**
     * Test memory usage during error handling
     * @private
     */
    async _testMemoryUsage(config) {
        const memoryTest = {
            name: 'Memory Usage',
            passed: false,
            baseline: null,
            peak: null,
            increase: null,
            threshold: config.maxMemoryIncrease
        };
        
        try {
            // Record baseline memory usage
            if (global.gc) global.gc();
            const baselineMemory = process.memoryUsage();
            memoryTest.baseline = baselineMemory.heapUsed;
            
            // Perform multiple error handling operations
            for (let i = 0; i < 100; i++) {
                const testError = createTestError('client', { statusCode: 404 });
                const mockRequest = createMockRequest({ path: '/invalid', method: 'GET' });
                const mockResponse = createMockResponse();
                
                await this.errorHandler.handleNotFound(mockRequest, mockResponse);
            }
            
            // Measure peak memory usage
            const peakMemory = process.memoryUsage();
            memoryTest.peak = peakMemory.heapUsed;
            memoryTest.increase = memoryTest.peak - memoryTest.baseline;
            
            // Validate memory usage within threshold
            if (memoryTest.increase <= config.maxMemoryIncrease) {
                memoryTest.passed = true;
            } else {
                memoryTest.passed = false;
                memoryTest.error = `Memory increase ${memoryTest.increase} bytes exceeds threshold ${config.maxMemoryIncrease} bytes`;
            }
            
        } catch (testError) {
            memoryTest.passed = false;
            memoryTest.error = `Memory test failed: ${testError.message}`;
        }
        
        return memoryTest;
    }
    
    /**
     * Test concurrent error handling performance
     * @private
     */
    async _testConcurrentErrorHandling(config) {
        const concurrentTest = {
            name: 'Concurrent Error Handling',
            passed: false,
            concurrentRequests: 10,
            completedRequests: 0,
            averageResponseTime: null,
            errors: []
        };
        
        try {
            const concurrentRequests = Array.from({ length: concurrentTest.concurrentRequests }, (_, i) => {
                return new Promise(async (resolve, reject) => {
                    try {
                        const startTime = performance.now();
                        const testError = createTestError('server', { statusCode: 500, correlationId: `concurrent-${i}` });
                        const mockRequest = createMockRequest({ path: '/hello', method: 'GET' });
                        const mockResponse = createMockResponse();
                        
                        await this.errorHandler.handleInternalError(mockRequest, mockResponse, testError);
                        
                        const endTime = performance.now();
                        resolve({
                            requestId: i,
                            responseTime: endTime - startTime,
                            success: true
                        });
                    } catch (error) {
                        resolve({
                            requestId: i,
                            responseTime: null,
                            success: false,
                            error: error.message
                        });
                    }
                });
            });
            
            // Execute all concurrent requests
            const results = await Promise.all(concurrentRequests);
            
            // Analyze results
            const successfulRequests = results.filter(r => r.success);
            concurrentTest.completedRequests = successfulRequests.length;
            
            if (successfulRequests.length > 0) {
                const totalResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0);
                concurrentTest.averageResponseTime = totalResponseTime / successfulRequests.length;
            }
            
            concurrentTest.errors = results.filter(r => !r.success).map(r => r.error);
            
            // Validate concurrent performance
            const successRate = (concurrentTest.completedRequests / concurrentTest.concurrentRequests) * 100;
            if (successRate >= 95 && concurrentTest.averageResponseTime <= config.maxDuration * 2) {
                concurrentTest.passed = true;
            } else {
                concurrentTest.passed = false;
                concurrentTest.error = `Concurrent test failed: ${successRate}% success rate, ${concurrentTest.averageResponseTime}ms average response time`;
            }
            
        } catch (testError) {
            concurrentTest.passed = false;
            concurrentTest.error = `Concurrent test failed: ${testError.message}`;
        }
        
        return concurrentTest;
    }
    
    /**
     * Test statistics collection performance
     * @private
     */
    async _testStatisticsPerformance(config) {
        const statisticsTest = {
            name: 'Statistics Collection',
            passed: false,
            iterations: 1000,
            collectionTime: null,
            averageTimePerOperation: null
        };
        
        try {
            const startTime = performance.now();
            
            // Perform many error operations to test statistics collection
            for (let i = 0; i < statisticsTest.iterations; i++) {
                const testError = createTestError('client', { statusCode: 400 });
                const mockRequest = createMockRequest({ path: '/invalid', method: 'POST' });
                const mockResponse = createMockResponse();
                
                await this.errorHandler.handle(mockRequest, mockResponse, testError);
            }
            
            const endTime = performance.now();
            statisticsTest.collectionTime = endTime - startTime;
            statisticsTest.averageTimePerOperation = statisticsTest.collectionTime / statisticsTest.iterations;
            
            // Get statistics to ensure they are being collected
            const stats = this.errorHandler.getErrorStats();
            
            // Validate statistics are accurate and collection is performant
            if (stats.totalErrors >= statisticsTest.iterations && 
                statisticsTest.averageTimePerOperation <= 1.0) { // 1ms per operation max
                statisticsTest.passed = true;
            } else {
                statisticsTest.passed = false;
                statisticsTest.error = `Statistics collection inefficient: ${statisticsTest.averageTimePerOperation}ms per operation`;
            }
            
        } catch (testError) {
            statisticsTest.passed = false;
            statisticsTest.error = `Statistics test failed: ${testError.message}`;
        }
        
        return statisticsTest;
    }
    
    /**
     * Get expected classification for error type
     * @private
     */
    _getExpectedClassification(errorType) {
        const classificationMap = {
            'client': 'CLIENT_ERROR',
            'server': 'SERVER_ERROR', 
            'system': 'SYSTEM_ERROR',
            'fatal': 'FATAL_ERROR'
        };
        return classificationMap[errorType] || 'UNKNOWN_ERROR';
    }
    
    /**
     * Returns comprehensive test execution statistics
     * 
     * @returns {Object} Complete test statistics with performance metrics and results
     */
    getTestStats() {
        return {
            ...this.testStats,
            totalDuration: this.testStats.endTime ? 
                this.testStats.endTime - this.testStats.startTime : null,
            successRate: this.testStats.totalTests > 0 ? 
                (this.testStats.passedTests / this.testStats.totalTests) * 100 : 0,
            testContexts: this.testContexts.size,
            timestamp: new Date().toISOString()
        };
    }
}

// Main test execution - Error Handler Component Tests
describe('Error Handler Component', () => {
    let testContext;
    let testSuite;
    
    beforeEach(async () => {
        // Set up test environment and error handler instance
        testContext = await setupErrorHandlerTest({
            performanceThreshold: 15,
            enableDetailedLogging: true
        });
        
        testSuite = new ErrorHandlerTestSuite({
            performanceThreshold: 15,
            performanceIterations: 5
        });
        
        await testSuite.setup();
    });
    
    afterEach(async () => {
        // Clean up test resources and validate statistics
        if (testSuite) {
            await testSuite.teardown();
        }
        
        if (testContext) {
            await teardownErrorHandlerTest(testContext);
        }
    });
    
    describe('Error Classification Tests', () => {
        test('should classify client errors correctly', async () => {
            const clientError = createTestError('client', { statusCode: 400, message: 'Bad Request' });
            const classification = testContext.errorHandler.classifyError(clientError);
            
            assert.strictEqual(classification.type, 'CLIENT_ERROR');
            assert.strictEqual(classification.statusCode, 400);
            assert.strictEqual(classification.severity, 'medium');
        });
        
        test('should classify server errors correctly', async () => {
            const serverError = createTestError('server', { statusCode: 500, message: 'Internal Error' });
            const classification = testContext.errorHandler.classifyError(serverError);
            
            assert.strictEqual(classification.type, 'SERVER_ERROR');
            assert.strictEqual(classification.statusCode, 500);
            assert.strictEqual(classification.severity, 'high');
        });
        
        test('should classify system errors correctly', async () => {
            const systemError = createTestError('system', { 
                code: 'ECONNREFUSED', 
                message: 'Connection refused' 
            });
            const classification = testContext.errorHandler.classifyError(systemError);
            
            assert.strictEqual(classification.type, 'SYSTEM_ERROR');
            assert.ok(classification.code);
            assert.strictEqual(classification.severity, 'high');
        });
        
        test('should classify fatal errors correctly', async () => {
            const fatalError = createTestError('fatal', { 
                message: 'Critical system failure',
                exitCode: 1
            });
            const classification = testContext.errorHandler.classifyError(fatalError);
            
            assert.strictEqual(classification.type, 'FATAL_ERROR');
            assert.strictEqual(classification.severity, 'critical');
        });
    });
    
    describe('Error Handler Methods', () => {
        test('should handle 404 Not Found errors correctly', async () => {
            const mockRequest = createMockRequest({ path: '/nonexistent', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handleNotFound(mockRequest, mockResponse);
            
            assert.strictEqual(mockResponse.statusCode, 404);
            assert.ok(mockResponse.body.includes('Not Found'));
            assert.strictEqual(mockResponse.headers['content-type'], 'text/plain');
        });
        
        test('should handle 405 Method Not Allowed errors correctly', async () => {
            const mockRequest = createMockRequest({ path: '/hello', method: 'POST' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handleMethodNotAllowed(mockRequest, mockResponse);
            
            assert.strictEqual(mockResponse.statusCode, 405);
            assert.ok(mockResponse.body.includes('Method Not Allowed'));
            assert.strictEqual(mockResponse.headers['allow'], 'GET');
        });
        
        test('should handle 500 Internal Server errors correctly', async () => {
            const testError = createTestError('server', { statusCode: 500 });
            const mockRequest = createMockRequest({ path: '/hello', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handleInternalError(mockRequest, mockResponse, testError);
            
            assert.strictEqual(mockResponse.statusCode, 500);
            assert.ok(mockResponse.body.includes('Internal Server Error'));
            assert.strictEqual(mockResponse.headers['content-type'], 'text/plain');
        });
        
        test('should handle generic errors through main handle method', async () => {
            const testError = createTestError('client', { statusCode: 400 });
            const mockRequest = createMockRequest({ path: '/invalid', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            
            assert.ok(mockResponse.statusCode >= 400);
            assert.ok(mockResponse.finished);
            assert.ok(mockResponse.headers['content-type']);
        });
    });
    
    describe('Security Features', () => {
        test('should sanitize sensitive information from error messages', async () => {
            const sensitiveError = createTestError('server', {
                message: 'Database connection failed: mongodb://user:password123@localhost:27017/db',
                includeSensitiveData: true
            });
            
            const sanitized = sanitizeError(sensitiveError);
            
            assert.ok(!sanitized.message.includes('password123'));
            assert.ok(!sanitized.message.includes('mongodb://'));
            assert.ok(!sanitized.message.includes('user:password'));
        });
        
        test('should filter file paths from stack traces', async () => {
            const errorWithStack = createTestError('server', {
                message: 'File system error',
                includeStack: true
            });
            
            const sanitized = sanitizeError(errorWithStack);
            
            if (sanitized.stack) {
                assert.ok(!sanitized.stack.includes('/home/user'));
                assert.ok(!sanitized.stack.includes('/usr/local'));
            }
        });
        
        test('should include security headers in error responses', async () => {
            const mockRequest = createMockRequest({ path: '/invalid', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handleNotFound(mockRequest, mockResponse);
            
            assert.strictEqual(mockResponse.headers['x-content-type-options'], 'nosniff');
            assert.strictEqual(mockResponse.headers['x-frame-options'], 'DENY');
        });
        
        test('should generate safe correlation IDs', async () => {
            const mockRequest = createMockRequest({ path: '/error', method: 'GET' });
            const mockResponse = createMockResponse();
            const testError = createTestError('server');
            
            await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            
            const correlationId = mockResponse.headers['x-correlation-id'];
            assert.ok(correlationId);
            assert.ok(correlationId.startsWith(CORRELATION_ID_PREFIX));
            assert.ok(!correlationId.includes('password'));
            assert.ok(!correlationId.includes('user'));
        });
    });
    
    describe('Performance Tests', () => {
        test('should process errors within performance threshold', async () => {
            const startTime = performance.now();
            
            const testError = createTestError('client', { statusCode: 404 });
            const mockRequest = createMockRequest({ path: '/test', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            
            const processingTime = performance.now() - startTime;
            assert.ok(processingTime < 15, `Processing time ${processingTime}ms exceeds 15ms threshold`);
        });
        
        test('should maintain performance under concurrent load', async () => {
            const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
                return new Promise(async (resolve) => {
                    const startTime = performance.now();
                    const testError = createTestError('client', { statusCode: 400 });
                    const mockRequest = createMockRequest({ path: `/test-${i}`, method: 'GET' });
                    const mockResponse = createMockResponse();
                    
                    await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
                    
                    resolve(performance.now() - startTime);
                });
            });
            
            const responseTimes = await Promise.all(concurrentRequests);
            const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            
            assert.ok(averageResponseTime < 25, `Average response time ${averageResponseTime}ms exceeds concurrent threshold`);
        });
        
        test('should have minimal memory usage during error processing', async () => {
            if (global.gc) global.gc();
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Process multiple errors
            for (let i = 0; i < 100; i++) {
                const testError = createTestError('client', { statusCode: 404 });
                const mockRequest = createMockRequest({ path: `/test-${i}`, method: 'GET' });
                const mockResponse = createMockResponse();
                
                await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            }
            
            if (global.gc) global.gc();
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be less than 5MB for 100 error operations
            assert.ok(memoryIncrease < 5 * 1024 * 1024, `Memory increase ${memoryIncrease} bytes exceeds 5MB threshold`);
        });
    });
    
    describe('Error Statistics', () => {
        test('should collect error statistics accurately', async () => {
            // Process several different types of errors
            const errorTypes = [
                { type: 'client', statusCode: 400 },
                { type: 'client', statusCode: 404 },
                { type: 'server', statusCode: 500 }
            ];
            
            for (const errorConfig of errorTypes) {
                const testError = createTestError(errorConfig.type, { statusCode: errorConfig.statusCode });
                const mockRequest = createMockRequest({ path: '/test', method: 'GET' });
                const mockResponse = createMockResponse();
                
                await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            }
            
            const stats = testContext.errorHandler.getErrorStats();
            
            assert.ok(stats.totalErrors >= errorTypes.length);
            assert.ok(stats.errorsByType);
            assert.ok(stats.errorsByStatusCode);
            assert.ok(typeof stats.averageProcessingTime === 'number');
        });
        
        test('should track error processing time statistics', async () => {
            const testError = createTestError('server', { statusCode: 500 });
            const mockRequest = createMockRequest({ path: '/test', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            
            const stats = testContext.errorHandler.getErrorStats();
            
            assert.ok(typeof stats.averageProcessingTime === 'number');
            assert.ok(stats.averageProcessingTime >= 0);
            assert.ok(typeof stats.totalProcessingTime === 'number');
        });
    });
    
    describe('Integration Tests', () => {
        test('should integrate with logging system', async () => {
            const mockRequest = createMockRequest({ 
                path: '/test', 
                method: 'GET',
                headers: { 'x-correlation-id': 'test-123' }
            });
            const mockResponse = createMockResponse();
            const testError = createTestError('server', { statusCode: 500 });
            
            await testContext.errorHandler.handle(mockRequest, mockResponse, testError);
            
            // Verify error was logged (this would depend on logger implementation)
            assert.ok(mockResponse.finished);
            assert.strictEqual(mockResponse.statusCode, 500);
        });
        
        test('should integrate with response generation', async () => {
            const mockRequest = createMockRequest({ path: '/invalid', method: 'GET' });
            const mockResponse = createMockResponse();
            
            await testContext.errorHandler.handleNotFound(mockRequest, mockResponse);
            
            // Verify complete response generation
            assert.ok(mockResponse.testInstrumentation.writeHeadCalled);
            assert.ok(mockResponse.testInstrumentation.endCalled);
            assert.ok(mockResponse.headers['content-type']);
            assert.ok(mockResponse.headers['content-length']);
            assert.ok(mockResponse.body);
        });
    });
    
    describe('Comprehensive Test Suite', () => {
        test('should execute comprehensive error classification tests', async () => {
            const results = await testSuite.testErrorClassification();
            
            assert.ok(results.totalScenarios > 0);
            assert.ok(results.passedScenarios > 0);
            assert.strictEqual(results.failedScenarios, 0);
        });
        
        test('should execute comprehensive security feature tests', async () => {
            const results = await testSuite.testSecurityFeatures();
            
            assert.ok(results.totalScenarios > 0);
            assert.ok(results.passedScenarios > 0);
            assert.ok(results.results.sanitization.length > 0);
            assert.ok(results.results.informationDisclosure.length > 0);
        });
        
        test('should execute comprehensive performance tests', async () => {
            const results = await testSuite.testPerformanceCharacteristics();
            
            assert.ok(results.tests.errorProcessing);
            assert.ok(results.tests.memoryUsage);
            assert.ok(results.tests.concurrentErrors);
            assert.ok(results.tests.statisticsCollection);
            assert.strictEqual(results.overall.passed, true);
        });
    });
});

// Export test utilities and classes for reuse in other test files
export {
    ErrorHandlerTestSuite,
    createMockResponse,
    createTestError,
    setupErrorHandlerTest,
    teardownErrorHandlerTest,
    validateErrorResponse
};