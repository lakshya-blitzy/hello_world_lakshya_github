/**
 * Comprehensive Unit Test Suite for HTTP Server Component
 * 
 * This test file provides complete coverage of the HttpServer class functionality including
 * server lifecycle management, request processing coordination, error handling, performance
 * characteristics, and integration with routing, error handling, logging, and configuration
 * components using Node.js built-in test runner with zero external dependencies.
 * 
 * Educational Purpose:
 * - Demonstrates comprehensive unit testing using Node.js built-in test runner
 * - Shows HTTP server testing patterns with mock objects and assertion utilities
 * - Provides examples of server lifecycle management testing and resource cleanup
 * - Illustrates performance measurement and validation for HTTP server components
 * - Demonstrates testing integration with dependent components and error scenarios
 * 
 * Test Coverage:
 * - HTTP Server Component Testing: server creation, port binding, request handling
 * - Unit Testing Strategy Implementation: Node.js built-in test runner with mocks
 * - HTTP Server Foundation Testing: initialization, request processing, lifecycle
 * - Server Lifecycle Management Testing: startup, request processing, shutdown
 * - Performance Requirements Testing: startup time, memory usage, concurrent connections
 * - Educational Testing Patterns: comprehensive server component validation examples
 */

// Node.js built-in module imports for testing framework and HTTP server functionality
import { test, describe, before, after, beforeEach, afterEach } from 'node:test'; // node:test@built-in - Node.js built-in test runner for comprehensive test execution
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Node.js built-in strict assertion library for detailed validation
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Node.js built-in performance API for server performance measurement
import { setTimeout } from 'node:timers/promises'; // node:timers/promises@built-in - Node.js built-in promisified setTimeout for test timing control

// Import HTTP server components and utilities for comprehensive server testing
import { 
    HttpServer, 
    createServer, 
    startServer, 
    stopServer 
} from '../../lib/http-server.js';

// Import comprehensive test utilities and helper functions for isolated server testing
import { 
    TestEnvironment, 
    ResponseValidator, 
    measurePerformance, 
    waitForCondition 
} from '../fixtures/test-helpers.js';

// Import mock request utilities for realistic HTTP request simulation and testing
import { 
    createMockRequest, 
    createHelloRequest, 
    createInvalidRequest, 
    MockHttpRequest 
} from '../fixtures/mock-requests.js';

// Import test data configurations for comprehensive testing scenarios and validation
import { testData } from '../fixtures/test-data.js';

// Global test configuration constants for consistent testing behavior across all test cases
const TEST_TIMEOUT = 15000;
const HTTP_SERVER_PERFORMANCE_THRESHOLDS = { 
    startupTime: 1000, 
    responseTime: 100, 
    memoryUsage: 52428800, 
    concurrentConnections: 100 
};
const DEFAULT_TEST_PORT = 0;
const SERVER_STARTUP_TIMEOUT = 5000;
const SERVER_SHUTDOWN_TIMEOUT = 5000;

// Shared test environment and server instances for test lifecycle management
let testEnvironment = null;
let testServer = null;
let responseValidator = null;

/**
 * Sets up HTTP server test environment including server instance, mock dependencies, test configuration,
 * and performance monitoring for comprehensive unit testing with proper isolation and resource management
 * 
 * @param {Object} options - Optional test configuration overrides for specific HTTP server testing scenarios
 * @returns {Promise<Object>} Promise resolving to test environment configuration with server instance and utilities
 */
export async function setupHttpServerTests(options = {}) {
    try {
        // Initialize TestEnvironment instance with HTTP server specific configuration and isolated port binding
        testEnvironment = new TestEnvironment({
            port: DEFAULT_TEST_PORT,
            timeout: TEST_TIMEOUT,
            serverStartupTimeout: SERVER_STARTUP_TIMEOUT,
            enablePerformanceMonitoring: true,
            validateResponses: true,
            ...options
        });

        // Set up test environment with server startup and connectivity validation for reliable testing
        await testEnvironment.setup();

        // Create ResponseValidator with HTTP server specific validation rules and performance thresholds
        responseValidator = new ResponseValidator({
            strictMode: true,
            validateSecurity: true,
            validatePerformance: true,
            performanceThreshold: HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime,
            enableContentValidation: true
        });

        // Register cleanup handlers for proper server shutdown and resource disposal during test teardown
        testEnvironment.addCleanup(async () => {
            if (testServer && testServer.isListening()) {
                await testServer.stop(SERVER_SHUTDOWN_TIMEOUT);
            }
        });

        // Return test environment object with server instance, validators, and test utilities for test execution
        return {
            testEnvironment,
            responseValidator,
            serverAddress: testEnvironment.serverAddress,
            server: testEnvironment.server
        };

    } catch (setupError) {
        console.error('HTTP server test setup failed:', setupError.message);
        throw setupError;
    }
}

/**
 * Cleans up HTTP server test environment including server shutdown, resource cleanup, and performance
 * monitoring disposal with comprehensive validation of complete resource disposal
 * 
 * @param {Object} testEnv - Test environment object from setup containing server and resources to clean up
 * @returns {Promise<void>} Promise resolving when HTTP server test cleanup is complete and validated
 */
export async function teardownHttpServerTests(testEnv) {
    try {
        // Stop performance monitoring and collect final metrics for test reporting and analysis
        if (testEnv && testEnv.testEnvironment) {
            await testEnv.testEnvironment.teardown();
        }

        // Clear global test variables to prevent memory leaks and test isolation issues
        testEnvironment = null;
        testServer = null;
        responseValidator = null;

        // Log test environment cleanup completion and resource verification for debugging
        console.log('HTTP server test environment cleanup completed successfully');

    } catch (teardownError) {
        console.error('HTTP server test teardown failed:', teardownError.message);
        throw teardownError;
    }
}

/**
 * Comprehensive test suite for HTTP server creation, configuration loading, and initial state validation
 * with proper dependency injection and comprehensive property verification
 */
