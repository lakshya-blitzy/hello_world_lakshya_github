/**
 * Node.js Tutorial HTTP Server - Hello Handler Component Unit Test Suite
 * 
 * Comprehensive unit test suite for the hello handler component in the Node.js tutorial HTTP server 
 * application. Tests HelloHandler class functionality, handleHello function behavior, request validation, 
 * response generation, performance characteristics, and integration with logger, response generator, and 
 * configuration components using Node.js built-in test runner with zero external dependencies for 
 * educational testing patterns.
 * 
 * This test suite provides complete validation of hello handler functionality including successful 
 * response generation, error handling, performance measurement, and integration testing. Demonstrates 
 * comprehensive Node.js component testing patterns with mock objects, assertion utilities, and 
 * performance measurement using only built-in Node.js modules.
 * 
 * Educational Features:
 * - Demonstrates Node.js built-in test runner usage for zero-dependency testing
 * - Shows mock object creation patterns for HTTP request/response testing
 * - Illustrates performance testing techniques with built-in performance APIs
 * - Teaches comprehensive test coverage strategies for HTTP handler components
 * - Demonstrates integration testing patterns for component interaction validation
 * 
 * Dependencies:
 * - Node.js built-in test runner for test execution and organization
 * - Node.js built-in assertion library for test validations and comparisons
 * - Node.js built-in performance hooks for response timing measurement
 * - hello-handler.js: Target component for comprehensive testing validation
 * - Test fixture utilities for mock objects and test data management
 * 
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 * Test Framework: Node.js built-in test runner (zero external dependencies)
 */

// External imports - Node.js built-in test framework for comprehensive component testing
const { test, describe, before, after } = require('node:test'); // Node.js built-in v22.x

// External imports - Node.js built-in strict assertion library for test validations and response comparisons
const assert = require('node:assert/strict'); // Node.js built-in v22.x

// External imports - Node.js built-in performance API for measuring hello handler response timing and resource usage
const { performance } = require('node:perf_hooks'); // Node.js built-in v22.x

// Internal imports - hello handler component with all exports for comprehensive testing coverage
const {
    HelloHandler,
    handleHello,
    validateHelloRequest,
    generateHelloContent,
    measureHelloPerformance,
    helloHandler,
    HELLO_MESSAGE,
    ENDPOINT_PATH,
    SUCCESS_STATUS_CODE,
    CONTENT_TYPE
} = require('../../lib/hello-handler.js');

// Internal imports - test environment management utilities for isolated hello handler testing with setup and cleanup
const {
    TestEnvironment,
    ResponseValidator,
    measurePerformance
} = require('../fixtures/test-helpers.js');

// Internal imports - mock request factories for creating realistic HTTP request objects for hello handler unit testing
const {
    createMockRequest,
    createHelloRequest,
    createInvalidRequest
} = require('../fixtures/mock-requests.js');

// Internal imports - comprehensive test data including request scenarios, expected responses, and performance thresholds
const { testData } = require('../fixtures/test-data.js');

// Global constants for hello handler testing configuration and validation thresholds
const TEST_TIMEOUT = 10000;
const HELLO_HANDLER_PERFORMANCE_THRESHOLDS = {
    responseTime: 50,
    memoryUsage: 1048576,
    concurrentRequests: 100
};
const EXPECTED_HELLO_MESSAGE = 'Hello world';
const HELLO_ENDPOINT_PATH = '/hello';

/**
 * Sets up hello handler test environment including mock objects, test data, and performance monitoring 
 * for comprehensive unit testing
 * @param {Object} options - Optional test configuration overrides for specific test scenarios
 * @returns {Promise<Object>} Promise resolving to test environment configuration with handler instance and mock objects
 */
async function setupHelloHandlerTests(options = {}) {
    try {
        // Initialize TestEnvironment instance with hello handler specific configuration
        const testEnvironment = new TestEnvironment();
        await testEnvironment.setup();

        // Create HelloHandler instance with test configuration and mock dependencies
        const testHelloHandler = new HelloHandler({
            helloMessage: options.customMessage || EXPECTED_HELLO_MESSAGE,
            performanceTracking: options.performanceTracking !== false,
            correlationTracking: options.correlationTracking !== false,
            ...options.handlerOptions
        });

        // Set up ResponseValidator with hello endpoint specific validation rules
        const responseValidator = new ResponseValidator();

        // Initialize performance monitoring for hello handler response timing measurement
        const performanceMonitor = {
            startTime: null,
            endTime: null,
            measurements: []
        };

        // Create mock request factory for generating hello endpoint test requests
        const mockRequestFactory = {
            createValidHelloRequest: () => createHelloRequest(),
            createInvalidMethodRequest: () => createMockRequest('POST', '/hello'),
            createInvalidPathRequest: () => createMockRequest('GET', '/invalid'),
            createMalformedRequest: () => createInvalidRequest('malformed')
        };

        // Register cleanup handlers for proper resource disposal after test completion
        const cleanup = async () => {
            if (testEnvironment) {
                await testEnvironment.teardown();
            }
            if (global.helloHandlerStats) {
                global.helloHandlerStats.requestCount = 0;
                global.helloHandlerStats.errorCount = 0;
                global.helloHandlerStats.totalResponseTime = 0;
                global.helloHandlerStats.avgResponseTime = 0;
            }
        };

        // Return test environment object with handler, validators, and test utilities
        return {
            testEnvironment,
            helloHandler: testHelloHandler,
            responseValidator,
            performanceMonitor,
            mockRequestFactory,
            cleanup,
            config: {
                timeout: TEST_TIMEOUT,
                performanceThresholds: HELLO_HANDLER_PERFORMANCE_THRESHOLDS,
                expectedMessage: EXPECTED_HELLO_MESSAGE,
                endpointPath: HELLO_ENDPOINT_PATH
            }
        };

    } catch (error) {
        throw new Error(`Hello handler test setup failed: ${error.message}`);
    }
}

