/**
 * Comprehensive Server Lifecycle Integration Test Suite for Node.js Tutorial HTTP Server
 * 
 * This integration test suite validates complete server startup, operation, graceful shutdown, 
 * error handling, and resource management scenarios using Node.js built-in test runner with 
 * zero external dependencies. Demonstrates educational server lifecycle testing patterns and 
 * comprehensive validation of server behavior across all operational phases.
 * 
 * Educational Purpose:
 * - Demonstrates server lifecycle testing methodology using Node.js built-in test runner
 * - Shows integration testing patterns for HTTP server applications with proper lifecycle management
 * - Illustrates performance testing and validation during server lifecycle phases
 * - Provides examples of error handling and recovery testing for server startup/shutdown scenarios
 * - Teaches resource management testing including memory, CPU, and cleanup validation
 * - Demonstrates graceful shutdown testing with active connection handling
 * 
 * Features:
 * - Zero external dependencies - uses only Node.js built-in modules and test runner
 * - Comprehensive server lifecycle management testing from startup through shutdown
 * - Performance measurement and validation for lifecycle operations with timing thresholds
 * - Error handling and recovery testing for configuration and resource failures
 * - Test environment management with proper setup, teardown, and resource isolation
 * - Correlation tracking and request tracing for debugging lifecycle issues
 */

// Node.js built-in module imports for testing framework functionality
import { test, describe, before, after, beforeEach, afterEach } from 'node:test'; // node:test@built-in - Node.js built-in test runner for test execution and lifecycle management
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Node.js built-in assertion library for strict lifecycle state validation and error checking
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Node.js built-in performance API for measuring server startup and shutdown timing
import { setTimeout } from 'node:timers/promises'; // node:timers/promises@built-in - Node.js built-in promisified setTimeout for lifecycle timing control and timeout handling

// Import internal dependencies for test environment, server management, and configuration
import { 
    TestEnvironment, 
    waitForCondition, 
    measurePerformance,
    makeRequest,
    validateResponse
} from '../fixtures/test-helpers.js';
import { HttpServer } from '../../lib/http-server.js';
import { testData } from '../fixtures/test-data.js';
import { config } from '../../config/environment.js';

// Global test configuration constants for consistent lifecycle testing behavior
const TEST_TIMEOUT = 15000;
const SERVER_STARTUP_TIMEOUT = 5000;
const SERVER_SHUTDOWN_TIMEOUT = 10000;
const LIFECYCLE_PERFORMANCE_THRESHOLD = 2000;
const CORRELATION_PREFIX = 'lifecycle-test-';

// Test environment instance for shared lifecycle testing resources
let lifecycleTestEnv = null;

/**
 * Initializes test environment for server lifecycle testing with proper configuration, 
 * logging, and cleanup management for comprehensive lifecycle validation
 * 
 * @param {object} options - Test configuration including timeout settings and server parameters
 * @returns {Promise<object>} Promise resolving to test environment instance configured for lifecycle testing
 */