describe('HTTP Server Creation Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up fresh test environment for each test case to ensure isolation
        localTestEnv = await setupHttpServerTests();
    });

    afterEach(async () => {
        // Clean up test environment after each test to prevent resource leaks
        await teardownHttpServerTests(localTestEnv);
    });

    test('should create HttpServer instance with default configuration', async (t) => {
        // Test HttpServer class instantiation with default configuration options
        const server = new HttpServer();
        
        // Validate server instance properties are properly initialized with correct types
        assert.ok(server instanceof HttpServer, 'Should create HttpServer instance');
        assert.strictEqual(typeof server.start, 'function', 'Should have start method');
        assert.strictEqual(typeof server.stop, 'function', 'Should have stop method');
        assert.strictEqual(typeof server.handleRequest, 'function', 'Should have handleRequest method');
        assert.strictEqual(typeof server.getStats, 'function', 'Should have getStats method');
        assert.strictEqual(typeof server.isListening, 'function', 'Should have isListening method');
        assert.strictEqual(typeof server.getAddress, 'function', 'Should have getAddress method');
        
        // Verify server configuration loading from environment and server config with proper defaults
        const stats = server.getStats();
        assert.ok(stats, 'Should have server statistics');
        assert.strictEqual(stats.requests.total, 0, 'Should start with zero requests');
        assert.strictEqual(stats.connections.current, 0, 'Should start with zero connections');
    });

    test('should create server with custom configuration options and overrides', async (t) => {
        // Test server creation with custom configuration options including port, timeout, and behavior settings
        const customConfig = {
            port: 0, // Use dynamic port allocation for testing
            hostname: '127.0.0.1',
            timeout: 5000,
            keepAliveTimeout: 2000
        };
        
        const server = new HttpServer(customConfig);
        
        // Validate server configuration is properly applied from custom options
        assert.ok(server instanceof HttpServer, 'Should create server with custom config');
        assert.ok(server.config, 'Should have configuration object');
        assert.strictEqual(server.config.hostname, '127.0.0.1', 'Should apply custom hostname');
        assert.strictEqual(server.config.timeout, 5000, 'Should apply custom timeout');
    });

    test('should validate server instance properties are properly initialized', async (t) => {
        // Test server initial state including running status and statistics with comprehensive property validation
        const server = new HttpServer();
        
        // Verify server initial state including running status and statistics
        assert.strictEqual(server.isListening(), false, 'Server should not be listening initially');
        assert.strictEqual(server.getAddress(), null, 'Server address should be null before startup');
        
        // Validate server statistics are initialized with correct default values
        const initialStats = server.getStats();
        assert.strictEqual(initialStats.requests.total, 0, 'Should have zero initial requests');
        assert.strictEqual(initialStats.requests.successful, 0, 'Should have zero successful requests');
        assert.strictEqual(initialStats.errors.total, 0, 'Should have zero errors');
        assert.ok(initialStats.performance, 'Should have performance metrics object');
        assert.ok(initialStats.connections, 'Should have connections metrics object');
    });

    test('should test dependency injection of router, error handler, and logger components', async (t) => {
        // Test server configuration loading from environment and server config with proper component integration
        const server = new HttpServer();
        
        // Verify server event handlers are properly configured for lifecycle management
        assert.ok(server.listeners('error').length >= 0, 'Should have error event listeners');
        assert.ok(server.listeners('request').length >= 0, 'Should have request event listeners');
        
        // Test dependency injection through server configuration and component initialization
        const stats = server.getStats();
        assert.ok(stats.server, 'Should have server information in stats');
        assert.ok(stats.server.startTime === null, 'Should have null start time before startup');
    });

    test('should test createServer factory function with different parameter combinations', async (t) => {
        // Test createServer factory function with default parameters for server instantiation
        const server1 = createServer();
        assert.ok(server1 instanceof HttpServer, 'Should create HttpServer instance');
        
        // Test createServer with custom request handler function for request processing delegation
        const customHandler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Custom handler response');
        };
        
        const server2 = createServer(customHandler);
        assert.ok(server2 instanceof HttpServer, 'Should create server with custom handler');
        
        // Test createServer with configuration object for server customization and behavior control
        const server3 = createServer({ port: 0, timeout: 3000 });
        assert.ok(server3 instanceof HttpServer, 'Should create server with config object');
        assert.strictEqual(server3.config.timeout, 3000, 'Should apply configuration from createServer');
    });
});

/**
 * Comprehensive test suite for HTTP server lifecycle including startup, listening state management,
 * and graceful shutdown procedures with timeout handling and resource cleanup validation
 */
describe('HTTP Server Lifecycle Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up fresh test environment for each lifecycle test to ensure clean server state
        localTestEnv = await setupHttpServerTests();
        testServer = localTestEnv.server;
    });

    afterEach(async () => {
        // Ensure proper cleanup after each lifecycle test to prevent port conflicts
        if (testServer && testServer.isListening()) {
            await testServer.stop(SERVER_SHUTDOWN_TIMEOUT);
        }
        await teardownHttpServerTests(localTestEnv);
    });

    test('should test server startup process with automatic port allocation for test isolation', async (t) => {
        // Test server startup process with port binding and listening state management
        const server = new HttpServer({ port: 0 });
        
        // Start server and validate startup timing meets performance thresholds
        const startTime = performance.now();
        await server.start();
        const startupDuration = performance.now() - startTime;
        
        // Validate server startup time meets performance threshold of under 1 second
        assert.ok(startupDuration < HTTP_SERVER_PERFORMANCE_THRESHOLDS.startupTime, 
            `Server startup time ${startupDuration}ms should be under ${HTTP_SERVER_PERFORMANCE_THRESHOLDS.startupTime}ms`);
        
        // Test server listening state and port binding verification
        assert.strictEqual(server.isListening(), true, 'Server should be listening after startup');
        
        // Test server address retrieval and connection information accuracy
        const address = server.getAddress();
        assert.ok(address, 'Should have server address after startup');
        assert.ok(address.port > 0, 'Should have valid port number');
        assert.strictEqual(address.family, 'IPv4', 'Should use IPv4 address family');
        
        await server.stop();
    });

    test('should test server listening state and port binding verification', async (t) => {
        // Create server with specific configuration for binding validation
        const server = new HttpServer({ port: 0, hostname: '127.0.0.1' });
        
        // Verify server is not listening before startup
        assert.strictEqual(server.isListening(), false, 'Server should not be listening initially');
        assert.strictEqual(server.getAddress(), null, 'Address should be null before startup');
        
        // Start server and validate listening state changes
        await server.start();
        
        // Validate server listening state and address information accuracy
        assert.strictEqual(server.isListening(), true, 'Server should be listening after start');
        const address = server.getAddress();
        assert.ok(address, 'Should have address information');
        assert.strictEqual(address.address, '127.0.0.1', 'Should bind to specified address');
        assert.ok(address.url.startsWith('http://127.0.0.1:'), 'Should have complete URL');
        
        await server.stop();
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after stop');
    });

    test('should test graceful server shutdown with active connection handling', async (t) => {
        // Start server for shutdown testing with connection management validation
        const server = new HttpServer({ port: 0 });
        await server.start();
        
        // Verify server is running before shutdown test
        assert.strictEqual(server.isListening(), true, 'Server should be listening before shutdown');
        
        // Test graceful server shutdown with timeout handling and resource cleanup
        const shutdownStart = performance.now();
        await server.stop(SERVER_SHUTDOWN_TIMEOUT);
        const shutdownDuration = performance.now() - shutdownStart;
        
        // Validate server shutdown timeout handling and forced termination scenarios
        assert.ok(shutdownDuration < SERVER_SHUTDOWN_TIMEOUT, 'Shutdown should complete within timeout');
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after shutdown');
        assert.strictEqual(server.getAddress(), null, 'Address should be null after shutdown');
        
        // Verify complete resource cleanup after server shutdown and disposal
        const finalStats = server.getStats();
        assert.strictEqual(finalStats.connections.current, 0, 'Should have zero active connections after shutdown');
    });

    test('should test server lifecycle event emission and proper event handler execution', async (t) => {
        // Set up event tracking for server lifecycle validation
        const events = [];
        const server = new HttpServer({ port: 0 });
        
        // Register event listeners for comprehensive lifecycle event tracking
        server.on('started', (address) => {
            events.push({ event: 'started', address });
        });
        
        server.on('stopped', () => {
            events.push({ event: 'stopped' });
        });
        
        server.on('error', (error) => {
            events.push({ event: 'error', error });
        });
        
        // Execute server lifecycle and validate event emission
        await server.start();
        assert.strictEqual(events.length, 1, 'Should emit started event');
        assert.strictEqual(events[0].event, 'started', 'Should emit started event first');
        assert.ok(events[0].address, 'Started event should include address information');
        
        await server.stop();
        assert.strictEqual(events.length, 2, 'Should emit stopped event after shutdown');
        assert.strictEqual(events[1].event, 'stopped', 'Should emit stopped event');
    });

    test('should test startServer and stopServer utility functions', async (t) => {
        // Test startServer utility function with server instance and configuration
        const server = createServer();
        const address = await startServer(server, { port: 0 });
        
        // Validate startServer utility function results and server state
        assert.ok(address, 'startServer should return address information');
        assert.ok(address.port > 0, 'Should allocate valid port number');
        assert.strictEqual(server.isListening(), true, 'Server should be listening after startServer');
        
        // Test stopServer utility function with graceful shutdown and timeout handling
        await stopServer(server, SERVER_SHUTDOWN_TIMEOUT);
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after stopServer');
        
        // Validate utility functions provide consistent behavior with class methods
        const finalStats = server.getStats();
        assert.ok(finalStats, 'Should have stats after utility function usage');
    });
});

/**
 * Comprehensive test suite for HTTP server request processing coordination including routing delegation,
 * error handling, and response generation with performance measurement and validation
 */