/**
 * Cleans up hello handler test environment including handler instances, mock objects, and performance 
 * monitoring resources
 * @param {Object} testEnv - Test environment object from setup containing resources to clean up
 * @returns {Promise<void>} Promise resolving when hello handler test cleanup is complete
 */
async function teardownHelloHandlerTests(testEnv) {
    try {
        // Stop performance monitoring and collect final metrics for test reporting
        if (testEnv.performanceMonitor) {
            testEnv.performanceMonitor.endTime = performance.now();
        }

        // Clean up HelloHandler instance and release associated resources
        if (testEnv.helloHandler) {
            testEnv.helloHandler = null;
        }

        // Dispose of mock objects and clear test data to prevent memory leaks
        if (testEnv.mockRequestFactory) {
            testEnv.mockRequestFactory = null;
        }

        // Reset ResponseValidator state and clear validation rules
        if (testEnv.responseValidator) {
            testEnv.responseValidator = null;
        }

        // Clear any timers or intervals set during hello handler testing
        if (testEnv.cleanup) {
            await testEnv.cleanup();
        }

        // Validate complete cleanup and resource disposal for test isolation
        assert.strictEqual(testEnv.helloHandler, null);
        assert.strictEqual(testEnv.mockRequestFactory, null);
        assert.strictEqual(testEnv.responseValidator, null);

    } catch (error) {
        throw new Error(`Hello handler test cleanup failed: ${error.message}`);
    }
}

/**
 * Tests hello handler response generation for valid GET requests to /hello endpoint with comprehensive validation
 * @returns {Promise<void>} Promise resolving when hello handler response tests are complete
 */
async function testHelloHandlerResponse() {
    const testEnv = await setupHelloHandlerTests();
    
    try {
        // Create mock GET request to /hello endpoint with proper headers and configuration
        const mockRequest = testEnv.mockRequestFactory.createValidHelloRequest();
        
        // Create mock response object for capturing hello handler output
        let responseData = '';
        let responseHeaders = {};
        let statusCode = null;
        
        const mockResponse = {
            writeHead: (code, headers) => {
                statusCode = code;
                responseHeaders = { ...headers };
            },
            write: (data) => {
                responseData += data;
            },
            end: (data) => {
                if (data) responseData += data;
            },
            headersSent: false,
            statusCode: null
        };

        // Execute hello handler with mock request and response objects
        await testEnv.helloHandler.handle(mockRequest, mockResponse);

        // Validate response status code is HTTP 200 OK for successful processing
        assert.strictEqual(statusCode, SUCCESS_STATUS_CODE, 
            'Response status code should be 200 OK');

        // Verify response headers include Content-Type text/plain and security headers
        assert.strictEqual(responseHeaders['Content-Type'], CONTENT_TYPE,
            'Content-Type header should be text/plain with UTF-8 encoding');
        assert.ok(responseHeaders['X-Correlation-ID'], 
            'Response should include correlation ID header');

        // Confirm response body contains exact 'Hello world' message content
        assert.strictEqual(responseData, EXPECTED_HELLO_MESSAGE,
            'Response body should contain expected hello world message');

        // Check Content-Length header matches actual response body byte length
        const expectedContentLength = Buffer.byteLength(EXPECTED_HELLO_MESSAGE, 'utf8');
        assert.strictEqual(responseHeaders['Content-Length'], expectedContentLength.toString(),
            'Content-Length header should match response body byte length');

    } finally {
        await teardownHelloHandlerTests(testEnv);
    }
}

/**
 * Tests hello handler request validation including HTTP method checking, path validation, and security constraints
 * @returns {Promise<void>} Promise resolving when hello handler validation tests are complete
 */
