// Node.js Tutorial HTTP Server - Comprehensive End-to-End Workflow Test Suite
// Validates complete application workflow from startup to shutdown with educational testing patterns
// Uses Node.js built-in test runner for zero-dependency testing approach

// Node.js built-in module imports for comprehensive testing capabilities
import { test, describe, before, after } from 'node:test'; // Built-in Node.js test runner - stable
import assert from 'node:assert/strict'; // Built-in Node.js strict assertions - stable
import { performance } from 'node:perf_hooks'; // Built-in Node.js performance monitoring - stable
import { setTimeout } from 'node:timers/promises'; // Built-in Node.js promisified timers - stable

// Internal test infrastructure imports for comprehensive test environment management
import { TestEnvironment } from '../fixtures/test-helpers.js';
import { testData, validRequests, invalidRequests, expectedResponses, performanceData } from '../fixtures/test-data.js';
import { logger } from '../../lib/logger.js';

// Global test configuration constants for consistent test execution
const TEST_TIMEOUT = 30000;
const E2E_TEST_CORRELATION_PREFIX = 'e2e-test-';
const WORKFLOW_TEST_DELAY = 1000;
const MAX_REQUEST_ATTEMPTS = 3;

// Test environment instance for complete workflow testing lifecycle management
let testEnvironment = null;

/**
 * Executes the complete end-to-end workflow test including server startup, request processing,
 * error scenarios, and graceful shutdown with comprehensive validation and timing measurement
 * @param {Object} testEnv - TestEnvironment instance configured for end-to-end testing
 * @returns {Promise<Object>} Promise resolving to complete workflow results including timing, validation results, and performance metrics
 */