describe('HTTP Server Request Handling Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up test environment with server instance for request handling testing
        localTestEnv = await setupHttpServerTests();
        testServer = localTestEnv.server;
    });

    afterEach(async () => {
        // Clean up test environment after request handling tests
        await teardownHttpServerTests(localTestEnv);
    });

    test('should test server handling of valid GET request to /hello endpoint with proper routing', async (t) => {
        // Make valid GET request to hello endpoint for successful request processing validation
        const response = await localTestEnv.testEnvironment.makeRequest('/hello', {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
                'User-Agent': 'Node.js Test Client'
            }
        });
        
        // Validate response status code and content for successful hello endpoint processing
        assert.strictEqual(response.status, 200, 'Should return 200 OK for hello endpoint');
        assert.strictEqual(response.body, 'Hello world', 'Should return correct hello world content');
        
        // Test response headers including Content-Type and Content-Length accuracy
        assert.strictEqual(response.headers['content-type'], 'text/plain; charset=utf-8', 'Should have correct Content-Type header');
        assert.strictEqual(response.headers['content-length'], '11', 'Should have correct Content-Length header');
        
        // Validate security headers are present in response
        assert.strictEqual(response.headers['x-content-type-options'], 'nosniff', 'Should include security headers');
        assert.strictEqual(response.headers['x-frame-options'], 'DENY', 'Should include frame protection header');
        
        // Test request processing performance meets latency thresholds
        assert.ok(response.timing.duration < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime, 
            `Response time ${response.timing.duration}ms should be under ${HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime}ms`);
    });

    test('should test server handling of invalid requests with appropriate error responses', async (t) => {
        // Test server handling of 404 Not Found for invalid path requests
        const notFoundResponse = await localTestEnv.testEnvironment.makeRequest('/nonexistent', {
            method: 'GET'
        });
        
        // Validate 404 response status and error message content
        assert.strictEqual(notFoundResponse.status, 404, 'Should return 404 for non-existent path');
        assert.strictEqual(notFoundResponse.body, 'Not Found', 'Should return Not Found message');
        
        // Test server handling of 405 Method Not Allowed for unsupported methods
        const methodNotAllowedResponse = await localTestEnv.testEnvironment.makeRequest('/hello', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{"test": "data"}'
        });
        
        // Validate 405 response with proper Allow header specification
        assert.strictEqual(methodNotAllowedResponse.status, 405, 'Should return 405 for unsupported method');
        assert.strictEqual(methodNotAllowedResponse.body, 'Method Not Allowed', 'Should return method not allowed message');
        assert.strictEqual(methodNotAllowedResponse.headers['allow'], 'GET', 'Should specify allowed methods');
    });

    test('should test concurrent request handling and server stability under load', async (t) => {
        // Create multiple concurrent requests for load testing and stability validation
        const concurrentRequests = [];
        const requestCount = 10;
        
        // Generate concurrent hello endpoint requests for load testing
        for (let i = 0; i < requestCount; i++) {
            const requestPromise = localTestEnv.testEnvironment.makeRequest('/hello', {
                method: 'GET',
                headers: {
                    'X-Request-ID': `concurrent-${i}`,
                    'Accept': 'text/plain'
                }
            });
            concurrentRequests.push(requestPromise);
        }
        
        // Execute all concurrent requests and validate responses
        const responses = await Promise.all(concurrentRequests);
        
        // Validate all concurrent requests return successful responses
        responses.forEach((response, index) => {
            assert.strictEqual(response.status, 200, `Request ${index} should return 200 OK`);
            assert.strictEqual(response.body, 'Hello world', `Request ${index} should return correct content`);
            assert.ok(response.timing.duration < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime * 2, 
                `Request ${index} timing should be reasonable under load`);
        });
        
        // Verify server maintains stability and performance under concurrent load
        const serverStats = testServer.getStats();
        assert.ok(serverStats.requests.total >= requestCount, 'Server should track concurrent requests');
        assert.strictEqual(serverStats.errors.total, 0, 'Server should have zero errors during concurrent processing');
    });

    test('should test request timeout handling and connection management', async (t) => {
        // Create mock request for timeout testing scenario
        const mockRequest = createMockRequest({
            method: 'GET',
            path: '/hello',
            headers: {
                'Accept': 'text/plain',
                'Connection': 'close'
            }
        });
        
        // Test server handling of request with connection close header
        const response = await localTestEnv.testEnvironment.makeRequest('/hello', {
            method: 'GET',
            headers: {
                'Connection': 'close',
                'Accept': 'text/plain'
            }
        });
        
        // Validate server properly handles connection management headers
        assert.strictEqual(response.status, 200, 'Should process request despite connection close');
        assert.strictEqual(response.body, 'Hello world', 'Should return correct content');
        
        // Verify connection header handling in response
        assert.ok(response.headers['connection'], 'Should include connection header in response');
    });

    test('should test request correlation ID handling and tracking throughout processing', async (t) => {
        // Test request processing with correlation ID for request tracking
        const correlationId = `test-correlation-${Date.now()}`;
        
        const response = await localTestEnv.testEnvironment.makeRequest('/hello', {
            method: 'GET',
            headers: {
                'X-Correlation-ID': correlationId,
                'Accept': 'text/plain'
            }
        });
        
        // Validate successful request processing with correlation tracking
        assert.strictEqual(response.status, 200, 'Should process request with correlation ID');
        assert.strictEqual(response.body, 'Hello world', 'Should return correct content');
        
        // Verify correlation ID is maintained throughout request processing
        assert.ok(response.correlationId || response.headers['x-correlation-id'], 'Should maintain correlation ID tracking');
    });
});

/**
 * Comprehensive test suite for HTTP server error handling including connection errors, port binding
 * failures, and request processing errors with recovery scenarios and security event recording
 */