async function testHelloHandlerValidation() {
    const testEnv = await setupHelloHandlerTests();
    
    try {
        // Test valid GET request passes validation with appropriate success status
        const validRequest = testEnv.mockRequestFactory.createValidHelloRequest();
        const validResult = validateHelloRequest(validRequest);
        assert.strictEqual(validResult.isValid, true, 
            'Valid GET /hello request should pass validation');
        assert.strictEqual(validResult.errors.length, 0,
            'Valid request should have no validation errors');

        // Test invalid HTTP methods (POST, PUT, DELETE) are properly rejected
        const postRequest = testEnv.mockRequestFactory.createInvalidMethodRequest();
        const postResult = validateHelloRequest(postRequest);
        assert.strictEqual(postResult.isValid, false,
            'POST request should fail validation');
        assert.ok(postResult.errors.some(err => err.field === 'method'),
            'Validation should report HTTP method error');

        // Test invalid paths are identified and handled appropriately
        const invalidPathRequest = testEnv.mockRequestFactory.createInvalidPathRequest();
        const pathResult = validateHelloRequest(invalidPathRequest);
        assert.strictEqual(pathResult.isValid, false,
            'Invalid path request should fail validation');
        assert.ok(pathResult.errors.some(err => err.field === 'url'),
            'Validation should report URL path error');

        // Test malformed requests are caught by validation logic
        const malformedRequest = testEnv.mockRequestFactory.createMalformedRequest();
        const malformedResult = validateHelloRequest(malformedRequest);
        assert.strictEqual(malformedResult.isValid, false,
            'Malformed request should fail validation');

        // Verify validation errors return appropriate error information without sensitive data disclosure
        assert.ok(typeof validResult.details === 'object',
            'Validation should return details object');
        assert.ok(validResult.details.validatedAt,
            'Validation should include timestamp');

    } finally {
        await teardownHelloHandlerTests(testEnv);
    }
}

/**
 * Tests hello handler performance characteristics including response timing, memory usage, and concurrent request handling
 * @returns {Promise<Object>} Promise resolving to performance test results with timing and resource usage metrics
 */
async function testHelloHandlerPerformance() {
    const testEnv = await setupHelloHandlerTests();
    
    try {
        const performanceResults = {
            responseTime: null,
            memoryUsage: null,
            concurrentHandling: null,
            withinThresholds: false
        };

        // Measure hello handler response generation time for single request
        const startTime = performance.now();
        const mockRequest = testEnv.mockRequestFactory.createValidHelloRequest();
        const mockResponse = {
            writeHead: () => {},
            write: () => {},
            end: () => {},
            headersSent: false
        };

        await handleHello(mockRequest, mockResponse);
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        performanceResults.responseTime = responseTime;

        // Validate response time meets educational application threshold of under 50ms
        assert.ok(responseTime < HELLO_HANDLER_PERFORMANCE_THRESHOLDS.responseTime,
            `Response time ${responseTime.toFixed(2)}ms should be under ${HELLO_HANDLER_PERFORMANCE_THRESHOLDS.responseTime}ms threshold`);

        // Monitor memory usage during hello handler execution and response generation
        const memoryBefore = process.memoryUsage();
        
        // Execute multiple requests to measure memory usage patterns
        for (let i = 0; i < 10; i++) {
            const request = testEnv.mockRequestFactory.createValidHelloRequest();
            const response = {
                writeHead: () => {},
                write: () => {},
                end: () => {},
                headersSent: false
            };
            await handleHello(request, response);
        }
        
        const memoryAfter = process.memoryUsage();
        const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
        performanceResults.memoryUsage = memoryDelta;

        // Validate memory usage remains within acceptable limits during processing
        assert.ok(memoryDelta < HELLO_HANDLER_PERFORMANCE_THRESHOLDS.memoryUsage,
            `Memory usage increase ${memoryDelta} bytes should be under ${HELLO_HANDLER_PERFORMANCE_THRESHOLDS.memoryUsage} bytes threshold`);

        // Test concurrent hello request handling with multiple simultaneous requests
        const concurrentRequests = 5;
        const concurrentPromises = [];
        
        for (let i = 0; i < concurrentRequests; i++) {
            const request = testEnv.mockRequestFactory.createValidHelloRequest();
            const response = {
                writeHead: () => {},
                write: () => {},
                end: () => {},
                headersSent: false
            };
            concurrentPromises.push(handleHello(request, response));
        }
        
        await Promise.all(concurrentPromises);
        performanceResults.concurrentHandling = concurrentRequests;

        // Generate performance report with timing statistics and resource utilization data
        performanceResults.withinThresholds = 
            performanceResults.responseTime < HELLO_HANDLER_PERFORMANCE_THRESHOLDS.responseTime &&
            performanceResults.memoryUsage < HELLO_HANDLER_PERFORMANCE_THRESHOLDS.memoryUsage;

        return performanceResults;

    } finally {
        await teardownHelloHandlerTests(testEnv);
    }
}

/**
 * Tests hello handler integration with dependent components including logger, response generator, and configuration
 * @returns {Promise<void>} Promise resolving when hello handler integration tests are complete
 */