async function runCompleteWorkflow(testEnv) {
    // Log workflow test initiation with correlation ID and timestamp
    const workflowCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}workflow-${Date.now()}`;
    logger.info('Initiating complete end-to-end workflow test', {
        correlationId: workflowCorrelationId,
        timestamp: new Date().toISOString(),
        testEnvironment: 'e2e'
    });

    // Start timing measurement for complete workflow execution
    const workflowStartTime = performance.now();
    const workflowResults = {
        correlationId: workflowCorrelationId,
        startTime: workflowStartTime,
        endTime: null,
        totalDuration: null,
        testResults: {},
        performanceMetrics: {},
        validationResults: {},
        errors: []
    };

    try {
        // Execute successful hello endpoint request with validation
        logger.info('Starting hello endpoint workflow test', { correlationId: workflowCorrelationId });
        const helloResults = await testHelloEndpointWorkflow(testEnv);
        workflowResults.testResults.helloEndpoint = helloResults;
        
        // Add delay between test phases for realistic testing conditions
        await setTimeout(WORKFLOW_TEST_DELAY);

        // Execute error scenario requests (404, 405) with error validation
        logger.info('Starting error handling workflow test', { correlationId: workflowCorrelationId });
        const errorResults = await testErrorHandlingWorkflow(testEnv);
        workflowResults.testResults.errorHandling = errorResults;

        // Add delay for server stabilization between test phases
        await setTimeout(WORKFLOW_TEST_DELAY);

        // Measure and validate response times against performance thresholds
        logger.info('Starting performance measurement workflow', { correlationId: workflowCorrelationId });
        const performanceResults = await measureWorkflowPerformance(
            () => testHelloEndpointWorkflow(testEnv),
            { iterations: 10, maxDuration: performanceData.responseTimeThresholds.critical }
        );
        workflowResults.performanceMetrics = performanceResults;

        // Validate server health and status throughout workflow execution
        logger.info('Starting server lifecycle validation', { correlationId: workflowCorrelationId });
        const lifecycleResults = await validateServerLifecycle(testEnv);
        workflowResults.testResults.serverLifecycle = lifecycleResults;

        // Execute graceful shutdown and validate clean resource cleanup
        // Note: Graceful shutdown is handled by the TestEnvironment teardown process
        logger.info('Workflow execution completed successfully', { correlationId: workflowCorrelationId });

        // Calculate total workflow time and performance metrics
        const workflowEndTime = performance.now();
        const totalWorkflowTime = workflowEndTime - workflowStartTime;
        workflowResults.endTime = workflowEndTime;
        workflowResults.totalDuration = totalWorkflowTime;

        // Generate validation summary based on all test results
        const validationSummary = {
            helloEndpointValid: helloResults.isValid,
            errorHandlingValid: errorResults.isValid,
            performanceValid: performanceResults.validation?.durationWithinThreshold || false,
            lifecycleValid: lifecycleResults.isValid,
            overallValid: true
        };

        // Determine overall workflow validation status
        validationSummary.overallValid = Object.values(validationSummary).every(result => result === true);
        workflowResults.validationResults = validationSummary;

        // Log comprehensive workflow completion with metrics
        logger.info('Complete workflow test finished successfully', {
            correlationId: workflowCorrelationId,
            totalDuration: `${totalWorkflowTime.toFixed(2)}ms`,
            validationResults: validationSummary,
            performanceMetrics: {
                averageResponseTime: performanceResults.statistics?.duration?.average || 0,
                totalRequests: testEnv.getStats().requests.total
            }
        });

        // Return comprehensive workflow results with validation status and metrics
        return workflowResults;

    } catch (workflowError) {
        // Handle workflow errors with comprehensive error logging and reporting
        const workflowEndTime = performance.now();
        const totalWorkflowTime = workflowEndTime - workflowStartTime;
        
        workflowResults.endTime = workflowEndTime;
        workflowResults.totalDuration = totalWorkflowTime;
        workflowResults.errors.push({
            message: workflowError.message,
            stack: workflowError.stack,
            timestamp: new Date().toISOString()
        });

        logger.error('Complete workflow test failed', {
            correlationId: workflowCorrelationId,
            error: workflowError.message,
            totalDuration: `${totalWorkflowTime.toFixed(2)}ms`,
            testResults: workflowResults.testResults
        });

        throw workflowError;
    }
}

/**
 * Tests the complete hello endpoint workflow including request processing, response validation,
 * and performance measurement for successful request scenarios
 * @param {Object} testEnv - TestEnvironment instance for making HTTP requests
 * @returns {Promise<Object>} Promise resolving to hello endpoint test results with response validation and timing information
 */
async function testHelloEndpointWorkflow(testEnv) {
    // Generate unique correlation ID for hello endpoint test tracking
    const helloCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}hello-${Date.now()}`;
    logger.debug('Starting hello endpoint workflow test', { correlationId: helloCorrelationId });

    // Start high-resolution timing measurement for request processing
    const requestStartTime = performance.now();
    const testResults = {
        correlationId: helloCorrelationId,
        isValid: true,
        errors: [],
        warnings: [],
        timing: {},
        response: null,
        validation: null
    };

    try {
        // Make HTTP GET request to /hello endpoint using test environment
        const response = await testEnv.makeRequest('/hello', {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
                'User-Agent': 'E2E Test Client/1.0.0',
                'X-Correlation-ID': helloCorrelationId
            },
            timeout: 5000
        });

        testResults.response = response;
        testResults.timing = response.timing;

        // Validate response status code is 200 OK using strict assertion
        if (response.status !== 200) {
            testResults.isValid = false;
            testResults.errors.push(`Expected status 200, got ${response.status}`);
        } else {
            logger.debug('Hello endpoint status validation passed', { correlationId: helloCorrelationId });
        }

        // Validate response headers include correct Content-Type and security headers
        const expectedHeaders = {
            'content-type': expectedResponses.successResponse.headers['Content-Type'].toLowerCase(),
            'content-length': expectedResponses.successResponse.headers['Content-Length'],
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'deny'
        };

        for (const [headerName, expectedValue] of Object.entries(expectedHeaders)) {
            const actualValue = response.headers[headerName];
            if (!actualValue) {
                testResults.isValid = false;
                testResults.errors.push(`Missing required header: ${headerName}`);
            } else if (expectedValue !== '*' && !actualValue.includes && actualValue !== expectedValue) {
                if (actualValue.includes && !actualValue.includes(expectedValue)) {
                    testResults.isValid = false;
                    testResults.errors.push(`Header ${headerName} value mismatch: expected ${expectedValue}, got ${actualValue}`);
                }
            }
        }

        // Validate response body content matches expected 'Hello world' message
        const expectedBody = expectedResponses.successResponse.body;
        if (response.body !== expectedBody) {
            testResults.isValid = false;
            testResults.errors.push(`Body content mismatch: expected "${expectedBody}", got "${response.body}"`);
        } else {
            logger.debug('Hello endpoint body validation passed', { correlationId: helloCorrelationId });
        }

        // Validate response timing meets performance thresholds from test data
        const responseTime = response.timing.duration;
        const performanceThreshold = performanceData.responseTimeThresholds.critical;
        
        if (responseTime > performanceThreshold) {
            testResults.warnings.push(`Response time ${responseTime.toFixed(2)}ms exceeds threshold ${performanceThreshold}ms`);
        }

        // Perform comprehensive response validation using test environment
        const validation = testEnv.validateResponse(response, {
            status: 200,
            headers: expectedHeaders,
            body: expectedBody,
            maxResponseTime: performanceThreshold
        });

        testResults.validation = validation;

        // Calculate final request timing metrics
        const requestEndTime = performance.now();
        testResults.timing.totalTestTime = requestEndTime - requestStartTime;

        // Log successful hello endpoint workflow completion with metrics
        logger.info('Hello endpoint workflow completed', {
            correlationId: helloCorrelationId,
            isValid: testResults.isValid,
            responseTime: `${responseTime.toFixed(2)}ms`,
            totalTestTime: `${testResults.timing.totalTestTime.toFixed(2)}ms`,
            errors: testResults.errors.length,
            warnings: testResults.warnings.length
        });

        // Return test results with validation status and performance data
        return testResults;

    } catch (helloError) {
        // Handle hello endpoint test errors with comprehensive error reporting
        const requestEndTime = performance.now();
        testResults.timing.totalTestTime = requestEndTime - requestStartTime;
        testResults.isValid = false;
        testResults.errors.push(`Hello endpoint test failed: ${helloError.message}`);

        logger.error('Hello endpoint workflow test failed', {
            correlationId: helloCorrelationId,
            error: helloError.message,
            totalTestTime: `${testResults.timing.totalTestTime.toFixed(2)}ms`
        });

        return testResults;
    }
}

/**
 * Tests the complete error handling workflow including 404 Not Found and 405 Method Not Allowed
 * scenarios with proper error response validation and logging
 * @param {Object} testEnv - TestEnvironment instance for making HTTP requests to invalid endpoints
 * @returns {Promise<Object>} Promise resolving to error handling test results with error response validation and timing
 */