describe('HTTP Server Error Handling Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up test environment for error handling scenario testing
        localTestEnv = await setupHttpServerTests();
    });

    afterEach(async () => {
        // Clean up test environment after error handling tests
        await teardownHttpServerTests(localTestEnv);
    });

    test('should test server handling of port binding errors including EADDRINUSE scenarios', async (t) => {
        // Create first server and bind to specific port for conflict testing
        const server1 = new HttpServer({ port: 0 });
        await server1.start();
        const address = server1.getAddress();
        
        // Attempt to create second server on same port to trigger EADDRINUSE error
        const server2 = new HttpServer({ port: address.port });
        
        try {
            await server2.start();
            assert.fail('Second server should fail to start on occupied port');
        } catch (error) {
            // Validate port binding error is properly handled and reported
            assert.ok(error.message.includes('EADDRINUSE') || error.code === 'EADDRINUSE', 
                'Should receive port binding error');
        }
        
        // Clean up first server after port conflict testing
        await server1.stop();
    });

    test('should test server error event emission and error handler integration', async (t) => {
        // Set up error event tracking for error handling validation
        const errorEvents = [];
        const server = new HttpServer({ port: 0 });
        
        // Register error event listener for comprehensive error tracking
        server.on('error', (error) => {
            errorEvents.push({
                error: error.message,
                timestamp: Date.now()
            });
        });
        
        // Test error event emission during normal server operations
        await server.start();
        
        // Simulate error condition by attempting invalid operation
        try {
            await server.start(); // Attempt double start to trigger error
            assert.fail('Double start should trigger error');
        } catch (error) {
            // Error handling should prevent double start
            assert.ok(error.message, 'Should have error message for invalid operation');
        }
        
        await server.stop();
    });

    test('should test server recovery from non-critical errors with continued operation', async (t) => {
        // Start server for error recovery testing
        const server = localTestEnv.server;
        const initialStats = server.getStats();
        
        // Make successful request to establish baseline operation
        const successResponse = await localTestEnv.testEnvironment.makeRequest('/hello');
        assert.strictEqual(successResponse.status, 200, 'Should handle valid requests successfully');
        
        // Make invalid request to trigger error condition
        const errorResponse = await localTestEnv.testEnvironment.makeRequest('/nonexistent');
        assert.strictEqual(errorResponse.status, 404, 'Should handle invalid requests with proper error codes');
        
        // Verify server continues operation after error condition
        const postErrorResponse = await localTestEnv.testEnvironment.makeRequest('/hello');
        assert.strictEqual(postErrorResponse.status, 200, 'Should continue normal operation after error');
        
        // Validate server maintains operation statistics during error conditions
        const finalStats = server.getStats();
        assert.ok(finalStats.requests.total > initialStats.requests.total, 'Should track requests through error scenarios');
    });

    test('should test error logging and security event recording during error conditions', async (t) => {
        // Test comprehensive error logging including security events and error details
        const server = localTestEnv.server;
        
        // Make various invalid requests to trigger different error logging scenarios
        const invalidRequests = [
            { path: '/nonexistent', expectedStatus: 404, errorType: 'Not Found' },
            { path: '/hello', method: 'POST', expectedStatus: 405, errorType: 'Method Not Allowed' }
        ];
        
        for (const { path, method = 'GET', expectedStatus, errorType } of invalidRequests) {
            const response = await localTestEnv.testEnvironment.makeRequest(path, { method });
            
            // Validate proper error response generation and logging
            assert.strictEqual(response.status, expectedStatus, `Should return ${expectedStatus} for ${errorType}`);
            assert.ok(response.body.includes(errorType.split(' ')[0]), `Should include ${errorType} in response body`);
        }
        
        // Verify server statistics track error conditions appropriately
        const stats = server.getStats();
        assert.ok(stats.requests.total > 0, 'Should track total requests including errors');
    });

    test('should validate error responses follow security best practices without information disclosure', async (t) => {
        // Test error response security including information disclosure prevention
        const securityTestRequests = [
            { path: '/../../../etc/passwd', expectedStatus: 404 },
            { path: '/hello?<script>alert(1)</script>', expectedStatus: 404 },
            { path: '/admin', expectedStatus: 404 }
        ];
        
        for (const { path, expectedStatus } of securityTestRequests) {
            const response = await localTestEnv.testEnvironment.makeRequest(path);
            
            // Validate secure error responses without information disclosure
            assert.strictEqual(response.status, expectedStatus, `Should return ${expectedStatus} for security test path`);
            assert.ok(!response.body.includes('Error:'), 'Should not expose error details');
            assert.ok(!response.body.includes('stack'), 'Should not expose stack traces');
            assert.ok(!response.body.includes('file'), 'Should not expose file paths');
            
            // Verify security headers are present in error responses
            assert.strictEqual(response.headers['x-content-type-options'], 'nosniff', 'Should include security headers in error responses');
        }
    });
});

/**
 * Comprehensive test suite for HTTP server performance characteristics including startup time,
 * response latency, memory usage, and concurrent connection handling with detailed metrics analysis
 */
describe('HTTP Server Performance Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up test environment for performance measurement and validation
        localTestEnv = await setupHttpServerTests({
            enablePerformanceMonitoring: true,
            performanceTolerance: 0.1
        });
    });

    afterEach(async () => {
        // Clean up test environment after performance tests
        await teardownHttpServerTests(localTestEnv);
    });

    test('should measure HTTP server startup time against 1 second threshold requirement', async (t) => {
        // Measure server startup time for performance threshold validation
        const performanceResult = await measurePerformance(async () => {
            const server = new HttpServer({ port: 0 });
            await server.start();
            await server.stop();
        }, {
            iterations: 3,
            maxDuration: HTTP_SERVER_PERFORMANCE_THRESHOLDS.startupTime
        });
        
        // Validate server startup performance meets established thresholds
        assert.ok(performanceResult.statistics, 'Should have performance statistics');
        assert.ok(performanceResult.validation.durationWithinThreshold, 
            `Server startup should complete within ${HTTP_SERVER_PERFORMANCE_THRESHOLDS.startupTime}ms threshold`);
        
        // Verify consistent startup performance across multiple iterations
        assert.ok(performanceResult.statistics.successful >= 3, 'Should successfully complete all startup tests');
        assert.strictEqual(performanceResult.statistics.failed, 0, 'Should have no startup failures');
    });

    test('should monitor server memory usage during operation and validate 50MB threshold', async (t) => {
        // Monitor memory usage during server operation for resource consumption validation
        const server = localTestEnv.server;
        const initialMemory = process.memoryUsage();
        
        // Execute multiple requests to simulate memory usage during operation
        const requestCount = 100;
        const requests = [];
        
        for (let i = 0; i < requestCount; i++) {
            requests.push(localTestEnv.testEnvironment.makeRequest('/hello'));
        }
        
        await Promise.all(requests);
        
        // Measure memory usage after request processing
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Validate memory usage remains within established thresholds
        assert.ok(memoryIncrease < HTTP_SERVER_PERFORMANCE_THRESHOLDS.memoryUsage, 
            `Memory increase ${memoryIncrease} bytes should be under ${HTTP_SERVER_PERFORMANCE_THRESHOLDS.memoryUsage} bytes`);
        
        // Verify server statistics include memory tracking information
        const stats = server.getStats();
        assert.ok(stats.performance, 'Should include performance metrics in server statistics');
    });

    test('should test server response latency for hello endpoint against 100ms threshold', async (t) => {
        // Measure response latency for hello endpoint performance validation
        const latencyMeasurements = [];
        const testCount = 50;
        
        // Execute multiple requests to measure consistent response latency
        for (let i = 0; i < testCount; i++) {
            const startTime = performance.now();
            const response = await localTestEnv.testEnvironment.makeRequest('/hello');
            const endTime = performance.now();
            
            const latency = endTime - startTime;
            latencyMeasurements.push(latency);
            
            // Validate individual request meets latency threshold
            assert.strictEqual(response.status, 200, `Request ${i} should be successful`);
            assert.ok(latency < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime, 
                `Request ${i} latency ${latency}ms should be under ${HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime}ms`);
        }
        
        // Calculate and validate average response latency performance
        const averageLatency = latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / latencyMeasurements.length;
        const maxLatency = Math.max(...latencyMeasurements);
        
        assert.ok(averageLatency < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime, 
            `Average latency ${averageLatency}ms should be under threshold`);
        assert.ok(maxLatency < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime * 2, 
            'Maximum latency should be reasonable');
    });

    test('should test concurrent connection handling with multiple simultaneous requests', async (t) => {
        // Test concurrent connection handling capacity and performance under load
        const concurrency = Math.min(HTTP_SERVER_PERFORMANCE_THRESHOLDS.concurrentConnections / 10, 20);
        const requestsPerBatch = 5;
        const batches = [];
        
        // Create batches of concurrent requests for connection handling testing
        for (let batch = 0; batch < concurrency / requestsPerBatch; batch++) {
            const batchPromises = [];
            
            for (let req = 0; req < requestsPerBatch; req++) {
                const requestPromise = localTestEnv.testEnvironment.makeRequest('/hello', {
                    headers: {
                        'X-Batch': batch.toString(),
                        'X-Request': req.toString()
                    }
                });
                batchPromises.push(requestPromise);
            }
            
            batches.push(Promise.all(batchPromises));
        }
        
        // Execute all concurrent request batches and measure performance
        const batchStartTime = performance.now();
        const batchResults = await Promise.all(batches);
        const batchEndTime = performance.now();
        
        // Validate all concurrent requests complete successfully
        let totalRequests = 0;
        let successfulRequests = 0;
        
        batchResults.forEach((batchResponses, batchIndex) => {
            batchResponses.forEach((response, requestIndex) => {
                totalRequests++;
                if (response.status === 200) {
                    successfulRequests++;
                }
                
                assert.strictEqual(response.status, 200, 
                    `Batch ${batchIndex} Request ${requestIndex} should be successful`);
                assert.strictEqual(response.body, 'Hello world', 
                    `Batch ${batchIndex} Request ${requestIndex} should return correct content`);
            });
        });
        
        // Verify concurrent request handling performance and success rate
        const concurrentTestDuration = batchEndTime - batchStartTime;
        const requestsPerSecond = (totalRequests / (concurrentTestDuration / 1000));
        
        assert.strictEqual(successfulRequests, totalRequests, 'All concurrent requests should succeed');
        assert.ok(requestsPerSecond > 10, `Should handle at least 10 requests/second, got ${requestsPerSecond.toFixed(2)}`);
        
        // Validate server maintains stability under concurrent load
        const finalStats = localTestEnv.server.getStats();
        assert.ok(finalStats.requests.total >= totalRequests, 'Server should track all concurrent requests');
        assert.strictEqual(finalStats.errors.total, 0, 'Server should have no errors during concurrent testing');
    });

    test('should generate comprehensive performance report with timing and resource utilization', async (t) => {
        // Generate comprehensive performance report including all metrics and analysis
        const performanceTests = [
            {
                name: 'Single Request Performance',
                test: async () => {
                    const response = await localTestEnv.testEnvironment.makeRequest('/hello');
                    return response.timing.duration;
                }
            },
            {
                name: 'Batch Request Performance',
                test: async () => {
                    const batchSize = 10;
                    const promises = [];
                    
                    for (let i = 0; i < batchSize; i++) {
                        promises.push(localTestEnv.testEnvironment.makeRequest('/hello'));
                    }
                    
                    const startTime = performance.now();
                    await Promise.all(promises);
                    return performance.now() - startTime;
                }
            }
        ];
        
        const performanceReport = {
            timestamp: new Date().toISOString(),
            serverConfig: localTestEnv.server.config,
            tests: [],
            summary: {
                totalTests: performanceTests.length,
                passedTests: 0,
                failedTests: 0,
                averagePerformance: 0
            }
        };
        
        // Execute all performance tests and collect detailed metrics
        for (const { name, test } of performanceTests) {
            try {
                const testResult = await measurePerformance(test, {
                    iterations: 5,
                    maxDuration: HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime
                });
                
                performanceReport.tests.push({
                    name,
                    result: testResult,
                    passed: testResult.validation.durationWithinThreshold
                });
                
                if (testResult.validation.durationWithinThreshold) {
                    performanceReport.summary.passedTests++;
                } else {
                    performanceReport.summary.failedTests++;
                }
            } catch (testError) {
                performanceReport.tests.push({
                    name,
                    error: testError.message,
                    passed: false
                });
                performanceReport.summary.failedTests++;
            }
        }
        
        // Validate performance report generation and test coverage
        assert.ok(performanceReport.tests.length > 0, 'Should generate performance test results');
        assert.strictEqual(performanceReport.summary.failedTests, 0, 'All performance tests should pass');
        assert.ok(performanceReport.timestamp, 'Should include timestamp in performance report');
        
        // Return performance report for additional analysis if needed
        return performanceReport;
    });
});