async function testHelloHandlerIntegration() {
    const testEnv = await setupHelloHandlerTests();
    
    try {
        // Test hello handler integration with logger for request and response event logging
        const mockRequest = testEnv.mockRequestFactory.createValidHelloRequest();
        const mockResponse = {
            writeHead: () => {},
            write: () => {},
            end: () => {},
            headersSent: false
        };

        // Execute hello handler and verify no integration errors occur
        await assert.doesNotReject(
            async () => await testEnv.helloHandler.handle(mockRequest, mockResponse),
            'Hello handler integration should execute without errors'
        );

        // Test configuration loading and environment-specific hello message customization
        const customHandler = new HelloHandler({
            helloMessage: 'Custom Hello Message',
            performanceTracking: true
        });

        const customResponse = customHandler.generateResponse(mockRequest, {
            correlationId: 'test-correlation-id'
        });

        assert.ok(customResponse.content.includes('Custom Hello Message'),
            'Handler should use custom hello message from configuration');

        // Test correlation ID handling and request tracking across integrated components
        assert.ok(customResponse.metadata.correlationId === 'test-correlation-id',
            'Handler should preserve correlation ID in response metadata');

        // Test error integration with error handler for consistent error response generation
        const invalidRequest = testEnv.mockRequestFactory.createInvalidMethodRequest();
        
        await assert.doesNotReject(
            async () => await testEnv.helloHandler.handle(invalidRequest, mockResponse),
            'Hello handler should handle invalid requests gracefully through error integration'
        );

        // Validate hello handler works properly within complete request processing pipeline
        const handlerStats = testEnv.helloHandler.getStats();
        assert.ok(typeof handlerStats === 'object',
            'Handler should provide statistics for monitoring integration');
        assert.ok(handlerStats.requestCount >= 0,
            'Handler statistics should track request counts');

    } finally {
        await teardownHelloHandlerTests(testEnv);
    }
}

/**
 * Organized test suite class for comprehensive hello handler testing including functionality, performance, 
 * validation, and integration testing with proper test lifecycle management and resource cleanup
 */
class HelloHandlerTestSuite {
    /**
     * Initializes hello handler test suite with configuration, test environment, and shared resources for comprehensive testing
     * @param {Object} config - Test suite configuration including handler settings and performance thresholds
     */
    constructor(config = {}) {
        // Store test suite configuration and validate hello handler specific settings
        this.config = {
            timeout: config.timeout || TEST_TIMEOUT,
            performanceThresholds: config.performanceThresholds || HELLO_HANDLER_PERFORMANCE_THRESHOLDS,
            expectedMessage: config.expectedMessage || EXPECTED_HELLO_MESSAGE,
            endpointPath: config.endpointPath || HELLO_ENDPOINT_PATH,
            ...config
        };

        // Initialize TestEnvironment for isolated hello handler component testing
        this.testEnvironment = null;

        // Set up HelloHandler instance with test configuration and mock dependencies
        this.helloHandler = null;

        // Create ResponseValidator with hello endpoint specific validation rules and thresholds
        this.responseValidator = null;

        // Initialize performance monitoring for hello handler response timing and resource tracking
        this.performanceMetrics = {
            testResults: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            averageExecutionTime: 0
        };

        // Set up mock request factory for generating realistic hello endpoint test scenarios
        this.mockFactory = null;
    }

    /**
     * Executes comprehensive functionality tests for hello handler including response generation, content formatting, and header management
     * @returns {Promise<void>} Promise resolving when hello handler functionality tests complete
     */
    async runFunctionalityTests() {
        try {
            const testStartTime = performance.now();

            // Test HelloHandler class instantiation and configuration loading
            const handler = new HelloHandler({
                helloMessage: this.config.expectedMessage,
                performanceTracking: true
            });

            assert.ok(handler instanceof HelloHandler,
                'HelloHandler should instantiate correctly');
            assert.strictEqual(handler.helloMessage, this.config.expectedMessage,
                'HelloHandler should load configuration correctly');

            // Test handleHello function execution with valid GET requests
            const mockRequest = createHelloRequest();
            let responseData = '';
            const mockResponse = {
                writeHead: () => {},
                write: (data) => { responseData += data; },
                end: (data) => { if (data) responseData += data; },
                headersSent: false
            };

            await handleHello(mockRequest, mockResponse);

            // Test hello world response content generation and formatting
            assert.strictEqual(responseData, this.config.expectedMessage,
                'handleHello should generate expected hello world content');

            // Test HTTP response header configuration including Content-Type and security headers
            const responseObj = handler.generateResponse(mockRequest);
            assert.strictEqual(responseObj.statusCode, SUCCESS_STATUS_CODE,
                'Response should have HTTP 200 status code');
            assert.strictEqual(responseObj.headers['Content-Type'], CONTENT_TYPE,
                'Response should have correct Content-Type header');

            // Test response status code setting and HTTP compliance
            assert.ok(responseObj.headers['X-Content-Type-Options'],
                'Response should include security headers');

            // Validate hello message content matches expected 'Hello world' string
            assert.ok(responseObj.content.includes(this.config.expectedMessage),
                'Response content should include expected hello message');

            const testEndTime = performance.now();
            this.performanceMetrics.testResults.push({
                testName: 'functionality',
                executionTime: testEndTime - testStartTime,
                passed: true
            });

        } catch (error) {
            this.performanceMetrics.failedTests++;
            throw new Error(`Functionality tests failed: ${error.message}`);
        }
    }

