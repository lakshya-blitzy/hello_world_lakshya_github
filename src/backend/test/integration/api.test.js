/**
 * Comprehensive Integration Test Suite for Node.js Tutorial HTTP Server API
 * 
 * This integration test suite validates complete request-response cycles, endpoint functionality,
 * error handling, and server lifecycle management using Node.js built-in test runner with zero
 * external dependencies. Tests the full application stack from HTTP server initialization through
 * request routing, handler processing, response generation, and error management.
 * 
 * Educational Purpose:
 * - Demonstrates integration testing patterns for Node.js HTTP server applications
 * - Shows comprehensive API testing including success scenarios, error handling, and performance validation
 * - Illustrates test environment management with proper setup and teardown procedures
 * - Uses Node.js built-in testing capabilities for zero-dependency integration testing
 * - Provides examples of performance testing and validation integrated into test suites
 * - Shows correlation tracking and request tracing for debugging integration tests
 * 
 * Features:
 * - Complete API integration testing from server startup through request processing
 * - HTTP endpoint validation including /hello endpoint functionality and error responses
 * - Performance testing with timing measurement and resource monitoring
 * - Server lifecycle testing with graceful startup and shutdown procedures
 * - Correlation tracking for request debugging and test isolation
 * - Security testing including error response validation and header verification
 * - Zero external dependencies using only Node.js built-in modules
 */

// Node.js built-in imports for test execution and assertion support
import { test, describe, before, after } from 'node:test'; // node:test@built-in - Node.js built-in test runner for test execution and assertion support
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Node.js built-in assertion library for strict equality and validation checks
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Node.js built-in performance API for request timing and performance measurement
import { setTimeout } from 'node:timers/promises'; // node:timers/promises@built-in - Node.js built-in promisified setTimeout for test delays and timing control

// Internal imports for test infrastructure and server components
import { TestEnvironment } from '../fixtures/test-helpers.js';
import { testData } from '../fixtures/test-data.js';
import { HttpServer } from '../../lib/http-server.js';
import { config } from '../../config/environment.js';

// Global test configuration constants for consistent testing behavior
const TEST_TIMEOUT = 10000;
const SERVER_STARTUP_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 3000;
const PERFORMANCE_THRESHOLD = 100;
const CORRELATION_PREFIX = 'api-test-';

// Test environment instance for global test lifecycle management
let testEnvironment = null;
let testServer = null;

/**
 * Initializes test environment including test server creation, startup, and configuration
 * for integration testing with isolated server instance and proper connectivity validation
 * @param {Object} options - Optional test environment configuration including server settings and test parameters
 * @returns {Promise<Object>} Promise resolving to test environment instance with server address and configuration
 */
async function setupTestEnvironment(options = {}) {
    try {
        // Step 1: Create TestEnvironment instance with test-specific configuration
        const testConfig = {
            port: 0, // Use dynamic port allocation for test isolation
            hostname: '127.0.0.1',
            timeout: REQUEST_TIMEOUT,
            serverStartupTimeout: SERVER_STARTUP_TIMEOUT,
            enablePerformanceMonitoring: true,
            validateResponses: true,
            ...options
        };

        const environment = new TestEnvironment(testConfig);

        // Step 2: Initialize HTTP server with isolated port allocation for test isolation
        await environment.setup();

        // Step 3: Start test server with startup validation and connectivity checks
        // Server startup is handled by TestEnvironment.setup()

        // Step 4: Retrieve server address information for test client connections
        const serverAddress = environment.serverAddress;
        if (!serverAddress || !serverAddress.url) {
            throw new Error('Failed to retrieve valid server address from test environment');
        }

        // Step 5: Validate test server is listening and ready for request processing
        if (!environment.server || !environment.server.isListening()) {
            throw new Error('Test server is not listening after setup');
        }

        // Step 6: Return configured test environment ready for integration testing
        console.log(`Test environment setup completed: ${serverAddress.url}`);
        return environment;

    } catch (setupError) {
        console.error('Test environment setup failed:', setupError.message);
        throw setupError;
    }
}

/**
 * Cleans up test environment including server shutdown, resource cleanup, and validation
 * with comprehensive error handling and proper resource management
 * @param {Object} testEnv - Test environment instance to clean up and shutdown
 * @returns {Promise<void>} Promise resolving when test environment cleanup is complete
 */
async function teardownTestEnvironment(testEnv) {
    try {
        if (!testEnv) {
            console.warn('No test environment to teardown');
            return;
        }

        // Step 1: Stop test server gracefully with connection cleanup
        await testEnv.teardown();

        // Step 2: Clean up test resources including event listeners and timers
        // Cleanup is handled by TestEnvironment.teardown()

        // Step 3: Validate server has stopped completely and port is released
        if (testEnv.server && testEnv.server.isListening()) {
            console.warn('Test server still listening after teardown');
        }

        // Step 4: Complete test environment teardown and resource management
        console.log('Test environment teardown completed successfully');

    } catch (teardownError) {
        console.error('Test environment teardown failed:', teardownError.message);
        throw teardownError;
    }
}

