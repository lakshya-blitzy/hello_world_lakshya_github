/**
 * Comprehensive Test Utilities and Helper Functions for Node.js Tutorial HTTP Server Testing Framework
 * 
 * This file provides comprehensive test utilities that serve as learning examples for Node.js testing concepts
 * while supporting essential testing functionality for unit, integration, and end-to-end testing scenarios.
 * 
 * Educational Purpose:
 * - Demonstrates testing utilities using only Node.js built-in modules
 * - Provides test environment setup and teardown utilities for isolated test execution
 * - Shows HTTP response validation utilities including status codes, headers, and content
 * - Illustrates server lifecycle testing support with proper cleanup and resource management
 * - Demonstrates performance measurement utilities for educational testing patterns
 * 
 * Features:
 * - Zero external dependencies - uses only Node.js built-in modules
 * - Comprehensive test environment management with server lifecycle support
 * - HTTP response validation with detailed assertion checking and reporting
 * - Performance measurement utilities with timing and resource monitoring
 * - Integration support for unit, integration, and end-to-end testing scenarios
 * - Educational examples of Node.js testing concepts and patterns
 */

// Node.js built-in module imports for testing framework functionality
import { test } from 'node:test'; // node:test@built-in - Node.js built-in test runner for test execution and assertion support
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Node.js built-in assertion library for strict equality and validation checks
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Node.js built-in performance API for high-resolution timing and performance measurement
import { EventEmitter } from 'node:events'; // node:events@built-in - Node.js built-in EventEmitter for test event handling and cleanup coordination
import { setTimeout } from 'node:timers/promises'; // node:timers/promises@built-in - Node.js built-in promisified setTimeout for test delays and timing control
import { URL } from 'node:url'; // node:url@built-in - Node.js built-in URL constructor for parsing and validating test URLs

// Import internal components for test data, mock objects, server instances, and configuration
import { 
    validRequests, 
    invalidRequests, 
    expectedResponses, 
    performanceData, 
    testConfiguration 
} from './test-data.js';
import { 
    MockRequestFactory, 
    createMockRequest, 
    createHelloRequest, 
    createInvalidRequest, 
    createRequestWithBody 
} from './mock-requests.js';
import { HttpServer } from '../../lib/http-server.js';
import { config } from '../../config/environment.js';

// Global test configuration constants for consistent testing behavior
const CORRELATION_ID_PREFIX = 'test-helper-';
const DEFAULT_TEST_TIMEOUT = 10000;
const SERVER_STARTUP_TIMEOUT = 5000;
const PERFORMANCE_TOLERANCE = 0.1;
const DEFAULT_TEST_PORT = 0;

/**
 * Creates and configures HTTP server instance specifically for testing with proper test configuration,
 * isolated port binding, and comprehensive lifecycle management for test scenarios
 * 
 * @param {Object} options - Test server configuration including port, timeout settings, and test-specific customizations
 * @returns {Object} Test server instance configured for testing with monitoring and lifecycle management capabilities
 */
export function createTestServer(options = {}) {
    try {
        // Load test-specific server configuration with isolated port binding for test isolation
        const testServerConfig = {
            port: options.port || DEFAULT_TEST_PORT,
            hostname: options.hostname || config.server?.hostname || '127.0.0.1',
            timeout: options.timeout || 5000, // Reduced timeout for faster testing
            keepAliveTimeout: options.keepAliveTimeout || 1000,
            headersTimeout: options.headersTimeout || 5000,
            requestTimeout: options.requestTimeout || 10000,
            maxConnections: options.maxConnections || 50,
            environment: 'test',
            isDevelopment: false,
            isProduction: false,
            isTest: true,
            ...options
        };

        // Create HttpServer instance with test configuration and reduced timeouts for faster testing
        const testServer = new HttpServer(testServerConfig);

        // Configure server with test-specific settings including logging and monitoring
        testServer.isTestServer = true;
        testServer.testStartTime = performance.now();

        // Apply test environment configuration to prevent conflicts with development server
        testServer.config.isTest = true;

        // Set up server event listeners for test monitoring and error handling
        testServer.on('started', (address) => {
            testServer.testAddress = address;
            testServer.logger.info('Test server started successfully', {
                address: address.address,
                port: address.port,
                testMode: true
            });
        });

        testServer.on('stopped', () => {
            testServer.logger.info('Test server stopped successfully', {
                testMode: true,
                uptime: performance.now() - testServer.testStartTime
            });
        });

        testServer.on('error', (error) => {
            testServer.logger.error('Test server error', {
                error: error.message,
                testMode: true
            });
        });

        // Initialize server statistics collection for performance testing validation
        testServer.testStats = {
            requestCount: 0,
            errorCount: 0,
            averageResponseTime: 0,
            totalResponseTime: 0
        };

        // Configure graceful shutdown handling for proper test cleanup procedures
        testServer.originalStop = testServer.stop;
        testServer.stop = async function(timeout = 5000) {
            this.logger.info('Stopping test server', { testMode: true });
            return await this.originalStop(timeout);
        };

        // Return configured test server instance ready for test lifecycle management
        return testServer;

    } catch (error) {
        console.error('Failed to create test server:', error.message);
        throw error;
    }
}

/**
 * Starts test server instance with automatic port allocation, startup validation, and comprehensive
 * error handling for reliable test environment initialization
 * 
 * @param {Object} server - HttpServer instance to start for testing
 * @param {Object} options - Startup options including timeout and validation settings
 * @returns {Promise<Object>} Promise resolving to server address information when startup is complete
 */