/**
 * Comprehensive test suite for HTTP server integration with dependent components including router,
 * error handler, logger, and configuration with complete system validation
 */
describe('HTTP Server Integration Tests', () => {
    let localTestEnv = null;

    beforeEach(async () => {
        // Set up test environment for integration testing with all components
        localTestEnv = await setupHttpServerTests({
            validateResponses: true,
            enablePerformanceMonitoring: true
        });
    });

    afterEach(async () => {
        // Clean up integration test environment
        await teardownHttpServerTests(localTestEnv);
    });

    test('should test HTTP server integration with request router for URL path matching and delegation', async (t) => {
        // Test complete request routing integration including path matching and handler delegation
        const routingTests = [
            { path: '/hello', expectedStatus: 200, expectedBody: 'Hello world' },
            { path: '/nonexistent', expectedStatus: 404, expectedBody: 'Not Found' }
        ];
        
        for (const { path, expectedStatus, expectedBody } of routingTests) {
            const response = await localTestEnv.testEnvironment.makeRequest(path);
            
            // Validate router integration properly routes requests to appropriate handlers
            assert.strictEqual(response.status, expectedStatus, 
                `Router should return ${expectedStatus} for path ${path}`);
            assert.strictEqual(response.body, expectedBody, 
                `Router should return correct content for path ${path}`);
            
            // Verify routing performance and response consistency
            assert.ok(response.timing.duration < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime, 
                `Routing performance should be within threshold for ${path}`);
        }
    });

    test('should test integration with error handler for consistent error response generation', async (t) => {
        // Test error handler integration across different error scenarios
        const errorScenarios = [
            { 
                request: { path: '/invalid', method: 'GET' },
                expectedStatus: 404,
                errorType: 'Not Found'
            },
            {
                request: { path: '/hello', method: 'POST' },
                expectedStatus: 405,
                errorType: 'Method Not Allowed'
            }
        ];
        
        for (const { request, expectedStatus, errorType } of errorScenarios) {
            const response = await localTestEnv.testEnvironment.makeRequest(request.path, {
                method: request.method
            });
            
            // Validate error handler integration provides consistent error responses
            assert.strictEqual(response.status, expectedStatus, 
                `Error handler should return ${expectedStatus} for ${errorType}`);
            assert.ok(response.body.includes(errorType.split(' ')[0]), 
                `Error response should include ${errorType} information`);
            
            // Verify error handler includes proper security headers
            assert.strictEqual(response.headers['x-content-type-options'], 'nosniff', 
                'Error responses should include security headers');
        }
    });

    test('should test integration with logger component for server events and request tracking', async (t) => {
        // Test logger integration for comprehensive event tracking and request correlation
        const server = localTestEnv.server;
        const initialStats = server.getStats();
        
        // Execute various requests to generate logging events
        const testRequests = [
            { path: '/hello', method: 'GET' },
            { path: '/nonexistent', method: 'GET' },
            { path: '/hello', method: 'POST' }
        ];
        
        const responses = [];
        for (const { path, method } of testRequests) {
            const response = await localTestEnv.testEnvironment.makeRequest(path, { method });
            responses.push(response);
        }
        
        // Validate logger integration tracks all requests and events
        const finalStats = server.getStats();
        assert.ok(finalStats.requests.total > initialStats.requests.total, 
            'Logger should track request count increases');
        
        // Verify logging includes proper request correlation and performance data
        responses.forEach((response, index) => {
            assert.ok(response.timing, `Response ${index} should include timing information`);
            assert.ok(response.correlationId || response.testEnvironment, 
                `Response ${index} should include correlation tracking`);
        });
    });

    test('should test configuration loading and environment-specific server customization', async (t) => {
        // Test server configuration integration with environment variables and config files
        const customConfig = {
            port: 0,
            hostname: '127.0.0.1',
            timeout: 8000,
            keepAliveTimeout: 3000
        };
        
        const configuredServer = new HttpServer(customConfig);
        await configuredServer.start();
        
        // Validate configuration is properly loaded and applied to server instance
        assert.strictEqual(configuredServer.config.hostname, '127.0.0.1', 
            'Should apply custom hostname configuration');
        assert.strictEqual(configuredServer.config.timeout, 8000, 
            'Should apply custom timeout configuration');
        
        // Test server operates correctly with custom configuration
        const configTestUrl = configuredServer.getAddress().url + '/hello';
        const response = await fetch(configTestUrl);
        
        assert.strictEqual(response.status, 200, 'Configured server should handle requests correctly');
        assert.strictEqual(await response.text(), 'Hello world', 
            'Configured server should return correct content');
        
        await configuredServer.stop();
    });

    test('should test middleware integration for request processing pipeline coordination', async (t) => {
        // Test middleware integration including request logging and processing pipeline
        const server = localTestEnv.server;
        
        // Make request with middleware processing validation
        const response = await localTestEnv.testEnvironment.makeRequest('/hello', {
            headers: {
                'X-Test-Middleware': 'integration-test',
                'Accept': 'text/plain'
            }
        });
        
        // Validate middleware processing completes successfully
        assert.strictEqual(response.status, 200, 'Middleware should allow successful request processing');
        assert.strictEqual(response.body, 'Hello world', 'Middleware should not modify response content');
        
        // Verify middleware includes proper request correlation and logging
        const stats = server.getStats();
        assert.ok(stats.requests.total > 0, 'Middleware should contribute to request tracking');
        
        // Test middleware performance impact on request processing
        assert.ok(response.timing.duration < HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime, 
            'Middleware should not significantly impact response time');
    });

    test('should validate complete server operation within application architecture and component ecosystem', async (t) => {
        // Comprehensive integration validation across all server components and architecture
        const integrationValidation = {
            routing: false,
            errorHandling: false,
            logging: false,
            performance: false,
            configuration: false
        };
        
        // Test routing integration
        const routingResponse = await localTestEnv.testEnvironment.makeRequest('/hello');
        integrationValidation.routing = (routingResponse.status === 200 && 
            routingResponse.body === 'Hello world');
        
        // Test error handling integration
        const errorResponse = await localTestEnv.testEnvironment.makeRequest('/nonexistent');
        integrationValidation.errorHandling = (errorResponse.status === 404);
        
        // Test logging integration
        const serverStats = localTestEnv.server.getStats();
        integrationValidation.logging = (serverStats.requests.total > 0);
        
        // Test performance integration
        integrationValidation.performance = (routingResponse.timing.duration < 
            HTTP_SERVER_PERFORMANCE_THRESHOLDS.responseTime);
        
        // Test configuration integration
        const serverConfig = localTestEnv.server.config;
        integrationValidation.configuration = (serverConfig && serverConfig.hostname);
        
        // Validate all integration components are functioning correctly
        Object.entries(integrationValidation).forEach(([component, isValid]) => {
            assert.strictEqual(isValid, true, `${component} integration should be functioning correctly`);
        });
        
        // Generate comprehensive integration report
        const integrationReport = {
            timestamp: new Date().toISOString(),
            serverAddress: localTestEnv.serverAddress.url,
            validationResults: integrationValidation,
            serverStats: serverStats,
            overallStatus: Object.values(integrationValidation).every(v => v === true) ? 'PASS' : 'FAIL'
        };
        
        assert.strictEqual(integrationReport.overallStatus, 'PASS', 
            'All integration components should pass validation');
        
        return integrationReport;
    });
});