async function testErrorHandlingWorkflow(testEnv) {
    // Start error handling workflow test with correlation tracking
    const errorCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}error-${Date.now()}`;
    logger.debug('Starting error handling workflow test', { correlationId: errorCorrelationId });

    const errorTestStartTime = performance.now();
    const errorResults = {
        correlationId: errorCorrelationId,
        isValid: true,
        errors: [],
        warnings: [],
        testScenarios: {},
        timing: {}
    };

    try {
        // Test 404 Not Found scenario by requesting non-existent endpoint
        logger.debug('Testing 404 Not Found scenario', { correlationId: errorCorrelationId });
        const notFoundResponse = await testEnv.makeRequest('/nonexistent', {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
                'X-Correlation-ID': errorCorrelationId
            },
            timeout: 5000
        });

        // Validate 404 response has correct status code and error message
        const notFoundValidation = {
            isValid: true,
            errors: [],
            response: notFoundResponse
        };

        if (notFoundResponse.status !== 404) {
            notFoundValidation.isValid = false;
            notFoundValidation.errors.push(`Expected 404 status, got ${notFoundResponse.status}`);
        }

        if (!notFoundResponse.body.includes('Not Found')) {
            notFoundValidation.isValid = false;
            notFoundValidation.errors.push(`Expected 'Not Found' in response body, got "${notFoundResponse.body}"`);
        }

        errorResults.testScenarios.notFound = notFoundValidation;

        // Test 405 Method Not Allowed scenario by sending POST to /hello endpoint
        logger.debug('Testing 405 Method Not Allowed scenario', { correlationId: errorCorrelationId });
        const methodNotAllowedResponse = await testEnv.makeRequest('/hello', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Correlation-ID': errorCorrelationId
            },
            body: '{"test": "data"}',
            timeout: 5000
        });

        // Validate 405 response includes Allow header and appropriate error message
        const methodValidation = {
            isValid: true,
            errors: [],
            response: methodNotAllowedResponse
        };

        if (methodNotAllowedResponse.status !== 405) {
            methodValidation.isValid = false;
            methodValidation.errors.push(`Expected 405 status, got ${methodNotAllowedResponse.status}`);
        }

        if (!methodNotAllowedResponse.headers.allow || !methodNotAllowedResponse.headers.allow.includes('GET')) {
            methodValidation.isValid = false;
            methodValidation.errors.push(`Missing or incorrect Allow header: ${methodNotAllowedResponse.headers.allow}`);
        }

        if (!methodNotAllowedResponse.body.includes('Method Not Allowed')) {
            methodValidation.isValid = false;
            methodValidation.errors.push(`Expected 'Method Not Allowed' in response body, got "${methodNotAllowedResponse.body}"`);
        }

        errorResults.testScenarios.methodNotAllowed = methodValidation;

        // Validate error response timing is within acceptable thresholds
        const notFoundTiming = notFoundResponse.timing.duration;
        const methodTiming = methodNotAllowedResponse.timing.duration;
        const maxErrorResponseTime = performanceData.responseTimeThresholds.critical * 1.5; // Allow 50% more time for error responses

        if (notFoundTiming > maxErrorResponseTime) {
            errorResults.warnings.push(`404 response time ${notFoundTiming.toFixed(2)}ms exceeds threshold ${maxErrorResponseTime}ms`);
        }

        if (methodTiming > maxErrorResponseTime) {
            errorResults.warnings.push(`405 response time ${methodTiming.toFixed(2)}ms exceeds threshold ${maxErrorResponseTime}ms`);
        }

        // Validate error responses include proper security headers
        const securityHeaders = ['x-content-type-options', 'x-frame-options'];
        
        securityHeaders.forEach(header => {
            if (!notFoundResponse.headers[header]) {
                errorResults.warnings.push(`Missing security header ${header} in 404 response`);
            }
            if (!methodNotAllowedResponse.headers[header]) {
                errorResults.warnings.push(`Missing security header ${header} in 405 response`);
            }
        });

        // Validate error responses do not leak sensitive information
        const sensitivePatterns = [/stack trace/i, /internal error/i, /debug/i, /file path/i];
        
        sensitivePatterns.forEach(pattern => {
            if (pattern.test(notFoundResponse.body)) {
                errorResults.errors.push(`404 response contains sensitive information: ${pattern}`);
                errorResults.isValid = false;
            }
            if (pattern.test(methodNotAllowedResponse.body)) {
                errorResults.errors.push(`405 response contains sensitive information: ${pattern}`);
                errorResults.isValid = false;
            }
        });

        // Determine overall error handling validation status
        const allScenariosValid = Object.values(errorResults.testScenarios).every(scenario => scenario.isValid);
        errorResults.isValid = allScenariosValid && errorResults.errors.length === 0;

        // Calculate error handling test timing
        const errorTestEndTime = performance.now();
        errorResults.timing = {
            totalTestTime: errorTestEndTime - errorTestStartTime,
            notFoundResponseTime: notFoundTiming,
            methodNotAllowedResponseTime: methodTiming
        };

        // Log error handling workflow completion with validation results
        logger.info('Error handling workflow completed', {
            correlationId: errorCorrelationId,
            isValid: errorResults.isValid,
            totalTestTime: `${errorResults.timing.totalTestTime.toFixed(2)}ms`,
            scenarios: {
                notFound: notFoundValidation.isValid,
                methodNotAllowed: methodValidation.isValid
            },
            errors: errorResults.errors.length,
            warnings: errorResults.warnings.length
        });

        // Return comprehensive error handling test results with metrics
        return errorResults;

    } catch (errorHandlingError) {
        // Handle error handling test failures with comprehensive error reporting
        const errorTestEndTime = performance.now();
        errorResults.timing.totalTestTime = errorTestEndTime - errorTestStartTime;
        errorResults.isValid = false;
        errorResults.errors.push(`Error handling workflow failed: ${errorHandlingError.message}`);

        logger.error('Error handling workflow test failed', {
            correlationId: errorCorrelationId,
            error: errorHandlingError.message,
            totalTestTime: `${errorResults.timing.totalTestTime.toFixed(2)}ms`
        });

        return errorResults;
    }
}

/**
 * Validates the complete server lifecycle including startup, health monitoring, request processing
 * capability, and graceful shutdown procedures
 * @param {Object} testEnv - TestEnvironment instance for server lifecycle testing
 * @returns {Promise<Object>} Promise resolving to server lifecycle validation results with startup, runtime, and shutdown metrics
 */
async function validateServerLifecycle(testEnv) {
    // Start server lifecycle validation with correlation tracking
    const lifecycleCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}lifecycle-${Date.now()}`;
    logger.debug('Starting server lifecycle validation', { correlationId: lifecycleCorrelationId });

    const lifecycleStartTime = performance.now();
    const lifecycleResults = {
        correlationId: lifecycleCorrelationId,
        isValid: true,
        errors: [],
        warnings: [],
        validationChecks: {},
        timing: {}
    };

    try {
        // Validate server startup completed successfully without errors
        const serverStats = testEnv.getStats();
        
        lifecycleResults.validationChecks.startupValidation = {
            isValid: serverStats.environment.isSetup,
            serverUrl: serverStats.environment.serverUrl,
            uptime: serverStats.timing.uptime
        };

        if (!serverStats.environment.isSetup) {
            lifecycleResults.isValid = false;
            lifecycleResults.errors.push('Server startup validation failed - environment not properly setup');
        }

        // Check server is listening on assigned port and responding to connections
        const connectivityTest = await testEnv.makeRequest('/hello', {
            method: 'GET',
            headers: { 'X-Correlation-ID': lifecycleCorrelationId },
            timeout: 3000
        });

        lifecycleResults.validationChecks.connectivityTest = {
            isValid: connectivityTest.ok || connectivityTest.status === 200,
            responseTime: connectivityTest.timing.duration,
            status: connectivityTest.status
        };

        if (!lifecycleResults.validationChecks.connectivityTest.isValid) {
            lifecycleResults.errors.push(`Server connectivity test failed: status ${connectivityTest.status}`);
            lifecycleResults.isValid = false;
        }

        // Validate server can process multiple concurrent requests correctly
        const concurrentRequestPromises = [];
        const concurrentRequestCount = 5;
        
        for (let i = 0; i < concurrentRequestCount; i++) {
            concurrentRequestPromises.push(
                testEnv.makeRequest('/hello', {
                    method: 'GET',
                    headers: { 
                        'X-Correlation-ID': `${lifecycleCorrelationId}-concurrent-${i}`,
                        'X-Request-Number': i.toString()
                    },
                    timeout: 5000
                })
            );
        }

        const concurrentResponses = await Promise.all(concurrentRequestPromises);
        const successfulConcurrentRequests = concurrentResponses.filter(r => r.ok || r.status === 200).length;
        
        lifecycleResults.validationChecks.concurrentProcessing = {
            totalRequests: concurrentRequestCount,
            successfulRequests: successfulConcurrentRequests,
            isValid: successfulConcurrentRequests === concurrentRequestCount,
            averageResponseTime: concurrentResponses.reduce((sum, r) => sum + r.timing.duration, 0) / concurrentResponses.length
        };

        if (!lifecycleResults.validationChecks.concurrentProcessing.isValid) {
            lifecycleResults.errors.push(`Concurrent processing test failed: ${successfulConcurrentRequests}/${concurrentRequestCount} requests successful`);
            lifecycleResults.isValid = false;
        }

        // Check server maintains stable performance under normal load conditions
        const performanceValidation = {
            averageResponseTime: serverStats.performance.averageResponseTime,
            requestCount: serverStats.requests.total,
            errorRate: serverStats.requests.failed / Math.max(serverStats.requests.total, 1),
            isValid: true
        };

        if (performanceValidation.averageResponseTime > performanceData.responseTimeThresholds.critical) {
            performanceValidation.isValid = false;
            lifecycleResults.warnings.push(`Average response time ${performanceValidation.averageResponseTime.toFixed(2)}ms exceeds threshold`);
        }

        if (performanceValidation.errorRate > 0.05) { // 5% error rate threshold
            performanceValidation.isValid = false;
            lifecycleResults.errors.push(`Error rate ${(performanceValidation.errorRate * 100).toFixed(2)}% exceeds 5% threshold`);
            lifecycleResults.isValid = false;
        }

        lifecycleResults.validationChecks.performanceStability = performanceValidation;

        // Validate server health endpoints respond correctly if available
        // For this tutorial server, we'll check basic responsiveness
        const healthCheckResult = await testEnv.makeRequest('/hello', {
            method: 'GET',
            headers: { 
                'X-Correlation-ID': `${lifecycleCorrelationId}-health`,
                'Accept': 'text/plain'
            },
            timeout: 2000
        });

        lifecycleResults.validationChecks.healthCheck = {
            isValid: healthCheckResult.ok || healthCheckResult.status === 200,
            responseTime: healthCheckResult.timing.duration,
            status: healthCheckResult.status
        };

        // Test server handles graceful shutdown signal properly
        // Note: We don't actually trigger shutdown here as it would terminate the test
        // Instead, we validate the server's current state and readiness for shutdown
        lifecycleResults.validationChecks.shutdownReadiness = {
            isValid: !serverStats.environment.isShuttingDown,
            activeConnections: serverStats.requests.total - serverStats.requests.successful - serverStats.requests.failed,
            cleanupFunctionsRegistered: serverStats.cleanup?.registeredCleanupFunctions || 0
        };

        // Calculate lifecycle validation timing and metrics
        const lifecycleEndTime = performance.now();
        lifecycleResults.timing = {
            totalValidationTime: lifecycleEndTime - lifecycleStartTime,
            serverUptime: serverStats.timing.uptime,
            requestProcessingTime: serverStats.performance.averageResponseTime
        };

        // Determine overall lifecycle validation status
        const allChecksValid = Object.values(lifecycleResults.validationChecks).every(check => check.isValid);
        lifecycleResults.isValid = allChecksValid && lifecycleResults.errors.length === 0;

        // Log server lifecycle validation completion with comprehensive results
        logger.info('Server lifecycle validation completed', {
            correlationId: lifecycleCorrelationId,
            isValid: lifecycleResults.isValid,
            totalValidationTime: `${lifecycleResults.timing.totalValidationTime.toFixed(2)}ms`,
            validationChecks: Object.keys(lifecycleResults.validationChecks).reduce((acc, key) => {
                acc[key] = lifecycleResults.validationChecks[key].isValid;
                return acc;
            }, {}),
            errors: lifecycleResults.errors.length,
            warnings: lifecycleResults.warnings.length
        });

        // Return comprehensive lifecycle validation results
        return lifecycleResults;

    } catch (lifecycleError) {
        // Handle lifecycle validation errors with comprehensive error reporting
        const lifecycleEndTime = performance.now();
        lifecycleResults.timing.totalValidationTime = lifecycleEndTime - lifecycleStartTime;
        lifecycleResults.isValid = false;
        lifecycleResults.errors.push(`Server lifecycle validation failed: ${lifecycleError.message}`);

        logger.error('Server lifecycle validation failed', {
            correlationId: lifecycleCorrelationId,
            error: lifecycleError.message,
            totalValidationTime: `${lifecycleResults.timing.totalValidationTime.toFixed(2)}ms`
        });

        return lifecycleResults;
    }
}