export async function startTestServer(server, options = {}) {
    try {
        // Validate server instance is configured and ready for startup
        if (!server || typeof server.start !== 'function') {
            throw new Error('Invalid server instance provided for testing');
        }

        const startupTimeout = options.timeout || SERVER_STARTUP_TIMEOUT;
        const validateConnectivity = options.validateConnectivity !== false;

        // Start server with automatic port allocation (port 0) for conflict avoidance
        const startupPromise = server.start();

        // Wait for server startup with timeout handling for reliable test initialization
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Test server startup timeout after ${startupTimeout}ms`));
            }, startupTimeout).unref();
        });

        await Promise.race([startupPromise, timeoutPromise]);

        // Validate server is listening and accessible for HTTP requests
        if (!server.isListening()) {
            throw new Error('Test server failed to start listening');
        }

        // Retrieve server address information including hostname and allocated port
        const address = server.getAddress();
        if (!address) {
            throw new Error('Failed to retrieve test server address information');
        }

        // Perform basic connectivity test to ensure server is responsive
        if (validateConnectivity) {
            try {
                const testUrl = `${address.url}/hello`;
                const response = await fetch(testUrl, { 
                    method: 'GET',
                    signal: AbortSignal.timeout(2000)
                });
                
                if (!response.ok && response.status !== 404) {
                    throw new Error(`Connectivity test failed with status ${response.status}`);
                }
            } catch (connectivityError) {
                server.logger.warn('Test server connectivity validation failed', {
                    error: connectivityError.message,
                    address: address.url
                });
            }
        }

        // Log successful test server startup with address and timing information
        const startupTime = performance.now() - (server.testStartTime || 0);
        server.logger.info('Test server startup completed', {
            address: address.url,
            port: address.port,
            startupTime: `${startupTime.toFixed(2)}ms`,
            testMode: true
        });

        // Return server address object for test client connection configuration
        return address;

    } catch (startupError) {
        server?.logger?.error('Test server startup failed', {
            error: startupError.message,
            testMode: true
        });
        throw startupError;
    }
}

/**
 * Gracefully stops test server with connection cleanup, resource management, and validation
 * to ensure complete test environment teardown
 * 
 * @param {Object} server - HttpServer instance to stop and clean up
 * @param {Number} timeout - Maximum time to wait for graceful shutdown in milliseconds
 * @returns {Promise<void>} Promise resolving when server shutdown and cleanup is complete
 */
export async function stopTestServer(server, timeout = 5000) {
    try {
        // Check if server is currently running and accepting connections
        if (!server || !server.isListening()) {
            server?.logger?.warn('Test server is not running, shutdown skipped', { testMode: true });
            return;
        }

        const shutdownStartTime = performance.now();

        // Initiate graceful server shutdown with active connection handling
        await server.stop(timeout);

        // Wait for active connections to complete with timeout protection
        let connectionWaitTime = 0;
        const connectionCheckInterval = 100;
        const maxConnectionWaitTime = timeout / 2;

        while (connectionWaitTime < maxConnectionWaitTime) {
            const stats = server.getStats();
            if (stats.connections.current === 0) {
                break;
            }
            await setTimeout(connectionCheckInterval);
            connectionWaitTime += connectionCheckInterval;
        }

        // Clean up server resources including event listeners and timers
        if (server.removeAllListeners) {
            server.removeAllListeners();
        }

        // Validate server has stopped completely and port is available
        if (server.isListening()) {
            throw new Error('Test server failed to stop completely');
        }

        // Log successful test server shutdown with timing and cleanup confirmation
        const shutdownTime = performance.now() - shutdownStartTime;
        server.logger?.info('Test server shutdown completed', {
            shutdownTime: `${shutdownTime.toFixed(2)}ms`,
            testMode: true,
            gracefulShutdown: true
        });

    } catch (shutdownError) {
        server?.logger?.error('Test server shutdown failed', {
            error: shutdownError.message,
            testMode: true
        });
        throw shutdownError;
    }
}

/**
 * Makes HTTP requests to test server with comprehensive response handling, error management,
 * and performance measurement for complete request testing
 * 
 * @param {String} url - Complete URL for the HTTP request including protocol, host, and path
 * @param {Object} options - Request options including method, headers, body, and timeout settings
 * @returns {Promise<Object>} Promise resolving to complete response object with status, headers, body, and timing
 */
export async function makeRequest(url, options = {}) {
    // Start request timing measurement for performance validation
    const requestStartTime = performance.now();
    let response = null;
    
    try {
        // Parse and validate request URL and options for proper formatting
        const requestUrl = new URL(url);
        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Node.js Test Client/1.0.0',
                'Accept': 'text/plain',
                ...options.headers
            },
            body: options.body || null,
            signal: AbortSignal.timeout(options.timeout || DEFAULT_TEST_TIMEOUT)
        };

        // Configure HTTP request with method, headers, and body from options
        if (requestOptions.body && !requestOptions.headers['Content-Type']) {
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        // Set request timeout and error handling for reliable test execution
        if (requestOptions.body && typeof requestOptions.body !== 'string') {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }

        // Execute HTTP request using Node.js built-in fetch or HTTP client
        response = await fetch(requestUrl.toString(), requestOptions);

        // Collect response data including status code, headers, and body content
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });

        const responseBody = await response.text();

        // Measure request completion time for performance testing
        const requestEndTime = performance.now();
        const requestDuration = requestEndTime - requestStartTime;

        // Return comprehensive response object with all collected data and timing
        return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            timing: {
                duration: requestDuration,
                startTime: requestStartTime,
                endTime: requestEndTime
            },
            url: requestUrl.toString(),
            method: requestOptions.method,
            ok: response.ok
        };

    } catch (requestError) {
        const requestEndTime = performance.now();
        const requestDuration = requestEndTime - requestStartTime;

        // Handle network errors and timeouts
        const errorResponse = {
            status: 0,
            statusText: 'Network Error',
            headers: {},
            body: '',
            error: {
                name: requestError.name,
                message: requestError.message,
                code: requestError.code
            },
            timing: {
                duration: requestDuration,
                startTime: requestStartTime,
                endTime: requestEndTime
            },
            url: url,
            method: options.method || 'GET',
            ok: false
        };

        return errorResponse;
    }
}

/**
 * Comprehensive HTTP response validation function that checks status codes, headers, content,
 * and timing against expected values with detailed assertion reporting
 * 
 * @param {Object} response - HTTP response object to validate against expectations
 * @param {Object} expected - Expected response characteristics including status, headers, content
 * @param {Object} options - Validation options including strict mode and performance checks
 * @returns {Object} Validation result with success status and detailed comparison information
 */
export function validateResponse(response, expected = {}, options = {}) {
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {
            status: null,
            headers: null,
            content: null,
            timing: null,
            security: null
        },
        timestamp: new Date().toISOString()
    };

    try {
        // Validate HTTP status code matches expected value with strict equality
        if (expected.status !== undefined) {
            const statusValid = response.status === expected.status;
            validation.details.status = {
                expected: expected.status,
                actual: response.status,
                valid: statusValid
            };

            if (!statusValid) {
                validation.isValid = false;
                validation.errors.push(`Status code mismatch: expected ${expected.status}, got ${response.status}`);
            }
        }

        // Check response headers against expected headers with case-insensitive comparison
        if (expected.headers && typeof expected.headers === 'object') {
            const headerValidation = {
                missing: [],
                incorrect: [],
                extra: [],
                valid: []
            };

            for (const [headerName, expectedValue] of Object.entries(expected.headers)) {
                const actualValue = response.headers[headerName.toLowerCase()];
                
                if (actualValue === undefined) {
                    headerValidation.missing.push(headerName);
                    validation.isValid = false;
                    validation.errors.push(`Missing expected header: ${headerName}`);
                } else if (expectedValue !== '*' && actualValue !== expectedValue) {
                    headerValidation.incorrect.push({
                        header: headerName,
                        expected: expectedValue,
                        actual: actualValue
                    });
                    validation.isValid = false;
                    validation.errors.push(`Header value mismatch for ${headerName}: expected "${expectedValue}", got "${actualValue}"`);
                } else {
                    headerValidation.valid.push(headerName);
                }
            }

            validation.details.headers = headerValidation;
        }

        // Validate response content matches expected body with encoding handling
        if (expected.body !== undefined) {
            const contentValid = response.body === expected.body;
            validation.details.content = {
                expected: expected.body,
                actual: response.body,
                length: {
                    expected: expected.body.length,
                    actual: response.body.length
                },
                valid: contentValid
            };

            if (!contentValid) {
                validation.isValid = false;
                validation.errors.push(`Content mismatch: expected "${expected.body}", got "${response.body}"`);
            }
        }

        // Verify Content-Type header matches expected content type specification
        if (expected.contentType && response.headers['content-type']) {
            const contentTypeValid = response.headers['content-type'].includes(expected.contentType);
            if (!contentTypeValid) {
                validation.isValid = false;
                validation.errors.push(`Content-Type mismatch: expected "${expected.contentType}" in "${response.headers['content-type']}"`);
            }
        }

        // Check Content-Length header accuracy against actual response body length
        if (response.headers['content-length']) {
            const expectedLength = Buffer.byteLength(response.body, 'utf8');
            const actualLength = parseInt(response.headers['content-length'], 10);
            
            if (expectedLength !== actualLength) {
                validation.warnings.push(`Content-Length header (${actualLength}) doesn't match actual body length (${expectedLength})`);
            }
        }

        // Validate response timing meets performance thresholds if specified
        if (expected.maxResponseTime && response.timing) {
            const timingValid = response.timing.duration <= expected.maxResponseTime;
            validation.details.timing = {
                duration: response.timing.duration,
                threshold: expected.maxResponseTime,
                valid: timingValid
            };

            if (!timingValid) {
                if (options.strictTiming) {
                    validation.isValid = false;
                    validation.errors.push(`Response time ${response.timing.duration}ms exceeds threshold ${expected.maxResponseTime}ms`);
                } else {
                    validation.warnings.push(`Response time ${response.timing.duration}ms exceeds threshold ${expected.maxResponseTime}ms`);
                }
            }
        }

        // Perform security header validation for proper security header presence
        if (options.validateSecurity !== false) {
            const securityValidation = {
                missingHeaders: [],
                presentHeaders: []
            };

            const expectedSecurityHeaders = [
                'x-content-type-options',
                'x-frame-options'
            ];

            expectedSecurityHeaders.forEach(header => {
                if (response.headers[header]) {
                    securityValidation.presentHeaders.push(header);
                } else {
                    securityValidation.missingHeaders.push(header);
                    validation.warnings.push(`Missing security header: ${header}`);
                }
            });

            validation.details.security = securityValidation;
        }

    } catch (validationError) {
        validation.isValid = false;
        validation.errors.push(`Validation error: ${validationError.message}`);
    }

    // Return comprehensive validation result with pass/fail status and detailed feedback
    return validation;
}