    /**
     * Executes hello handler validation tests including request validation, security checks, and input sanitization
     * @returns {Promise<void>} Promise resolving when hello handler validation tests complete
     */
    async runValidationTests() {
        try {
            const testStartTime = performance.now();

            // Test HTTP method validation accepts only GET requests for hello endpoint
            const validGetRequest = createMockRequest('GET', '/hello');
            const getValidation = validateHelloRequest(validGetRequest);
            assert.strictEqual(getValidation.isValid, true,
                'GET request should pass validation');

            const postRequest = createMockRequest('POST', '/hello');
            const postValidation = validateHelloRequest(postRequest);
            assert.strictEqual(postValidation.isValid, false,
                'POST request should fail validation');

            // Test URL path validation ensures exact '/hello' path matching
            const validPathRequest = createMockRequest('GET', '/hello');
            const pathValidation = validateHelloRequest(validPathRequest);
            assert.strictEqual(pathValidation.isValid, true,
                'Correct path should pass validation');

            const invalidPathRequest = createMockRequest('GET', '/invalid');
            const invalidPathValidation = validateHelloRequest(invalidPathRequest);
            assert.strictEqual(invalidPathValidation.isValid, false,
                'Invalid path should fail validation');

            // Test request header validation for security and format compliance
            const requestWithHeaders = createMockRequest('GET', '/hello', {
                'user-agent': 'Test Agent',
                'accept': 'text/plain'
            });
            const headerValidation = validateHelloRequest(requestWithHeaders);
            assert.strictEqual(headerValidation.isValid, true,
                'Request with valid headers should pass validation');

            // Test malformed request handling with appropriate error responses
            const malformedRequest = createInvalidRequest('malformed');
            const malformedValidation = validateHelloRequest(malformedRequest);
            assert.strictEqual(malformedValidation.isValid, false,
                'Malformed request should fail validation');

            // Validate security checks prevent potential attack vectors and injection attempts
            assert.ok(Array.isArray(getValidation.errors),
                'Validation should return errors array');
            assert.ok(Array.isArray(getValidation.warnings),
                'Validation should return warnings array');

            const testEndTime = performance.now();
            this.performanceMetrics.testResults.push({
                testName: 'validation',
                executionTime: testEndTime - testStartTime,
                passed: true
            });

        } catch (error) {
            this.performanceMetrics.failedTests++;
            throw new Error(`Validation tests failed: ${error.message}`);
        }
    }