/**
 * Measures comprehensive performance metrics for the complete workflow including request timing,
 * memory usage, and resource utilization with statistical analysis
 * @param {Function} workflowFunction - Function representing the complete workflow to measure
 * @param {Object} options - Performance measurement options including iterations and thresholds
 * @returns {Promise<Object>} Promise resolving to detailed performance metrics including timing statistics, memory usage, and resource utilization
 */
async function measureWorkflowPerformance(workflowFunction, options = {}) {
    // Initialize performance measurement configuration with defaults
    const performanceCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}performance-${Date.now()}`;
    const iterations = options.iterations || 5;
    const maxDuration = options.maxDuration || performanceData.responseTimeThresholds.critical;
    
    logger.debug('Starting workflow performance measurement', {
        correlationId: performanceCorrelationId,
        iterations,
        maxDuration
    });

    // Initialize performance measurement with baseline memory and resource usage
    const performanceStartTime = performance.now();
    const baselineMemory = process.memoryUsage();
    
    const performanceResults = {
        correlationId: performanceCorrelationId,
        iterations,
        measurements: {
            durations: [],
            memoryUsage: [],
            errors: []
        },
        statistics: null,
        validation: null,
        timing: {}
    };

    try {
        // Execute workflow function multiple times for statistical accuracy
        for (let iteration = 0; iteration < iterations; iteration++) {
            const iterationStartTime = performance.now();
            const iterationMemoryStart = process.memoryUsage();
            
            try {
                // Measure high-resolution timing for each workflow execution iteration
                const iterationResult = await workflowFunction();
                
                const iterationEndTime = performance.now();
                const iterationMemoryEnd = process.memoryUsage();
                
                // Track memory usage changes during workflow execution
                const iterationDuration = iterationEndTime - iterationStartTime;
                const memoryDelta = {
                    heapUsed: iterationMemoryEnd.heapUsed - iterationMemoryStart.heapUsed,
                    heapTotal: iterationMemoryEnd.heapTotal - iterationMemoryStart.heapTotal,
                    rss: iterationMemoryEnd.rss - iterationMemoryStart.rss
                };

                performanceResults.measurements.durations.push(iterationDuration);
                performanceResults.measurements.memoryUsage.push(memoryDelta);

                // Log individual iteration performance for detailed analysis
                logger.debug(`Performance iteration ${iteration + 1} completed`, {
                    correlationId: performanceCorrelationId,
                    duration: `${iterationDuration.toFixed(2)}ms`,
                    memoryDelta: memoryDelta.heapUsed,
                    isValid: iterationResult?.isValid
                });

            } catch (iterationError) {
                // Track iteration errors for performance analysis
                const iterationEndTime = performance.now();
                const iterationDuration = iterationEndTime - iterationStartTime;
                
                performanceResults.measurements.errors.push({
                    iteration: iteration + 1,
                    error: iterationError.message,
                    duration: iterationDuration
                });

                logger.warn(`Performance iteration ${iteration + 1} failed`, {
                    correlationId: performanceCorrelationId,
                    error: iterationError.message,
                    duration: `${iterationDuration.toFixed(2)}ms`
                });
            }

            // Add small delay between iterations to prevent overwhelming the server
            if (iteration < iterations - 1) {
                await setTimeout(100);
            }
        }

        // Calculate statistical metrics including average, minimum, maximum, and percentiles
        const validDurations = performanceResults.measurements.durations;
        const validMemoryUsage = performanceResults.measurements.memoryUsage;
        
        if (validDurations.length === 0) {
            throw new Error('No successful iterations for performance measurement');
        }

        // Sort durations for percentile calculations
        const sortedDurations = [...validDurations].sort((a, b) => a - b);
        
        performanceResults.statistics = {
            duration: {
                min: Math.min(...validDurations),
                max: Math.max(...validDurations),
                average: validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length,
                median: sortedDurations[Math.floor(sortedDurations.length / 2)],
                p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
                p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
                total: validDurations.reduce((sum, d) => sum + d, 0)
            },
            memory: {
                baseline: baselineMemory,
                averageHeapIncrease: validMemoryUsage.reduce((sum, m) => sum + m.heapUsed, 0) / validMemoryUsage.length,
                maxHeapIncrease: Math.max(...validMemoryUsage.map(m => m.heapUsed)),
                averageRssIncrease: validMemoryUsage.reduce((sum, m) => sum + m.rss, 0) / validMemoryUsage.length
            },
            success: {
                successfulIterations: validDurations.length,
                failedIterations: performanceResults.measurements.errors.length,
                successRate: (validDurations.length / iterations) * 100
            }
        };

        // Compare results against performance thresholds from test configuration
        performanceResults.validation = {
            durationWithinThreshold: performanceResults.statistics.duration.average <= maxDuration,
            memoryWithinThreshold: Math.abs(performanceResults.statistics.memory.averageHeapIncrease) <= (50 * 1024 * 1024), // 50MB threshold
            successRateAcceptable: performanceResults.statistics.success.successRate >= 90, // 90% success rate threshold
            thresholds: {
                maxDuration,
                maxMemoryIncrease: 50 * 1024 * 1024,
                minSuccessRate: 90
            }
        };

        // Calculate total performance measurement timing
        const performanceEndTime = performance.now();
        performanceResults.timing = {
            totalMeasurementTime: performanceEndTime - performanceStartTime,
            averageIterationTime: (performanceEndTime - performanceStartTime) / iterations
        };

        // Generate performance report with timing, memory, and resource utilization
        logger.info('Workflow performance measurement completed', {
            correlationId: performanceCorrelationId,
            statistics: {
                averageDuration: `${performanceResults.statistics.duration.average.toFixed(2)}ms`,
                maxDuration: `${performanceResults.statistics.duration.max.toFixed(2)}ms`,
                successRate: `${performanceResults.statistics.success.successRate.toFixed(1)}%`,
                withinThreshold: performanceResults.validation.durationWithinThreshold
            },
            totalMeasurementTime: `${performanceResults.timing.totalMeasurementTime.toFixed(2)}ms`,
            iterations: validDurations.length,
            errors: performanceResults.measurements.errors.length
        });

        // Return comprehensive performance analysis with pass/fail status against thresholds
        return performanceResults;

    } catch (performanceError) {
        // Handle performance measurement errors with comprehensive error reporting
        const performanceEndTime = performance.now();
        performanceResults.timing.totalMeasurementTime = performanceEndTime - performanceStartTime;

        logger.error('Workflow performance measurement failed', {
            correlationId: performanceCorrelationId,
            error: performanceError.message,
            iterations: performanceResults.measurements.durations.length,
            totalMeasurementTime: `${performanceResults.timing.totalMeasurementTime.toFixed(2)}ms`
        });

        return {
            ...performanceResults,
            error: performanceError.message,
            statistics: null,
            validation: null
        };
    }
}

/**
 * Generates comprehensive test report for the complete workflow including all test results,
 * performance metrics, validation outcomes, and educational insights
 * @param {Object} workflowResults - Complete workflow test results from all test scenarios
 * @param {Object} performanceMetrics - Performance measurement results and timing analysis
 * @param {Object} testStats - Test execution statistics and validation results
 * @returns {Object} Comprehensive workflow test report with results, metrics, and educational commentary
 */
function generateWorkflowReport(workflowResults, performanceMetrics, testStats) {
    // Generate comprehensive workflow test report with structured sections
    const reportCorrelationId = `${E2E_TEST_CORRELATION_PREFIX}report-${Date.now()}`;
    
    logger.debug('Generating comprehensive workflow test report', {
        correlationId: reportCorrelationId
    });

    const report = {
        reportId: reportCorrelationId,
        timestamp: new Date().toISOString(),
        summary: {},
        testResults: workflowResults,
        performanceAnalysis: performanceMetrics,
        statistics: testStats,
        educationalInsights: {},
        recommendations: []
    };

    try {
        // Aggregate test results from all workflow scenarios and validation checks
        const testScenarios = {
            helloEndpoint: workflowResults?.testResults?.helloEndpoint?.isValid || false,
            errorHandling: workflowResults?.testResults?.errorHandling?.isValid || false,
            serverLifecycle: workflowResults?.testResults?.serverLifecycle?.isValid || false,
            performance: performanceMetrics?.validation?.durationWithinThreshold || false
        };

        // Calculate overall pass/fail rate and test coverage statistics
        const totalScenarios = Object.keys(testScenarios).length;
        const passedScenarios = Object.values(testScenarios).filter(result => result === true).length;
        const overallPassRate = (passedScenarios / totalScenarios) * 100;

        report.summary = {
            overallStatus: overallPassRate === 100 ? 'PASSED' : 'FAILED',
            passRate: `${overallPassRate.toFixed(1)}%`,
            scenarioResults: testScenarios,
            totalDuration: workflowResults?.totalDuration ? `${workflowResults.totalDuration.toFixed(2)}ms` : 'N/A',
            testExecution: {
                totalRequests: testStats?.requests?.total || 0,
                successfulRequests: testStats?.requests?.successful || 0,
                failedRequests: testStats?.requests?.failed || 0,
                averageResponseTime: testStats?.performance?.averageResponseTime || 0
            }
        };

        // Format performance metrics with comparison to baseline thresholds
        if (performanceMetrics && performanceMetrics.statistics) {
            report.performanceAnalysis = {
                ...performanceMetrics,
                summary: {
                    averageResponseTime: `${performanceMetrics.statistics.duration.average.toFixed(2)}ms`,
                    maxResponseTime: `${performanceMetrics.statistics.duration.max.toFixed(2)}ms`,
                    minResponseTime: `${performanceMetrics.statistics.duration.min.toFixed(2)}ms`,
                    performanceGrade: performanceMetrics.validation?.durationWithinThreshold ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT',
                    memoryEfficiency: Math.abs(performanceMetrics.statistics.memory.averageHeapIncrease) < (10 * 1024 * 1024) ? 'GOOD' : 'MODERATE'
                }
            };
        }

        // Generate educational commentary explaining test results and patterns observed
        report.educationalInsights = {
            testingPatterns: [
                'End-to-end workflow testing demonstrates complete application validation',
                'Request-response cycle testing ensures proper HTTP protocol implementation',
                'Error handling testing validates robustness and security practices',
                'Performance measurement provides insights into application scalability',
                'Server lifecycle testing ensures proper startup and shutdown procedures'
            ],
            keyObservations: [
                `Hello endpoint ${testScenarios.helloEndpoint ? 'successfully' : 'failed to'} handle GET requests`,
                `Error handling ${testScenarios.errorHandling ? 'correctly' : 'failed to'} process invalid requests`,
                `Server lifecycle ${testScenarios.serverLifecycle ? 'demonstrated' : 'failed to show'} proper operational behavior`,
                `Performance ${testScenarios.performance ? 'met' : 'exceeded'} acceptable response time thresholds`
            ],
            lessonsLearned: [
                'Comprehensive testing requires validation of both success and failure scenarios',
                'Performance measurement should be integrated into functional testing workflows',
                'Server lifecycle management is critical for production readiness',
                'Error handling testing helps identify potential security vulnerabilities',
                'Statistical analysis of performance data provides valuable insights'
            ]
        };

        // Include recommendations for performance optimization if applicable
        if (!testScenarios.performance && performanceMetrics?.statistics) {
            report.recommendations.push({
                area: 'Performance Optimization',
                priority: 'HIGH',
                description: `Average response time of ${performanceMetrics.statistics.duration.average.toFixed(2)}ms exceeds threshold`,
                suggestions: [
                    'Review request processing pipeline for optimization opportunities',
                    'Consider implementing response caching for static content',
                    'Analyze memory usage patterns for potential leaks',
                    'Profile application code to identify performance bottlenecks'
                ]
            });
        }

        if (!testScenarios.errorHandling) {
            report.recommendations.push({
                area: 'Error Handling',
                priority: 'MEDIUM',
                description: 'Error handling scenarios require improvement',
                suggestions: [
                    'Review error response formats for consistency',
                    'Ensure security headers are present in error responses',
                    'Validate error messages do not leak sensitive information',
                    'Test additional error scenarios for comprehensive coverage'
                ]
            });
        }

        // Create summary of lessons learned and testing patterns demonstrated
        report.educationalInsights.testingBenefits = [
            'End-to-end testing provides confidence in complete application functionality',
            'Automated testing reduces manual testing effort and increases reliability',
            'Performance testing identifies scalability concerns early in development',
            'Comprehensive error testing improves application robustness and security',
            'Statistical analysis enables data-driven performance optimization decisions'
        ];

        // Log successful report generation with summary information
        logger.info('Comprehensive workflow test report generated', {
            correlationId: reportCorrelationId,
            overallStatus: report.summary.overallStatus,
            passRate: report.summary.passRate,
            totalDuration: report.summary.totalDuration,
            recommendations: report.recommendations.length
        });

        // Return complete workflow test report suitable for educational review
        return report;

    } catch (reportError) {
        // Handle report generation errors with fallback reporting
        logger.error('Failed to generate comprehensive workflow test report', {
            correlationId: reportCorrelationId,
            error: reportError.message
        });

        return {
            ...report,
            error: reportError.message,
            summary: { overallStatus: 'ERROR', passRate: '0%' },
            educationalInsights: { error: 'Report generation failed' }
        };
    }
}

// Comprehensive end-to-end test suite using Node.js built-in test runner
describe('Complete Workflow End-to-End Test Suite', { timeout: TEST_TIMEOUT }, () => {
    
    // Test environment setup before all tests
    before(async () => {
        logger.info('Initializing complete workflow test environment');
        
        // Create and configure test environment with comprehensive settings
        testEnvironment = new TestEnvironment({
            timeout: TEST_TIMEOUT,
            enablePerformanceMonitoring: true,
            validateResponses: true,
            port: 0, // Use dynamic port allocation for test isolation
            performanceTolerance: 0.1
        });

        // Set up test environment with server startup and validation
        await testEnvironment.setup();
        
        logger.info('Complete workflow test environment ready', {
            serverUrl: testEnvironment.getStats().environment.serverUrl,
            correlationId: testEnvironment.correlationId
        });
    });

    // Test environment cleanup after all tests
    after(async () => {
        if (testEnvironment) {
            logger.info('Cleaning up complete workflow test environment');
            
            // Generate final test statistics and performance report
            const finalStats = testEnvironment.getStats();
            logger.info('Final test environment statistics', {
                correlationId: testEnvironment.correlationId,
                totalRequests: finalStats.requests.total,
                successRate: `${finalStats.requests.successRate.toFixed(1)}%`,
                averageResponseTime: `${finalStats.performance.averageResponseTime.toFixed(2)}ms`,
                uptime: `${finalStats.timing.uptime.toFixed(0)}ms`
            });

            // Perform graceful test environment teardown
            await testEnvironment.teardown();
            logger.info('Complete workflow test environment cleanup completed');
        }
    });

    // Primary complete workflow test
    test('Complete Application Workflow - Startup to Shutdown', async () => {
        logger.info('Starting complete application workflow test');
        
        // Execute comprehensive end-to-end workflow with full validation
        const workflowResults = await runCompleteWorkflow(testEnvironment);
        
        // Assert overall workflow success with detailed validation
        assert.ok(workflowResults.validationResults.overallValid, 
            'Complete workflow validation should pass all scenarios');
        
        // Validate individual test scenario results
        assert.ok(workflowResults.validationResults.helloEndpointValid, 
            'Hello endpoint workflow should complete successfully');
        assert.ok(workflowResults.validationResults.errorHandlingValid, 
            'Error handling workflow should validate properly');
        assert.ok(workflowResults.validationResults.lifecycleValid, 
            'Server lifecycle validation should pass');
        
        // Validate performance metrics meet acceptable thresholds
        assert.ok(workflowResults.validationResults.performanceValid, 
            'Workflow performance should meet acceptable thresholds');
        
        // Validate workflow timing is within reasonable bounds
        assert.ok(workflowResults.totalDuration < (TEST_TIMEOUT * 0.8), 
            'Complete workflow should complete within 80% of timeout period');
        
        logger.info('Complete application workflow test passed successfully', {
            correlationId: workflowResults.correlationId,
            totalDuration: `${workflowResults.totalDuration.toFixed(2)}ms`,
            validationResults: workflowResults.validationResults
        });
    });

    // Hello endpoint specific workflow test
    test('Hello Endpoint Request-Response Workflow', async () => {
        logger.info('Starting hello endpoint workflow test');
        
        // Test complete hello endpoint workflow with comprehensive validation
        const helloResults = await testHelloEndpointWorkflow(testEnvironment);
        
        // Assert hello endpoint workflow success
        assert.ok(helloResults.isValid, 'Hello endpoint workflow should be valid');
        assert.strictEqual(helloResults.errors.length, 0, 'Hello endpoint workflow should have no errors');
        
        // Validate response characteristics
        assert.ok(helloResults.response, 'Hello endpoint should return a response');
        assert.strictEqual(helloResults.response.status, 200, 'Hello endpoint should return 200 status');
        assert.strictEqual(helloResults.response.body, 'Hello world', 'Hello endpoint should return correct content');
        
        // Validate response timing
        assert.ok(helloResults.timing.duration < performanceData.responseTimeThresholds.critical,
            'Hello endpoint response time should be within acceptable limits');
        
        logger.info('Hello endpoint workflow test completed successfully', {
            correlationId: helloResults.correlationId,
            responseTime: `${helloResults.timing.duration.toFixed(2)}ms`,
            isValid: helloResults.isValid
        });
    });

    // Error handling workflow test
    test('Error Handling Request Workflows', async () => {
        logger.info('Starting error handling workflow test');
        
        // Test comprehensive error handling scenarios
        const errorResults = await testErrorHandlingWorkflow(testEnvironment);
        
        // Assert error handling workflow success
        assert.ok(errorResults.isValid, 'Error handling workflow should be valid');
        assert.strictEqual(errorResults.errors.length, 0, 'Error handling workflow should have no validation errors');
        
        // Validate 404 Not Found scenario
        assert.ok(errorResults.testScenarios.notFound, '404 Not Found scenario should be present');
        assert.ok(errorResults.testScenarios.notFound.isValid, '404 Not Found scenario should be valid');
        assert.strictEqual(errorResults.testScenarios.notFound.response.status, 404, 
            '404 scenario should return correct status code');
        
        // Validate 405 Method Not Allowed scenario
        assert.ok(errorResults.testScenarios.methodNotAllowed, '405 Method Not Allowed scenario should be present');
        assert.ok(errorResults.testScenarios.methodNotAllowed.isValid, '405 Method Not Allowed scenario should be valid');
        assert.strictEqual(errorResults.testScenarios.methodNotAllowed.response.status, 405, 
            '405 scenario should return correct status code');
        
        logger.info('Error handling workflow test completed successfully', {
            correlationId: errorResults.correlationId,
            scenarios: Object.keys(errorResults.testScenarios).length,
            isValid: errorResults.isValid
        });
    });

    // Server lifecycle validation test
    test('Server Lifecycle Management Validation', async () => {
        logger.info('Starting server lifecycle validation test');
        
        // Validate complete server lifecycle management
        const lifecycleResults = await validateServerLifecycle(testEnvironment);
        
        // Assert server lifecycle validation success
        assert.ok(lifecycleResults.isValid, 'Server lifecycle validation should pass');
        assert.strictEqual(lifecycleResults.errors.length, 0, 'Server lifecycle should have no validation errors');
        
        // Validate startup validation
        assert.ok(lifecycleResults.validationChecks.startupValidation.isValid, 
            'Server startup validation should pass');
        
        // Validate connectivity test
        assert.ok(lifecycleResults.validationChecks.connectivityTest.isValid, 
            'Server connectivity test should pass');
        
        // Validate concurrent processing capability
        assert.ok(lifecycleResults.validationChecks.concurrentProcessing.isValid, 
            'Server concurrent processing validation should pass');
        
        // Validate performance stability
        assert.ok(lifecycleResults.validationChecks.performanceStability.isValid, 
            'Server performance stability validation should pass');
        
        logger.info('Server lifecycle validation test completed successfully', {
            correlationId: lifecycleResults.correlationId,
            validationTime: `${lifecycleResults.timing.totalValidationTime.toFixed(2)}ms`,
            allChecksValid: lifecycleResults.isValid
        });
    });

    // Performance measurement and validation test
    test('Workflow Performance Measurement and Analysis', async () => {
        logger.info('Starting workflow performance measurement test');
        
        // Measure workflow performance with statistical analysis
        const performanceResults = await measureWorkflowPerformance(
            () => testHelloEndpointWorkflow(testEnvironment),
            { 
                iterations: 10, 
                maxDuration: performanceData.responseTimeThresholds.critical 
            }
        );
        
        // Assert performance measurement success
        assert.ok(performanceResults.statistics, 'Performance statistics should be collected');
        assert.ok(performanceResults.statistics.duration.average > 0, 
            'Average response time should be measurable');
        assert.ok(performanceResults.statistics.success.successRate >= 90, 
            'Success rate should be at least 90%');
        
        // Validate performance meets acceptable thresholds
        assert.ok(performanceResults.validation.durationWithinThreshold, 
            'Average response time should be within acceptable threshold');
        assert.ok(performanceResults.validation.successRateAcceptable, 
            'Success rate should be acceptable');
        
        // Validate measurement consistency
        assert.ok(performanceResults.measurements.durations.length >= 8, 
            'At least 80% of iterations should complete successfully');
        
        logger.info('Workflow performance measurement test completed successfully', {
            correlationId: performanceResults.correlationId,
            averageTime: `${performanceResults.statistics.duration.average.toFixed(2)}ms`,
            successRate: `${performanceResults.statistics.success.successRate.toFixed(1)}%`,
            withinThreshold: performanceResults.validation.durationWithinThreshold
        });
    });

    // Comprehensive workflow reporting test
    test('Comprehensive Workflow Test Report Generation', async () => {
        logger.info('Starting comprehensive test report generation');
        
        // Execute complete workflow for reporting
        const workflowResults = await runCompleteWorkflow(testEnvironment);
        const performanceResults = await measureWorkflowPerformance(
            () => testHelloEndpointWorkflow(testEnvironment),
            { iterations: 5 }
        );
        const testStats = testEnvironment.getStats();
        
        // Generate comprehensive workflow test report
        const report = generateWorkflowReport(workflowResults, performanceResults, testStats);
        
        // Assert report generation success
        assert.ok(report, 'Test report should be generated');
        assert.ok(report.reportId, 'Report should have unique identifier');
        assert.ok(report.summary, 'Report should contain summary information');
        assert.ok(report.educationalInsights, 'Report should contain educational insights');
        
        // Validate report content structure
        assert.ok(report.summary.overallStatus, 'Report should contain overall status');
        assert.ok(report.summary.passRate, 'Report should contain pass rate information');
        assert.ok(report.educationalInsights.testingPatterns, 'Report should explain testing patterns');
        assert.ok(Array.isArray(report.educationalInsights.lessonsLearned), 
            'Report should contain lessons learned');
        
        logger.info('Comprehensive test report generation completed successfully', {
            reportId: report.reportId,
            overallStatus: report.summary.overallStatus,
            passRate: report.summary.passRate,
            recommendations: report.recommendations?.length || 0
        });
    });
});