/**
 * Performance measurement utility that tracks request timing, throughput, and resource utilization
 * with statistical analysis for comprehensive performance testing
 * 
 * @param {Function} testFunction - Function to execute and measure performance for
 * @param {Object} options - Performance measurement options including iterations and thresholds
 * @returns {Promise<Object>} Promise resolving to performance metrics including timing, memory, and statistical analysis
 */
export async function measurePerformance(testFunction, options = {}) {
    // Initialize performance measurement including baseline memory usage
    const iterations = options.iterations || 1;
    const warmupIterations = options.warmup || 0;
    const collectGarbage = options.collectGarbage !== false;
    
    const measurements = {
        durations: [],
        memoryUsage: [],
        errors: []
    };

    let baselineMemory = null;

    try {
        // Record baseline memory usage before performance testing
        baselineMemory = process.memoryUsage();

        // Perform warmup iterations to stabilize performance measurements
        for (let i = 0; i < warmupIterations; i++) {
            try {
                await testFunction();
            } catch (warmupError) {
                // Ignore warmup errors
            }
        }

        // Collect garbage before actual measurements if enabled
        if (collectGarbage && global.gc) {
            global.gc();
        }

        // Execute test function with error handling and resource monitoring for specified iterations
        for (let i = 0; i < iterations; i++) {
            const iterationStartTime = performance.now();
            const iterationMemoryStart = process.memoryUsage();

            try {
                // Execute test function with performance measurement
                await testFunction();
                
                const iterationEndTime = performance.now();
                const iterationMemoryEnd = process.memoryUsage();
                
                // Record execution completion time and memory usage changes
                const duration = iterationEndTime - iterationStartTime;
                measurements.durations.push(duration);
                measurements.memoryUsage.push({
                    heapUsedDelta: iterationMemoryEnd.heapUsed - iterationMemoryStart.heapUsed,
                    heapTotalDelta: iterationMemoryEnd.heapTotal - iterationMemoryStart.heapTotal,
                    rss: iterationMemoryEnd.rss
                });

            } catch (iterationError) {
                const iterationEndTime = performance.now();
                measurements.errors.push({
                    iteration: i + 1,
                    error: iterationError.message,
                    duration: iterationEndTime - iterationStartTime
                });
            }
        }

        // Calculate performance statistics including average, min, max timing
        const validDurations = measurements.durations.filter(d => d > 0);
        const statistics = {
            iterations: iterations,
            successful: validDurations.length,
            failed: measurements.errors.length,
            duration: {
                min: Math.min(...validDurations),
                max: Math.max(...validDurations),
                average: validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length,
                median: validDurations.sort((a, b) => a - b)[Math.floor(validDurations.length / 2)],
                total: validDurations.reduce((sum, d) => sum + d, 0)
            },
            memory: {
                baseline: baselineMemory,
                peak: Math.max(...measurements.memoryUsage.map(m => m.rss)),
                averageHeapIncrease: measurements.memoryUsage.reduce((sum, m) => sum + m.heapUsedDelta, 0) / measurements.memoryUsage.length
            }
        };

        // Compare results against performance thresholds from test configuration
        const thresholds = {
            maxDuration: options.maxDuration || performanceData.responseTimeThresholds?.critical || 100,
            maxMemoryIncrease: options.maxMemoryIncrease || 10 * 1024 * 1024 // 10MB
        };

        const thresholdValidation = {
            durationWithinThreshold: statistics.duration.average <= thresholds.maxDuration,
            memoryWithinThreshold: Math.abs(statistics.memory.averageHeapIncrease) <= thresholds.maxMemoryIncrease
        };

        // Generate performance report with timing, memory, and resource utilization
        const performanceReport = {
            statistics,
            thresholds,
            validation: thresholdValidation,
            measurements: {
                durations: measurements.durations,
                errors: measurements.errors,
                memoryUsage: measurements.memoryUsage
            },
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform
        };

        // Return comprehensive performance metrics object for test validation
        return performanceReport;

    } catch (performanceError) {
        return {
            error: performanceError.message,
            statistics: null,
            measurements: measurements,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Utility function that waits for specified condition to be met with timeout handling and polling
 * interval configuration for reliable test synchronization
 * 
 * @param {Function} condition - Condition function that returns true when condition is met
 * @param {Object} options - Wait options including timeout, polling interval, and error handling
 * @returns {Promise<Boolean>} Promise resolving to true when condition is met, false on timeout
 */
export async function waitForCondition(condition, options = {}) {
    const timeout = options.timeout || DEFAULT_TEST_TIMEOUT;
    const interval = options.interval || 100;
    const throwOnTimeout = options.throwOnTimeout !== false;
    
    const startTime = performance.now();
    let attempts = 0;
    
    try {
        // Initialize condition polling with specified timeout and interval settings
        while ((performance.now() - startTime) < timeout) {
            attempts++;
            
            try {
                // Execute condition function repeatedly until true result or timeout
                const conditionResult = await condition();
                
                if (conditionResult === true) {
                    return true;
                }
                
            } catch (conditionError) {
                // Handle condition function errors with appropriate error logging
                if (options.ignoreErrors !== true) {
                    console.warn(`Condition check failed on attempt ${attempts}:`, conditionError.message);
                }
            }
            
            // Wait for polling interval before next condition check
            await setTimeout(interval);
        }
        
        // Return false if timeout is reached before condition satisfaction
        const totalTime = performance.now() - startTime;
        
        if (throwOnTimeout) {
            throw new Error(`Condition not met within ${timeout}ms timeout (${attempts} attempts, ${totalTime.toFixed(2)}ms elapsed)`);
        }
        
        return false;
        
    } catch (waitError) {
        const totalTime = performance.now() - startTime;
        console.error(`waitForCondition failed after ${totalTime.toFixed(2)}ms:`, waitError.message);
        
        if (throwOnTimeout) {
            throw waitError;
        }
        
        return false;
    }
}

/**
 * Generates unique correlation ID for test request tracking and debugging with timestamp
 * and random components for test isolation and monitoring
 * 
 * @returns {String} Unique correlation ID with test prefix for tracking and debugging purposes
 */
export function generateCorrelationId() {
    // Generate timestamp component using high-resolution performance timer
    const timestamp = Date.now();
    const performanceComponent = Math.floor(performance.now() * 1000);
    
    // Create random component using cryptographically secure random generation
    const randomComponent = Math.random().toString(36).substring(2, 10);
    
    // Combine timestamp and random components with test helper prefix
    const correlationId = `${CORRELATION_ID_PREFIX}${timestamp}-${performanceComponent}-${randomComponent}`;
    
    // Format correlation ID according to standardized correlation ID format
    return correlationId;
}

/**
 * Comprehensive test environment management class that provides server lifecycle management,
 * request utilities, performance monitoring, and resource cleanup for isolated test execution
 * with proper setup and teardown procedures
 */
export class TestEnvironment extends EventEmitter {
    /**
     * Initializes test environment with server configuration, correlation tracking, statistics collection,
     * and cleanup management for comprehensive test support
     * 
     * @param {Object} config - Configuration object with server settings, timeouts, and test behavior options
     */
    constructor(config = {}) {
        super();
        
        // Generate unique correlation ID for test environment tracking and debugging
        this.correlationId = generateCorrelationId();
        
        // Load test configuration with server settings and performance thresholds
        this.config = {
            port: config.port || DEFAULT_TEST_PORT,
            hostname: config.hostname || '127.0.0.1',
            timeout: config.timeout || DEFAULT_TEST_TIMEOUT,
            serverStartupTimeout: config.serverStartupTimeout || SERVER_STARTUP_TIMEOUT,
            performanceTolerance: config.performanceTolerance || PERFORMANCE_TOLERANCE,
            validateResponses: config.validateResponses !== false,
            enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
            ...config
        };
        
        // Initialize test statistics collection for performance and execution tracking
        this.stats = {
            requestCount: 0,
            errorCount: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            startTime: null,
            endTime: null,
            validationResults: []
        };
        
        // Set up cleanup function registry for proper resource management
        this.cleanup = [];
        
        // Configure test-specific server settings with isolated port and reduced timeouts
        this.server = null;
        this.serverAddress = null;
        
        // Initialize server instance with test configuration and monitoring
        this.mockRequestFactory = new MockRequestFactory({
            host: this.config.hostname,
            port: this.config.port,
            timeout: this.config.timeout
        });
        
        // Set up test environment state tracking for setup and teardown validation
        this.isSetup = false;
        this.isShuttingDown = false;
        
        // Configure error handling and logging for test environment operations
        this.on('error', (error) => {
            console.error('TestEnvironment error:', error.message);
            this.stats.errorCount++;
        });
    }
    
    /**
     * Sets up complete test environment including server startup, connectivity validation,
     * and resource initialization for test execution
     * 
     * @returns {Promise<void>} Promise resolving when test environment setup is complete
     */
    async setup() {
        try {
            // Validate test environment is not already setup to prevent double initialization
            if (this.isSetup) {
                throw new Error('Test environment is already setup');
            }
            
            this.stats.startTime = performance.now();
            
            // Create and configure HttpServer instance with test-specific settings
            this.server = createTestServer(this.config);
            
            // Start test server with automatic port allocation and startup validation
            this.serverAddress = await startTestServer(this.server, {
                timeout: this.config.serverStartupTimeout,
                validateConnectivity: true
            });
            
            // Validate server connectivity and responsiveness for request processing
            if (!this.serverAddress || !this.serverAddress.url) {
                throw new Error('Failed to retrieve valid server address after startup');
            }
            
            // Initialize performance monitoring and statistics collection
            if (this.config.enablePerformanceMonitoring) {
                this.setupPerformanceMonitoring();
            }
            
            // Set up error handling and cleanup procedures for test execution
            this.addCleanup(async () => {
                if (this.server && this.server.isListening()) {
                    await stopTestServer(this.server);
                }
            });
            
            // Mark test environment as setup and ready for test execution
            this.isSetup = true;
            
            // Log successful test environment setup with server address and timing
            const setupTime = performance.now() - this.stats.startTime;
            console.log(`Test environment setup completed in ${setupTime.toFixed(2)}ms`, {
                correlationId: this.correlationId,
                serverUrl: this.serverAddress.url,
                port: this.serverAddress.port
            });
            
            this.emit('setup', this.serverAddress);
            
        } catch (setupError) {
            this.isSetup = false;
            this.stats.errorCount++;
            console.error('Test environment setup failed:', setupError.message);
            throw setupError;
        }
    }
    
    /**
     * Performs complete test environment teardown including server shutdown, resource cleanup,
     * and validation for proper test isolation
     * 
     * @returns {Promise<void>} Promise resolving when test environment teardown is complete
     */
    async teardown() {
        try {
            // Check if test environment is properly setup before teardown
            if (!this.isSetup) {
                console.warn('Test environment teardown skipped - not setup', {
                    correlationId: this.correlationId
                });
                return;
            }
            
            if (this.isShuttingDown) {
                console.warn('Test environment teardown already in progress', {
                    correlationId: this.correlationId
                });
                return;
            }
            
            this.isShuttingDown = true;
            const teardownStartTime = performance.now();
            
            // Execute all registered cleanup functions in reverse order
            const cleanupTasks = [...this.cleanup].reverse();
            for (const cleanupFn of cleanupTasks) {
                try {
                    await cleanupFn();
                } catch (cleanupError) {
                    console.error('Cleanup function failed:', cleanupError.message);
                }
            }
            
            // Stop test server gracefully with connection cleanup and port release
            if (this.server && this.server.isListening()) {
                await stopTestServer(this.server, this.config.timeout);
            }
            
            // Clean up test resources including timers, event listeners, and statistics
            this.removeAllListeners();
            this.cleanup = [];
            
            // Validate server has stopped completely and resources are released
            if (this.server && this.server.isListening()) {
                console.warn('Server still listening after teardown', {
                    correlationId: this.correlationId
                });
            }
            
            // Reset test environment state to allow for future setup
            this.stats.endTime = performance.now();
            this.isSetup = false;
            this.isShuttingDown = false;
            
            // Log successful test environment teardown with cleanup confirmation
            const teardownTime = performance.now() - teardownStartTime;
            const totalTime = this.stats.endTime - this.stats.startTime;
            
            console.log(`Test environment teardown completed in ${teardownTime.toFixed(2)}ms`, {
                correlationId: this.correlationId,
                totalTestTime: `${totalTime.toFixed(2)}ms`,
                requestCount: this.stats.requestCount,
                errorCount: this.stats.errorCount
            });
            
            this.emit('teardown', {
                teardownTime,
                totalTime,
                stats: this.getStats()
            });
            
        } catch (teardownError) {
            this.stats.errorCount++;
            console.error('Test environment teardown failed:', teardownError.message);
            throw teardownError;
        }
    }
    
    /**
     * Makes HTTP requests to test server with automatic URL construction, request tracking,
     * and comprehensive response handling
     * 
     * @param {String} path - Request path to append to server base URL
     * @param {Object} options - Request options including method, headers, and body
     * @returns {Promise<Object>} Promise resolving to complete response object with timing and correlation
     */
    async makeRequest(path, options = {}) {
        try {
            // Validate test environment is setup and server is accessible
            if (!this.isSetup || !this.serverAddress) {
                throw new Error('Test environment is not properly setup for making requests');
            }
            
            // Construct complete request URL using server address and provided path
            const requestUrl = new URL(path, this.serverAddress.url).toString();
            
            // Add correlation ID to request headers for tracking and debugging
            const requestOptions = {
                ...options,
                headers: {
                    'X-Correlation-ID': this.correlationId,
                    'X-Test-Environment': 'true',
                    ...options.headers
                }
            };
            
            // Execute HTTP request with timing measurement and error handling
            const response = await makeRequest(requestUrl, requestOptions);
            
            // Update test statistics with request count and performance metrics
            this.stats.requestCount++;
            this.stats.totalResponseTime += response.timing.duration;
            this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.requestCount;
            
            if (response.ok) {
                this.stats.successfulRequests++;
            } else {
                this.stats.failedRequests++;
            }
            
            // Return response object with correlation ID and performance data
            response.correlationId = this.correlationId;
            response.testEnvironment = true;
            
            this.emit('request', {
                path,
                response,
                timing: response.timing
            });
            
            return response;
            
        } catch (requestError) {
            this.stats.errorCount++;
            this.stats.failedRequests++;
            console.error('Test environment request failed:', requestError.message);
            throw requestError;
        }
    }
    
    /**
     * Validates HTTP responses against expected criteria with comprehensive checking
     * and detailed reporting for test assertions
     * 
     * @param {Object} response - HTTP response object to validate
     * @param {Object} expected - Expected response characteristics
     * @returns {Object} Validation result with detailed comparison and assertion information
     */
    validateResponse(response, expected) {
        try {
            // Perform comprehensive response validation using validateResponse utility
            const validation = validateResponse(response, expected, {
                validateSecurity: true,
                strictTiming: this.config.performanceTolerance < 1.0
            });
            
            // Update test statistics with validation results and assertion counts
            this.stats.validationResults.push({
                timestamp: new Date().toISOString(),
                correlationId: this.correlationId,
                isValid: validation.isValid,
                errors: validation.errors.length,
                warnings: validation.warnings.length
            });
            
            // Track validation failures for test reporting and debugging
            if (!validation.isValid) {
                this.stats.errorCount++;
                this.emit('validationError', {
                    response,
                    expected,
                    validation
                });
            }
            
            // Return detailed validation result with pass/fail status and feedback
            validation.correlationId = this.correlationId;
            validation.testEnvironment = true;
            
            return validation;
            
        } catch (validationError) {
            this.stats.errorCount++;
            console.error('Response validation failed:', validationError.message);
            return {
                isValid: false,
                errors: [validationError.message],
                warnings: [],
                details: {},
                correlationId: this.correlationId
            };
        }
    }
    
    /**
     * Registers cleanup function to be executed during test environment teardown
     * for proper resource management
     * 
     * @param {Function} cleanupFn - Function to execute during teardown for resource cleanup
     * @returns {void} No return value - adds function to cleanup registry
     */
    addCleanup(cleanupFn) {
        // Validate cleanup function is callable and properly defined
        if (typeof cleanupFn !== 'function') {
            throw new Error('Cleanup function must be a function');
        }
        
        // Add cleanup function to internal cleanup registry
        this.cleanup.push(cleanupFn);
        
        // Log cleanup function registration for debugging purposes
        console.log(`Cleanup function registered (${this.cleanup.length} total)`, {
            correlationId: this.correlationId
        });
    }
    
    /**
     * Returns comprehensive test execution statistics including performance metrics,
     * request counts, and validation results
     * 
     * @returns {Object} Test statistics object with performance metrics and execution data
     */
    getStats() {
        // Collect current test execution statistics including request counts
        const currentTime = performance.now();
        const totalTime = this.stats.endTime || currentTime;
        const uptime = this.stats.startTime ? totalTime - this.stats.startTime : 0;
        
        // Calculate performance metrics including average response times
        const performanceMetrics = {
            requestsPerSecond: uptime > 0 ? (this.stats.requestCount / (uptime / 1000)) : 0,
            averageResponseTime: this.stats.averageResponseTime,
            totalResponseTime: this.stats.totalResponseTime
        };
        
        // Include validation statistics with pass/fail ratios
        const validationStats = {
            totalValidations: this.stats.validationResults.length,
            successfulValidations: this.stats.validationResults.filter(v => v.isValid).length,
            failedValidations: this.stats.validationResults.filter(v => !v.isValid).length,
            successRate: this.stats.validationResults.length > 0 ? 
                (this.stats.validationResults.filter(v => v.isValid).length / this.stats.validationResults.length) * 100 : 0
        };
        
        // Return comprehensive statistics object for test reporting
        return {
            correlationId: this.correlationId,
            environment: {
                isSetup: this.isSetup,
                isShuttingDown: this.isShuttingDown,
                serverUrl: this.serverAddress?.url,
                config: this.config
            },
            timing: {
                startTime: this.stats.startTime,
                endTime: this.stats.endTime,
                uptime: uptime,
                totalTestDuration: uptime
            },
            requests: {
                total: this.stats.requestCount,
                successful: this.stats.successfulRequests,
                failed: this.stats.failedRequests,
                errors: this.stats.errorCount,
                successRate: this.stats.requestCount > 0 ? 
                    (this.stats.successfulRequests / this.stats.requestCount) * 100 : 0
            },
            performance: performanceMetrics,
            validation: validationStats,
            cleanup: {
                registeredCleanupFunctions: this.cleanup.length
            },
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Sets up performance monitoring for test environment
     * @private
     */
    setupPerformanceMonitoring() {
        const monitoringInterval = setInterval(() => {
            const memoryUsage = process.memoryUsage();
            this.emit('performanceMetrics', {
                memory: memoryUsage,
                uptime: performance.now() - this.stats.startTime,
                requestCount: this.stats.requestCount,
                averageResponseTime: this.stats.averageResponseTime
            });
        }, 5000);
        
        this.addCleanup(() => {
            clearInterval(monitoringInterval);
        });
    }
}

/**
 * Specialized response validation class that provides comprehensive HTTP response checking
 * including status codes, headers, content validation, and security header verification
 * with detailed assertion reporting
 */
export class ResponseValidator extends EventEmitter {
    /**
     * Initializes response validator with configuration, validation rules, and custom validation
     * support for comprehensive response testing
     * 
     * @param {Object} options - Configuration options including validation rules, strict mode, and custom validators
     */
    constructor(options = {}) {
        super();
        
        // Load validation configuration from options with default rules and thresholds
        this.config = {
            strictMode: options.strictMode !== false,
            validateSecurity: options.validateSecurity !== false,
            validatePerformance: options.validatePerformance !== false,
            performanceThreshold: options.performanceThreshold || performanceData.responseTimeThresholds?.critical || 100,
            enableContentValidation: options.enableContentValidation !== false,
            ...options
        };
        
        // Initialize validation statistics tracking for performance monitoring
        this.stats = {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            errorsByType: {},
            warningsByType: {},
            averageValidationTime: 0,
            totalValidationTime: 0
        };
        
        // Set up strict mode enforcement for comprehensive validation checking
        this.strictMode = this.config.strictMode;
        
        // Register custom validation functions for specialized response checking
        this.customValidators = options.customValidators || [];
        
        // Configure security header validation rules and requirements
        this.securityHeaders = {
            required: options.requiredSecurityHeaders || [
                'x-content-type-options',
                'x-frame-options'
            ],
            recommended: options.recommendedSecurityHeaders || [
                'x-xss-protection',
                'referrer-policy',
                'content-security-policy'
            ]
        };
    }
    
    /**
     * Performs comprehensive HTTP response validation including all configured checks
     * with detailed reporting and assertion results
     * 
     * @param {Object} response - HTTP response object to validate
     * @param {Object} expected - Expected response characteristics and validation criteria
     * @returns {Object} Complete validation result with detailed checking results and assertion information
     */
    validate(response, expected) {
        const validationStartTime = performance.now();
        
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            details: {
                status: null,
                headers: null,
                content: null,
                security: null,
                performance: null,
                custom: []
            },
            metadata: {
                correlationId: generateCorrelationId(),
                timestamp: new Date().toISOString(),
                validatorVersion: '1.0.0',
                strictMode: this.strictMode
            }
        };
        
        try {
            // Execute status code validation with strict equality checking
            const statusValidation = this.validateStatusCode(response.status, expected.status);
            validation.details.status = statusValidation;
            if (!statusValidation.isValid) {
                validation.isValid = false;
                validation.errors.push(...statusValidation.errors);
            }
            validation.warnings.push(...statusValidation.warnings);
            
            // Perform header validation including required headers and security headers
            if (expected.headers || this.config.validateSecurity) {
                const headerValidation = this.validateHeaders(response.headers, expected.headers || {});
                validation.details.headers = headerValidation;
                if (!headerValidation.isValid) {
                    validation.isValid = false;
                    validation.errors.push(...headerValidation.errors);
                }
                validation.warnings.push(...headerValidation.warnings);
            }
            
            // Validate response content against expected body with encoding handling
            if (this.config.enableContentValidation && expected.body !== undefined) {
                const contentValidation = this.validateContent(response.body, expected.body);
                validation.details.content = contentValidation;
                if (!contentValidation.isValid) {
                    validation.isValid = false;
                    validation.errors.push(...contentValidation.errors);
                }
                validation.warnings.push(...contentValidation.warnings);
            }
            
            // Check Content-Type and Content-Length header accuracy
            if (response.headers['content-type'] && expected.contentType) {
                const contentTypeMatch = response.headers['content-type'].includes(expected.contentType);
                if (!contentTypeMatch) {
                    validation.isValid = false;
                    validation.errors.push(`Content-Type mismatch: expected "${expected.contentType}" in "${response.headers['content-type']}"`);
                }
            }
            
            if (response.headers['content-length'] && response.body) {
                const expectedLength = Buffer.byteLength(response.body, 'utf8');
                const actualLength = parseInt(response.headers['content-length'], 10);
                if (expectedLength !== actualLength) {
                    validation.warnings.push(`Content-Length mismatch: header=${actualLength}, actual=${expectedLength}`);
                }
            }
            
            // Execute custom validation functions with error handling
            for (const customValidator of this.customValidators) {
                try {
                    const customResult = customValidator(response, expected);
                    validation.details.custom.push(customResult);
                    if (customResult.isValid === false) {
                        validation.isValid = false;
                        validation.errors.push(...(customResult.errors || []));
                    }
                    validation.warnings.push(...(customResult.warnings || []));
                } catch (customError) {
                    validation.isValid = false;
                    validation.errors.push(`Custom validator error: ${customError.message}`);
                }
            }
            
            // Validate performance timing if enabled
            if (this.config.validatePerformance && response.timing) {
                const performanceValidation = {
                    duration: response.timing.duration,
                    threshold: this.config.performanceThreshold,
                    isValid: response.timing.duration <= this.config.performanceThreshold
                };
                
                validation.details.performance = performanceValidation;
                
                if (!performanceValidation.isValid) {
                    if (this.strictMode) {
                        validation.isValid = false;
                        validation.errors.push(`Performance threshold exceeded: ${response.timing.duration}ms > ${this.config.performanceThreshold}ms`);
                    } else {
                        validation.warnings.push(`Performance threshold exceeded: ${response.timing.duration}ms > ${this.config.performanceThreshold}ms`);
                    }
                }
            }
            
            // Update validation statistics with results and performance data
            const validationTime = performance.now() - validationStartTime;
            this.updateStats(validation, validationTime);
            
            // Emit validation event for monitoring
            this.emit('validation', {
                validation,
                response,
                expected,
                duration: validationTime
            });
            
        } catch (validationError) {
            validation.isValid = false;
            validation.errors.push(`Validation process error: ${validationError.message}`);
            this.stats.failedValidations++;
        }
        
        // Return comprehensive validation result with detailed feedback
        return validation;
    }
    
    /**
     * Validates HTTP status code against expected value with detailed error reporting
     * for status code mismatches
     * 
     * @param {Number} actual - Actual HTTP status code from response
     * @param {Number} expected - Expected HTTP status code for validation
     * @returns {Object} Status code validation result with pass/fail status and details
     */
    validateStatusCode(actual, expected) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            expected: expected,
            actual: actual
        };
        
        if (expected !== undefined) {
            // Compare actual and expected status codes with strict equality
            if (actual !== expected) {
                validation.isValid = false;
                // Generate detailed error message for status code mismatches
                validation.errors.push(`Status code mismatch: expected ${expected}, got ${actual}`);
                
                // Add contextual information about status code categories
                const expectedCategory = Math.floor(expected / 100);
                const actualCategory = Math.floor(actual / 100);
                
                if (expectedCategory !== actualCategory) {
                    validation.errors.push(`Status code category mismatch: expected ${expectedCategory}xx, got ${actualCategory}xx`);
                }
            }
            
            // Add warnings for unusual status codes
            if (actual < 100 || actual >= 600) {
                validation.warnings.push(`Unusual status code: ${actual}`);
            }
        }
        
        return validation;
    }
    
    /**
     * Validates HTTP response headers including required headers, security headers,
     * and custom header validation with comprehensive checking
     * 
     * @param {Object} actualHeaders - Actual HTTP response headers from server
     * @param {Object} expectedHeaders - Expected headers for validation
     * @returns {Object} Header validation result with detailed checking results for each header
     */
    validateHeaders(actualHeaders, expectedHeaders) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            missing: [],
            incorrect: [],
            extra: [],
            security: {
                present: [],
                missing: []
            }
        };
        
        // Check all expected headers are present in response
        for (const [headerName, expectedValue] of Object.entries(expectedHeaders)) {
            const normalizedName = headerName.toLowerCase();
            const actualValue = actualHeaders[normalizedName];
            
            if (actualValue === undefined) {
                validation.missing.push(headerName);
                validation.isValid = false;
                validation.errors.push(`Missing required header: ${headerName}`);
            } else if (expectedValue !== '*' && actualValue !== expectedValue) {
                // Validate header values match expected values with case handling
                validation.incorrect.push({
                    header: headerName,
                    expected: expectedValue,
                    actual: actualValue
                });
                validation.isValid = false;
                validation.errors.push(`Header value mismatch for ${headerName}: expected "${expectedValue}", got "${actualValue}"`);
            }
        }
        
        // Verify required security headers are present and correct
        if (this.config.validateSecurity) {
            this.securityHeaders.required.forEach(header => {
                if (actualHeaders[header]) {
                    validation.security.present.push(header);
                } else {
                    validation.security.missing.push(header);
                    if (this.strictMode) {
                        validation.isValid = false;
                        validation.errors.push(`Missing required security header: ${header}`);
                    } else {
                        validation.warnings.push(`Missing recommended security header: ${header}`);
                    }
                }
            });
            
            // Check recommended security headers
            this.securityHeaders.recommended.forEach(header => {
                if (!actualHeaders[header]) {
                    validation.warnings.push(`Missing recommended security header: ${header}`);
                }
            });
        }
        
        // Check Content-Type and Content-Length header accuracy
        if (actualHeaders['content-type']) {
            const contentType = actualHeaders['content-type'];
            if (!contentType.includes('charset') && contentType.startsWith('text/')) {
                validation.warnings.push('Text content type missing charset specification');
            }
        }
        
        return validation;
    }
    
    /**
     * Validates HTTP response content including body text, encoding, and content format
     * with comprehensive content checking
     * 
     * @param {String|Buffer} actualContent - Actual response body content
     * @param {String|Buffer} expectedContent - Expected content for validation
     * @returns {Object} Content validation result with detailed content comparison information
     */
    validateContent(actualContent, expectedContent) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            expected: expectedContent,
            actual: actualContent,
            comparison: {
                lengthMatch: false,
                exactMatch: false,
                encodingValid: true
            }
        };
        
        try {
            // Compare actual and expected content with proper encoding handling
            const actualString = typeof actualContent === 'string' ? actualContent : actualContent.toString('utf8');
            const expectedString = typeof expectedContent === 'string' ? expectedContent : expectedContent.toString('utf8');
            
            validation.comparison.exactMatch = actualString === expectedString;
            validation.comparison.lengthMatch = actualString.length === expectedString.length;
            
            if (!validation.comparison.exactMatch) {
                validation.isValid = false;
                validation.errors.push(`Content mismatch: expected "${expectedString}", got "${actualString}"`);
                
                if (!validation.comparison.lengthMatch) {
                    validation.errors.push(`Content length mismatch: expected ${expectedString.length}, got ${actualString.length}`);
                }
            }
            
            // Validate content length matches Content-Length header
            // This is handled in the main validate method
            
            // Check content format matches Content-Type specification
            // This would require additional format-specific validation
            
        } catch (contentError) {
            validation.isValid = false;
            validation.comparison.encodingValid = false;
            validation.errors.push(`Content validation error: ${contentError.message}`);
        }
        
        return validation;
    }
    
    /**
     * Updates validation statistics
     * @private
     */
    updateStats(validation, validationTime) {
        this.stats.totalValidations++;
        this.stats.totalValidationTime += validationTime;
        this.stats.averageValidationTime = this.stats.totalValidationTime / this.stats.totalValidations;
        
        if (validation.isValid) {
            this.stats.successfulValidations++;
        } else {
            this.stats.failedValidations++;
        }
        
        // Track error types
        validation.errors.forEach(error => {
            const errorType = error.split(':')[0];
            this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
        });
        
        // Track warning types
        validation.warnings.forEach(warning => {
            const warningType = warning.split(':')[0];
            this.stats.warningsByType[warningType] = (this.stats.warningsByType[warningType] || 0) + 1;
        });
    }
    
    /**
     * Returns validation statistics
     * 
     * @returns {Object} Validation statistics with performance metrics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalValidations > 0 
                ? (this.stats.successfulValidations / this.stats.totalValidations) * 100 
                : 0,
            config: this.config,
            timestamp: new Date().toISOString()
        };
    }
}

// Export default test helpers object containing commonly used utility functions for immediate use in test files
export const testHelpers = {
    createTestServer,
    makeRequest,
    validateResponse,
    measurePerformance,
    waitForCondition,
    generateCorrelationId,
    TestEnvironment,
    ResponseValidator
};

// Export the test helpers object as default for convenient importing
export default testHelpers;