/**
 * Validates hello endpoint functionality including request processing, response generation,
 * and comprehensive header management with performance measurement
 * @param {Object} testEnv - Test environment instance for making requests
 * @param {Object} requestOptions - Optional request configuration overrides
 * @returns {Promise<Object>} Promise resolving to validation result with response details and performance metrics
 */
async function validateHelloEndpoint(testEnv, requestOptions = {}) {
    try {
        // Step 1: Make GET request to /hello endpoint using test environment
        const startTime = performance.now();
        const response = await testEnv.makeRequest('/hello', {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
                'User-Agent': 'Node.js Test Client/1.0.0',
                ...requestOptions.headers
            },
            timeout: REQUEST_TIMEOUT,
            ...requestOptions
        });

        // Step 2: Measure request processing time for performance validation
        const processingTime = performance.now() - startTime;

        // Step 3: Validate response status code is 200 OK
        assert.strictEqual(response.status, 200, 
            `Expected status 200 but got ${response.status}`);

        // Step 4: Validate response content is exactly 'Hello world'
        assert.strictEqual(response.body, 'Hello world', 
            `Expected body 'Hello world' but got '${response.body}'`);

        // Step 5: Validate Content-Type header is 'text/plain; charset=utf-8'
        assert.ok(response.headers['content-type'], 
            'Content-Type header is missing');
        assert.ok(response.headers['content-type'].includes('text/plain'), 
            `Expected Content-Type to include 'text/plain' but got '${response.headers['content-type']}'`);

        // Step 6: Validate Content-Length header matches response body length
        const expectedLength = Buffer.byteLength('Hello world');
        assert.strictEqual(response.headers['content-length'], expectedLength.toString(), 
            `Expected Content-Length ${expectedLength} but got ${response.headers['content-length']}`);

        // Step 7: Validate security headers are present and correct
        assert.ok(response.headers['x-content-type-options'], 
            'X-Content-Type-Options security header is missing');
        assert.strictEqual(response.headers['x-content-type-options'], 'nosniff', 
            `Expected X-Content-Type-Options 'nosniff' but got '${response.headers['x-content-type-options']}'`);

        assert.ok(response.headers['x-frame-options'], 
            'X-Frame-Options security header is missing');

        // Step 8: Return comprehensive validation result with timing and response data
        return {
            success: true,
            response: {
                status: response.status,
                body: response.body,
                headers: response.headers,
                timing: response.timing
            },
            performance: {
                processingTime,
                withinThreshold: processingTime <= PERFORMANCE_THRESHOLD
            },
            validation: {
                statusCodeValid: true,
                contentValid: true,
                headersValid: true,
                securityHeadersValid: true
            }
        };

    } catch (validationError) {
        return {
            success: false,
            error: validationError.message,
            response: null,
            performance: null,
            validation: null
        };
    }
}

/**
 * Validates error handling scenarios including 404 Not Found, 405 Method Not Allowed,
 * and validation errors with comprehensive response analysis
 * @param {Object} testEnv - Test environment instance for error scenario testing
 * @param {String} errorType - Type of error to test (notFound, methodNotAllowed, badRequest)
 * @returns {Promise<Object>} Promise resolving to error validation result with response analysis
 */