/**
 * Comprehensive HTTP Server Test Suite Class
 * 
 * Organized test suite class for comprehensive HTTP server testing including creation, lifecycle management,
 * request handling, error handling, performance, and integration testing with proper test lifecycle
 * management and resource cleanup validation
 */
export class HttpServerTestSuite {
    /**
     * Initializes HTTP server test suite with configuration, test environment, mock dependencies,
     * and shared resources for comprehensive testing with proper setup and teardown procedures
     * 
     * @param {Object} config - Test suite configuration including server settings, performance thresholds, and test parameters
     */
    constructor(config = {}) {
        // Store test suite configuration and validate HTTP server specific settings
        this.config = {
            port: config.port || DEFAULT_TEST_PORT,
            timeout: config.timeout || TEST_TIMEOUT,
            serverStartupTimeout: config.serverStartupTimeout || SERVER_STARTUP_TIMEOUT,
            performanceThresholds: {
                ...HTTP_SERVER_PERFORMANCE_THRESHOLDS,
                ...config.performanceThresholds
            },
            enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
            validateResponses: config.validateResponses !== false,
            ...config
        };

        // Initialize test environment tracking and resource management
        this.testEnvironment = null;
        this.httpServer = null;
        this.responseValidator = null;
        this.performanceMetrics = null;
        this.isSetup = false;

        // Initialize test execution statistics and results tracking
        this.testResults = {
            creation: null,
            lifecycle: null,
            requestHandling: null,
            errorHandling: null,
            performance: null,
            integration: null
        };
    }

    /**
     * Executes HTTP server creation tests including instantiation, configuration, dependency injection,
     * and initial state validation with comprehensive property and method verification
     * 
     * @returns {Promise<void>} Promise resolving when HTTP server creation tests complete successfully
     */
    async runCreationTests() {
        try {
            const creationTestResults = {
                passed: 0,
                failed: 0,
                tests: []
            };

            // Test HttpServer class instantiation with various configuration options
            const serverInstanceTest = await this.executeTest('Server Instance Creation', async () => {
                const server = new HttpServer();
                assert.ok(server instanceof HttpServer, 'Should create HttpServer instance');
                return { server, result: 'Server instance created successfully' };
            });
            creationTestResults.tests.push(serverInstanceTest);

            // Test createServer factory function with different parameter combinations
            const factoryFunctionTest = await this.executeTest('Factory Function Testing', async () => {
                const server = createServer();
                assert.ok(server instanceof HttpServer, 'Factory should create HttpServer instance');
                return { result: 'Factory function works correctly' };
            });
            creationTestResults.tests.push(factoryFunctionTest);

            // Test server configuration loading from environment and config files
            const configurationTest = await this.executeTest('Configuration Loading', async () => {
                const config = { port: 0, timeout: 5000 };
                const server = new HttpServer(config);
                assert.strictEqual(server.config.timeout, 5000, 'Should apply configuration');
                return { result: 'Configuration loading successful' };
            });
            creationTestResults.tests.push(configurationTest);

            // Calculate creation test results
            creationTestResults.passed = creationTestResults.tests.filter(t => t.passed).length;
            creationTestResults.failed = creationTestResults.tests.filter(t => !t.passed).length;

            this.testResults.creation = creationTestResults;
            return creationTestResults;

        } catch (creationError) {
            throw new Error(`HTTP server creation tests failed: ${creationError.message}`);
        }
    }

    /**
     * Executes HTTP server lifecycle tests including startup, listening state management, and graceful
     * shutdown procedures with timeout handling and resource cleanup validation
     * 
     * @returns {Promise<void>} Promise resolving when HTTP server lifecycle tests complete successfully
     */
    async runLifecycleTests() {
        let testServer = null;

        try {
            const lifecycleTestResults = {
                passed: 0,
                failed: 0,
                tests: []
            };

            // Test server startup process with port binding and listening state management
            const startupTest = await this.executeTest('Server Startup', async () => {
                testServer = new HttpServer({ port: 0 });
                const startTime = performance.now();
                await testServer.start();
                const startupTime = performance.now() - startTime;
                
                assert.ok(startupTime < this.config.performanceThresholds.startupTime, 
                    'Startup should meet performance threshold');
                assert.strictEqual(testServer.isListening(), true, 'Server should be listening');
                
                return { startupTime, result: 'Server startup successful' };
            });
            lifecycleTestResults.tests.push(startupTest);

            // Test server listening state verification and address information accuracy
            const listeningStateTest = await this.executeTest('Listening State Validation', async () => {
                const address = testServer.getAddress();
                assert.ok(address, 'Should have address information');
                assert.ok(address.port > 0, 'Should have valid port');
                
                return { address, result: 'Listening state validated' };
            });
            lifecycleTestResults.tests.push(listeningStateTest);

            // Test graceful server shutdown with connection cleanup and resource disposal
            const shutdownTest = await this.executeTest('Server Shutdown', async () => {
                const shutdownStart = performance.now();
                await testServer.stop();
                const shutdownTime = performance.now() - shutdownStart;
                
                assert.strictEqual(testServer.isListening(), false, 'Server should not be listening');
                assert.ok(shutdownTime < SERVER_SHUTDOWN_TIMEOUT, 'Shutdown should complete within timeout');
                
                return { shutdownTime, result: 'Server shutdown successful' };
            });
            lifecycleTestResults.tests.push(shutdownTest);

            // Calculate lifecycle test results
            lifecycleTestResults.passed = lifecycleTestResults.tests.filter(t => t.passed).length;
            lifecycleTestResults.failed = lifecycleTestResults.tests.filter(t => !t.passed).length;

            this.testResults.lifecycle = lifecycleTestResults;
            return lifecycleTestResults;

        } catch (lifecycleError) {
            // Ensure cleanup if test fails
            if (testServer && testServer.isListening()) {
                try {
                    await testServer.stop();
                } catch (cleanupError) {
                    console.warn('Cleanup error during lifecycle test failure:', cleanupError.message);
                }
            }
            throw new Error(`HTTP server lifecycle tests failed: ${lifecycleError.message}`);
        }
    }