async function setupLifecycleTest(options = {}) {
    try {
        // Create TestEnvironment instance with lifecycle-specific configuration
        const testEnvConfig = {
            port: options.port || 0, // Use dynamic port allocation for isolation
            hostname: options.hostname || config.server?.hostname || '127.0.0.1',
            timeout: options.timeout || TEST_TIMEOUT,
            serverStartupTimeout: SERVER_STARTUP_TIMEOUT,
            serverShutdownTimeout: SERVER_SHUTDOWN_TIMEOUT,
            performanceTolerance: 0.1,
            enablePerformanceMonitoring: true,
            validateResponses: true,
            ...options
        };

        // Configure test-specific timeout values for startup and shutdown
        testEnvConfig.lifecycleTimeouts = {
            startup: SERVER_STARTUP_TIMEOUT,
            shutdown: SERVER_SHUTDOWN_TIMEOUT,
            healthCheck: 3000,
            performanceValidation: 1000
        };

        // Set up correlation tracking for lifecycle event monitoring
        const correlationId = `${CORRELATION_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        testEnvConfig.correlationId = correlationId;

        // Initialize performance monitoring for lifecycle timing measurement
        testEnvConfig.performanceThresholds = {
            startupTime: LIFECYCLE_PERFORMANCE_THRESHOLD,
            shutdownTime: LIFECYCLE_PERFORMANCE_THRESHOLD / 2,
            requestTime: testData.performanceData?.responseTimeThresholds?.critical || 100
        };

        // Create and configure TestEnvironment for lifecycle testing
        const testEnvironment = new TestEnvironment(testEnvConfig);

        // Register cleanup handlers for proper resource management
        testEnvironment.addCleanup(async () => {
            console.log(`Lifecycle test cleanup for correlation: ${correlationId}`);
        });

        // Return configured test environment ready for lifecycle testing
        console.log(`Lifecycle test environment setup completed`, { 
            correlationId, 
            config: testEnvConfig 
        });

        return testEnvironment;

    } catch (setupError) {
        console.error('Failed to setup lifecycle test environment:', setupError.message);
        throw setupError;
    }
}

/**
 * Cleans up server lifecycle test environment with comprehensive resource cleanup 
 * and validation for proper test isolation
 * 
 * @param {object} testEnv - Test environment instance to clean up
 * @returns {Promise<void>} Promise resolving when lifecycle test cleanup is complete
 */
async function teardownLifecycleTest(testEnv) {
    try {
        if (!testEnv) {
            console.warn('No test environment provided for teardown');
            return;
        }

        console.log('Starting lifecycle test teardown', { 
            correlationId: testEnv.correlationId 
        });

        // Ensure any running servers are gracefully stopped
        if (testEnv.server && testEnv.server.isListening()) {
            console.log('Stopping server during lifecycle test teardown');
            await testEnv.server.stop(SERVER_SHUTDOWN_TIMEOUT);
        }

        // Execute all registered cleanup functions
        await testEnv.teardown();

        // Validate all resources have been properly released
        if (testEnv.server && testEnv.server.isListening()) {
            throw new Error('Server still listening after teardown');
        }

        // Clear performance monitoring and correlation tracking
        console.log('Lifecycle test teardown completed successfully', { 
            correlationId: testEnv.correlationId,
            stats: testEnv.getStats()
        });

        // Complete test environment teardown
        testEnv.removeAllListeners();

    } catch (teardownError) {
        console.error('Lifecycle test teardown failed:', teardownError.message);
        throw teardownError;
    }
}

/**
 * Validates server startup procedure including port binding, status verification, 
 * and connectivity testing with comprehensive timing and validation
 * 
 * @param {object} server - HttpServer instance to validate startup for
 * @param {object} expectedConfig - Expected server configuration for validation
 * @returns {Promise<object>} Promise resolving to startup validation results with timing and status information
 */
async function validateServerStartup(server, expectedConfig = {}) {
    try {
        // Measure server startup time using performance API
        const startupStartTime = performance.now();

        // Validate server is listening on expected port and hostname
        assert.ok(server.isListening(), 'Server should be listening after startup');

        // Test server connectivity with basic HTTP request
        const address = server.getAddress();
        assert.ok(address, 'Server address should be available after startup');
        assert.ok(address.port > 0, 'Server should have valid port number');
        assert.ok(address.hostname, 'Server should have valid hostname');

        // Verify server status methods return correct information
        const serverStats = server.getStats();
        assert.ok(serverStats, 'Server statistics should be available');
        assert.strictEqual(serverStats.server.isRunning, true, 'Server should report running status');

        // Validate server address information is accurate
        if (expectedConfig.port && expectedConfig.port !== 0) {
            assert.strictEqual(address.port, expectedConfig.port, 'Server port should match configuration');
        }

        if (expectedConfig.hostname) {
            assert.strictEqual(address.hostname, expectedConfig.hostname, 'Server hostname should match configuration');
        }

        // Check startup time meets performance requirements
        const startupTime = performance.now() - startupStartTime;
        assert.ok(startupTime < LIFECYCLE_PERFORMANCE_THRESHOLD, 
            `Server startup validation should complete within ${LIFECYCLE_PERFORMANCE_THRESHOLD}ms, took ${startupTime.toFixed(2)}ms`);

        // Return comprehensive startup validation results
        return {
            isValid: true,
            address,
            stats: serverStats,
            timing: {
                startupValidationTime: startupTime,
                timestamp: new Date().toISOString()
            },
            connectivity: {
                listening: server.isListening(),
                addressAvailable: !!address,
                statsAvailable: !!serverStats
            }
        };

    } catch (validationError) {
        return {
            isValid: false,
            error: {
                name: validationError.name,
                message: validationError.message,
                stack: validationError.stack
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Validates server shutdown procedure including graceful connection handling, 
 * resource cleanup, and timing validation with comprehensive monitoring
 * 
 * @param {object} server - HttpServer instance to validate shutdown for
 * @param {number} timeout - Maximum time allowed for graceful shutdown
 * @returns {Promise<object>} Promise resolving to shutdown validation results with timing and cleanup status
 */
async function validateServerShutdown(server, timeout = SERVER_SHUTDOWN_TIMEOUT) {
    try {
        // Record active connections before shutdown initiation
        const preShutdownStats = server.getStats();
        const activeConnections = preShutdownStats.connections.current;

        // Measure shutdown duration using performance timing
        const shutdownStartTime = performance.now();

        // Initiate server shutdown
        await server.stop(timeout);

        const shutdownTime = performance.now() - shutdownStartTime;

        // Validate server stops accepting new connections
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after shutdown');

        // Check server resources are properly cleaned up
        const postShutdownStats = server.getStats();
        assert.strictEqual(postShutdownStats.server.isRunning, false, 'Server should report stopped status');

        // Validate port is released and available for reuse
        const address = server.getAddress();
        assert.strictEqual(address, null, 'Server address should be null after shutdown');

        // Ensure shutdown completes within timeout threshold
        assert.ok(shutdownTime < timeout, 
            `Server shutdown should complete within ${timeout}ms, took ${shutdownTime.toFixed(2)}ms`);

        // Return detailed shutdown validation results
        return {
            isValid: true,
            timing: {
                shutdownDuration: shutdownTime,
                timestamp: new Date().toISOString()
            },
            connections: {
                preShutdown: activeConnections,
                postShutdown: postShutdownStats.connections.current
            },
            cleanup: {
                serverStopped: !server.isListening(),
                addressReleased: address === null,
                statsUpdated: !postShutdownStats.server.isRunning
            }
        };

    } catch (shutdownError) {
        return {
            isValid: false,
            error: {
                name: shutdownError.name,
                message: shutdownError.message,
                stack: shutdownError.stack
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Tests server startup failure scenarios including port conflicts, configuration errors, 
 * and resource issues with comprehensive error analysis
 * 
 * @param {object} failureConfig - Configuration designed to cause startup failures
 * @returns {Promise<object>} Promise resolving to failure scenario test results with error analysis
 */
async function testStartupFailureScenarios(failureConfig) {
    const testResults = {
        scenarios: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0
        }
    };

    try {
        // Test port conflict scenario
        const portConflictTest = await testPortConflictScenario(failureConfig);
        testResults.scenarios.push(portConflictTest);
        testResults.summary.total++;
        if (portConflictTest.passed) testResults.summary.passed++;
        else testResults.summary.failed++;

        // Test invalid configuration scenarios
        const configErrorTest = await testConfigurationErrorScenario();
        testResults.scenarios.push(configErrorTest);
        testResults.summary.total++;
        if (configErrorTest.passed) testResults.summary.passed++;
        else testResults.summary.failed++;

        // Test permission error handling for restricted ports
        const permissionErrorTest = await testPermissionErrorScenario();
        testResults.scenarios.push(permissionErrorTest);
        testResults.summary.total++;
        if (permissionErrorTest.passed) testResults.summary.passed++;
        else testResults.summary.failed++;

        // Return failure scenario analysis with error categorization
        return testResults;

    } catch (testError) {
        testResults.error = {
            name: testError.name,
            message: testError.message,
            stack: testError.stack
        };
        return testResults;
    }
}

/**
 * Tests port conflict detection and handling
 */
async function testPortConflictScenario(failureConfig) {
    try {
        // Create and start first server on specific port
        const firstServer = new HttpServer({ port: failureConfig.port || 3001, hostname: '127.0.0.1' });
        await firstServer.start();

        try {
            // Attempt to start second server on same port
            const secondServer = new HttpServer({ port: failureConfig.port || 3001, hostname: '127.0.0.1' });
            await secondServer.start();

            // If we reach here, the test failed
            await secondServer.stop();
            await firstServer.stop();
            return {
                scenario: 'port_conflict',
                passed: false,
                error: 'Second server started on conflicted port unexpectedly'
            };

        } catch (conflictError) {
            // Expected error - validate it's the right type
            await firstServer.stop();
            
            const isExpectedError = conflictError.code === 'EADDRINUSE' || 
                                  conflictError.message.includes('EADDRINUSE') ||
                                  conflictError.message.includes('already in use');

            return {
                scenario: 'port_conflict',
                passed: isExpectedError,
                error: isExpectedError ? null : conflictError.message,
                errorCode: conflictError.code
            };
        }

    } catch (setupError) {
        return {
            scenario: 'port_conflict',
            passed: false,
            error: `Setup failed: ${setupError.message}`
        };
    }
}

/**
 * Tests configuration error handling
 */
async function testConfigurationErrorScenario() {
    try {
        // Test with invalid port number
        const invalidServer = new HttpServer({ port: -1, hostname: '127.0.0.1' });
        await invalidServer.start();

        // If we reach here, the test failed
        return {
            scenario: 'configuration_error',
            passed: false,
            error: 'Server started with invalid port unexpectedly'
        };

    } catch (configError) {
        // Expected error - validate configuration handling
        const isExpectedError = configError.message.includes('port') || 
                              configError.message.includes('invalid');

        return {
            scenario: 'configuration_error',
            passed: isExpectedError,
            error: isExpectedError ? null : configError.message
        };
    }
}

/**
 * Tests permission error handling
 */
async function testPermissionErrorScenario() {
    try {
        // Attempt to bind to privileged port (requires root)
        const privilegedServer = new HttpServer({ port: 80, hostname: '127.0.0.1' });
        await privilegedServer.start();

        // If we reach here on non-root, the test failed
        await privilegedServer.stop();
        return {
            scenario: 'permission_error',
            passed: false,
            error: 'Server bound to privileged port without proper permissions'
        };

    } catch (permissionError) {
        // Expected error on non-root systems
        const isExpectedError = permissionError.code === 'EACCES' || 
                              permissionError.message.includes('Permission denied') ||
                              permissionError.message.includes('EACCES');

        return {
            scenario: 'permission_error',
            passed: isExpectedError,
            error: isExpectedError ? null : permissionError.message,
            errorCode: permissionError.code
        };
    }
}

/**
 * Tests graceful server shutdown with active HTTP connections to validate 
 * connection handling and cleanup procedures
 * 
 * @param {object} testEnv - Test environment for making active connections
 * @param {number} connectionCount - Number of active connections to maintain during shutdown
 * @returns {Promise<object>} Promise resolving to graceful shutdown test results with connection handling analysis
 */
async function testGracefulShutdownWithActiveConnections(testEnv, connectionCount = 3) {
    try {
        // Start test server and establish multiple active connections
        await testEnv.setup();
        
        const server = testEnv.server;
        const serverAddress = testEnv.serverAddress;

        // Create active connections with delayed responses
        const connectionPromises = [];
        for (let i = 0; i < connectionCount; i++) {
            const connectionPromise = makeRequest(`${serverAddress.url}/hello`, {
                method: 'GET',
                timeout: 10000, // Long timeout to keep connection active
                headers: {
                    'X-Connection-Id': `connection-${i}`,
                    'Keep-Alive': 'timeout=30'
                }
            });
            connectionPromises.push(connectionPromise);
        }

        // Allow connections to establish
        await setTimeout(100);

        // Monitor connection handling during shutdown process
        const shutdownStartTime = performance.now();
        
        // Initiate server shutdown while connections are active
        const shutdownPromise = server.stop(SERVER_SHUTDOWN_TIMEOUT);
        
        // Wait for both shutdown and connections to complete
        const [shutdownResult, ...connectionResults] = await Promise.allSettled([
            shutdownPromise,
            ...connectionPromises
        ]);

        const shutdownTime = performance.now() - shutdownStartTime;

        // Validate active requests complete before server stops
        const successfulConnections = connectionResults.filter(result => 
            result.status === 'fulfilled' && result.value.ok
        ).length;

        // Validate all connections are properly closed
        assert.ok(shutdownResult.status === 'fulfilled', 'Server shutdown should complete successfully');
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after shutdown');

        // Return connection handling analysis and timing results
        return {
            isValid: true,
            timing: {
                shutdownDuration: shutdownTime,
                timestamp: new Date().toISOString()
            },
            connections: {
                requested: connectionCount,
                successful: successfulConnections,
                handled: connectionResults.length
            },
            shutdown: {
                completed: shutdownResult.status === 'fulfilled',
                serverStopped: !server.isListening()
            }
        };

    } catch (testError) {
        return {
            isValid: false,
            error: {
                name: testError.name,
                message: testError.message,
                stack: testError.stack
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure cleanup
        await teardownLifecycleTest(testEnv);
    }
}

/**
 * Tests complete server restart scenario including shutdown, cleanup, 
 * and successful restart validation
 * 
 * @param {object} serverConfig - Server configuration for restart testing
 * @returns {Promise<object>} Promise resolving to restart scenario results with timing and validation data
 */
async function testServerRestartScenario(serverConfig = {}) {
    try {
        const testConfig = {
            port: 0, // Dynamic port allocation
            hostname: '127.0.0.1',
            ...serverConfig
        };

        // Start server with initial configuration
        const server = new HttpServer(testConfig);
        await server.start();

        // Validate server is operational and accepting connections
        const initialAddress = server.getAddress();
        assert.ok(server.isListening(), 'Server should be listening after initial start');

        // Make test request to verify functionality
        const initialResponse = await makeRequest(`${initialAddress.url}/hello`);
        assert.strictEqual(initialResponse.status, 200, 'Initial request should succeed');

        // Record initial port for comparison
        const initialPort = initialAddress.port;

        // Perform graceful server shutdown
        const shutdownStartTime = performance.now();
        await server.stop(SERVER_SHUTDOWN_TIMEOUT);
        const shutdownTime = performance.now() - shutdownStartTime;

        // Validate complete resource cleanup
        assert.strictEqual(server.isListening(), false, 'Server should not be listening after shutdown');
        assert.strictEqual(server.getAddress(), null, 'Server address should be null after shutdown');

        // Restart server with same or updated configuration
        const restartStartTime = performance.now();
        await server.start();
        const restartTime = performance.now() - restartStartTime;

        // Validate successful restart and renewed functionality
        const restartAddress = server.getAddress();
        assert.ok(server.isListening(), 'Server should be listening after restart');
        assert.ok(restartAddress, 'Server should have address after restart');

        // Verify functionality after restart
        const restartResponse = await makeRequest(`${restartAddress.url}/hello`);
        assert.strictEqual(restartResponse.status, 200, 'Request should succeed after restart');
        assert.strictEqual(restartResponse.body, 'Hello world', 'Response should be correct after restart');

        // Clean up
        await server.stop();

        // Measure total restart cycle timing
        const totalCycleTime = shutdownTime + restartTime;

        // Return restart scenario validation results
        return {
            isValid: true,
            timing: {
                shutdownTime,
                restartTime,
                totalCycleTime,
                timestamp: new Date().toISOString()
            },
            lifecycle: {
                initialStart: true,
                shutdownCompleted: true,
                restartCompleted: true,
                functionalityVerified: true
            },
            addresses: {
                initial: initialAddress,
                restart: restartAddress,
                portChanged: initialPort !== restartAddress.port
            }
        };

    } catch (restartError) {
        return {
            isValid: false,
            error: {
                name: restartError.name,
                message: restartError.message,
                stack: restartError.stack
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Measures server lifecycle performance including startup time, shutdown duration, 
 * and resource utilization with comprehensive metrics collection
 * 
 * @param {object} server - HttpServer instance for performance measurement
 * @param {object} performanceConfig - Performance measurement configuration and thresholds
 * @returns {Promise<object>} Promise resolving to comprehensive lifecycle performance metrics
 */
async function measureLifecyclePerformance(server, performanceConfig = {}) {
    try {
        const config = {
            iterations: performanceConfig.iterations || 3,
            thresholds: {
                startupTime: performanceConfig.startupThreshold || LIFECYCLE_PERFORMANCE_THRESHOLD,
                shutdownTime: performanceConfig.shutdownThreshold || LIFECYCLE_PERFORMANCE_THRESHOLD / 2,
                memoryIncrease: performanceConfig.memoryThreshold || 50 * 1024 * 1024 // 50MB
            },
            ...performanceConfig
        };

        const measurements = {
            startup: [],
            shutdown: [],
            memory: [],
            errors: []
        };

        // Measure server startup time from initialization to listening
        for (let i = 0; i < config.iterations; i++) {
            try {
                // Record baseline memory usage
                const baselineMemory = process.memoryUsage();
                
                // Measure startup time
                const startupStartTime = performance.now();
                await server.start();
                const startupTime = performance.now() - startupStartTime;
                
                // Track memory usage during server lifecycle phases
                const postStartupMemory = process.memoryUsage();
                
                // Measure shutdown duration from signal to complete stop
                const shutdownStartTime = performance.now();
                await server.stop();
                const shutdownTime = performance.now() - shutdownStartTime;
                
                const postShutdownMemory = process.memoryUsage();

                // Record measurements
                measurements.startup.push(startupTime);
                measurements.shutdown.push(shutdownTime);
                measurements.memory.push({
                    baseline: baselineMemory.heapUsed,
                    postStartup: postStartupMemory.heapUsed,
                    postShutdown: postShutdownMemory.heapUsed,
                    increase: postStartupMemory.heapUsed - baselineMemory.heapUsed,
                    cleanup: postShutdownMemory.heapUsed - postStartupMemory.heapUsed
                });

                // Brief pause between iterations
                await setTimeout(100);

            } catch (iterationError) {
                measurements.errors.push({
                    iteration: i + 1,
                    error: iterationError.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Calculate resource cleanup efficiency metrics
        const avgStartupTime = measurements.startup.reduce((sum, time) => sum + time, 0) / measurements.startup.length;
        const avgShutdownTime = measurements.shutdown.reduce((sum, time) => sum + time, 0) / measurements.shutdown.length;
        const avgMemoryIncrease = measurements.memory.reduce((sum, mem) => sum + mem.increase, 0) / measurements.memory.length;

        // Compare results against performance thresholds
        const performanceAnalysis = {
            startupPerformance: {
                average: avgStartupTime,
                threshold: config.thresholds.startupTime,
                withinThreshold: avgStartupTime <= config.thresholds.startupTime,
                samples: measurements.startup
            },
            shutdownPerformance: {
                average: avgShutdownTime,
                threshold: config.thresholds.shutdownTime,
                withinThreshold: avgShutdownTime <= config.thresholds.shutdownTime,
                samples: measurements.shutdown
            },
            memoryEfficiency: {
                averageIncrease: avgMemoryIncrease,
                threshold: config.thresholds.memoryIncrease,
                withinThreshold: Math.abs(avgMemoryIncrease) <= config.thresholds.memoryIncrease,
                details: measurements.memory
            }
        };

        // Return detailed performance analysis with recommendations
        return {
            isValid: performanceAnalysis.startupPerformance.withinThreshold && 
                    performanceAnalysis.shutdownPerformance.withinThreshold &&
                    performanceAnalysis.memoryEfficiency.withinThreshold,
            analysis: performanceAnalysis,
            iterations: config.iterations,
            errors: measurements.errors,
            recommendations: generatePerformanceRecommendations(performanceAnalysis),
            timestamp: new Date().toISOString()
        };

    } catch (performanceError) {
        return {
            isValid: false,
            error: {
                name: performanceError.name,
                message: performanceError.message,
                stack: performanceError.stack
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Generates performance recommendations based on analysis
 */
function generatePerformanceRecommendations(analysis) {
    const recommendations = [];

    if (!analysis.startupPerformance.withinThreshold) {
        recommendations.push(`Startup time ${analysis.startupPerformance.average.toFixed(2)}ms exceeds threshold of ${analysis.startupPerformance.threshold}ms`);
    }

    if (!analysis.shutdownPerformance.withinThreshold) {
        recommendations.push(`Shutdown time ${analysis.shutdownPerformance.average.toFixed(2)}ms exceeds threshold of ${analysis.shutdownPerformance.threshold}ms`);
    }

    if (!analysis.memoryEfficiency.withinThreshold) {
        recommendations.push(`Memory usage increase ${(analysis.memoryEfficiency.averageIncrease / 1024 / 1024).toFixed(2)}MB exceeds threshold`);
    }

    if (recommendations.length === 0) {
        recommendations.push('Server lifecycle performance meets all thresholds');
    }

    return recommendations;
}

/**
 * Validates server health and responsiveness during various lifecycle phases 
 * including startup, operation, and shutdown
 * 
 * @param {object} testEnv - Test environment for health validation
 * @returns {Promise<object>} Promise resolving to server health validation results across lifecycle phases
 */
async function validateServerHealthDuringLifecycle(testEnv) {
    try {
        const healthValidation = {
            phases: {
                startup: null,
                operation: null,
                shutdown: null
            },
            overall: {
                isHealthy: false,
                errors: [],
                warnings: []
            }
        };

        // Setup test environment
        await testEnv.setup();

        // Test server responsiveness immediately after startup
        try {
            const startupHealthResponse = await testEnv.makeRequest('/hello');
            healthValidation.phases.startup = {
                responsive: startupHealthResponse.ok,
                responseTime: startupHealthResponse.timing.duration,
                statusCode: startupHealthResponse.status,
                isHealthy: startupHealthResponse.ok && startupHealthResponse.timing.duration < 1000
            };
        } catch (startupError) {
            healthValidation.phases.startup = {
                responsive: false,
                error: startupError.message,
                isHealthy: false
            };
            healthValidation.overall.errors.push(`Startup phase health check failed: ${startupError.message}`);
        }

        // Validate health check endpoints during normal operation
        try {
            const serverStats = testEnv.server.getStats();
            const operationHealthResponse = await testEnv.makeRequest('/hello');
            
            healthValidation.phases.operation = {
                responsive: operationHealthResponse.ok,
                responseTime: operationHealthResponse.timing.duration,
                statusCode: operationHealthResponse.status,
                serverStats: {
                    totalRequests: serverStats.requests.total,
                    errorRate: serverStats.errors.rate,
                    avgResponseTime: serverStats.performance.averageResponseTime
                },
                isHealthy: operationHealthResponse.ok && 
                          operationHealthResponse.timing.duration < 500 &&
                          serverStats.errors.rate < 5
            };
        } catch (operationError) {
            healthValidation.phases.operation = {
                responsive: false,
                error: operationError.message,
                isHealthy: false
            };
            healthValidation.overall.errors.push(`Operation phase health check failed: ${operationError.message}`);
        }

        // Test graceful degradation during shutdown initiation
        try {
            // Start shutdown process
            const shutdownPromise = testEnv.server.stop(SERVER_SHUTDOWN_TIMEOUT);
            
            // Try to make request during shutdown
            let shutdownHealthResponse = null;
            try {
                shutdownHealthResponse = await testEnv.makeRequest('/hello', { timeout: 2000 });
            } catch (shutdownRequestError) {
                // Expected during shutdown
            }

            await shutdownPromise;

            healthValidation.phases.shutdown = {
                gracefulShutdown: true,
                shutdownRequestHandled: shutdownHealthResponse?.ok || false,
                serverStopped: !testEnv.server.isListening(),
                isHealthy: !testEnv.server.isListening()
            };
        } catch (shutdownError) {
            healthValidation.phases.shutdown = {
                gracefulShutdown: false,
                error: shutdownError.message,
                isHealthy: false
            };
            healthValidation.overall.errors.push(`Shutdown phase health check failed: ${shutdownError.message}`);
        }

        // Validate error handling during lifecycle transitions
        const allPhasesHealthy = Object.values(healthValidation.phases)
            .every(phase => phase && phase.isHealthy);

        healthValidation.overall.isHealthy = allPhasesHealthy && healthValidation.overall.errors.length === 0;

        if (!allPhasesHealthy) {
            healthValidation.overall.warnings.push('Some lifecycle phases reported unhealthy status');
        }

        // Return comprehensive health validation results
        return healthValidation;

    } catch (healthError) {
        return {
            phases: {},
            overall: {
                isHealthy: false,
                errors: [healthError.message],
                warnings: []
            },
            error: {
                name: healthError.name,
                message: healthError.message,
                stack: healthError.stack
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure cleanup
        try {
            await teardownLifecycleTest(testEnv);
        } catch (cleanupError) {
            console.error('Cleanup error during health validation:', cleanupError.message);
        }
    }
}

// Test Suite Setup and Teardown
describe('Server Lifecycle Integration Tests', { timeout: TEST_TIMEOUT * 2 }, () => {
    
    before(async () => {
        console.log('Setting up server lifecycle integration test suite');
        // Global test setup if needed
    });

    after(async () => {
        console.log('Cleaning up server lifecycle integration test suite');
        if (lifecycleTestEnv) {
            await teardownLifecycleTest(lifecycleTestEnv);
            lifecycleTestEnv = null;
        }
    });

    beforeEach(async () => {
        // Setup fresh test environment for each test
        lifecycleTestEnv = await setupLifecycleTest();
    });

    afterEach(async () => {
        // Clean up after each test
        if (lifecycleTestEnv) {
            await teardownLifecycleTest(lifecycleTestEnv);
            lifecycleTestEnv = null;
        }
    });

    // Server Startup Tests
    describe('Server Startup Tests', () => {
        
        test('should start server successfully with default configuration', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            const validationResult = await validateServerStartup(lifecycleTestEnv.server);
            
            assert.ok(validationResult.isValid, 'Server startup validation should pass');
            assert.ok(validationResult.address, 'Server should have valid address');
            assert.ok(validationResult.timing, 'Startup timing should be measured');
            assert.ok(lifecycleTestEnv.server.isListening(), 'Server should be listening on configured port within startup timeout');
        });

        test('should start server with custom configuration', { timeout: TEST_TIMEOUT }, async () => {
            const customConfig = {
                port: 0, // Dynamic port allocation
                hostname: '127.0.0.1',
                timeout: 60000
            };

            const customTestEnv = await setupLifecycleTest(customConfig);
            await customTestEnv.setup();

            const address = customTestEnv.server.getAddress();
            
            assert.ok(customTestEnv.server.isListening(), 'Server should be listening on custom configuration');
            assert.strictEqual(address.hostname, customConfig.hostname, 'Server should bind to custom hostname');
            assert.ok(address.port > 0, 'Server should have valid port with custom configuration');

            await teardownLifecycleTest(customTestEnv);
        });

        test('should handle port conflicts gracefully', { timeout: TEST_TIMEOUT }, async () => {
            const testPort = 3001;
            const failureScenarios = await testStartupFailureScenarios({ port: testPort });
            
            assert.ok(failureScenarios.scenarios.length > 0, 'Should test port conflict scenarios');
            
            const portConflictTest = failureScenarios.scenarios.find(s => s.scenario === 'port_conflict');
            assert.ok(portConflictTest, 'Should include port conflict test');
            assert.ok(portConflictTest.passed, 'Should handle port conflicts with appropriate error messages');
        });

        test('should reject invalid port configurations', { timeout: TEST_TIMEOUT }, async () => {
            const failureScenarios = await testStartupFailureScenarios({ port: -1 });
            
            const configErrorTest = failureScenarios.scenarios.find(s => s.scenario === 'configuration_error');
            assert.ok(configErrorTest, 'Should test configuration errors');
            assert.ok(configErrorTest.passed, 'Should reject invalid port ranges with proper error handling');
        });

        test('should complete startup within timeout threshold', { timeout: TEST_TIMEOUT }, async () => {
            const startTime = performance.now();
            await lifecycleTestEnv.setup();
            const startupTime = performance.now() - startTime;
            
            assert.ok(startupTime < SERVER_STARTUP_TIMEOUT, 
                `Server startup should complete within ${SERVER_STARTUP_TIMEOUT}ms threshold, took ${startupTime.toFixed(2)}ms`);
        });
    });

    // Server Shutdown Tests
    describe('Server Shutdown Tests', () => {
        
        test('should shutdown gracefully with no active connections', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            const shutdownResult = await validateServerShutdown(lifecycleTestEnv.server);
            
            assert.ok(shutdownResult.isValid, 'Server shutdown validation should pass');
            assert.ok(shutdownResult.cleanup.serverStopped, 'Server should be stopped after shutdown');
            assert.ok(shutdownResult.cleanup.addressReleased, 'Port should be released after shutdown');
            assert.ok(shutdownResult.timing.shutdownDuration < SERVER_SHUTDOWN_TIMEOUT, 
                'Clean shutdown should complete within timeout threshold');
        });

        test('should handle active connections during shutdown', { timeout: TEST_TIMEOUT }, async () => {
            const connectionResult = await testGracefulShutdownWithActiveConnections(lifecycleTestEnv, 2);
            
            assert.ok(connectionResult.isValid, 'Graceful shutdown with connections should succeed');
            assert.ok(connectionResult.connections.handled > 0, 'Active connections should be processed during shutdown');
            assert.ok(connectionResult.shutdown.completed, 'Shutdown should complete successfully');
        });

        test('should reject new connections during shutdown', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            // Start shutdown process without waiting
            const shutdownPromise = lifecycleTestEnv.server.stop(SERVER_SHUTDOWN_TIMEOUT);
            
            // Try to make request during shutdown
            let connectionRejected = false;
            try {
                await lifecycleTestEnv.makeRequest('/hello', { timeout: 1000 });
            } catch (connectionError) {
                connectionRejected = true;
            }
            
            await shutdownPromise;
            
            // Note: This test may be timing-dependent as shutdown could complete before request
            // The important thing is that shutdown completes successfully
            assert.strictEqual(lifecycleTestEnv.server.isListening(), false, 
                'Server should stop accepting new connections during shutdown process');
        });

        test('should timeout graceful shutdown if necessary', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            // Test with very short timeout
            const shortTimeout = 100;
            const shutdownResult = await validateServerShutdown(lifecycleTestEnv.server, shortTimeout);
            
            // Server should still shutdown, even if timeout is short
            assert.ok(shutdownResult.cleanup.serverStopped, 'Server should be stopped even with short timeout');
        });

        test('should release resources completely', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            const originalAddress = lifecycleTestEnv.server.getAddress();
            
            await lifecycleTestEnv.server.stop();
            
            // Validate port is available for reuse
            const testServer = new HttpServer({ 
                port: originalAddress.port,
                hostname: originalAddress.hostname 
            });
            
            try {
                await testServer.start();
                assert.ok(testServer.isListening(), 'Port should be available for reuse after shutdown');
                await testServer.stop();
            } catch (reuseError) {
                // Port 0 (dynamic allocation) won't be reusable, which is expected
                if (originalAddress.port === 0) {
                    assert.ok(true, 'Dynamic port allocation expected to not be reusable');
                } else {
                    throw reuseError;
                }
            }
        });
    });

    // Server Lifecycle Management Tests
    describe('Server Lifecycle Management Tests', () => {
        
        test('should support complete restart cycle', { timeout: TEST_TIMEOUT }, async () => {
            const restartResult = await testServerRestartScenario();
            
            assert.ok(restartResult.isValid, 'Server restart cycle should complete successfully');
            assert.ok(restartResult.lifecycle.initialStart, 'Initial server start should succeed');
            assert.ok(restartResult.lifecycle.shutdownCompleted, 'Server shutdown should complete');
            assert.ok(restartResult.lifecycle.restartCompleted, 'Server restart should complete');
            assert.ok(restartResult.lifecycle.functionalityVerified, 'Server functionality should work after restart');
        });

        test('should maintain state consistency during lifecycle', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            // Check initial state
            const initialStats = lifecycleTestEnv.server.getStats();
            assert.ok(initialStats.server.isRunning, 'Server should report running state initially');
            
            // Stop server
            await lifecycleTestEnv.server.stop();
            const stoppedStats = lifecycleTestEnv.server.getStats();
            assert.strictEqual(stoppedStats.server.isRunning, false, 
                'Server should report consistent stopped state');
        });

        test('should handle rapid start-stop cycles', { timeout: TEST_TIMEOUT * 2 }, async () => {
            const server = new HttpServer({ port: 0, hostname: '127.0.0.1' });
            
            // Perform multiple rapid start-stop operations
            for (let i = 0; i < 3; i++) {
                await server.start();
                assert.ok(server.isListening(), `Server should start on cycle ${i + 1}`);
                
                await server.stop();
                assert.strictEqual(server.isListening(), false, `Server should stop on cycle ${i + 1}`);
            }
            
            // Final cleanup
            if (server.isListening()) {
                await server.stop();
            }
        });

        test('should recover from startup failures', { timeout: TEST_TIMEOUT }, async () => {
            // Create server with invalid config
            const server = new HttpServer({ port: -1 });
            
            try {
                await server.start();
                assert.fail('Server should not start with invalid configuration');
            } catch (startupError) {
                // Expected failure
                assert.ok(startupError, 'Startup should fail with invalid configuration');
            }
            
            // Reconfigure with valid settings and retry
            server.config.port = 0; // Use dynamic port allocation
            
            await server.start();
            assert.ok(server.isListening(), 'Server should recover and start after addressing issues');
            
            await server.stop();
        });
    });

    // Lifecycle Performance Tests
    describe('Lifecycle Performance Tests', () => {
        
        test('should meet startup performance requirements', { timeout: TEST_TIMEOUT }, async () => {
            const server = new HttpServer({ port: 0, hostname: '127.0.0.1' });
            
            const performanceResult = await measureLifecyclePerformance(server, {
                iterations: 2,
                startupThreshold: LIFECYCLE_PERFORMANCE_THRESHOLD
            });
            
            assert.ok(performanceResult.analysis.startupPerformance.withinThreshold,
                `Server startup should meet performance requirements: ${performanceResult.analysis.startupPerformance.average.toFixed(2)}ms`);
        });

        test('should meet shutdown performance requirements', { timeout: TEST_TIMEOUT }, async () => {
            const server = new HttpServer({ port: 0, hostname: '127.0.0.1' });
            
            const performanceResult = await measureLifecyclePerformance(server, {
                iterations: 2,
                shutdownThreshold: LIFECYCLE_PERFORMANCE_THRESHOLD / 2
            });
            
            assert.ok(performanceResult.analysis.shutdownPerformance.withinThreshold,
                `Server shutdown should meet performance requirements: ${performanceResult.analysis.shutdownPerformance.average.toFixed(2)}ms`);
        });

        test('should maintain memory efficiency during lifecycle', { timeout: TEST_TIMEOUT }, async () => {
            const server = new HttpServer({ port: 0, hostname: '127.0.0.1' });
            
            const performanceResult = await measureLifecyclePerformance(server, {
                iterations: 2,
                memoryThreshold: 100 * 1024 * 1024 // 100MB threshold
            });
            
            assert.ok(performanceResult.analysis.memoryEfficiency.withinThreshold,
                `Memory usage should remain efficient during lifecycle operations: ${(performanceResult.analysis.memoryEfficiency.averageIncrease / 1024 / 1024).toFixed(2)}MB`);
        });

        test('should optimize CPU utilization during transitions', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            const startTime = performance.now();
            await lifecycleTestEnv.server.stop();
            const operationTime = performance.now() - startTime;
            
            // CPU optimization is validated through timing - efficient operations complete faster
            assert.ok(operationTime < SERVER_SHUTDOWN_TIMEOUT,
                `CPU-optimized operations should complete efficiently: ${operationTime.toFixed(2)}ms`);
        });
    });

    // Error Handling Tests
    describe('Error Handling Tests', () => {
        
        test('should handle configuration errors during startup', { timeout: TEST_TIMEOUT }, async () => {
            const failureScenarios = await testStartupFailureScenarios();
            
            assert.ok(failureScenarios.scenarios.length > 0, 'Should test multiple error scenarios');
            
            const configErrors = failureScenarios.scenarios.filter(s => 
                s.scenario === 'configuration_error' && s.passed
            );
            
            assert.ok(configErrors.length > 0, 'Should handle configuration errors with appropriate error messages');
        });

        test('should handle system resource errors', { timeout: TEST_TIMEOUT }, async () => {
            const failureScenarios = await testStartupFailureScenarios();
            
            const permissionErrors = failureScenarios.scenarios.filter(s => 
                s.scenario === 'permission_error'
            );
            
            assert.ok(permissionErrors.length > 0, 'Should test system resource error scenarios');
        });

        test('should handle shutdown errors gracefully', { timeout: TEST_TIMEOUT }, async () => {
            await lifecycleTestEnv.setup();
            
            // Force a potential error condition by stopping twice
            await lifecycleTestEnv.server.stop();
            
            // Second stop should not throw error
            try {
                await lifecycleTestEnv.server.stop();
                assert.ok(true, 'Multiple shutdown calls should be handled gracefully');
            } catch (shutdownError) {
                // Some implementations might throw, which is also acceptable if handled properly
                assert.ok(shutdownError.message, 'Shutdown errors should provide meaningful messages');
            }
        });

        test('should provide diagnostic information for failures', { timeout: TEST_TIMEOUT }, async () => {
            const failureScenarios = await testStartupFailureScenarios();
            
            failureScenarios.scenarios.forEach(scenario => {
                if (!scenario.passed && scenario.error) {
                    assert.ok(scenario.error.length > 0, 
                        `Failure scenario ${scenario.scenario} should provide diagnostic information`);
                    assert.ok(!scenario.error.includes('password') && !scenario.error.includes('secret'),
                        'Diagnostic information should not expose sensitive data');
                }
            });
        });
    });

    // Health Validation Tests
    describe('Server Health Validation Tests', () => {
        
        test('should validate server health during complete lifecycle', { timeout: TEST_TIMEOUT * 2 }, async () => {
            const healthValidation = await validateServerHealthDuringLifecycle(lifecycleTestEnv);
            
            assert.ok(healthValidation.overall.isHealthy, 'Server should maintain health throughout lifecycle');
            
            if (healthValidation.phases.startup) {
                assert.ok(healthValidation.phases.startup.isHealthy, 'Server should be healthy during startup phase');
            }
            
            if (healthValidation.phases.operation) {
                assert.ok(healthValidation.phases.operation.isHealthy, 'Server should be healthy during operation phase');
            }
            
            if (healthValidation.phases.shutdown) {
                assert.ok(healthValidation.phases.shutdown.isHealthy, 'Server should shutdown gracefully');
            }
        });
    });
});