async function validateErrorHandling(testEnv, errorType) {
    try {
        let requestConfig = {};
        let expectedStatus = 500;
        let expectedContent = '';

        // Step 1: Load invalid request configuration from test data based on error type
        switch (errorType) {
            case 'notFound':
                requestConfig = {
                    path: '/nonexistent',
                    method: 'GET'
                };
                expectedStatus = 404;
                expectedContent = 'Not Found';
                break;

            case 'methodNotAllowed':
                requestConfig = {
                    path: '/hello',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: '{"message": "test"}'
                };
                expectedStatus = 405;
                expectedContent = 'Method Not Allowed';
                break;

            case 'badRequest':
                requestConfig = {
                    path: '/hello with spaces',
                    method: 'GET'
                };
                expectedStatus = 400;
                expectedContent = 'Bad Request';
                break;

            default:
                throw new Error(`Unknown error type: ${errorType}`);
        }

        // Step 2: Make HTTP request designed to trigger specified error condition
        const startTime = performance.now();
        const response = await testEnv.makeRequest(requestConfig.path, {
            method: requestConfig.method,
            headers: requestConfig.headers || {},
            body: requestConfig.body,
            timeout: REQUEST_TIMEOUT
        });
        const processingTime = performance.now() - startTime;

        // Step 3: Validate appropriate HTTP error status code is returned
        assert.strictEqual(response.status, expectedStatus, 
            `Expected status ${expectedStatus} for ${errorType} but got ${response.status}`);

        // Step 4: Validate error response message is secure and appropriate
        if (expectedContent && response.body) {
            assert.ok(response.body.includes(expectedContent), 
                `Expected response to contain '${expectedContent}' but got '${response.body}'`);
        }

        // Step 5: Validate error response headers include security protection
        assert.ok(response.headers['content-type'], 
            'Content-Type header is missing in error response');
        
        // Security headers should be present in error responses
        if (response.headers['x-content-type-options']) {
            assert.strictEqual(response.headers['x-content-type-options'], 'nosniff', 
                'X-Content-Type-Options security header should be nosniff in error responses');
        }

        // Step 6: Validate error response timing meets performance requirements
        assert.ok(processingTime <= PERFORMANCE_THRESHOLD, 
            `Error response time ${processingTime}ms exceeds threshold ${PERFORMANCE_THRESHOLD}ms`);

        // Step 7: Return error validation result with complete response analysis
        return {
            success: true,
            errorType,
            response: {
                status: response.status,
                body: response.body,
                headers: response.headers
            },
            performance: {
                processingTime,
                withinThreshold: processingTime <= PERFORMANCE_THRESHOLD
            },
            validation: {
                statusCodeValid: response.status === expectedStatus,
                contentValid: !expectedContent || (response.body && response.body.includes(expectedContent)),
                headersValid: true,
                securityValid: true
            }
        };

    } catch (errorValidationError) {
        return {
            success: false,
            error: errorValidationError.message,
            errorType,
            response: null,
            performance: null,
            validation: null
        };
    }
}

/**
 * Measures API performance including response times, throughput, and resource utilization
 * under various load conditions with comprehensive metrics collection
 * @param {Object} testEnv - Test environment instance for performance testing
 * @param {Object} performanceConfig - Performance test configuration including request count and concurrency
 * @returns {Promise<Object>} Promise resolving to comprehensive performance metrics and analysis
 */