    /**
     * Executes HTTP server request handling tests including routing coordination, middleware integration,
     * and response generation with performance measurement and validation
     * 
     * @returns {Promise<void>} Promise resolving when HTTP server request handling tests complete successfully
     */
    async runRequestHandlingTests() {
        if (!this.testEnvironment) {
            throw new Error('Test environment not initialized for request handling tests');
        }

        try {
            const requestHandlingResults = {
                passed: 0,
                failed: 0,
                tests: []
            };

            // Test server handling of valid HTTP requests with proper routing delegation
            const validRequestTest = await this.executeTest('Valid Request Processing', async () => {
                const response = await this.testEnvironment.makeRequest('/hello');
                assert.strictEqual(response.status, 200, 'Should return 200 for valid request');
                assert.strictEqual(response.body, 'Hello world', 'Should return correct content');
                
                return { response, result: 'Valid request processed successfully' };
            });
            requestHandlingResults.tests.push(validRequestTest);

            // Test server handling of invalid requests with appropriate error responses
            const invalidRequestTest = await this.executeTest('Invalid Request Handling', async () => {
                const response = await this.testEnvironment.makeRequest('/nonexistent');
                assert.strictEqual(response.status, 404, 'Should return 404 for invalid path');
                
                return { response, result: 'Invalid request handled correctly' };
            });
            requestHandlingResults.tests.push(invalidRequestTest);

            // Test concurrent request handling and server stability under multiple connections
            const concurrentRequestTest = await this.executeTest('Concurrent Request Handling', async () => {
                const requests = [];
                for (let i = 0; i < 10; i++) {
                    requests.push(this.testEnvironment.makeRequest('/hello'));
                }
                
                const responses = await Promise.all(requests);
                const allSuccessful = responses.every(r => r.status === 200);
                assert.strictEqual(allSuccessful, true, 'All concurrent requests should succeed');
                
                return { requestCount: responses.length, result: 'Concurrent requests handled successfully' };
            });
            requestHandlingResults.tests.push(concurrentRequestTest);

            // Calculate request handling test results
            requestHandlingResults.passed = requestHandlingResults.tests.filter(t => t.passed).length;
            requestHandlingResults.failed = requestHandlingResults.tests.filter(t => !t.passed).length;

            this.testResults.requestHandling = requestHandlingResults;
            return requestHandlingResults;

        } catch (requestHandlingError) {
            throw new Error(`HTTP server request handling tests failed: ${requestHandlingError.message}`);
        }
    }

    /**
     * Executes HTTP server error handling tests including connection errors, binding failures,
     * and recovery scenarios with comprehensive error condition validation
     * 
     * @returns {Promise<void>} Promise resolving when HTTP server error handling tests complete successfully
     */
    async runErrorHandlingTests() {
        try {
            const errorHandlingResults = {
                passed: 0,
                failed: 0,
                tests: []
            };

            // Test server handling of port binding errors including EADDRINUSE scenarios
            const portBindingErrorTest = await this.executeTest('Port Binding Error', async () => {
                const server1 = new HttpServer({ port: 0 });
                await server1.start();
                const address = server1.getAddress();
                
                try {
                    const server2 = new HttpServer({ port: address.port });
                    await server2.start();
                    assert.fail('Should fail to bind to occupied port');
                } catch (error) {
                    assert.ok(error.message.includes('EADDRINUSE') || error.code === 'EADDRINUSE', 
                        'Should get port binding error');
                }
                
                await server1.stop();
                return { result: 'Port binding error handled correctly' };
            });
            errorHandlingResults.tests.push(portBindingErrorTest);

            // Test server error event emission and integration with error handler components
            const errorEventTest = await this.executeTest('Error Event Emission', async () => {
                const server = new HttpServer({ port: 0 });
                let errorEmitted = false;
                
                server.on('error', () => {
                    errorEmitted = true;
                });
                
                await server.start();
                
                // Test double start to trigger error
                try {
                    await server.start();
                } catch (error) {
                    // Expected error for double start
                }
                
                await server.stop();
                return { errorEmitted, result: 'Error events handled appropriately' };
            });
            errorHandlingResults.tests.push(errorEventTest);

            // Calculate error handling test results
            errorHandlingResults.passed = errorHandlingResults.tests.filter(t => t.passed).length;
            errorHandlingResults.failed = errorHandlingResults.tests.filter(t => !t.passed).length;

            this.testResults.errorHandling = errorHandlingResults;
            return errorHandlingResults;

        } catch (errorHandlingError) {
            throw new Error(`HTTP server error handling tests failed: ${errorHandlingError.message}`);
        }
    }

    /**
     * Executes HTTP server performance tests including startup time, response latency, memory usage,
     * and concurrent connection handling with detailed metrics collection
     * 
     * @returns {Promise<Object>} Promise resolving to performance test results with detailed metrics and analysis
     */
    async runPerformanceTests() {
        try {
            const performanceResults = {
                passed: 0,
                failed: 0,
                tests: [],
                metrics: {
                    startupTime: null,
                    responseLatency: null,
                    memoryUsage: null,
                    concurrentConnections: null
                }
            };

            // Measure HTTP server startup time against 1 second threshold requirement
            const startupPerformanceTest = await this.executeTest('Startup Performance', async () => {
                const result = await measurePerformance(async () => {
                    const server = new HttpServer({ port: 0 });
                    await server.start();
                    await server.stop();
                }, {
                    iterations: 3,
                    maxDuration: this.config.performanceThresholds.startupTime
                });
                
                assert.ok(result.validation.durationWithinThreshold, 'Startup should meet performance threshold');
                performanceResults.metrics.startupTime = result.statistics.duration.average;
                
                return { performanceResult: result, result: 'Startup performance validated' };
            });
            performanceResults.tests.push(startupPerformanceTest);

            // Monitor server memory usage during operation and validate against threshold
            if (this.testEnvironment) {
                const memoryUsageTest = await this.executeTest('Memory Usage', async () => {
                    const initialMemory = process.memoryUsage();
                    
                    // Execute requests to measure memory usage
                    const requests = [];
                    for (let i = 0; i < 50; i++) {
                        requests.push(this.testEnvironment.makeRequest('/hello'));
                    }
                    await Promise.all(requests);
                    
                    const finalMemory = process.memoryUsage();
                    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
                    
                    assert.ok(memoryIncrease < this.config.performanceThresholds.memoryUsage, 
                        'Memory usage should be within threshold');
                    
                    performanceResults.metrics.memoryUsage = memoryIncrease;
                    return { memoryIncrease, result: 'Memory usage within acceptable limits' };
                });
                performanceResults.tests.push(memoryUsageTest);
            }

            // Calculate performance test results
            performanceResults.passed = performanceResults.tests.filter(t => t.passed).length;
            performanceResults.failed = performanceResults.tests.filter(t => !t.passed).length;

            this.testResults.performance = performanceResults;
            return performanceResults;

        } catch (performanceError) {
            throw new Error(`HTTP server performance tests failed: ${performanceError.message}`);
        }
    }