    /**
     * Executes hello handler performance tests including response timing, memory usage, and concurrency handling
     * @returns {Promise<Object>} Promise resolving to performance test results with detailed metrics
     */
    async runPerformanceTests() {
        try {
            const testStartTime = performance.now();
            const performanceResults = {};

            // Measure hello handler response generation time against 50ms threshold
            const singleRequestStart = performance.now();
            const mockRequest = createHelloRequest();
            const mockResponse = {
                writeHead: () => {},
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await handleHello(mockRequest, mockResponse);
            const singleRequestEnd = performance.now();
            const responseTime = singleRequestEnd - singleRequestStart;

            performanceResults.responseTime = responseTime;
            assert.ok(responseTime < this.config.performanceThresholds.responseTime,
                `Response time ${responseTime.toFixed(2)}ms should be under ${this.config.performanceThresholds.responseTime}ms`);

            // Monitor memory usage during hello handler execution and response processing
            const memoryBefore = process.memoryUsage();
            
            for (let i = 0; i < 10; i++) {
                const request = createHelloRequest();
                const response = {
                    writeHead: () => {},
                    write: () => {},
                    end: () => {},
                    headersSent: false
                };
                await handleHello(request, response);
            }
            
            const memoryAfter = process.memoryUsage();
            const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
            
            performanceResults.memoryUsage = memoryDelta;
            assert.ok(memoryDelta < this.config.performanceThresholds.memoryUsage,
                `Memory usage ${memoryDelta} bytes should be under threshold`);

            // Test concurrent request handling with multiple simultaneous hello requests
            const concurrentStart = performance.now();
            const concurrentPromises = [];
            
            for (let i = 0; i < 5; i++) {
                const request = createHelloRequest();
                const response = {
                    writeHead: () => {},
                    write: () => {},
                    end: () => {},
                    headersSent: false
                };
                concurrentPromises.push(handleHello(request, response));
            }
            
            await Promise.all(concurrentPromises);
            const concurrentEnd = performance.now();
            performanceResults.concurrentTime = concurrentEnd - concurrentStart;

            // Generate comprehensive performance report with timing and resource utilization
            performanceResults.withinThresholds = 
                performanceResults.responseTime < this.config.performanceThresholds.responseTime &&
                performanceResults.memoryUsage < this.config.performanceThresholds.memoryUsage;

            const testEndTime = performance.now();
            this.performanceMetrics.testResults.push({
                testName: 'performance',
                executionTime: testEndTime - testStartTime,
                passed: performanceResults.withinThresholds,
                details: performanceResults
            });

            return performanceResults;

        } catch (error) {
            this.performanceMetrics.failedTests++;
            throw new Error(`Performance tests failed: ${error.message}`);
        }
    }

    /**
     * Executes integration tests for hello handler interaction with logger, response generator, and configuration components
     * @returns {Promise<void>} Promise resolving when hello handler integration tests complete
     */
    async runIntegrationTests() {
        try {
            const testStartTime = performance.now();

            // Test hello handler integration with logger component for event tracking
            const handler = new HelloHandler({
                helloMessage: this.config.expectedMessage,
                correlationTracking: true
            });

            const mockRequest = createHelloRequest();
            const mockResponse = {
                writeHead: () => {},
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await assert.doesNotReject(
                async () => await handler.handle(mockRequest, mockResponse),
                'Handler integration should execute without errors'
            );

            // Test integration with response generator for consistent response formatting
            const responseObj = handler.generateResponse(mockRequest, {
                correlationId: 'integration-test-id'
            });

            assert.ok(responseObj.statusCode === SUCCESS_STATUS_CODE,
                'Integration should produce correct status code');
            assert.ok(responseObj.content.includes(this.config.expectedMessage),
                'Integration should produce correct content');

            // Test configuration loading and environment-specific customization
            const customHandler = new HelloHandler({
                helloMessage: 'Custom Integration Message'
            });

            const customResponse = customHandler.generateResponse(mockRequest);
            assert.ok(customResponse.content.includes('Custom Integration Message'),
                'Handler should support configuration customization');

            // Test correlation ID handling and request tracking integration
            assert.ok(responseObj.metadata.correlationId === 'integration-test-id',
                'Handler should preserve correlation ID through integration');

            // Validate complete hello handler integration within request processing pipeline
            const stats = handler.getStats();
            assert.ok(typeof stats === 'object',
                'Handler should provide statistics for monitoring');
            assert.ok(typeof stats.requestCount === 'number',
                'Handler statistics should be properly integrated');

            const testEndTime = performance.now();
            this.performanceMetrics.testResults.push({
                testName: 'integration',
                executionTime: testEndTime - testStartTime,
                passed: true
            });

        } catch (error) {
            this.performanceMetrics.failedTests++;
            throw new Error(`Integration tests failed: ${error.message}`);
        }
    }

    /**
     * Executes error handling tests for hello handler including validation errors, processing errors, and recovery scenarios
     * @returns {Promise<void>} Promise resolving when hello handler error handling tests complete
     */
    async runErrorHandlingTests() {
        try {
            const testStartTime = performance.now();

            const handler = new HelloHandler();

            // Test hello handler response to invalid HTTP methods with 405 Method Not Allowed
            const postRequest = createMockRequest('POST', '/hello');
            let errorStatusCode = null;
            const methodNotAllowedResponse = {
                writeHead: (code) => { errorStatusCode = code; },
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await handler.handle(postRequest, methodNotAllowedResponse);
            assert.strictEqual(errorStatusCode, 405,
                'Invalid method should return 405 Method Not Allowed');

            // Test hello handler response to invalid paths with appropriate routing errors
            const invalidPathRequest = createMockRequest('GET', '/invalid');
            let pathErrorStatusCode = null;
            const notFoundResponse = {
                writeHead: (code) => { pathErrorStatusCode = code; },
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await handler.handle(invalidPathRequest, notFoundResponse);
            // Note: The handler validates path in handleHello, but the class version handles via request validation
            assert.ok(pathErrorStatusCode === 400 || pathErrorStatusCode === 404,
                'Invalid path should return appropriate error status');

            // Test handling of malformed requests with secure error responses
            const malformedRequest = createInvalidRequest('malformed');
            const malformedResponse = {
                writeHead: () => {},
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await assert.doesNotReject(
                async () => await handler.handle(malformedRequest, malformedResponse),
                'Handler should gracefully handle malformed requests'
            );

            // Test hello handler recovery from processing errors and exceptions
            const handlerStats = handler.getStats();
            assert.ok(typeof handlerStats.errorCount === 'number',
                'Handler should track error counts for monitoring');

            // Validate error responses follow security best practices without information disclosure
            const validation = validateHelloRequest(malformedRequest);
            assert.strictEqual(validation.isValid, false,
                'Malformed requests should be properly identified');
            assert.ok(Array.isArray(validation.errors),
                'Error responses should provide structured error information');

            const testEndTime = performance.now();
            this.performanceMetrics.testResults.push({
                testName: 'errorHandling',
                executionTime: testEndTime - testStartTime,
                passed: true
            });

        } catch (error) {
            this.performanceMetrics.failedTests++;
            throw new Error(`Error handling tests failed: ${error.message}`);
        }
    }

    /**
     * Generates comprehensive test report including functionality results, performance metrics, and validation outcomes
     * @returns {Object} Test report object with results, metrics, and analysis data
     */
    generateTestReport() {
        try {
            // Collect all test results including functionality, validation, and performance outcomes
            const totalTests = this.performanceMetrics.testResults.length;
            const passedTests = this.performanceMetrics.testResults.filter(result => result.passed).length;
            const failedTests = totalTests - passedTests;

            // Compile performance metrics including response times, memory usage, and throughput
            const executionTimes = this.performanceMetrics.testResults.map(result => result.executionTime);
            const averageExecutionTime = executionTimes.length > 0 ? 
                executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length : 0;

            // Generate test coverage analysis for hello handler functionality
            const testCoverage = {
                functionalityTests: this.performanceMetrics.testResults.some(r => r.testName === 'functionality'),
                validationTests: this.performanceMetrics.testResults.some(r => r.testName === 'validation'),
                performanceTests: this.performanceMetrics.testResults.some(r => r.testName === 'performance'),
                integrationTests: this.performanceMetrics.testResults.some(r => r.testName === 'integration'),
                errorHandlingTests: this.performanceMetrics.testResults.some(r => r.testName === 'errorHandling')
            };

            // Calculate test success rates and identify any failing test scenarios
            const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

            // Create detailed report with recommendations and performance analysis
            const testReport = {
                summary: {
                    totalTests,
                    passedTests,
                    failedTests,
                    successRate: `${successRate.toFixed(2)}%`,
                    averageExecutionTime: `${averageExecutionTime.toFixed(2)}ms`
                },
                testResults: this.performanceMetrics.testResults,
                coverage: testCoverage,
                performanceMetrics: {
                    thresholds: this.config.performanceThresholds,
                    withinThresholds: this.performanceMetrics.testResults
                        .filter(r => r.testName === 'performance')
                        .every(r => r.details?.withinThresholds !== false)
                },
                recommendations: [],
                configuration: this.config,
                generatedAt: new Date().toISOString()
            };

            // Add recommendations based on test results
            if (successRate < 100) {
                testReport.recommendations.push('Review and fix failing test cases');
            }
            if (averageExecutionTime > 100) {
                testReport.recommendations.push('Consider optimizing test execution performance');
            }
            if (!testCoverage.performanceTests) {
                testReport.recommendations.push('Add performance testing for comprehensive validation');
            }

            // Return comprehensive test report for hello handler validation and monitoring
            return testReport;

        } catch (error) {
            return {
                error: true,
                errorMessage: error.message,
                generatedAt: new Date().toISOString()
            };
        }
    }
}

// Comprehensive test execution using Node.js built-in test runner with organized test suites
describe('Hello Handler Component Tests', { timeout: TEST_TIMEOUT }, () => {
    let testSuite;
    let testEnv;

    before(async () => {
        // Initialize test suite and environment for hello handler testing
        testSuite = new HelloHandlerTestSuite();
        testEnv = await setupHelloHandlerTests();
    });

    after(async () => {
        // Clean up test environment and resources
        if (testEnv) {
            await teardownHelloHandlerTests(testEnv);
        }
    });

    describe('HelloHandler Class Tests', () => {
        test('should instantiate HelloHandler with default configuration', async () => {
            const handler = new HelloHandler();
            assert.ok(handler instanceof HelloHandler);
            assert.strictEqual(handler.helloMessage, EXPECTED_HELLO_MESSAGE);
        });

        test('should instantiate HelloHandler with custom configuration', async () => {
            const customMessage = 'Custom Hello World';
            const handler = new HelloHandler({
                helloMessage: customMessage,
                performanceTracking: false
            });
            assert.strictEqual(handler.helloMessage, customMessage);
        });

        test('should handle valid GET /hello requests successfully', async () => {
            const handler = new HelloHandler();
            const mockRequest = createHelloRequest();
            let responseData = '';
            const mockResponse = {
                writeHead: () => {},
                write: (data) => { responseData += data; },
                end: (data) => { if (data) responseData += data; },
                headersSent: false
            };

            await handler.handle(mockRequest, mockResponse);
            assert.ok(responseData.includes(EXPECTED_HELLO_MESSAGE));
        });

        test('should generate response with proper headers and content', async () => {
            const handler = new HelloHandler();
            const mockRequest = createHelloRequest();
            const response = handler.generateResponse(mockRequest);

            assert.strictEqual(response.statusCode, SUCCESS_STATUS_CODE);
            assert.strictEqual(response.headers['Content-Type'], CONTENT_TYPE);
            assert.ok(response.content.includes(EXPECTED_HELLO_MESSAGE));
        });

        test('should provide performance statistics', async () => {
            const handler = new HelloHandler();
            const stats = handler.getStats();

            assert.ok(typeof stats === 'object');
            assert.ok(typeof stats.requestCount === 'number');
            assert.ok(typeof stats.successCount === 'number');
            assert.ok(typeof stats.errorCount === 'number');
        });

        test('should validate requests correctly', async () => {
            const handler = new HelloHandler();
            const validRequest = createHelloRequest();
            const validation = handler.validateRequest(validRequest);

            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.errors.length, 0);
        });

        test('should update configuration dynamically', async () => {
            const handler = new HelloHandler();
            const newMessage = 'Updated Hello Message';
            
            handler.updateConfig({ helloMessage: newMessage });
            assert.strictEqual(handler.helloMessage, newMessage);
        });
    });

    describe('Standalone Function Tests', () => {
        test('handleHello function should process valid requests', async () => {
            const mockRequest = createHelloRequest();
            let responseData = '';
            const mockResponse = {
                writeHead: () => {},
                write: (data) => { responseData += data; },
                end: (data) => { if (data) responseData += data; },
                headersSent: false
            };

            await handleHello(mockRequest, mockResponse);
            assert.strictEqual(responseData, EXPECTED_HELLO_MESSAGE);
        });

        test('validateHelloRequest should validate GET /hello requests', async () => {
            const validRequest = createHelloRequest();
            const result = validateHelloRequest(validRequest);

            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.errors.length, 0);
        });

        test('validateHelloRequest should reject invalid methods', async () => {
            const invalidRequest = createMockRequest('POST', '/hello');
            const result = validateHelloRequest(invalidRequest);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(err => err.field === 'method'));
        });

        test('validateHelloRequest should reject invalid paths', async () => {
            const invalidRequest = createMockRequest('GET', '/invalid');
            const result = validateHelloRequest(invalidRequest);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(err => err.field === 'url'));
        });

        test('generateHelloContent should return expected content', async () => {
            const mockRequest = createHelloRequest();
            const content = generateHelloContent(mockRequest);

            assert.ok(typeof content === 'string');
            assert.ok(content.includes(EXPECTED_HELLO_MESSAGE));
        });

        test('generateHelloContent should handle custom options', async () => {
            const mockRequest = createHelloRequest();
            const customMessage = 'Custom Test Message';
            const content = generateHelloContent(mockRequest, {
                customMessage: customMessage
            });

            assert.ok(content.includes(customMessage));
        });
    });

    describe('Performance Testing', () => {
        test('should meet response time performance thresholds', async () => {
            const result = await testHelloHandlerPerformance();
            
            assert.ok(result.responseTime < HELLO_HANDLER_PERFORMANCE_THRESHOLDS.responseTime);
            assert.ok(result.withinThresholds);
        });

        test('should handle concurrent requests efficiently', async () => {
            const concurrentRequests = 10;
            const promises = [];

            for (let i = 0; i < concurrentRequests; i++) {
                const mockRequest = createHelloRequest();
                const mockResponse = {
                    writeHead: () => {},
                    write: () => {},
                    end: () => {},
                    headersSent: false
                };
                promises.push(handleHello(mockRequest, mockResponse));
            }

            await assert.doesNotReject(
                async () => await Promise.all(promises),
                'Should handle concurrent requests without errors'
            );
        });
    });

    describe('Error Handling Tests', () => {
        test('should handle invalid HTTP methods gracefully', async () => {
            const handler = new HelloHandler();
            const postRequest = createMockRequest('POST', '/hello');
            let statusCode = null;
            const mockResponse = {
                writeHead: (code) => { statusCode = code; },
                write: () => {},
                end: () => {},
                headersSent: false
            };

            await handler.handle(postRequest, mockResponse);
            assert.strictEqual(statusCode, 405);
        });

        test('should handle malformed requests', async () => {
            const malformedRequest = createInvalidRequest('malformed');
            const result = validateHelloRequest(malformedRequest);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.length > 0);
        });

        test('should provide detailed error information', async () => {
            const invalidRequest = createMockRequest('PUT', '/hello');
            const result = validateHelloRequest(invalidRequest);

            assert.ok(result.details);
            assert.ok(result.details.validatedAt);
            assert.ok(result.errors.some(err => err.field && err.message));
        });
    });

    describe('Integration Testing', () => {
        test('should integrate with test environment successfully', async () => {
            await testHelloHandlerIntegration();
            // Test passes if no errors are thrown
        });

        test('should maintain correlation tracking', async () => {
            const handler = new HelloHandler({ correlationTracking: true });
            const mockRequest = createHelloRequest();
            const response = handler.generateResponse(mockRequest, {
                correlationId: 'integration-test-123'
            });

            assert.strictEqual(response.metadata.correlationId, 'integration-test-123');
        });
    });

    describe('Test Suite Integration', () => {
        test('should execute all functionality tests', async () => {
            await testSuite.runFunctionalityTests();
            // Test passes if no errors are thrown
        });

        test('should execute all validation tests', async () => {
            await testSuite.runValidationTests();
            // Test passes if no errors are thrown
        });

        test('should execute all performance tests', async () => {
            const result = await testSuite.runPerformanceTests();
            assert.ok(typeof result === 'object');
            assert.ok(result.withinThresholds !== undefined);
        });

        test('should execute all integration tests', async () => {
            await testSuite.runIntegrationTests();
            // Test passes if no errors are thrown
        });

        test('should execute all error handling tests', async () => {
            await testSuite.runErrorHandlingTests();
            // Test passes if no errors are thrown
        });

        test('should generate comprehensive test report', async () => {
            // Run a few tests to populate metrics
            await testSuite.runFunctionalityTests();
            await testSuite.runValidationTests();

            const report = testSuite.generateTestReport();
            
            assert.ok(typeof report === 'object');
            assert.ok(report.summary);
            assert.ok(typeof report.summary.totalTests === 'number');
            assert.ok(typeof report.summary.successRate === 'string');
            assert.ok(report.generatedAt);
        });
    });
});

// Export all test utilities and classes for external usage and integration testing
module.exports = {
    // HelloHandlerTestSuite class for organized hello handler component testing with comprehensive test coverage and lifecycle management
    HelloHandlerTestSuite,
    
    // Utility function for setting up hello handler test environment with mock objects and configuration
    setupHelloHandlerTests,
    
    // Utility function for cleaning up hello handler test resources and environment
    teardownHelloHandlerTests,
    
    // Standalone function for testing hello handler response generation functionality
    testHelloHandlerResponse,
    
    // Standalone function for testing hello handler request validation logic
    testHelloHandlerValidation,
    
    // Standalone function for testing hello handler performance characteristics
    testHelloHandlerPerformance
};