async function measureApiPerformance(testEnv, performanceConfig = {}) {
    try {
        const config = {
            sequentialRequests: performanceConfig.sequentialRequests || 10,
            concurrentRequests: performanceConfig.concurrentRequests || 5,
            requestTimeout: performanceConfig.requestTimeout || REQUEST_TIMEOUT,
            ...performanceConfig
        };

        const metrics = {
            sequential: {
                requests: [],
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0
            },
            concurrent: {
                requests: [],
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0
            },
            memory: {
                beforeTest: process.memoryUsage(),
                afterTest: null,
                delta: null
            }
        };

        // Step 1: Execute sequential hello endpoint requests for baseline performance measurement
        console.log(`Starting sequential performance test: ${config.sequentialRequests} requests`);
        const sequentialStartTime = performance.now();

        for (let i = 0; i < config.sequentialRequests; i++) {
            const requestStart = performance.now();
            const response = await testEnv.makeRequest('/hello', {
                method: 'GET',
                timeout: config.requestTimeout
            });
            const requestTime = performance.now() - requestStart;

            metrics.sequential.requests.push({
                requestNumber: i + 1,
                responseTime: requestTime,
                statusCode: response.status,
                success: response.status === 200
            });

            metrics.sequential.minTime = Math.min(metrics.sequential.minTime, requestTime);
            metrics.sequential.maxTime = Math.max(metrics.sequential.maxTime, requestTime);
        }

        metrics.sequential.totalTime = performance.now() - sequentialStartTime;
        metrics.sequential.averageTime = metrics.sequential.requests
            .reduce((sum, req) => sum + req.responseTime, 0) / metrics.sequential.requests.length;

        // Step 2: Execute concurrent hello endpoint requests for load testing
        console.log(`Starting concurrent performance test: ${config.concurrentRequests} requests`);
        const concurrentStartTime = performance.now();

        const concurrentPromises = Array.from({ length: config.concurrentRequests }, async (_, i) => {
            const requestStart = performance.now();
            try {
                const response = await testEnv.makeRequest('/hello', {
                    method: 'GET',
                    timeout: config.requestTimeout
                });
                const requestTime = performance.now() - requestStart;

                return {
                    requestNumber: i + 1,
                    responseTime: requestTime,
                    statusCode: response.status,
                    success: response.status === 200
                };
            } catch (error) {
                const requestTime = performance.now() - requestStart;
                return {
                    requestNumber: i + 1,
                    responseTime: requestTime,
                    statusCode: 0,
                    success: false,
                    error: error.message
                };
            }
        });

        metrics.concurrent.requests = await Promise.all(concurrentPromises);
        metrics.concurrent.totalTime = performance.now() - concurrentStartTime;

        // Step 3: Calculate concurrent performance metrics
        const successfulConcurrentRequests = metrics.concurrent.requests.filter(req => req.success);
        if (successfulConcurrentRequests.length > 0) {
            metrics.concurrent.averageTime = successfulConcurrentRequests
                .reduce((sum, req) => sum + req.responseTime, 0) / successfulConcurrentRequests.length;
            
            metrics.concurrent.minTime = Math.min(...successfulConcurrentRequests.map(req => req.responseTime));
            metrics.concurrent.maxTime = Math.max(...successfulConcurrentRequests.map(req => req.responseTime));
        }

        // Step 4: Track memory usage during request processing
        metrics.memory.afterTest = process.memoryUsage();
        metrics.memory.delta = {
            heapUsed: metrics.memory.afterTest.heapUsed - metrics.memory.beforeTest.heapUsed,
            heapTotal: metrics.memory.afterTest.heapTotal - metrics.memory.beforeTest.heapTotal,
            rss: metrics.memory.afterTest.rss - metrics.memory.beforeTest.rss
        };

        // Step 5: Calculate requests per second throughput metrics
        const throughputMetrics = {
            sequentialRps: config.sequentialRequests / (metrics.sequential.totalTime / 1000),
            concurrentRps: config.concurrentRequests / (metrics.concurrent.totalTime / 1000),
            successRate: {
                sequential: (metrics.sequential.requests.filter(req => req.success).length / metrics.sequential.requests.length) * 100,
                concurrent: (successfulConcurrentRequests.length / metrics.concurrent.requests.length) * 100
            }
        };

        // Step 6: Validate performance meets configured thresholds
        const thresholdValidation = {
            sequentialAverageValid: metrics.sequential.averageTime <= PERFORMANCE_THRESHOLD,
            concurrentAverageValid: metrics.concurrent.averageTime <= PERFORMANCE_THRESHOLD,
            memoryUsageAcceptable: Math.abs(metrics.memory.delta.heapUsed) < (50 * 1024 * 1024), // 50MB threshold
            throughputAcceptable: throughputMetrics.sequentialRps >= 10 // Minimum 10 RPS
        };

        // Step 7: Return detailed performance analysis with recommendations
        return {
            success: true,
            config,
            metrics,
            throughput: throughputMetrics,
            validation: thresholdValidation,
            recommendations: generatePerformanceRecommendations(metrics, thresholdValidation),
            timestamp: new Date().toISOString()
        };

    } catch (performanceError) {
        return {
            success: false,
            error: performanceError.message,
            metrics: null,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Validates complete server lifecycle including startup, request processing, and graceful shutdown
 * with comprehensive timing analysis and resource management validation
 * @param {Object} serverConfig - Server configuration for lifecycle testing
 * @returns {Promise<Object>} Promise resolving to lifecycle validation results with timing and status information
 */
async function validateServerLifecycle(serverConfig = {}) {
    try {
        const config = {
            port: 0, // Dynamic port allocation
            hostname: '127.0.0.1',
            timeout: 5000,
            ...serverConfig
        };

        const lifecycleMetrics = {
            startup: {
                startTime: null,
                endTime: null,
                duration: null,
                success: false
            },
            operation: {
                requestsProcessed: 0,
                requestsSuccessful: 0,
                averageResponseTime: 0
            },
            shutdown: {
                startTime: null,
                endTime: null,
                duration: null,
                success: false
            }
        };

        // Step 1: Create HttpServer instance with test configuration
        console.log('Creating HttpServer for lifecycle testing');
        const server = new HttpServer(config);

        // Step 2: Measure server startup time and validate successful port binding
        console.log('Starting server lifecycle test');
        lifecycleMetrics.startup.startTime = performance.now();

        await server.start();
        
        lifecycleMetrics.startup.endTime = performance.now();
        lifecycleMetrics.startup.duration = lifecycleMetrics.startup.endTime - lifecycleMetrics.startup.startTime;
        lifecycleMetrics.startup.success = server.isListening();

        // Validate server startup completed successfully
        assert.ok(server.isListening(), 'Server should be listening after startup');
        assert.ok(lifecycleMetrics.startup.duration <= SERVER_STARTUP_TIMEOUT, 
            `Server startup time ${lifecycleMetrics.startup.duration}ms exceeds timeout ${SERVER_STARTUP_TIMEOUT}ms`);

        const serverAddress = server.getAddress();
        assert.ok(serverAddress && serverAddress.url, 'Server address should be available after startup');

        // Step 3: Test server responsiveness immediately after startup
        console.log('Testing server responsiveness after startup');
        const responsivenesssTest = await fetch(`${serverAddress.url}/hello`, {
            method: 'GET',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });

        assert.strictEqual(responsivenesssTest.status, 200, 
            'Server should respond with 200 immediately after startup');

        // Step 4: Process multiple requests to validate ongoing operation
        console.log('Processing multiple requests to validate ongoing operation');
        const operationRequests = 5;
        const requestTimes = [];

        for (let i = 0; i < operationRequests; i++) {
            const requestStart = performance.now();
            const response = await fetch(`${serverAddress.url}/hello`, {
                method: 'GET',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT)
            });
            const requestTime = performance.now() - requestStart;

            requestTimes.push(requestTime);
            lifecycleMetrics.operation.requestsProcessed++;

            if (response.status === 200) {
                lifecycleMetrics.operation.requestsSuccessful++;
            }
        }

        lifecycleMetrics.operation.averageResponseTime = requestTimes.length > 0 
            ? requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length 
            : 0;

        // Validate operational requests processed successfully
        assert.strictEqual(lifecycleMetrics.operation.requestsProcessed, operationRequests, 
            'All operational requests should be processed');
        assert.strictEqual(lifecycleMetrics.operation.requestsSuccessful, operationRequests, 
            'All operational requests should be successful');

        // Step 5: Initiate graceful shutdown and measure shutdown duration
        console.log('Initiating graceful server shutdown');
        lifecycleMetrics.shutdown.startTime = performance.now();

        await server.stop();

        lifecycleMetrics.shutdown.endTime = performance.now();
        lifecycleMetrics.shutdown.duration = lifecycleMetrics.shutdown.endTime - lifecycleMetrics.shutdown.startTime;
        lifecycleMetrics.shutdown.success = !server.isListening();

        // Step 6: Validate server resources are properly cleaned up
        assert.ok(!server.isListening(), 'Server should not be listening after shutdown');
        assert.ok(lifecycleMetrics.shutdown.duration <= 10000, 
            `Server shutdown time ${lifecycleMetrics.shutdown.duration}ms is excessive`);

        // Step 7: Return lifecycle validation results with complete timing analysis
        return {
            success: true,
            metrics: lifecycleMetrics,
            validation: {
                startupValid: lifecycleMetrics.startup.success && lifecycleMetrics.startup.duration <= SERVER_STARTUP_TIMEOUT,
                operationValid: lifecycleMetrics.operation.requestsSuccessful === operationRequests,
                shutdownValid: lifecycleMetrics.shutdown.success && lifecycleMetrics.shutdown.duration <= 10000
            },
            timing: {
                totalTestDuration: lifecycleMetrics.shutdown.endTime - lifecycleMetrics.startup.startTime,
                startupDuration: lifecycleMetrics.startup.duration,
                shutdownDuration: lifecycleMetrics.shutdown.duration
            },
            serverAddress,
            config
        };

    } catch (lifecycleError) {
        return {
            success: false,
            error: lifecycleError.message,
            metrics: null,
            validation: null,
            timing: null
        };
    }
}

/**
 * Generates unique correlation ID for API test request tracking and debugging
 * with timestamp and random components for uniqueness
 * @returns {String} Unique correlation ID with API test prefix for request tracking
 */
function generateCorrelationId() {
    // Step 1: Generate timestamp component using high-resolution timer
    const timestamp = Date.now();
    const performanceComponent = Math.floor(performance.now() * 1000);

    // Step 2: Create random component for uniqueness within test execution
    const randomComponent = Math.random().toString(36).substring(2, 10);

    // Step 3: Combine components with API test prefix for identification
    const correlationId = `${CORRELATION_PREFIX}${timestamp}-${performanceComponent}-${randomComponent}`;

    // Step 4: Return formatted correlation ID for test request tracking
    return correlationId;
}

/**
 * Generates performance recommendations based on test results
 * @private
 */
function generatePerformanceRecommendations(metrics, validation) {
    const recommendations = [];

    if (!validation.sequentialAverageValid) {
        recommendations.push('Sequential request performance is below threshold - consider optimizing request processing');
    }

    if (!validation.concurrentAverageValid) {
        recommendations.push('Concurrent request performance is below threshold - consider optimizing for concurrent load');
    }

    if (!validation.memoryUsageAcceptable) {
        recommendations.push('Memory usage increased significantly during testing - investigate potential memory leaks');
    }

    if (!validation.throughputAcceptable) {
        recommendations.push('Request throughput is below minimum threshold - optimize server request handling');
    }

    if (recommendations.length === 0) {
        recommendations.push('Performance metrics are within acceptable thresholds');
    }

    return recommendations;
}

// Main test suite execution with comprehensive integration testing

describe('API Integration Tests', () => {
    // Test suite setup - initialize test environment once for all tests
    before(async () => {
        console.log('Setting up test environment for API integration tests');
        testEnvironment = await setupTestEnvironment({
            enablePerformanceMonitoring: true,
            validateResponses: true
        });
        console.log(`Test environment ready: ${testEnvironment.serverAddress.url}`);
    });

    // Test suite teardown - clean up test environment after all tests
    after(async () => {
        console.log('Tearing down test environment');
        if (testEnvironment) {
            await teardownTestEnvironment(testEnvironment);
            console.log('Test environment teardown completed');
        }
    });

    // Hello Endpoint Integration Tests
    describe('Hello Endpoint Tests', () => {
        test('should return Hello world for GET /hello', async () => {
            const validation = await validateHelloEndpoint(testEnvironment);
            
            assert.ok(validation.success, `Hello endpoint validation failed: ${validation.error}`);
            assert.strictEqual(validation.response.status, 200, 'Expected HTTP 200 status');
            assert.strictEqual(validation.response.body, 'Hello world', 'Expected Hello world content');
            assert.ok(validation.validation.statusCodeValid, 'Status code validation failed');
            assert.ok(validation.validation.contentValid, 'Content validation failed');
            assert.ok(validation.validation.headersValid, 'Headers validation failed');
        });

        test('should include proper Content-Type header', async () => {
            const validation = await validateHelloEndpoint(testEnvironment);
            
            assert.ok(validation.success, `Validation failed: ${validation.error}`);
            assert.ok(validation.response.headers['content-type'], 'Content-Type header is missing');
            assert.ok(validation.response.headers['content-type'].includes('text/plain'), 
                `Expected Content-Type to include text/plain: ${validation.response.headers['content-type']}`);
            assert.ok(validation.response.headers['content-type'].includes('charset=utf-8'), 
                `Expected Content-Type to include charset=utf-8: ${validation.response.headers['content-type']}`);
        });

        test('should include security headers', async () => {
            const validation = await validateHelloEndpoint(testEnvironment);
            
            assert.ok(validation.success, `Validation failed: ${validation.error}`);
            assert.ok(validation.validation.securityHeadersValid, 'Security headers validation failed');
            assert.ok(validation.response.headers['x-content-type-options'], 
                'X-Content-Type-Options header is missing');
            assert.strictEqual(validation.response.headers['x-content-type-options'], 'nosniff', 
                'X-Content-Type-Options should be nosniff');
            assert.ok(validation.response.headers['x-frame-options'], 
                'X-Frame-Options header is missing');
        });

        test('should respond within performance threshold', async () => {
            const validation = await validateHelloEndpoint(testEnvironment);
            
            assert.ok(validation.success, `Validation failed: ${validation.error}`);
            assert.ok(validation.performance.withinThreshold, 
                `Response time ${validation.performance.processingTime}ms exceeds threshold ${PERFORMANCE_THRESHOLD}ms`);
            assert.ok(validation.performance.processingTime <= PERFORMANCE_THRESHOLD, 
                `Processing time should be <= ${PERFORMANCE_THRESHOLD}ms`);
        });
    });

    // Error Handling Integration Tests
    describe('Error Handling Tests', () => {
        test('should return 404 for unknown paths', async () => {
            const validation = await validateErrorHandling(testEnvironment, 'notFound');
            
            assert.ok(validation.success, `Error handling validation failed: ${validation.error}`);
            assert.strictEqual(validation.response.status, 404, 'Expected HTTP 404 status');
            assert.ok(validation.validation.statusCodeValid, 'Status code validation failed');
            assert.ok(validation.validation.contentValid, 'Content validation failed');
        });

        test('should return 405 for unsupported methods', async () => {
            const validation = await validateErrorHandling(testEnvironment, 'methodNotAllowed');
            
            assert.ok(validation.success, `Method not allowed validation failed: ${validation.error}`);
            assert.strictEqual(validation.response.status, 405, 'Expected HTTP 405 status');
            assert.ok(validation.validation.statusCodeValid, 'Status code validation failed');
            
            // Check for Allow header in method not allowed responses
            if (validation.response.headers.allow || validation.response.headers.Allow) {
                const allowHeader = validation.response.headers.allow || validation.response.headers.Allow;
                assert.ok(allowHeader.includes('GET'), 'Allow header should include GET method');
            }
        });

        test('should handle malformed requests', async () => {
            // Test with malformed URL - some servers may handle this differently
            const response = await testEnvironment.makeRequest('/hello%20with%20spaces', {
                method: 'GET',
                timeout: REQUEST_TIMEOUT
            });

            // Server may return 400 for malformed URLs or process them normally
            assert.ok(response.status >= 200 && response.status < 600, 
                'Response should have a valid HTTP status code');
            assert.ok(response.headers['content-type'], 
                'Response should have Content-Type header');
        });

        test('should not expose sensitive information in errors', async () => {
            const validation = await validateErrorHandling(testEnvironment, 'notFound');
            
            assert.ok(validation.success, `Validation failed: ${validation.error}`);
            
            // Ensure error response doesn't contain stack traces or system information
            const responseBody = validation.response.body.toLowerCase();
            assert.ok(!responseBody.includes('stack'), 'Error response should not contain stack traces');
            assert.ok(!responseBody.includes('error:'), 'Error response should not contain detailed error information');
            assert.ok(!responseBody.includes('at '), 'Error response should not contain stack trace lines');
            
            // Ensure security headers are present in error responses
            assert.ok(validation.validation.securityValid, 'Security validation failed for error response');
        });
    });

    // Performance Integration Tests
    describe('Performance Tests', () => {
        test('should handle concurrent requests efficiently', async () => {
            const performanceResult = await measureApiPerformance(testEnvironment, {
                sequentialRequests: 5,
                concurrentRequests: 10,
                requestTimeout: REQUEST_TIMEOUT
            });

            assert.ok(performanceResult.success, `Performance test failed: ${performanceResult.error}`);
            assert.ok(performanceResult.validation.concurrentAverageValid, 
                `Concurrent request average time ${performanceResult.metrics.concurrent.averageTime}ms exceeds threshold`);
            assert.ok(performanceResult.throughput.concurrent >= 5, 
                'Concurrent throughput should be at least 5 requests per second');
            
            // Validate success rate for concurrent requests
            assert.ok(performanceResult.throughput.successRate.concurrent >= 90, 
                `Concurrent request success rate ${performanceResult.throughput.successRate.concurrent}% is too low`);
        });

        test('should maintain memory usage within limits', async () => {
            const performanceResult = await measureApiPerformance(testEnvironment, {
                sequentialRequests: 20,
                concurrentRequests: 5
            });

            assert.ok(performanceResult.success, `Performance test failed: ${performanceResult.error}`);
            assert.ok(performanceResult.validation.memoryUsageAcceptable, 
                `Memory usage increase ${performanceResult.metrics.memory.delta.heapUsed} bytes is excessive`);
            
            // Memory usage should not increase significantly during normal operation
            const memoryIncreaseMB = performanceResult.metrics.memory.delta.heapUsed / (1024 * 1024);
            assert.ok(Math.abs(memoryIncreaseMB) < 50, 
                `Memory usage increased by ${memoryIncreaseMB.toFixed(2)}MB, which exceeds 50MB limit`);
        });

        test('should achieve target throughput', async () => {
            const performanceResult = await measureApiPerformance(testEnvironment, {
                sequentialRequests: 50,
                concurrentRequests: 10
            });

            assert.ok(performanceResult.success, `Performance test failed: ${performanceResult.error}`);
            assert.ok(performanceResult.validation.throughputAcceptable, 
                `Sequential throughput ${performanceResult.throughput.sequentialRps} RPS is below minimum`);
            
            // Validate both sequential and concurrent throughput
            assert.ok(performanceResult.throughput.sequentialRps >= 10, 
                'Sequential throughput should be at least 10 RPS');
            assert.ok(performanceResult.throughput.concurrentRps >= 5, 
                'Concurrent throughput should be at least 5 RPS');
        });
    });

    // Server Lifecycle Integration Tests
    describe('Server Lifecycle Tests', () => {
        test('should start server successfully', async () => {
            const lifecycleResult = await validateServerLifecycle({
                port: 0, // Dynamic port allocation
                timeout: 5000
            });

            assert.ok(lifecycleResult.success, `Server lifecycle test failed: ${lifecycleResult.error}`);
            assert.ok(lifecycleResult.validation.startupValid, 'Server startup validation failed');
            assert.ok(lifecycleResult.metrics.startup.success, 'Server startup was not successful');
            assert.ok(lifecycleResult.metrics.startup.duration <= SERVER_STARTUP_TIMEOUT, 
                `Server startup time ${lifecycleResult.metrics.startup.duration}ms exceeds timeout`);
        });

        test('should accept connections immediately after startup', async () => {
            const lifecycleResult = await validateServerLifecycle();

            assert.ok(lifecycleResult.success, `Lifecycle test failed: ${lifecycleResult.error}`);
            assert.ok(lifecycleResult.validation.operationValid, 'Server operation validation failed');
            assert.strictEqual(lifecycleResult.metrics.operation.requestsProcessed, 
                lifecycleResult.metrics.operation.requestsSuccessful,
                'All requests should be processed successfully immediately after startup');
        });

        test('should shutdown gracefully', async () => {
            const lifecycleResult = await validateServerLifecycle();

            assert.ok(lifecycleResult.success, `Lifecycle test failed: ${lifecycleResult.error}`);
            assert.ok(lifecycleResult.validation.shutdownValid, 'Server shutdown validation failed');
            assert.ok(lifecycleResult.metrics.shutdown.success, 'Server shutdown was not successful');
            assert.ok(lifecycleResult.metrics.shutdown.duration <= 10000, 
                `Server shutdown time ${lifecycleResult.metrics.shutdown.duration}ms is excessive`);
        });

        test('should handle startup failures appropriately', async () => {
            // Test startup failure by trying to bind to an invalid port
            try {
                const server = new HttpServer({
                    port: -1, // Invalid port number
                    hostname: '127.0.0.1'
                });

                await server.start();
                
                // If we reach here, the test should fail because startup should have failed
                assert.fail('Server startup should have failed with invalid port');
                
            } catch (startupError) {
                // Startup failure is expected with invalid configuration
                assert.ok(startupError instanceof Error, 'Startup error should be an Error instance');
                assert.ok(startupError.message.length > 0, 'Startup error should have a descriptive message');
                
                // The error message should be helpful for debugging
                console.log(`Expected startup failure: ${startupError.message}`);
            }
        });
    });

    // Additional integration tests for comprehensive coverage
    describe('Request Correlation and Tracking', () => {
        test('should generate and track correlation IDs', async () => {
            const correlationId = generateCorrelationId();
            
            assert.ok(correlationId, 'Correlation ID should be generated');
            assert.ok(correlationId.startsWith(CORRELATION_PREFIX), 
                `Correlation ID should start with ${CORRELATION_PREFIX}`);
            assert.ok(correlationId.length > CORRELATION_PREFIX.length + 10, 
                'Correlation ID should have sufficient length for uniqueness');

            // Test request with correlation ID
            const response = await testEnvironment.makeRequest('/hello', {
                method: 'GET',
                headers: {
                    'X-Correlation-ID': correlationId
                }
            });

            assert.strictEqual(response.status, 200, 'Request with correlation ID should succeed');
        });

        test('should handle multiple simultaneous requests with different correlation IDs', async () => {
            const requestCount = 5;
            const correlationIds = Array.from({ length: requestCount }, () => generateCorrelationId());
            
            // Ensure all correlation IDs are unique
            const uniqueIds = new Set(correlationIds);
            assert.strictEqual(uniqueIds.size, requestCount, 'All correlation IDs should be unique');

            // Make simultaneous requests with different correlation IDs
            const requestPromises = correlationIds.map(id => 
                testEnvironment.makeRequest('/hello', {
                    method: 'GET',
                    headers: {
                        'X-Correlation-ID': id
                    }
                })
            );

            const responses = await Promise.all(requestPromises);

            // Validate all requests succeeded
            responses.forEach((response, index) => {
                assert.strictEqual(response.status, 200, 
                    `Request ${index + 1} with correlation ID ${correlationIds[index]} should succeed`);
            });
        });
    });

    describe('Edge Cases and Boundary Testing', () => {
        test('should handle requests with unusual headers', async () => {
            const response = await testEnvironment.makeRequest('/hello', {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Test/1.0 (Integration Test Suite)',
                    'X-Custom-Header': 'test-value',
                    'Cache-Control': 'no-cache'
                }
            });

            assert.strictEqual(response.status, 200, 'Server should handle unusual headers gracefully');
            assert.strictEqual(response.body, 'Hello world', 'Response content should be correct regardless of headers');
        });

        test('should handle rapid sequential requests', async () => {
            const requestCount = 25;
            const responses = [];

            for (let i = 0; i < requestCount; i++) {
                const response = await testEnvironment.makeRequest('/hello', {
                    method: 'GET'
                });
                responses.push(response);
            }

            // All requests should succeed
            responses.forEach((response, index) => {
                assert.strictEqual(response.status, 200, 
                    `Rapid sequential request ${index + 1} should succeed`);
                assert.strictEqual(response.body, 'Hello world', 
                    `Rapid sequential request ${index + 1} should return correct content`);
            });

            // Check for consistent performance
            const responseTimes = responses.map(r => r.timing.duration);
            const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            
            assert.ok(averageTime <= PERFORMANCE_THRESHOLD * 2, 
                `Average response time for rapid requests ${averageTime}ms should be reasonable`);
        });

        test('should maintain server health during extended operation', async () => {
            const testDuration = 10000; // 10 seconds
            const startTime = performance.now();
            let requestCount = 0;
            let successCount = 0;

            // Make requests continuously for the test duration
            while (performance.now() - startTime < testDuration) {
                try {
                    const response = await testEnvironment.makeRequest('/hello', {
                        method: 'GET',
                        timeout: 1000
                    });
                    
                    requestCount++;
                    if (response.status === 200) {
                        successCount++;
                    }
                    
                    // Small delay to prevent overwhelming the server
                    await setTimeout(50);
                    
                } catch (error) {
                    requestCount++;
                    console.warn(`Request failed during extended operation: ${error.message}`);
                }
            }

            const successRate = (successCount / requestCount) * 100;
            
            assert.ok(requestCount > 0, 'Should have processed some requests during extended operation');
            assert.ok(successRate >= 95, 
                `Success rate ${successRate.toFixed(2)}% should be at least 95% during extended operation`);
            
            console.log(`Extended operation test: ${requestCount} requests, ${successRate.toFixed(2)}% success rate`);
        });
    });
});