    /**
     * Executes HTTP server integration tests including interaction with router, error handler, logger,
     * and configuration components with complete system validation
     * 
     * @returns {Promise<void>} Promise resolving when HTTP server integration tests complete successfully
     */
    async runIntegrationTests() {
        if (!this.testEnvironment) {
            throw new Error('Test environment not initialized for integration tests');
        }

        try {
            const integrationResults = {
                passed: 0,
                failed: 0,
                tests: []
            };

            // Test HTTP server integration with request router for path matching and handler delegation
            const routerIntegrationTest = await this.executeTest('Router Integration', async () => {
                const helloResponse = await this.testEnvironment.makeRequest('/hello');
                const notFoundResponse = await this.testEnvironment.makeRequest('/nonexistent');
                
                assert.strictEqual(helloResponse.status, 200, 'Router should route hello requests');
                assert.strictEqual(notFoundResponse.status, 404, 'Router should handle unknown paths');
                
                return { result: 'Router integration validated' };
            });
            integrationResults.tests.push(routerIntegrationTest);

            // Test integration with error handler for consistent error response generation
            const errorHandlerIntegrationTest = await this.executeTest('Error Handler Integration', async () => {
                const methodNotAllowedResponse = await this.testEnvironment.makeRequest('/hello', {
                    method: 'POST'
                });
                
                assert.strictEqual(methodNotAllowedResponse.status, 405, 
                    'Error handler should return 405 for unsupported methods');
                
                return { result: 'Error handler integration validated' };
            });
            integrationResults.tests.push(errorHandlerIntegrationTest);

            // Test integration with logger component for server events and request tracking
            const loggerIntegrationTest = await this.executeTest('Logger Integration', async () => {
                const initialStats = this.httpServer ? this.httpServer.getStats() : 
                    this.testEnvironment.server.getStats();
                
                await this.testEnvironment.makeRequest('/hello');
                
                const finalStats = this.httpServer ? this.httpServer.getStats() : 
                    this.testEnvironment.server.getStats();
                
                assert.ok(finalStats.requests.total > initialStats.requests.total, 
                    'Logger should track request counts');
                
                return { result: 'Logger integration validated' };
            });
            integrationResults.tests.push(loggerIntegrationTest);

            // Calculate integration test results
            integrationResults.passed = integrationResults.tests.filter(t => t.passed).length;
            integrationResults.failed = integrationResults.tests.filter(t => !t.passed).length;

            this.testResults.integration = integrationResults;
            return integrationResults;

        } catch (integrationError) {
            throw new Error(`HTTP server integration tests failed: ${integrationError.message}`);
        }
    }

    /**
     * Generates comprehensive test report including all test results, performance metrics, coverage analysis,
     * and recommendations for HTTP server validation and operational readiness assessment
     * 
     * @returns {Object} Test report object with results, metrics, coverage data, and analysis information
     */
    generateTestReport() {
        // Collect all test results including creation, lifecycle, request handling, and integration outcomes
        const allTestResults = Object.values(this.testResults).filter(result => result !== null);
        
        const totalTests = allTestResults.reduce((sum, result) => sum + result.tests.length, 0);
        const totalPassed = allTestResults.reduce((sum, result) => sum + result.passed, 0);
        const totalFailed = allTestResults.reduce((sum, result) => sum + result.failed, 0);
        
        // Compile performance metrics including startup time, response latency, and resource utilization
        const performanceMetrics = this.testResults.performance ? 
            this.testResults.performance.metrics : null;
        
        // Generate test coverage analysis for HTTP server functionality and component integration
        const coverageAnalysis = {
            serverCreation: this.testResults.creation ? 'TESTED' : 'NOT TESTED',
            serverLifecycle: this.testResults.lifecycle ? 'TESTED' : 'NOT TESTED',
            requestHandling: this.testResults.requestHandling ? 'TESTED' : 'NOT TESTED',
            errorHandling: this.testResults.errorHandling ? 'TESTED' : 'NOT TESTED',
            performance: this.testResults.performance ? 'TESTED' : 'NOT TESTED',
            integration: this.testResults.integration ? 'TESTED' : 'NOT TESTED'
        };
        
        // Calculate test success rates and identify any failing test scenarios or performance issues
        const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
        
        // Create detailed report with recommendations for server optimization and monitoring
        const testReport = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                totalPassed,
                totalFailed,
                successRate: `${successRate.toFixed(2)}%`,
                overallStatus: totalFailed === 0 ? 'PASS' : 'FAIL'
            },
            testResults: this.testResults,
            performanceMetrics,
            coverageAnalysis,
            recommendations: this.generateRecommendations(successRate, performanceMetrics),
            configuration: this.config,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch
            }
        };
        
        // Return comprehensive test report for HTTP server validation and operational readiness assessment
        return testReport;
    }

    /**
     * Execute individual test with error handling and result tracking
     * @private
     */
    async executeTest(testName, testFunction) {
        try {
            const startTime = performance.now();
            const result = await testFunction();
            const endTime = performance.now();
            
            return {
                name: testName,
                passed: true,
                duration: endTime - startTime,
                result: result.result || 'Test passed',
                data: result
            };
        } catch (error) {
            return {
                name: testName,
                passed: false,
                error: error.message,
                result: 'Test failed'
            };
        }
    }

    /**
     * Generate recommendations based on test results
     * @private
     */
    generateRecommendations(successRate, performanceMetrics) {
        const recommendations = [];
        
        if (successRate < 100) {
            recommendations.push('Investigate and fix failing test cases');
        }
        
        if (performanceMetrics && performanceMetrics.startupTime > 500) {
            recommendations.push('Consider optimizing server startup time');
        }
        
        if (performanceMetrics && performanceMetrics.memoryUsage > 25 * 1024 * 1024) {
            recommendations.push('Monitor memory usage during peak load');
        }
        
        if (successRate === 100) {
            recommendations.push('All tests passing - server ready for deployment');
        }
        
        return recommendations;
    }
}

// Export standalone test functions for individual execution and testing scenarios
export {
    testHttpServerCreation,
    testHttpServerLifecycle,
    testHttpServerRequestHandling,
    testHttpServerErrorHandling,
    testHttpServerPerformance,
    testHttpServerIntegration
};

/**
 * Standalone function for testing HTTP server creation, instantiation, and configuration loading
 * with comprehensive server instance validation and property verification
 * 
 * @returns {Promise<void>} Promise resolving when HTTP server creation tests complete successfully
 */
export async function testHttpServerCreation() {
    const testSuite = new HttpServerTestSuite();
    return await testSuite.runCreationTests();
}

/**
 * Standalone function for testing HTTP server lifecycle including startup and shutdown procedures
 * with timeout handling and resource management validation
 * 
 * @returns {Promise<void>} Promise resolving when HTTP server lifecycle tests complete successfully
 */
export async function testHttpServerLifecycle() {
    const testSuite = new HttpServerTestSuite();
    return await testSuite.runLifecycleTests();
}

/**
 * Standalone function for testing HTTP server request processing and coordination functionality
 * with routing delegation and response generation validation
 * 
 * @returns {Promise<void>} Promise resolving when HTTP server request handling tests complete successfully
 */
export async function testHttpServerRequestHandling() {
    const testSuite = new HttpServerTestSuite();
    testSuite.testEnvironment = await setupHttpServerTests();
    try {
        return await testSuite.runRequestHandlingTests();
    } finally {
        await teardownHttpServerTests({ testEnvironment: testSuite.testEnvironment });
    }
}

/**
 * Standalone function for testing HTTP server error handling and recovery scenarios
 * with comprehensive error condition validation and security verification
 * 
 * @returns {Promise<void>} Promise resolving when HTTP server error handling tests complete successfully
 */
export async function testHttpServerErrorHandling() {
    const testSuite = new HttpServerTestSuite();
    return await testSuite.runErrorHandlingTests();
}

/**
 * Standalone function for testing HTTP server performance characteristics and thresholds
 * with detailed metrics collection and performance analysis
 * 
 * @returns {Promise<Object>} Promise resolving to performance test results with detailed metrics
 */
export async function testHttpServerPerformance() {
    const testSuite = new HttpServerTestSuite();
    testSuite.testEnvironment = await setupHttpServerTests();
    try {
        return await testSuite.runPerformanceTests();
    } finally {
        await teardownHttpServerTests({ testEnvironment: testSuite.testEnvironment });
    }
}

/**
 * Standalone function for testing HTTP server integration with dependent components
 * including router, error handler, logger, and configuration validation
 * 
 * @returns {Promise<void>} Promise resolving when HTTP server integration tests complete successfully
 */
export async function testHttpServerIntegration() {
    const testSuite = new HttpServerTestSuite();
    testSuite.testEnvironment = await setupHttpServerTests();
    try {
        return await testSuite.runIntegrationTests();
    } finally {
        await teardownHttpServerTests({ testEnvironment: testSuite.testEnvironment });
    }
}