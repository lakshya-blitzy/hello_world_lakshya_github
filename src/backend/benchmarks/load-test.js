// Node.js Tutorial HTTP Server - Comprehensive Load Testing Utility
// Simulates concurrent user traffic to measure server performance under various load conditions
// Uses only Node.js built-in modules for educational demonstrations of load testing techniques
// Zero external dependencies - demonstrates performance measurement and server capacity analysis

// Node.js built-in modules for load testing functionality
const { performance } = require('node:perf_hooks'); // Built-in performance timing
const http = require('node:http'); // Built-in HTTP module for client connections
const cluster = require('node:cluster'); // Built-in cluster module for multi-process load generation
const { EventEmitter } = require('node:events'); // Built-in event coordination
const process = require('node:process'); // Built-in process monitoring
const os = require('node:os'); // Built-in OS metrics

// Internal module imports for server testing and performance monitoring
const { HttpServer } = require('../lib/http-server.js');
const { TestEnvironment, makeTestRequest, measurePerformance } = require('../test/fixtures/test-helpers.js');
const { PerformanceBaseline } = require('./performance-baseline.js');
const { PerformanceMonitor } = require('../utils/performance-monitor.js');
const { config } = require('../config/environment.js');
const { logger } = require('../lib/logger.js');

// Global constants for load test scenario configuration
const LOAD_TEST_SCENARIOS = {
    LIGHT: 'light',
    MODERATE: 'moderate', 
    HEAVY: 'heavy',
    STRESS: 'stress',
    SPIKE: 'spike'
};

// Default load testing configuration with performance-oriented settings
const DEFAULT_LOAD_CONFIG = {
    duration: 60000,           // 60 seconds test duration
    concurrency: 10,           // 10 concurrent clients
    rampUpTime: 5000,         // 5 second ramp-up period
    rampDownTime: 5000,       // 5 second ramp-down period
    requestsPerSecond: 100    // Target requests per second
};

// Performance thresholds for load test validation and analysis
const PERFORMANCE_THRESHOLDS = {
    responseTime: 100,        // Maximum acceptable response time (ms)
    errorRate: 1.0,          // Maximum acceptable error rate (%)
    throughput: 100,         // Minimum required throughput (req/s)
    memoryIncrease: 50       // Maximum memory increase during test (MB)
};

// Load test endpoint configuration for comprehensive testing coverage
const LOAD_TEST_ENDPOINTS = {
    hello: '/hello',         // Primary endpoint for load testing
    health: '/health',       // Health check endpoint
    notFound: '/invalid'     // Non-existent endpoint for error testing
};

/**
 * Main load testing function that orchestrates complete load test execution including server setup,
 * concurrent request generation, metrics collection, and results analysis with baseline comparison
 * @param {object} loadTestConfig - Load test configuration including scenario type, concurrency levels, duration, and performance thresholds
 * @returns {Promise<object>} Promise resolving to comprehensive load test results with performance metrics, statistics, and baseline comparison
 */
async function executeLoadTest(loadTestConfig = {}) {
    // Validate load test configuration parameters and scenario requirements
    const validatedConfig = validateLoadTestConfig(loadTestConfig);
    
    logger.info('Starting comprehensive load test execution', {
        scenario: validatedConfig.scenario,
        duration: validatedConfig.duration,
        concurrency: validatedConfig.concurrency,
        targetThroughput: validatedConfig.requestsPerSecond
    });
    
    let testEnvironment = null;
    let loadTester = null;
    
    try {
        // Set up isolated test environment with dedicated HTTP server instance
        testEnvironment = new TestEnvironment({
            port: 0, // Use random available port for isolation
            enablePerformanceMonitoring: true,
            loadTestMode: true
        });
        
        await testEnvironment.setup();
        logger.info('Test environment initialized successfully');
        
        // Load performance baseline data for comparison if available
        const baseline = new PerformanceBaseline({
            testType: 'load_test',
            scenario: validatedConfig.scenario
        });
        
        try {
            await baseline.loadBaselineData();
            logger.info('Performance baseline loaded for comparison');
        } catch (error) {
            logger.warn('No baseline data available, will establish new baseline', { error: error.message });
        }
        
        // Initialize performance monitoring and metrics collection systems
        const performanceMonitor = new PerformanceMonitor({
            thresholds: PERFORMANCE_THRESHOLDS,
            intervals: {
                realTimeMs: 1000,      // Real-time metrics every 1 second
                aggregationMs: 5000,   // Aggregate metrics every 5 seconds
                thresholdCheckMs: 2000 // Threshold checking every 2 seconds
            },
            enableRealTimeCollection: true,
            enableTrendAnalysis: true,
            enableThresholdAlerting: true
        });
        
        await performanceMonitor.startMonitoring();
        logger.info('Performance monitoring started');
        
        // Execute specified load test scenario with concurrent request generation
        loadTester = new LoadTester({
            ...validatedConfig,
            serverUrl: testEnvironment.getServerUrl(),
            performanceMonitor: performanceMonitor,
            baseline: baseline
        });
        
        // Monitor server performance and resource utilization during test execution
        const testResults = await loadTester.run();
        
        // Collect and aggregate performance metrics from all concurrent clients
        const aggregatedMetrics = await loadTester.collectResults();
        
        // Perform statistical analysis on collected performance data
        const performanceAnalysis = await loadTester.analyzePerformance(aggregatedMetrics);
        
        // Compare results against performance baseline and thresholds
        const baselineComparison = await baseline.compareWithBaseline(performanceAnalysis);
        
        // Generate comprehensive load test report with findings and recommendations
        const loadTestReport = generateLoadTestReport(
            {
                ...testResults,
                metrics: aggregatedMetrics,
                analysis: performanceAnalysis,
                baselineComparison: baselineComparison
            },
            {
                includeRecommendations: true,
                includeGraphicalSummary: false,
                detailLevel: 'comprehensive'
            }
        );
        
        // Stop performance monitoring and collect final metrics
        await performanceMonitor.stopMonitoring();
        const finalMonitoringSnapshot = performanceMonitor.getPerformanceSnapshot({
            includeHistoricalData: true,
            includeThresholdAnalysis: true
        });
        
        logger.info('Load test execution completed successfully', {
            duration: testResults.actualDuration,
            totalRequests: aggregatedMetrics.totalRequests,
            successRate: aggregatedMetrics.successRate,
            averageResponseTime: aggregatedMetrics.averageResponseTime
        });
        
        // Return comprehensive load test results with all analysis data
        return {
            success: true,
            timestamp: Date.now(),
            testConfiguration: validatedConfig,
            results: testResults,
            metrics: aggregatedMetrics,
            analysis: performanceAnalysis,
            baselineComparison: baselineComparison,
            monitoring: finalMonitoringSnapshot,
            report: loadTestReport
        };
        
    } catch (error) {
        logger.error('Load test execution failed', {
            error: error.message,
            stack: error.stack,
            configuration: validatedConfig
        });
        
        throw new Error(`Load test execution failed: ${error.message}`);
        
    } finally {
        // Clean up test environment and resources after execution completion
        if (loadTester) {
            try {
                await loadTester.cleanup();
                logger.info('Load tester cleanup completed');
            } catch (cleanupError) {
                logger.warn('Load tester cleanup encountered issues', { error: cleanupError.message });
            }
        }
        
        if (testEnvironment) {
            try {
                await testEnvironment.teardown();
                logger.info('Test environment cleanup completed');
            } catch (cleanupError) {
                logger.warn('Test environment cleanup encountered issues', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Executes light load test scenario with minimal concurrency to establish baseline performance under normal conditions
 * @param {object} testConfig - Light load test configuration with low concurrency and moderate request rate
 * @returns {Promise<object>} Promise resolving to light load test results with baseline performance metrics
 */
async function runLightLoadTest(testConfig = {}) {
    // Configure light load test parameters with 5-10 concurrent connections
    const lightLoadConfig = {
        scenario: LOAD_TEST_SCENARIOS.LIGHT,
        duration: testConfig.duration || 30000,     // 30 second test duration
        concurrency: testConfig.concurrency || 5,   // 5 concurrent connections
        rampUpTime: testConfig.rampUpTime || 2000,  // 2 second ramp-up
        rampDownTime: testConfig.rampDownTime || 2000, // 2 second ramp-down
        requestsPerSecond: testConfig.requestsPerSecond || 50, // Moderate request rate
        endpoints: [LOAD_TEST_ENDPOINTS.hello],
        ...testConfig
    };
    
    logger.info('Starting light load test scenario', lightLoadConfig);
    
    // Set moderate request rate to simulate normal user traffic patterns
    // Execute test for specified duration while monitoring response times
    const results = await executeLoadTest(lightLoadConfig);
    
    // Measure server performance under light load conditions
    // Collect baseline performance metrics for comparison with heavier loads
    logger.info('Light load test completed successfully', {
        averageResponseTime: results.metrics.averageResponseTime,
        throughput: results.metrics.throughput,
        errorRate: results.metrics.errorRate
    });
    
    // Return light load test results with performance characteristics
    return {
        ...results,
        scenarioType: LOAD_TEST_SCENARIOS.LIGHT,
        baselineMetrics: {
            responseTime: results.metrics.averageResponseTime,
            throughput: results.metrics.throughput,
            cpuUsage: results.monitoring.systemMetrics.cpu.usagePercent,
            memoryUsage: results.monitoring.systemMetrics.memory.systemUsagePercent
        }
    };
}

/**
 * Executes moderate load test scenario with medium concurrency to test server performance under typical production load
 * @param {object} testConfig - Moderate load test configuration with medium concurrency and increased request rate
 * @returns {Promise<object>} Promise resolving to moderate load test results with performance degradation analysis
 */
async function runModerateLoadTest(testConfig = {}) {
    // Configure moderate load test with 25-50 concurrent connections
    const moderateLoadConfig = {
        scenario: LOAD_TEST_SCENARIOS.MODERATE,
        duration: testConfig.duration || 60000,     // 60 second test duration
        concurrency: testConfig.concurrency || 25,  // 25 concurrent connections
        rampUpTime: testConfig.rampUpTime || 5000,  // 5 second ramp-up
        rampDownTime: testConfig.rampDownTime || 5000, // 5 second ramp-down
        requestsPerSecond: testConfig.requestsPerSecond || 100, // Elevated request rate
        endpoints: [LOAD_TEST_ENDPOINTS.hello, LOAD_TEST_ENDPOINTS.health],
        ...testConfig
    };
    
    logger.info('Starting moderate load test scenario', moderateLoadConfig);
    
    // Set elevated request rate to simulate busy production conditions
    // Execute sustained load test while monitoring performance degradation
    const results = await executeLoadTest(moderateLoadConfig);
    
    // Measure response time increases and throughput changes under load
    // Track server resource utilization and identify bottlenecks
    const performanceDegradation = analyzePerformanceDegradation(results, 'moderate');
    
    logger.info('Moderate load test completed successfully', {
        averageResponseTime: results.metrics.averageResponseTime,
        throughput: results.metrics.throughput,
        performanceDegradation: performanceDegradation
    });
    
    // Return moderate load test results with performance analysis
    return {
        ...results,
        scenarioType: LOAD_TEST_SCENARIOS.MODERATE,
        performanceDegradation: performanceDegradation,
        productionReadiness: assessProductionReadiness(results)
    };
}

/**
 * Executes heavy load test scenario with high concurrency to determine server capacity limits and performance boundaries
 * @param {object} testConfig - Heavy load test configuration with high concurrency and maximum sustainable request rate
 * @returns {Promise<object>} Promise resolving to heavy load test results with capacity analysis and performance limits
 */
async function runHeavyLoadTest(testConfig = {}) {
    // Configure heavy load test with 100+ concurrent connections
    const heavyLoadConfig = {
        scenario: LOAD_TEST_SCENARIOS.HEAVY,
        duration: testConfig.duration || 120000,    // 2 minute test duration
        concurrency: testConfig.concurrency || 100, // 100 concurrent connections
        rampUpTime: testConfig.rampUpTime || 10000, // 10 second ramp-up
        rampDownTime: testConfig.rampDownTime || 10000, // 10 second ramp-down
        requestsPerSecond: testConfig.requestsPerSecond || 200, // High request rate
        endpoints: [LOAD_TEST_ENDPOINTS.hello, LOAD_TEST_ENDPOINTS.health, LOAD_TEST_ENDPOINTS.notFound],
        ...testConfig
    };
    
    logger.info('Starting heavy load test scenario', heavyLoadConfig);
    
    // Set high request rate near server capacity limits
    // Execute intensive load test while monitoring for performance breakdown
    const results = await executeLoadTest(heavyLoadConfig);
    
    // Measure maximum sustainable throughput and response time degradation
    // Identify server capacity limits and resource exhaustion points
    const capacityAnalysis = analyzeServerCapacity(results);
    const bottleneckAnalysis = detectPerformanceBottlenecks(results);
    
    logger.info('Heavy load test completed successfully', {
        maxSustainableThroughput: capacityAnalysis.maxThroughput,
        capacityLimits: capacityAnalysis.resourceLimits,
        bottlenecks: bottleneckAnalysis.primaryBottlenecks
    });
    
    // Return heavy load test results with capacity planning recommendations
    return {
        ...results,
        scenarioType: LOAD_TEST_SCENARIOS.HEAVY,
        capacityAnalysis: capacityAnalysis,
        bottleneckAnalysis: bottleneckAnalysis,
        scalingRecommendations: generateScalingRecommendations(capacityAnalysis)
    };
}

/**
 * Executes stress test scenario that pushes server beyond normal capacity to identify failure points and recovery behavior
 * @param {object} stressConfig - Stress test configuration with extreme load parameters and failure detection
 * @returns {Promise<object>} Promise resolving to stress test results with failure analysis and recovery metrics
 */
async function runStressTest(stressConfig = {}) {
    // Configure stress test with excessive concurrent connections and request rates
    const stressTestConfig = {
        scenario: LOAD_TEST_SCENARIOS.STRESS,
        duration: stressConfig.duration || 180000,  // 3 minute stress duration
        concurrency: stressConfig.concurrency || 200, // 200 concurrent connections
        rampUpTime: stressConfig.rampUpTime || 15000, // 15 second aggressive ramp-up
        rampDownTime: stressConfig.rampDownTime || 30000, // 30 second recovery period
        requestsPerSecond: stressConfig.requestsPerSecond || 500, // Extreme request rate
        endpoints: [LOAD_TEST_ENDPOINTS.hello, LOAD_TEST_ENDPOINTS.health, LOAD_TEST_ENDPOINTS.notFound],
        errorThreshold: 10.0, // Accept higher error rates during stress testing
        ...stressConfig
    };
    
    logger.warn('Starting stress test scenario - server may experience failures', stressTestConfig);
    
    let stressResults = null;
    let failurePoints = [];
    let recoveryMetrics = null;
    
    try {
        // Execute extreme load conditions to test server breaking points
        stressResults = await executeLoadTest(stressTestConfig);
        
        // Monitor for error rate increases, connection failures, and timeouts
        failurePoints = identifyFailurePoints(stressResults);
        
        // Measure server recovery behavior after stress conditions
        recoveryMetrics = await measureRecoveryBehavior(stressResults);
        
    } catch (stressError) {
        logger.error('Stress test caused server failure - this is expected behavior', {
            error: stressError.message,
            testDuration: stressTestConfig.duration,
            concurrency: stressTestConfig.concurrency
        });
        
        // Capture failure details for analysis
        failurePoints.push({
            type: 'critical_failure',
            message: stressError.message,
            timestamp: Date.now(),
            conditions: stressTestConfig
        });
    }
    
    // Identify failure modes and server resilience characteristics
    const resilienceAnalysis = analyzeServerResilience(stressResults, failurePoints);
    
    logger.info('Stress test completed with failure analysis', {
        failurePointsDetected: failurePoints.length,
        maxConcurrencyReached: stressResults?.metrics?.maxConcurrency || 0,
        recoveryTime: recoveryMetrics?.recoveryTimeMs || 'not_measured'
    });
    
    // Return stress test results with failure analysis and recovery recommendations
    return {
        success: true,
        scenarioType: LOAD_TEST_SCENARIOS.STRESS,
        results: stressResults,
        failurePoints: failurePoints,
        recoveryMetrics: recoveryMetrics,
        resilienceAnalysis: resilienceAnalysis,
        recommendations: generateResilienceRecommendations(resilienceAnalysis)
    };
}

/**
 * Executes spike test scenario with sudden traffic increases to test server elasticity and auto-scaling behavior
 * @param {object} spikeConfig - Spike test configuration with traffic spike patterns and elasticity measurement
 * @returns {Promise<object>} Promise resolving to spike test results with elasticity analysis and scaling performance
 */
async function runSpikeTest(spikeConfig = {}) {
    // Configure spike test with sudden traffic increases and decreases
    const spikeTestConfig = {
        scenario: LOAD_TEST_SCENARIOS.SPIKE,
        baselineConcurrency: spikeConfig.baselineConcurrency || 10,   // Normal load level
        spikeConcurrency: spikeConfig.spikeConcurrency || 100,        // Spike load level
        spikeDuration: spikeConfig.spikeDuration || 30000,            // 30 second spike duration
        baselineDuration: spikeConfig.baselineDuration || 30000,      // 30 second baseline periods
        spikeTransitionTime: spikeConfig.spikeTransitionTime || 5000, // 5 second transition
        totalDuration: spikeConfig.totalDuration || 120000,          // 2 minute total test
        endpoints: [LOAD_TEST_ENDPOINTS.hello],
        ...spikeConfig
    };
    
    logger.info('Starting spike test scenario with traffic pattern analysis', spikeTestConfig);
    
    const spikeResults = [];
    const elasticityMetrics = [];
    
    const testStartTime = Date.now();
    const testEndTime = testStartTime + spikeTestConfig.totalDuration;
    
    while (Date.now() < testEndTime) {
        // Execute baseline load followed by rapid traffic spike
        logger.info('Executing baseline load phase');
        const baselineResults = await executeLoadTest({
            scenario: 'spike_baseline',
            duration: spikeTestConfig.baselineDuration,
            concurrency: spikeTestConfig.baselineConcurrency,
            rampUpTime: 1000,
            rampDownTime: 1000,
            requestsPerSecond: spikeTestConfig.baselineConcurrency * 2
        });
        
        // Measure server response to sudden load changes and scaling behavior
        logger.info('Executing traffic spike phase');
        const spikePhaseResults = await executeLoadTest({
            scenario: 'spike_peak',
            duration: spikeTestConfig.spikeDuration,
            concurrency: spikeTestConfig.spikeConcurrency,
            rampUpTime: spikeTestConfig.spikeTransitionTime,
            rampDownTime: spikeTestConfig.spikeTransitionTime,
            requestsPerSecond: spikeTestConfig.spikeConcurrency * 3
        });
        
        // Monitor performance recovery after spike conditions end
        const recoveryResults = await executeLoadTest({
            scenario: 'spike_recovery',
            duration: spikeTestConfig.baselineDuration,
            concurrency: spikeTestConfig.baselineConcurrency,
            rampUpTime: spikeTestConfig.spikeTransitionTime,
            rampDownTime: 1000,
            requestsPerSecond: spikeTestConfig.baselineConcurrency * 2
        });
        
        // Analyze server elasticity and auto-scaling effectiveness
        const phaseElasticity = analyzeElasticity(baselineResults, spikePhaseResults, recoveryResults);
        
        spikeResults.push({
            baseline: baselineResults,
            spike: spikePhaseResults,
            recovery: recoveryResults,
            elasticity: phaseElasticity,
            timestamp: Date.now()
        });
        
        elasticityMetrics.push(phaseElasticity);
        
        // Break if we've completed at least one full cycle and are near end time
        if (spikeResults.length >= 1 && (Date.now() + spikeTestConfig.totalDuration / 2) > testEndTime) {
            break;
        }
    }
    
    // Aggregate elasticity analysis across all spike cycles
    const overallElasticity = aggregateElasticityAnalysis(elasticityMetrics);
    
    logger.info('Spike test completed with elasticity analysis', {
        spikeCyclesCompleted: spikeResults.length,
        averageElasticityScore: overallElasticity.elasticityScore,
        scalingEffectiveness: overallElasticity.scalingEffectiveness
    });
    
    // Return spike test results with scaling recommendations
    return {
        success: true,
        scenarioType: LOAD_TEST_SCENARIOS.SPIKE,
        spikeResults: spikeResults,
        elasticityAnalysis: overallElasticity,
        scalingRecommendations: generateElasticityRecommendations(overallElasticity)
    };
}

/**
 * Creates and manages concurrent HTTP requests to server endpoints with precise timing control and performance measurement
 * @param {string} serverUrl - Target server URL for load testing requests
 * @param {object} requestConfig - Request configuration including concurrency, rate limiting, and request parameters
 * @returns {Promise<array>} Promise resolving to array of request results with timing and status information
 */
async function generateConcurrentRequests(serverUrl, requestConfig) {
    const {
        concurrency = 10,
        totalRequests = 100,
        requestsPerSecond = null,
        endpoints = ['/hello'],
        timeout = 10000,
        method = 'GET',
        headers = {},
        rateLimiting = false
    } = requestConfig;
    
    logger.info('Generating concurrent HTTP requests', {
        serverUrl: serverUrl,
        concurrency: concurrency,
        totalRequests: totalRequests,
        endpoints: endpoints.length
    });
    
    // Create concurrent HTTP client connections based on concurrency configuration
    const concurrentClients = [];
    const requestResults = [];
    const startTime = performance.now();
    
    // Initialize request timing and performance measurement for each client
    for (let clientId = 0; clientId < concurrency; clientId++) {
        const client = new ConcurrentClient(`client_${clientId}`, {
            serverUrl: serverUrl,
            endpoints: endpoints,
            timeout: timeout,
            method: method,
            headers: headers,
            rateLimiting: rateLimiting,
            requestsPerSecond: requestsPerSecond
        });
        
        concurrentClients.push(client);
    }
    
    // Coordinate concurrent request execution with rate limiting if specified
    const requestPromises = concurrentClients.map(async (client, clientIndex) => {
        const clientResults = [];
        const requestsPerClient = Math.floor(totalRequests / concurrency);
        const extraRequests = clientIndex < (totalRequests % concurrency) ? 1 : 0;
        const totalClientRequests = requestsPerClient + extraRequests;
        
        // Execute HTTP requests to target endpoints with proper error handling
        for (let requestIndex = 0; requestIndex < totalClientRequests; requestIndex++) {
            try {
                const endpoint = endpoints[requestIndex % endpoints.length];
                const requestResult = await client.makeRequest(endpoint, {
                    correlationId: `${client.clientId}_${requestIndex}`,
                    requestIndex: requestIndex,
                    totalRequests: totalClientRequests
                });
                
                clientResults.push(requestResult);
                
                // Apply rate limiting if specified
                if (rateLimiting && requestsPerSecond) {
                    const delayMs = 1000 / (requestsPerSecond / concurrency);
                    if (delayMs > 10) { // Only delay if meaningful
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
                
            } catch (requestError) {
                // Handle individual request failures
                clientResults.push({
                    success: false,
                    error: requestError.message,
                    correlationId: `${client.clientId}_${requestIndex}`,
                    timestamp: Date.now(),
                    clientId: client.clientId
                });
            }
        }
        
        return clientResults;
    });
    
    // Collect individual request results including response time and status
    const allClientResults = await Promise.all(requestPromises);
    
    // Aggregate concurrent request results for statistical analysis
    for (const clientResults of allClientResults) {
        requestResults.push(...clientResults);
    }
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    logger.info('Concurrent request generation completed', {
        totalRequests: requestResults.length,
        successfulRequests: requestResults.filter(r => r.success).length,
        totalDuration: totalDuration.toFixed(2),
        averageResponseTime: calculateAverageResponseTime(requestResults)
    });
    
    // Return array of request results with comprehensive timing data
    return {
        requestResults: requestResults,
        totalDuration: totalDuration,
        concurrency: concurrency,
        actualRequestCount: requestResults.length,
        successCount: requestResults.filter(r => r.success).length,
        errorCount: requestResults.filter(r => !r.success).length,
        averageResponseTime: calculateAverageResponseTime(requestResults),
        throughput: (requestResults.length / totalDuration) * 1000 // requests per second
    };
}

/**
 * Measures server throughput by calculating successful requests per second during load test execution
 * @param {array} requestResults - Array of request results with timing information
 * @param {number} testDurationMs - Total test duration in milliseconds for throughput calculation
 * @returns {object} Throughput metrics including requests per second, successful requests, and error rates
 */
function measureThroughput(requestResults, testDurationMs) {
    if (!Array.isArray(requestResults) || requestResults.length === 0) {
        logger.warn('No request results provided for throughput measurement');
        return {
            requestsPerSecond: 0,
            successfulRequests: 0,
            totalRequests: 0,
            errorRate: 0,
            successRate: 0
        };
    }
    
    // Count total successful requests completed during test duration
    const successfulRequests = requestResults.filter(result => 
        result.success && result.statusCode && result.statusCode < 400
    );
    
    const errorRequests = requestResults.filter(result => 
        !result.success || (result.statusCode && result.statusCode >= 400)
    );
    
    // Calculate requests per second based on successful requests and duration
    const requestsPerSecond = testDurationMs > 0 ? 
        (successfulRequests.length / testDurationMs) * 1000 : 0;
    
    // Compute error rate percentage from failed requests
    const errorRate = requestResults.length > 0 ? 
        (errorRequests.length / requestResults.length) * 100 : 0;
    
    const successRate = requestResults.length > 0 ? 
        (successfulRequests.length / requestResults.length) * 100 : 0;
    
    // Analyze throughput distribution over time intervals
    const timeIntervals = analyzeTimeDistribution(requestResults, testDurationMs);
    
    // Calculate peak throughput and sustained throughput metrics
    const peakThroughput = calculatePeakThroughput(timeIntervals);
    const sustainedThroughput = calculateSustainedThroughput(timeIntervals);
    
    logger.info('Throughput measurement completed', {
        requestsPerSecond: requestsPerSecond.toFixed(2),
        successRate: successRate.toFixed(2),
        errorRate: errorRate.toFixed(2)
    });
    
    // Return comprehensive throughput analysis with statistics
    return {
        requestsPerSecond: parseFloat(requestsPerSecond.toFixed(2)),
        successfulRequests: successfulRequests.length,
        totalRequests: requestResults.length,
        errorRequests: errorRequests.length,
        errorRate: parseFloat(errorRate.toFixed(2)),
        successRate: parseFloat(successRate.toFixed(2)),
        peakThroughput: peakThroughput,
        sustainedThroughput: sustainedThroughput,
        throughputDistribution: timeIntervals,
        testDurationMs: testDurationMs
    };
}

/**
 * Performs statistical analysis of response times collected during load testing to identify performance patterns and outliers
 * @param {array} responseTimeData - Array of response time measurements in milliseconds
 * @returns {object} Response time analysis including statistical metrics, percentiles, and distribution characteristics
 */
function analyzeResponseTimes(responseTimeData) {
    if (!Array.isArray(responseTimeData) || responseTimeData.length === 0) {
        logger.warn('No response time data provided for analysis');
        return {
            count: 0,
            mean: 0,
            median: 0,
            standardDeviation: 0,
            percentiles: {},
            distribution: {}
        };
    }
    
    // Clean response time data by removing invalid measurements and outliers
    const validResponseTimes = responseTimeData
        .filter(time => typeof time === 'number' && time >= 0 && time < 60000) // Remove impossible values
        .sort((a, b) => a - b); // Sort for percentile calculations
    
    if (validResponseTimes.length === 0) {
        logger.warn('No valid response time data after cleaning');
        return {
            count: 0,
            mean: 0,
            median: 0,
            standardDeviation: 0,
            percentiles: {},
            distribution: {}
        };
    }
    
    // Calculate descriptive statistics including mean, median, and standard deviation
    const mean = validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length;
    const median = calculateMedian(validResponseTimes);
    const standardDeviation = calculateStandardDeviation(validResponseTimes, mean);
    
    // Compute percentile values (P50, P90, P95, P99) for response time distribution
    const percentiles = {
        p50: calculatePercentile(validResponseTimes, 50),
        p75: calculatePercentile(validResponseTimes, 75),
        p90: calculatePercentile(validResponseTimes, 90),
        p95: calculatePercentile(validResponseTimes, 95),
        p99: calculatePercentile(validResponseTimes, 99),
        p999: calculatePercentile(validResponseTimes, 99.9)
    };
    
    // Identify response time patterns and performance degradation trends
    const trends = identifyPerformanceTrends(validResponseTimes);
    
    // Analyze response time consistency and variability over test duration
    const variabilityAnalysis = analyzeResponseTimeVariability(validResponseTimes);
    
    // Generate response time distribution histogram for visualization
    const distribution = generateResponseTimeDistribution(validResponseTimes);
    
    logger.info('Response time analysis completed', {
        count: validResponseTimes.length,
        mean: mean.toFixed(2),
        median: median.toFixed(2),
        p95: percentiles.p95.toFixed(2),
        p99: percentiles.p99.toFixed(2)
    });
    
    // Return comprehensive response time analysis with statistical insights
    return {
        count: validResponseTimes.length,
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        min: validResponseTimes[0],
        max: validResponseTimes[validResponseTimes.length - 1],
        standardDeviation: parseFloat(standardDeviation.toFixed(2)),
        percentiles: percentiles,
        trends: trends,
        variability: variabilityAnalysis,
        distribution: distribution,
        outliers: identifyResponseTimeOutliers(validResponseTimes, mean, standardDeviation)
    };
}

/**
 * Analyzes load test results to identify performance bottlenecks, resource constraints, and optimization opportunities
 * @param {object} loadTestResults - Complete load test results with performance metrics and system resources
 * @returns {object} Bottleneck analysis with identified constraints and optimization recommendations
 */
function detectPerformanceBottlenecks(loadTestResults) {
    logger.info('Analyzing performance bottlenecks from load test results');
    
    const bottlenecks = {
        cpu: [],
        memory: [],
        network: [],
        eventLoop: [],
        responseTime: [],
        throughput: []
    };
    
    const recommendations = [];
    
    // Analyze response time degradation patterns under increasing load
    if (loadTestResults.analysis && loadTestResults.analysis.responseTimes) {
        const responseAnalysis = loadTestResults.analysis.responseTimes;
        
        // Check for significant response time increases
        if (responseAnalysis.percentiles.p95 > PERFORMANCE_THRESHOLDS.responseTime * 2) {
            bottlenecks.responseTime.push({
                type: 'high_response_time',
                severity: 'high',
                metric: 'p95_response_time',
                value: responseAnalysis.percentiles.p95,
                threshold: PERFORMANCE_THRESHOLDS.responseTime,
                description: 'P95 response time significantly exceeds acceptable threshold'
            });
            
            recommendations.push({
                category: 'response_time',
                priority: 'high',
                suggestion: 'Optimize request processing pipeline and reduce computational overhead'
            });
        }
        
        // Check for high response time variability
        if (responseAnalysis.standardDeviation > responseAnalysis.mean * 0.5) {
            bottlenecks.responseTime.push({
                type: 'response_time_variability',
                severity: 'medium',
                metric: 'response_time_std_dev',
                value: responseAnalysis.standardDeviation,
                description: 'High response time variability indicates inconsistent performance'
            });
        }
    }
    
    // Identify CPU, memory, and I/O resource constraints during testing
    if (loadTestResults.monitoring && loadTestResults.monitoring.systemMetrics) {
        const systemMetrics = loadTestResults.monitoring.systemMetrics;
        
        // CPU bottleneck analysis
        if (systemMetrics.cpu && systemMetrics.cpu.usagePercent > 80) {
            bottlenecks.cpu.push({
                type: 'high_cpu_usage',
                severity: 'high',
                metric: 'cpu_usage_percent',
                value: systemMetrics.cpu.usagePercent,
                threshold: 80,
                description: 'CPU usage exceeds 80% indicating processing bottleneck'
            });
            
            recommendations.push({
                category: 'cpu',
                priority: 'high',
                suggestion: 'Consider CPU optimization or scaling to handle higher concurrent load'
            });
        }
        
        // Memory bottleneck analysis
        if (systemMetrics.memory && systemMetrics.memory.systemUsagePercent > 85) {
            bottlenecks.memory.push({
                type: 'high_memory_usage',
                severity: 'high',
                metric: 'memory_usage_percent',
                value: systemMetrics.memory.systemUsagePercent,
                threshold: 85,
                description: 'Memory usage exceeds 85% indicating potential memory constraint'
            });
            
            recommendations.push({
                category: 'memory',
                priority: 'high',
                suggestion: 'Optimize memory usage patterns and consider increasing available memory'
            });
        }
        
        // Event loop lag analysis
        if (systemMetrics.process && systemMetrics.process.eventLoopLagMs > 100) {
            bottlenecks.eventLoop.push({
                type: 'event_loop_lag',
                severity: 'high',
                metric: 'event_loop_lag_ms',
                value: systemMetrics.process.eventLoopLagMs,
                threshold: 100,
                description: 'Event loop lag exceeds 100ms indicating blocking operations'
            });
            
            recommendations.push({
                category: 'event_loop',
                priority: 'critical',
                suggestion: 'Identify and eliminate blocking operations in the event loop'
            });
        }
    }
    
    // Correlate performance degradation with system resource utilization
    const correlationAnalysis = analyzeResourceCorrelation(loadTestResults);
    
    // Detect event loop blocking and asynchronous I/O bottlenecks
    const asyncBottlenecks = detectAsynchronousBottlenecks(loadTestResults);
    
    // Identify network connection limits and socket exhaustion issues
    const networkBottlenecks = detectNetworkBottlenecks(loadTestResults);
    
    // Calculate overall bottleneck severity score
    const bottleneckSeverity = calculateBottleneckSeverity(bottlenecks);
    
    logger.info('Performance bottleneck analysis completed', {
        totalBottlenecks: Object.values(bottlenecks).reduce((total, arr) => total + arr.length, 0),
        highSeverityCount: Object.values(bottlenecks).reduce((count, arr) => 
            count + arr.filter(b => b.severity === 'high').length, 0),
        overallSeverity: bottleneckSeverity
    });
    
    // Generate bottleneck report with root cause analysis
    // Return performance bottleneck analysis with actionable recommendations
    return {
        bottlenecks: bottlenecks,
        recommendations: recommendations,
        correlationAnalysis: correlationAnalysis,
        asyncBottlenecks: asyncBottlenecks,
        networkBottlenecks: networkBottlenecks,
        overallSeverity: bottleneckSeverity,
        summary: generateBottleneckSummary(bottlenecks, recommendations)
    };
}

/**
 * Creates comprehensive load test report with performance metrics, analysis, and recommendations for capacity planning and optimization
 * @param {object} testResults - Complete load test results with all metrics and analysis data
 * @param {object} reportOptions - Report formatting and output configuration options
 * @returns {object} Formatted load test report with executive summary, detailed metrics, and recommendations
 */
function generateLoadTestReport(testResults, reportOptions = {}) {
    const options = {
        includeExecutiveSummary: true,
        includeDetailedMetrics: true,
        includeTrendAnalysis: true,
        includeRecommendations: true,
        includeGraphicalSummary: false,
        detailLevel: 'comprehensive',
        ...reportOptions
    };
    
    logger.info('Generating comprehensive load test report', {
        scenario: testResults.results?.scenario || 'unknown',
        detailLevel: options.detailLevel
    });
    
    const report = {
        metadata: {
            reportId: `load_test_report_${Date.now()}`,
            generatedAt: new Date().toISOString(),
            reportVersion: '1.0.0',
            testDuration: testResults.results?.actualDuration || 0,
            scenario: testResults.results?.scenario || 'unknown'
        },
        executiveSummary: null,
        detailedMetrics: null,
        performanceAnalysis: null,
        bottleneckAnalysis: null,
        baselineComparison: null,
        recommendations: null,
        appendices: {}
    };
    
    // Create executive summary with key performance findings and recommendations
    if (options.includeExecutiveSummary) {
        report.executiveSummary = {
            testOverview: {
                scenario: testResults.results?.scenario || 'Load Test',
                duration: formatDuration(testResults.results?.actualDuration || 0),
                concurrency: testResults.testConfiguration?.concurrency || 'N/A',
                totalRequests: testResults.metrics?.totalRequests || 0,
                successRate: `${(testResults.metrics?.successRate || 0).toFixed(2)}%`
            },
            keyFindings: generateKeyFindings(testResults),
            performanceSummary: {
                averageResponseTime: `${(testResults.metrics?.averageResponseTime || 0).toFixed(2)}ms`,
                throughput: `${(testResults.metrics?.throughput || 0).toFixed(2)} req/s`,
                errorRate: `${(testResults.metrics?.errorRate || 0).toFixed(2)}%`,
                p95ResponseTime: `${(testResults.analysis?.responseTimes?.percentiles?.p95 || 0).toFixed(2)}ms`
            },
            verdict: generatePerformanceVerdict(testResults)
        };
    }
    
    // Generate detailed performance metrics section with statistical analysis
    if (options.includeDetailedMetrics) {
        report.detailedMetrics = {
            requestMetrics: {
                totalRequests: testResults.metrics?.totalRequests || 0,
                successfulRequests: testResults.metrics?.successfulRequests || 0,
                failedRequests: testResults.metrics?.errorRequests || 0,
                timeouts: testResults.metrics?.timeouts || 0,
                connectionErrors: testResults.metrics?.connectionErrors || 0
            },
            responseTimeMetrics: testResults.analysis?.responseTimes || {},
            throughputMetrics: testResults.metrics?.throughputAnalysis || {},
            systemResourceMetrics: testResults.monitoring?.systemMetrics || {},
            concurrencyMetrics: {
                targetConcurrency: testResults.testConfiguration?.concurrency || 0,
                actualConcurrency: testResults.metrics?.actualConcurrency || 0,
                concurrencyEfficiency: calculateConcurrencyEfficiency(testResults)
            }
        };
    }
    
    // Include throughput analysis with requests per second and capacity metrics
    if (testResults.metrics?.throughputAnalysis) {
        report.detailedMetrics.throughputAnalysis = {
            ...testResults.metrics.throughputAnalysis,
            capacityUtilization: calculateCapacityUtilization(testResults),
            scalabilityIndicators: generateScalabilityIndicators(testResults)
        };
    }
    
    // Add response time analysis with percentile distributions and trends
    if (testResults.analysis?.responseTimes && options.includeTrendAnalysis) {
        report.performanceAnalysis = {
            responseTimeAnalysis: testResults.analysis.responseTimes,
            trendAnalysis: testResults.analysis.trends || {},
            performanceDegradation: testResults.performanceDegradation || {},
            consistencyMetrics: calculateConsistencyMetrics(testResults)
        };
    }
    
    // Include system resource utilization analysis during load testing
    if (testResults.monitoring?.systemMetrics) {
        report.performanceAnalysis.resourceUtilization = {
            cpu: testResults.monitoring.systemMetrics.cpu || {},
            memory: testResults.monitoring.systemMetrics.memory || {},
            network: testResults.monitoring.systemMetrics.network || {},
            process: testResults.monitoring.systemMetrics.process || {}
        };
    }
    
    // Add performance baseline comparison if baseline data is available
    if (testResults.baselineComparison && testResults.baselineComparison.comparisonAvailable) {
        report.baselineComparison = {
            comparisonSummary: testResults.baselineComparison.summary || {},
            performanceRegression: testResults.baselineComparison.regression || {},
            improvements: testResults.baselineComparison.improvements || {},
            recommendations: testResults.baselineComparison.recommendations || []
        };
    }
    
    // Generate capacity planning recommendations based on test results
    if (options.includeRecommendations) {
        report.recommendations = {
            capacityPlanning: generateCapacityPlanningRecommendations(testResults),
            performanceOptimization: generateOptimizationRecommendations(testResults),
            scalingGuidance: generateScalingGuidance(testResults),
            monitoringSetup: generateMonitoringRecommendations(testResults)
        };
    }
    
    // Include bottleneck analysis and optimization opportunities
    if (testResults.bottleneckAnalysis) {
        report.bottleneckAnalysis = {
            identifiedBottlenecks: testResults.bottleneckAnalysis.bottlenecks || {},
            rootCauseAnalysis: testResults.bottleneckAnalysis.correlationAnalysis || {},
            optimizationOpportunities: testResults.bottleneckAnalysis.recommendations || [],
            prioritizedActions: prioritizeOptimizationActions(testResults.bottleneckAnalysis)
        };
    }
    
    // Add appendices with raw data and technical details
    report.appendices = {
        rawMetrics: options.detailLevel === 'comprehensive' ? testResults.metrics : null,
        testConfiguration: testResults.testConfiguration,
        environmentInfo: gatherEnvironmentInfo(),
        testTimeline: generateTestTimeline(testResults)
    };
    
    logger.info('Load test report generation completed', {
        reportId: report.metadata.reportId,
        sections: Object.keys(report).filter(key => report[key] !== null).length,
        recommendations: report.recommendations ? Object.keys(report.recommendations).length : 0
    });
    
    // Format report for console output and file export
    // Return comprehensive load test report object
    return {
        success: true,
        report: report,
        formattedOutput: formatReportForConsole(report),
        exportData: options.includeExport ? formatReportForExport(report) : null,
        summary: generateReportSummary(report)
    };
}

/**
 * Comprehensive load testing class that orchestrates concurrent request generation, performance monitoring,
 * and results analysis for the Node.js HTTP server with configurable test scenarios and detailed performance reporting
 */
class LoadTester extends EventEmitter {
    /**
     * Initializes load tester with configuration, test environment, performance monitoring, and baseline comparison capabilities
     * @param {object} config - Load test configuration with scenario settings and performance thresholds
     */
    constructor(config = {}) {
        super();
        
        // Validate load test configuration and scenario parameters
        this.config = this.validateConfig(config);
        
        // Create TestEnvironment instance for isolated load testing
        this.testEnvironment = config.testEnvironment || null;
        
        // Initialize PerformanceMonitor for real-time metrics collection
        this.performanceMonitor = config.performanceMonitor || null;
        
        // Load performance baseline data for comparison if available
        this.baseline = config.baseline || null;
        
        // Initialize HTTP client pool for concurrent request generation
        this.clients = [];
        this.activeClients = 0;
        
        // Set up results collection and analysis infrastructure
        this.results = {
            startTime: null,
            endTime: null,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimeData: [],
            throughputData: [],
            systemMetrics: [],
            errors: []
        };
        
        // Configure logging for load test progress and debug output
        this.isRunning = false;
        this.testId = `load_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        logger.info('LoadTester initialized successfully', {
            testId: this.testId,
            scenario: this.config.scenario,
            concurrency: this.config.concurrency,
            duration: this.config.duration
        });
    }
    
    /**
     * Executes complete load test with the configured scenario, concurrent request generation, and comprehensive results analysis
     * @param {object} runOptions - Optional runtime configuration overrides for specific test execution
     * @returns {Promise<object>} Promise resolving to complete load test results with performance metrics and analysis
     */
    async run(runOptions = {}) {
        // Set load test running state and initialize test execution tracking
        if (this.isRunning) {
            throw new Error('Load test is already running');
        }
        
        this.isRunning = true;
        this.results.startTime = Date.now();
        
        const effectiveConfig = { ...this.config, ...runOptions };
        
        logger.info('Starting load test execution', {
            testId: this.testId,
            scenario: effectiveConfig.scenario,
            configuration: effectiveConfig
        });
        
        try {
            // Set up test environment with dedicated server instance
            if (!this.testEnvironment) {
                throw new Error('Test environment is required for load test execution');
            }
            
            // Start performance monitoring and system resource tracking
            if (this.performanceMonitor) {
                await this.performanceMonitor.startMonitoring();
                logger.info('Performance monitoring started');
            }
            
            // Execute configured load test scenario with concurrent requests
            const scenarioResults = await this.executeScenario(effectiveConfig.scenario, effectiveConfig);
            
            // Monitor test progress and collect real-time performance metrics
            this.emit('testProgress', {
                testId: this.testId,
                progress: 100,
                currentMetrics: scenarioResults.metrics
            });
            
            // Handle test completion and perform statistical analysis
            this.results.endTime = Date.now();
            this.results.actualDuration = this.results.endTime - this.results.startTime;
            
            // Compare results against baseline performance if available
            let baselineComparison = null;
            if (this.baseline) {
                try {
                    baselineComparison = await this.baseline.compareWithBaseline(scenarioResults);
                    logger.info('Baseline comparison completed');
                } catch (baselineError) {
                    logger.warn('Baseline comparison failed', { error: baselineError.message });
                }
            }
            
            // Generate comprehensive test report with findings and recommendations
            const performanceAnalysis = await this.analyzePerformance(scenarioResults);
            
            logger.info('Load test execution completed successfully', {
                testId: this.testId,
                duration: this.results.actualDuration,
                totalRequests: scenarioResults.totalRequests,
                successRate: scenarioResults.successRate
            });
            
            this.emit('testCompleted', {
                testId: this.testId,
                results: scenarioResults,
                analysis: performanceAnalysis,
                baselineComparison: baselineComparison
            });
            
            // Return complete load test results with detailed analysis
            return {
                testId: this.testId,
                scenario: effectiveConfig.scenario,
                configuration: effectiveConfig,
                results: scenarioResults,
                analysis: performanceAnalysis,
                baselineComparison: baselineComparison,
                actualDuration: this.results.actualDuration,
                timestamp: this.results.endTime
            };
            
        } catch (error) {
            logger.error('Load test execution failed', {
                testId: this.testId,
                error: error.message,
                stack: error.stack
            });
            
            this.emit('testFailed', {
                testId: this.testId,
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
            
        } finally {
            this.isRunning = false;
            
            // Clean up test environment and client connections
            await this.cleanup();
        }
    }
    
    /**
     * Executes specific load test scenario with configured parameters including ramp-up, sustained load, and ramp-down phases
     * @param {string} scenarioType - Type of load test scenario to execute (light, moderate, heavy, stress, spike)
     * @param {object} scenarioConfig - Scenario-specific configuration overrides
     * @returns {Promise<object>} Promise resolving to scenario execution results with performance metrics
     */
    async executeScenario(scenarioType, scenarioConfig) {
        logger.info('Executing load test scenario', { 
            scenario: scenarioType,
            testId: this.testId 
        });
        
        // Configure scenario parameters based on scenario type and overrides
        const phaseConfig = this.buildPhaseConfiguration(scenarioType, scenarioConfig);
        
        const scenarioResults = {
            scenario: scenarioType,
            phases: [],
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimeData: [],
            metrics: {}
        };
        
        // Initialize concurrent HTTP clients for the specified concurrency level
        await this.startConcurrentClients(phaseConfig.concurrency, scenarioConfig);
        
        // Execute ramp-up phase with gradually increasing request rate
        if (phaseConfig.rampUpTime > 0) {
            logger.info('Starting ramp-up phase', { duration: phaseConfig.rampUpTime });
            const rampUpResults = await this.executePhase('ramp-up', phaseConfig.rampUpTime, {
                startConcurrency: 1,
                endConcurrency: phaseConfig.concurrency,
                requestsPerSecond: phaseConfig.requestsPerSecond * 0.5
            });
            scenarioResults.phases.push(rampUpResults);
            this.aggregatePhaseResults(scenarioResults, rampUpResults);
        }
        
        // Run sustained load phase with target concurrency and request rate
        logger.info('Starting sustained load phase', { 
            duration: phaseConfig.sustainedDuration,
            concurrency: phaseConfig.concurrency 
        });
        const sustainedResults = await this.executePhase('sustained', phaseConfig.sustainedDuration, {
            concurrency: phaseConfig.concurrency,
            requestsPerSecond: phaseConfig.requestsPerSecond
        });
        scenarioResults.phases.push(sustainedResults);
        this.aggregatePhaseResults(scenarioResults, sustainedResults);
        
        // Execute ramp-down phase with gradually decreasing load
        if (phaseConfig.rampDownTime > 0) {
            logger.info('Starting ramp-down phase', { duration: phaseConfig.rampDownTime });
            const rampDownResults = await this.executePhase('ramp-down', phaseConfig.rampDownTime, {
                startConcurrency: phaseConfig.concurrency,
                endConcurrency: 1,
                requestsPerSecond: phaseConfig.requestsPerSecond * 0.3
            });
            scenarioResults.phases.push(rampDownResults);
            this.aggregatePhaseResults(scenarioResults, rampDownResults);
        }
        
        // Collect performance metrics throughout all test phases
        scenarioResults.metrics = this.calculateScenarioMetrics(scenarioResults);
        
        // Analyze scenario results and identify performance characteristics
        scenarioResults.successRate = scenarioResults.totalRequests > 0 ? 
            (scenarioResults.successfulRequests / scenarioResults.totalRequests) * 100 : 0;
        scenarioResults.errorRate = 100 - scenarioResults.successRate;
        
        logger.info('Scenario execution completed', {
            scenario: scenarioType,
            totalRequests: scenarioResults.totalRequests,
            successRate: scenarioResults.successRate.toFixed(2),
            averageResponseTime: scenarioResults.metrics.averageResponseTime
        });
        
        // Return scenario execution results with phase-specific analysis
        return scenarioResults;
    }
    
    /**
     * Initializes and starts concurrent HTTP clients for generating sustained load against the target server
     * @param {number} concurrency - Number of concurrent clients to start
     * @param {object} clientConfig - Configuration for HTTP clients including request patterns
     * @returns {Promise<array>} Promise resolving to array of active HTTP client instances
     */
    async startConcurrentClients(concurrency, clientConfig) {
        logger.info('Starting concurrent HTTP clients', { 
            concurrency: concurrency,
            testId: this.testId 
        });
        
        // Create HTTP client instances based on concurrency requirements
        this.clients = [];
        
        for (let i = 0; i < concurrency; i++) {
            // Configure each client with unique identification and request parameters
            const client = new ConcurrentClient(`${this.testId}_client_${i}`, {
                serverUrl: clientConfig.serverUrl || this.config.serverUrl,
                endpoints: clientConfig.endpoints || ['/hello'],
                timeout: clientConfig.timeout || 10000,
                method: clientConfig.method || 'GET',
                headers: clientConfig.headers || {},
                rateLimiting: clientConfig.rateLimiting || false
            });
            
            this.clients.push(client);
        }
        
        // Establish HTTP connections to target server for each client
        const startPromises = this.clients.map(async (client) => {
            try {
                // Initialize request timing and performance measurement per client
                await client.start({
                    warmupRequests: 1,
                    connectionTimeout: 5000
                });
                this.activeClients++;
                return client;
            } catch (startError) {
                logger.error('Client start failed', {
                    clientId: client.clientId,
                    error: startError.message
                });
                throw startError;
            }
        });
        
        // Start concurrent request generation with coordinated timing
        const activeClients = await Promise.all(startPromises);
        
        logger.info('Concurrent clients started successfully', {
            totalClients: activeClients.length,
            activeClients: this.activeClients
        });
        
        // Return array of active client instances for load generation
        return activeClients;
    }
    
    /**
     * Collects and aggregates performance results from all concurrent clients and system monitoring
     * @returns {object} Aggregated load test results with comprehensive performance metrics
     */
    async collectResults() {
        logger.info('Collecting results from all clients and monitoring systems', {
            testId: this.testId,
            activeClients: this.activeClients
        });
        
        const aggregatedResults = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimeData: [],
            throughputData: [],
            clientResults: [],
            systemMetrics: null,
            errors: []
        };
        
        // Collect request results from all concurrent HTTP clients
        for (const client of this.clients) {
            try {
                const clientStats = client.getStats();
                
                aggregatedResults.totalRequests += clientStats.requestCount;
                aggregatedResults.successfulRequests += clientStats.successCount;
                aggregatedResults.failedRequests += clientStats.errorCount;
                aggregatedResults.responseTimeData.push(...clientStats.responseTimeData);
                
                aggregatedResults.clientResults.push({
                    clientId: client.clientId,
                    stats: clientStats
                });
                
                if (clientStats.errors.length > 0) {
                    aggregatedResults.errors.push(...clientStats.errors);
                }
                
            } catch (clientError) {
                logger.error('Error collecting client results', {
                    clientId: client.clientId,
                    error: clientError.message
                });
                
                aggregatedResults.errors.push({
                    type: 'client_collection_error',
                    clientId: client.clientId,
                    message: clientError.message,
                    timestamp: Date.now()
                });
            }
        }
        
        // Aggregate performance metrics including response times and throughput
        aggregatedResults.averageResponseTime = this.calculateAverageResponseTime(aggregatedResults.responseTimeData);
        aggregatedResults.successRate = aggregatedResults.totalRequests > 0 ? 
            (aggregatedResults.successfulRequests / aggregatedResults.totalRequests) * 100 : 0;
        aggregatedResults.errorRate = 100 - aggregatedResults.successRate;
        
        // Gather system resource utilization data from performance monitor
        if (this.performanceMonitor) {
            try {
                aggregatedResults.systemMetrics = this.performanceMonitor.getPerformanceSnapshot({
                    includeHistoricalData: true,
                    includeThresholdAnalysis: true
                });
                
                logger.info('System metrics collected from performance monitor');
            } catch (monitorError) {
                logger.warn('Failed to collect system metrics', { error: monitorError.message });
            }
        }
        
        // Calculate statistical measures and performance distributions
        if (aggregatedResults.responseTimeData.length > 0) {
            aggregatedResults.responseTimeAnalysis = analyzeResponseTimes(aggregatedResults.responseTimeData);
        }
        
        // Identify performance trends and patterns during test execution
        aggregatedResults.testDuration = this.results.actualDuration || 0;
        aggregatedResults.throughput = aggregatedResults.testDuration > 0 ? 
            (aggregatedResults.totalRequests / aggregatedResults.testDuration) * 1000 : 0;
        
        logger.info('Results collection completed', {
            totalRequests: aggregatedResults.totalRequests,
            successRate: aggregatedResults.successRate.toFixed(2),
            averageResponseTime: aggregatedResults.averageResponseTime.toFixed(2),
            throughput: aggregatedResults.throughput.toFixed(2)
        });
        
        // Return comprehensive results object with all collected metrics
        return aggregatedResults;
    }
    
    /**
     * Performs comprehensive performance analysis on collected results including statistical analysis and bottleneck detection
     * @param {object} testResults - Raw test results from load test execution
     * @returns {object} Performance analysis with statistical metrics, bottleneck identification, and recommendations
     */
    async analyzePerformance(testResults) {
        logger.info('Performing comprehensive performance analysis', {
            testId: this.testId,
            totalRequests: testResults.totalRequests
        });
        
        const performanceAnalysis = {
            responseTimes: null,
            throughput: null,
            errors: null,
            trends: null,
            bottlenecks: null,
            recommendations: []
        };
        
        // Perform statistical analysis on response times and throughput metrics
        if (testResults.responseTimeData && testResults.responseTimeData.length > 0) {
            performanceAnalysis.responseTimes = analyzeResponseTimes(testResults.responseTimeData);
            logger.info('Response time analysis completed');
        }
        
        // Calculate performance percentiles and distribution characteristics
        if (testResults.testDuration && testResults.totalRequests > 0) {
            performanceAnalysis.throughput = measureThroughput(
                testResults.responseTimeData,
                testResults.testDuration
            );
            logger.info('Throughput analysis completed');
        }
        
        // Identify performance bottlenecks and resource constraints
        performanceAnalysis.bottlenecks = detectPerformanceBottlenecks({
            results: testResults,
            analysis: performanceAnalysis,
            monitoring: testResults.systemMetrics
        });
        
        // Analyze error patterns and failure modes during testing
        if (testResults.errors && testResults.errors.length > 0) {
            performanceAnalysis.errors = {
                totalErrors: testResults.errors.length,
                errorTypes: this.categorizeErrors(testResults.errors),
                errorRate: (testResults.errors.length / testResults.totalRequests) * 100,
                errorPatterns: this.analyzeErrorPatterns(testResults.errors)
            };
            logger.info('Error analysis completed');
        }
        
        // Compare performance against thresholds and baseline data
        performanceAnalysis.thresholdAnalysis = this.analyzeThresholdCompliance(testResults, performanceAnalysis);
        
        // Generate performance analysis with actionable insights
        performanceAnalysis.recommendations = this.generatePerformanceRecommendations(
            performanceAnalysis,
            testResults
        );
        
        // Identify performance trends over test duration
        if (testResults.phases && testResults.phases.length > 0) {
            performanceAnalysis.trends = this.analyzeTrendData(testResults.phases);
            logger.info('Trend analysis completed');
        }
        
        logger.info('Performance analysis completed successfully', {
            bottlenecksFound: performanceAnalysis.bottlenecks ? 
                Object.values(performanceAnalysis.bottlenecks).reduce((total, arr) => total + arr.length, 0) : 0,
            recommendationsGenerated: performanceAnalysis.recommendations.length
        });
        
        // Return comprehensive performance analysis with recommendations
        return performanceAnalysis;
    }
    
    /**
     * Performs cleanup after load test completion including client disconnection, resource cleanup, and environment teardown
     * @returns {Promise<void>} Promise resolving when cleanup is complete
     */
    async cleanup() {
        logger.info('Starting load tester cleanup', { testId: this.testId });
        
        const cleanupTasks = [];
        
        // Stop performance monitoring and metrics collection
        if (this.performanceMonitor) {
            cleanupTasks.push(
                this.performanceMonitor.stopMonitoring()
                    .then(() => logger.info('Performance monitoring stopped'))
                    .catch(error => logger.warn('Performance monitoring cleanup failed', { error: error.message }))
            );
        }
        
        // Disconnect all concurrent HTTP clients and close connections
        if (this.clients.length > 0) {
            for (const client of this.clients) {
                cleanupTasks.push(
                    client.stop()
                        .then(() => logger.info('Client stopped successfully', { clientId: client.clientId }))
                        .catch(error => logger.warn('Client cleanup failed', { 
                            clientId: client.clientId, 
                            error: error.message 
                        }))
                );
            }
        }
        
        // Execute all cleanup tasks concurrently
        await Promise.allSettled(cleanupTasks);
        
        // Clean up temporary files and measurement data
        this.clients = [];
        this.activeClients = 0;
        
        // Reset load tester state for potential reuse
        this.isRunning = false;
        this.results = {
            startTime: null,
            endTime: null,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimeData: [],
            throughputData: [],
            systemMetrics: [],
            errors: []
        };
        
        // Log cleanup completion and final statistics
        logger.info('Load tester cleanup completed successfully', { 
            testId: this.testId,
            cleanupTasks: cleanupTasks.length
        });
    }
    
    // Private helper methods for load tester internal operations
    
    validateConfig(config) {
        const validatedConfig = {
            scenario: config.scenario || LOAD_TEST_SCENARIOS.LIGHT,
            duration: config.duration || DEFAULT_LOAD_CONFIG.duration,
            concurrency: config.concurrency || DEFAULT_LOAD_CONFIG.concurrency,
            rampUpTime: config.rampUpTime || DEFAULT_LOAD_CONFIG.rampUpTime,
            rampDownTime: config.rampDownTime || DEFAULT_LOAD_CONFIG.rampDownTime,
            requestsPerSecond: config.requestsPerSecond || DEFAULT_LOAD_CONFIG.requestsPerSecond,
            serverUrl: config.serverUrl || 'http://localhost:3000',
            endpoints: config.endpoints || ['/hello'],
            ...config
        };
        
        // Validate scenario type
        if (!Object.values(LOAD_TEST_SCENARIOS).includes(validatedConfig.scenario)) {
            throw new Error(`Invalid scenario type: ${validatedConfig.scenario}`);
        }
        
        // Validate numeric parameters
        if (validatedConfig.duration <= 0 || validatedConfig.concurrency <= 0) {
            throw new Error('Duration and concurrency must be positive numbers');
        }
        
        return validatedConfig;
    }
    
    buildPhaseConfiguration(scenarioType, scenarioConfig) {
        const baseConfig = {
            concurrency: scenarioConfig.concurrency,
            requestsPerSecond: scenarioConfig.requestsPerSecond,
            rampUpTime: scenarioConfig.rampUpTime,
            rampDownTime: scenarioConfig.rampDownTime,
            sustainedDuration: scenarioConfig.duration - scenarioConfig.rampUpTime - scenarioConfig.rampDownTime
        };
        
        // Ensure sustained duration is positive
        if (baseConfig.sustainedDuration <= 0) {
            baseConfig.sustainedDuration = Math.max(10000, scenarioConfig.duration * 0.6);
            baseConfig.rampUpTime = Math.min(baseConfig.rampUpTime, scenarioConfig.duration * 0.2);
            baseConfig.rampDownTime = Math.min(baseConfig.rampDownTime, scenarioConfig.duration * 0.2);
        }
        
        return baseConfig;
    }
    
    async executePhase(phaseName, duration, phaseConfig) {
        const phaseStartTime = Date.now();
        const phaseResults = {
            phaseName: phaseName,
            duration: duration,
            config: phaseConfig,
            requests: [],
            startTime: phaseStartTime,
            endTime: null
        };
        
        // Execute requests during phase
        const phaseEndTime = phaseStartTime + duration;
        
        while (Date.now() < phaseEndTime && this.activeClients > 0) {
            const remainingTime = phaseEndTime - Date.now();
            const batchDuration = Math.min(1000, remainingTime); // 1 second batches
            
            if (batchDuration <= 0) break;
            
            // Execute concurrent requests for this batch
            const batchPromises = this.clients.map(async (client) => {
                if (!client.isActive) return [];
                
                try {
                    const endpoint = phaseConfig.endpoints ? 
                        phaseConfig.endpoints[Math.floor(Math.random() * phaseConfig.endpoints.length)] :
                        '/hello';
                    
                    const result = await client.makeRequest(endpoint);
                    return [result];
                } catch (error) {
                    return [{
                        success: false,
                        error: error.message,
                        timestamp: Date.now(),
                        clientId: client.clientId
                    }];
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            for (const clientResults of batchResults) {
                phaseResults.requests.push(...clientResults);
            }
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        phaseResults.endTime = Date.now();
        phaseResults.actualDuration = phaseResults.endTime - phaseResults.startTime;
        
        return phaseResults;
    }
    
    aggregatePhaseResults(scenarioResults, phaseResults) {
        const successfulRequests = phaseResults.requests.filter(r => r.success);
        const failedRequests = phaseResults.requests.filter(r => !r.success);
        
        scenarioResults.totalRequests += phaseResults.requests.length;
        scenarioResults.successfulRequests += successfulRequests.length;
        scenarioResults.failedRequests += failedRequests.length;
        
        const responseTimeData = successfulRequests
            .map(r => r.responseTimeMs)
            .filter(rt => typeof rt === 'number' && rt > 0);
        
        scenarioResults.responseTimeData.push(...responseTimeData);
    }
    
    calculateScenarioMetrics(scenarioResults) {
        const metrics = {
            totalRequests: scenarioResults.totalRequests,
            successfulRequests: scenarioResults.successfulRequests,
            failedRequests: scenarioResults.failedRequests,
            averageResponseTime: 0,
            throughput: 0
        };
        
        if (scenarioResults.responseTimeData.length > 0) {
            metrics.averageResponseTime = scenarioResults.responseTimeData.reduce((sum, rt) => sum + rt, 0) / 
                scenarioResults.responseTimeData.length;
        }
        
        const totalDuration = scenarioResults.phases.reduce((sum, phase) => sum + phase.actualDuration, 0);
        if (totalDuration > 0) {
            metrics.throughput = (scenarioResults.totalRequests / totalDuration) * 1000;
        }
        
        return metrics;
    }
    
    calculateAverageResponseTime(responseTimeData) {
        if (!responseTimeData || responseTimeData.length === 0) return 0;
        
        const validTimes = responseTimeData.filter(time => typeof time === 'number' && time > 0);
        if (validTimes.length === 0) return 0;
        
        return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
    }
    
    categorizeErrors(errors) {
        const categories = {
            network: [],
            timeout: [],
            server: [],
            client: [],
            unknown: []
        };
        
        for (const error of errors) {
            if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                categories.timeout.push(error);
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                categories.network.push(error);
            } else if (error.statusCode && error.statusCode >= 500) {
                categories.server.push(error);
            } else if (error.statusCode && error.statusCode >= 400) {
                categories.client.push(error);
            } else {
                categories.unknown.push(error);
            }
        }
        
        return categories;
    }
    
    analyzeErrorPatterns(errors) {
        // Group errors by time windows to identify patterns
        const timeWindows = {};
        const windowSize = 10000; // 10 second windows
        
        for (const error of errors) {
            const windowStart = Math.floor(error.timestamp / windowSize) * windowSize;
            if (!timeWindows[windowStart]) {
                timeWindows[windowStart] = [];
            }
            timeWindows[windowStart].push(error);
        }
        
        return {
            totalWindows: Object.keys(timeWindows).length,
            highErrorWindows: Object.entries(timeWindows)
                .filter(([window, errors]) => errors.length > 5)
                .map(([window, errors]) => ({
                    windowStart: parseInt(window),
                    errorCount: errors.length
                }))
        };
    }
    
    analyzeThresholdCompliance(testResults, performanceAnalysis) {
        const compliance = {
            responseTime: { passed: false, value: 0, threshold: PERFORMANCE_THRESHOLDS.responseTime },
            errorRate: { passed: false, value: 0, threshold: PERFORMANCE_THRESHOLDS.errorRate },
            throughput: { passed: false, value: 0, threshold: PERFORMANCE_THRESHOLDS.throughput }
        };
        
        if (performanceAnalysis.responseTimes) {
            compliance.responseTime.value = performanceAnalysis.responseTimes.percentiles?.p95 || 0;
            compliance.responseTime.passed = compliance.responseTime.value <= compliance.responseTime.threshold;
        }
        
        compliance.errorRate.value = testResults.errorRate || 0;
        compliance.errorRate.passed = compliance.errorRate.value <= compliance.errorRate.threshold;
        
        if (performanceAnalysis.throughput) {
            compliance.throughput.value = performanceAnalysis.throughput.requestsPerSecond || 0;
            compliance.throughput.passed = compliance.throughput.value >= compliance.throughput.threshold;
        }
        
        return compliance;
    }
    
    generatePerformanceRecommendations(performanceAnalysis, testResults) {
        const recommendations = [];
        
        // Response time recommendations
        if (performanceAnalysis.responseTimes && performanceAnalysis.responseTimes.percentiles.p95 > PERFORMANCE_THRESHOLDS.responseTime) {
            recommendations.push({
                category: 'response_time',
                priority: 'high',
                issue: 'High response time percentiles',
                recommendation: 'Optimize request processing pipeline and reduce computational overhead',
                metrics: {
                    current: performanceAnalysis.responseTimes.percentiles.p95,
                    threshold: PERFORMANCE_THRESHOLDS.responseTime
                }
            });
        }
        
        // Error rate recommendations
        if (testResults.errorRate > PERFORMANCE_THRESHOLDS.errorRate) {
            recommendations.push({
                category: 'error_handling',
                priority: 'critical',
                issue: 'High error rate detected',
                recommendation: 'Investigate and fix underlying causes of request failures',
                metrics: {
                    current: testResults.errorRate,
                    threshold: PERFORMANCE_THRESHOLDS.errorRate
                }
            });
        }
        
        // Throughput recommendations
        if (performanceAnalysis.throughput && performanceAnalysis.throughput.requestsPerSecond < PERFORMANCE_THRESHOLDS.throughput) {
            recommendations.push({
                category: 'throughput',
                priority: 'medium',
                issue: 'Throughput below target threshold',
                recommendation: 'Consider scaling strategies and performance optimization',
                metrics: {
                    current: performanceAnalysis.throughput.requestsPerSecond,
                    threshold: PERFORMANCE_THRESHOLDS.throughput
                }
            });
        }
        
        return recommendations;
    }
    
    analyzeTrendData(phases) {
        const trends = {
            responseTimeTrend: 'stable',
            throughputTrend: 'stable',
            errorRateTrend: 'stable',
            phaseComparison: []
        };
        
        // Analyze trends across phases
        for (let i = 1; i < phases.length; i++) {
            const previousPhase = phases[i - 1];
            const currentPhase = phases[i];
            
            trends.phaseComparison.push({
                phase: currentPhase.phaseName,
                changes: {
                    requestCount: currentPhase.requests.length - previousPhase.requests.length,
                    // Additional trend analysis would be implemented here
                }
            });
        }
        
        return trends;
    }
}

/**
 * Individual HTTP client class that generates concurrent requests with precise timing control,
 * error handling, and performance measurement for load testing scenarios
 */
class ConcurrentClient {
    /**
     * Initializes concurrent HTTP client with configuration, request tracking, and performance measurement capabilities
     * @param {string} clientId - Unique identifier for the client
     * @param {object} clientConfig - Configuration for client behavior and request patterns
     */
    constructor(clientId, clientConfig = {}) {
        // Store client ID and configuration for request tracking
        this.clientId = clientId;
        this.config = {
            serverUrl: clientConfig.serverUrl || 'http://localhost:3000',
            endpoints: clientConfig.endpoints || ['/hello'],
            timeout: clientConfig.timeout || 10000,
            method: clientConfig.method || 'GET',
            headers: clientConfig.headers || {},
            rateLimiting: clientConfig.rateLimiting || false,
            requestsPerSecond: clientConfig.requestsPerSecond || null,
            ...clientConfig
        };
        
        // Initialize request results collection array
        this.requestResults = [];
        
        // Set up performance statistics tracking for the client
        this.stats = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            responseTimeData: [],
            errors: [],
            startTime: null,
            endTime: null
        };
        
        // Configure HTTP client options including timeouts and connection settings
        this.httpAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            timeout: this.config.timeout
        });
        
        // Initialize client state tracking for lifecycle management
        this.isActive = false;
        this.requestQueue = [];
        
        logger.info('ConcurrentClient initialized', {
            clientId: this.clientId,
            serverUrl: this.config.serverUrl,
            endpoints: this.config.endpoints
        });
    }
    
    /**
     * Starts the concurrent client to begin generating HTTP requests according to configured patterns
     * @param {object} startOptions - Runtime options for client request generation
     * @returns {Promise<void>} Promise resolving when client startup is complete
     */
    async start(startOptions = {}) {
        const options = {
            warmupRequests: startOptions.warmupRequests || 0,
            connectionTimeout: startOptions.connectionTimeout || 5000,
            ...startOptions
        };
        
        logger.info('Starting concurrent client', {
            clientId: this.clientId,
            options: options
        });
        
        // Set client active state and initialize request generation
        this.isActive = true;
        this.stats.startTime = Date.now();
        
        try {
            // Configure request timing based on rate limiting and patterns
            if (options.warmupRequests > 0) {
                logger.info('Performing warmup requests', {
                    clientId: this.clientId,
                    warmupCount: options.warmupRequests
                });
                
                for (let i = 0; i < options.warmupRequests; i++) {
                    try {
                        const warmupEndpoint = this.config.endpoints[0] || '/hello';
                        await this.makeRequest(warmupEndpoint, { isWarmup: true });
                    } catch (warmupError) {
                        logger.warn('Warmup request failed', {
                            clientId: this.clientId,
                            error: warmupError.message
                        });
                    }
                }
            }
            
            // Begin performance measurement and results collection
            logger.info('Concurrent client started successfully', {
                clientId: this.clientId,
                isActive: this.isActive
            });
            
        } catch (startError) {
            this.isActive = false;
            logger.error('Concurrent client start failed', {
                clientId: this.clientId,
                error: startError.message
            });
            throw startError;
        }
        
        // Log client startup completion with configuration details
    }
    
    /**
     * Makes individual HTTP request with timing measurement and result tracking
     * @param {string} endpoint - Target endpoint path for the HTTP request
     * @param {object} requestOptions - HTTP request options including headers and method
     * @returns {Promise<object>} Promise resolving to request result with timing and status information
     */
    async makeRequest(endpoint, requestOptions = {}) {
        if (!this.isActive) {
            throw new Error(`Client ${this.clientId} is not active`);
        }
        
        const options = {
            correlationId: requestOptions.correlationId || `${this.clientId}_${Date.now()}`,
            isWarmup: requestOptions.isWarmup || false,
            ...requestOptions
        };
        
        // Record request start time with high-resolution timer
        const startTime = performance.now();
        const requestTimestamp = Date.now();
        
        const requestResult = {
            success: false,
            correlationId: options.correlationId,
            endpoint: endpoint,
            method: this.config.method,
            clientId: this.clientId,
            startTime: requestTimestamp,
            responseTimeMs: 0,
            statusCode: null,
            error: null,
            isWarmup: options.isWarmup
        };
        
        try {
            // Create HTTP request to target endpoint with configured options
            const url = new URL(endpoint, this.config.serverUrl);
            const requestData = await this.executeHttpRequest(url, {
                method: this.config.method,
                headers: {
                    'User-Agent': `LoadTest-${this.clientId}`,
                    'Connection': 'keep-alive',
                    ...this.config.headers
                },
                timeout: this.config.timeout,
                agent: this.httpAgent
            });
            
            // Handle request timeout and connection errors
            // Receive and process HTTP response
            requestResult.success = true;
            requestResult.statusCode = requestData.statusCode;
            requestResult.responseSize = requestData.responseSize || 0;
            requestResult.headers = requestData.headers || {};
            
        } catch (requestError) {
            // Handle various types of request errors
            requestResult.success = false;
            requestResult.error = requestError.message;
            requestResult.statusCode = requestError.statusCode || 0;
            
            this.stats.errors.push({
                correlationId: options.correlationId,
                endpoint: endpoint,
                error: requestError.message,
                timestamp: requestTimestamp
            });
        }
        
        // Record request completion time and calculate duration
        const endTime = performance.now();
        requestResult.responseTimeMs = parseFloat((endTime - startTime).toFixed(2));
        requestResult.endTime = Date.now();
        
        // Update client statistics with request result
        if (!options.isWarmup) {
            this.stats.requestCount++;
            if (requestResult.success) {
                this.stats.successCount++;
                this.stats.responseTimeData.push(requestResult.responseTimeMs);
            } else {
                this.stats.errorCount++;
            }
            
            this.requestResults.push(requestResult);
        }
        
        // Return request result object with timing and status data
        return requestResult;
    }
    
    /**
     * Stops the concurrent client and finalizes request generation with results collection
     * @returns {Promise<object>} Promise resolving to client results summary when stopped
     */
    async stop() {
        logger.info('Stopping concurrent client', { clientId: this.clientId });
        
        // Set client inactive state to stop new request generation
        this.isActive = false;
        this.stats.endTime = Date.now();
        
        // Complete any in-flight requests with timeout handling
        // Note: In a more complex implementation, we would wait for in-flight requests
        // For this educational example, we'll perform immediate cleanup
        
        // Finalize client performance statistics
        const clientSummary = {
            clientId: this.clientId,
            duration: this.stats.endTime - (this.stats.startTime || this.stats.endTime),
            totalRequests: this.stats.requestCount,
            successfulRequests: this.stats.successCount,
            failedRequests: this.stats.errorCount,
            successRate: this.stats.requestCount > 0 ? 
                (this.stats.successCount / this.stats.requestCount) * 100 : 0,
            averageResponseTime: this.getAverageResponseTime(),
            errors: this.stats.errors
        };
        
        // Clean up client resources and connections
        if (this.httpAgent) {
            this.httpAgent.destroy();
        }
        
        logger.info('Concurrent client stopped successfully', {
            clientId: this.clientId,
            summary: clientSummary
        });
        
        // Return client results summary with performance metrics
        return clientSummary;
    }
    
    /**
     * Returns current performance statistics for the concurrent client
     * @returns {object} Client performance statistics including request count, timing, and success rates
     */
    getStats() {
        // Calculate current request count and success rate
        const currentTime = Date.now();
        const duration = this.stats.endTime ? 
            (this.stats.endTime - this.stats.startTime) : 
            (currentTime - (this.stats.startTime || currentTime));
        
        // Compute average response time and performance metrics
        const averageResponseTime = this.getAverageResponseTime();
        
        // Include error count and failure patterns
        const errorRate = this.stats.requestCount > 0 ? 
            (this.stats.errorCount / this.stats.requestCount) * 100 : 0;
        
        const successRate = this.stats.requestCount > 0 ? 
            (this.stats.successCount / this.stats.requestCount) * 100 : 0;
        
        // Return comprehensive client statistics object
        return {
            clientId: this.clientId,
            isActive: this.isActive,
            duration: duration,
            requestCount: this.stats.requestCount,
            successCount: this.stats.successCount,
            errorCount: this.stats.errorCount,
            successRate: parseFloat(successRate.toFixed(2)),
            errorRate: parseFloat(errorRate.toFixed(2)),
            averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
            responseTimeData: [...this.stats.responseTimeData],
            errors: [...this.stats.errors],
            throughput: duration > 0 ? (this.stats.requestCount / duration) * 1000 : 0
        };
    }
    
    // Private helper methods for HTTP request execution and statistics
    
    async executeHttpRequest(url, requestOptions) {
        return new Promise((resolve, reject) => {
            const request = http.request(url, requestOptions, (response) => {
                let responseData = '';
                let responseSize = 0;
                
                response.on('data', (chunk) => {
                    responseData += chunk;
                    responseSize += chunk.length;
                });
                
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        data: responseData,
                        responseSize: responseSize
                    });
                });
                
                response.on('error', (error) => {
                    reject(new Error(`Response error: ${error.message}`));
                });
            });
            
            request.on('error', (error) => {
                reject(new Error(`Request error: ${error.message}`));
            });
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error(`Request timeout after ${this.config.timeout}ms`));
            });
            
            request.setTimeout(this.config.timeout);
            request.end();
        });
    }
    
    getAverageResponseTime() {
        if (this.stats.responseTimeData.length === 0) return 0;
        
        const sum = this.stats.responseTimeData.reduce((total, time) => total + time, 0);
        return sum / this.stats.responseTimeData.length;
    }
}

// Utility functions for load test analysis and reporting

function validateLoadTestConfig(config) {
    const validated = { ...DEFAULT_LOAD_CONFIG, ...config };
    
    if (validated.duration <= 0) {
        throw new Error('Test duration must be positive');
    }
    
    if (validated.concurrency <= 0) {
        throw new Error('Concurrency must be positive');
    }
    
    if (validated.requestsPerSecond <= 0) {
        throw new Error('Requests per second must be positive');
    }
    
    return validated;
}

function calculateAverageResponseTime(requestResults) {
    if (!Array.isArray(requestResults) || requestResults.length === 0) {
        return 0;
    }
    
    const responseTimeData = requestResults
        .filter(result => result.success && typeof result.responseTimeMs === 'number')
        .map(result => result.responseTimeMs);
    
    if (responseTimeData.length === 0) return 0;
    
    return responseTimeData.reduce((sum, time) => sum + time, 0) / responseTimeData.length;
}

function calculateMedian(sortedArray) {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0 ? 
        (sortedArray[mid - 1] + sortedArray[mid]) / 2 : 
        sortedArray[mid];
}

function calculateStandardDeviation(values, mean) {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
}

function calculatePercentile(sortedArray, percentile) {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
        return sortedArray[lower];
    }
    
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
}

function identifyPerformanceTrends(responseTimeData) {
    if (responseTimeData.length < 10) {
        return { trend: 'insufficient_data', confidence: 0 };
    }
    
    // Simple trend analysis using linear regression
    const n = responseTimeData.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = responseTimeData;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    if (slope > 0.1) {
        return { trend: 'increasing', slope: slope, confidence: 0.8 };
    } else if (slope < -0.1) {
        return { trend: 'decreasing', slope: slope, confidence: 0.8 };
    } else {
        return { trend: 'stable', slope: slope, confidence: 0.9 };
    }
}

function analyzeResponseTimeVariability(responseTimeData) {
    if (responseTimeData.length < 2) {
        return { variability: 'insufficient_data' };
    }
    
    const mean = responseTimeData.reduce((sum, time) => sum + time, 0) / responseTimeData.length;
    const standardDeviation = calculateStandardDeviation(responseTimeData, mean);
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;
    
    let variabilityLevel = 'low';
    if (coefficientOfVariation > 0.5) {
        variabilityLevel = 'high';
    } else if (coefficientOfVariation > 0.2) {
        variabilityLevel = 'medium';
    }
    
    return {
        variability: variabilityLevel,
        coefficientOfVariation: coefficientOfVariation,
        standardDeviation: standardDeviation,
        mean: mean
    };
}

function generateResponseTimeDistribution(responseTimeData) {
    const buckets = {
        '0-50ms': 0,
        '50-100ms': 0,
        '100-200ms': 0,
        '200-500ms': 0,
        '500-1000ms': 0,
        '1000ms+': 0
    };
    
    for (const time of responseTimeData) {
        if (time <= 50) buckets['0-50ms']++;
        else if (time <= 100) buckets['50-100ms']++;
        else if (time <= 200) buckets['100-200ms']++;
        else if (time <= 500) buckets['200-500ms']++;
        else if (time <= 1000) buckets['500-1000ms']++;
        else buckets['1000ms+']++;
    }
    
    return buckets;
}

function identifyResponseTimeOutliers(responseTimeData, mean, standardDeviation) {
    const outlierThreshold = mean + (2 * standardDeviation); // 2 standard deviations
    return responseTimeData.filter(time => time > outlierThreshold);
}

function analyzeTimeDistribution(requestResults, testDurationMs) {
    const intervals = [];
    const intervalSize = 5000; // 5 second intervals
    const numIntervals = Math.ceil(testDurationMs / intervalSize);
    
    for (let i = 0; i < numIntervals; i++) {
        intervals.push({
            start: i * intervalSize,
            end: (i + 1) * intervalSize,
            requestCount: 0,
            successCount: 0
        });
    }
    
    // Distribute requests into intervals based on timestamp
    for (const result of requestResults) {
        const resultTime = result.startTime || result.timestamp || 0;
        const intervalIndex = Math.floor(resultTime / intervalSize);
        
        if (intervalIndex >= 0 && intervalIndex < intervals.length) {
            intervals[intervalIndex].requestCount++;
            if (result.success) {
                intervals[intervalIndex].successCount++;
            }
        }
    }
    
    return intervals;
}

function calculatePeakThroughput(timeIntervals) {
    if (timeIntervals.length === 0) return 0;
    
    const throughputs = timeIntervals.map(interval => {
        const duration = (interval.end - interval.start) / 1000; // Convert to seconds
        return interval.requestCount / duration;
    });
    
    return Math.max(...throughputs);
}

function calculateSustainedThroughput(timeIntervals) {
    if (timeIntervals.length === 0) return 0;
    
    // Calculate median throughput as a measure of sustained throughput
    const throughputs = timeIntervals.map(interval => {
        const duration = (interval.end - interval.start) / 1000;
        return interval.requestCount / duration;
    }).sort((a, b) => a - b);
    
    return calculateMedian(throughputs);
}

function formatDuration(durationMs) {
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
}

// Additional utility functions for comprehensive load testing analysis

function analyzePerformanceDegradation(results, scenarioType) {
    // Placeholder implementation for performance degradation analysis
    return {
        scenarioType: scenarioType,
        degradationDetected: false,
        degradationFactors: [],
        recommendations: []
    };
}

function assessProductionReadiness(results) {
    // Placeholder implementation for production readiness assessment
    return {
        ready: true,
        score: 85,
        requirements: [],
        risks: []
    };
}

function analyzeServerCapacity(results) {
    // Placeholder implementation for server capacity analysis
    return {
        maxThroughput: results.metrics?.throughput || 0,
        resourceLimits: {},
        scalingPoints: []
    };
}

function generateScalingRecommendations(capacityAnalysis) {
    // Placeholder implementation for scaling recommendations
    return {
        verticalScaling: [],
        horizontalScaling: [],
        optimizations: []
    };
}

function identifyFailurePoints(stressResults) {
    // Placeholder implementation for failure point identification
    return [];
}

function measureRecoveryBehavior(stressResults) {
    // Placeholder implementation for recovery behavior measurement
    return {
        recoveryTimeMs: 0,
        recoveryPattern: 'immediate'
    };
}

function analyzeServerResilience(stressResults, failurePoints) {
    // Placeholder implementation for server resilience analysis
    return {
        resilienceScore: 80,
        failureModes: [],
        recoveryCapabilities: []
    };
}

function generateResilienceRecommendations(resilienceAnalysis) {
    // Placeholder implementation for resilience recommendations
    return [];
}

function analyzeElasticity(baselineResults, spikeResults, recoveryResults) {
    // Placeholder implementation for elasticity analysis
    return {
        elasticityScore: 75,
        scalingEffectiveness: 'good',
        responseTime: 0
    };
}

function aggregateElasticityAnalysis(elasticityMetrics) {
    // Placeholder implementation for aggregate elasticity analysis
    return {
        elasticityScore: 75,
        scalingEffectiveness: 'good',
        overallPerformance: 'acceptable'
    };
}

function generateElasticityRecommendations(elasticityAnalysis) {
    // Placeholder implementation for elasticity recommendations
    return [];
}

function analyzeResourceCorrelation(loadTestResults) {
    // Placeholder implementation for resource correlation analysis
    return {};
}

function detectAsynchronousBottlenecks(loadTestResults) {
    // Placeholder implementation for async bottleneck detection
    return {};
}

function detectNetworkBottlenecks(loadTestResults) {
    // Placeholder implementation for network bottleneck detection
    return {};
}

function calculateBottleneckSeverity(bottlenecks) {
    // Calculate overall bottleneck severity score
    const totalBottlenecks = Object.values(bottlenecks).reduce((total, arr) => total + arr.length, 0);
    const highSeverityCount = Object.values(bottlenecks).reduce((count, arr) => 
        count + arr.filter(b => b.severity === 'high').length, 0);
    
    if (totalBottlenecks === 0) return 'none';
    if (highSeverityCount > 3) return 'critical';
    if (highSeverityCount > 1) return 'high';
    if (totalBottlenecks > 3) return 'medium';
    return 'low';
}

function generateBottleneckSummary(bottlenecks, recommendations) {
    const totalBottlenecks = Object.values(bottlenecks).reduce((total, arr) => total + arr.length, 0);
    const criticalCount = Object.values(bottlenecks).reduce((count, arr) => 
        count + arr.filter(b => b.severity === 'critical' || b.severity === 'high').length, 0);
    
    return {
        totalBottlenecks: totalBottlenecks,
        criticalBottlenecks: criticalCount,
        primaryConcerns: recommendations.filter(r => r.priority === 'critical' || r.priority === 'high'),
        overallStatus: totalBottlenecks === 0 ? 'healthy' : 
                      criticalCount > 0 ? 'needs_attention' : 'monitoring_recommended'
    };
}

function generateKeyFindings(testResults) {
    // Generate key findings from test results
    const findings = [];
    
    if (testResults.metrics?.successRate >= 99) {
        findings.push('High reliability with >99% success rate');
    } else if (testResults.metrics?.successRate < 95) {
        findings.push('Reliability concerns with success rate below 95%');
    }
    
    if (testResults.analysis?.responseTimes?.percentiles?.p95 <= 100) {
        findings.push('Excellent response times with P95 under 100ms');
    } else if (testResults.analysis?.responseTimes?.percentiles?.p95 > 500) {
        findings.push('Response time optimization needed (P95 > 500ms)');
    }
    
    return findings;
}

function generatePerformanceVerdict(testResults) {
    const successRate = testResults.metrics?.successRate || 0;
    const p95ResponseTime = testResults.analysis?.responseTimes?.percentiles?.p95 || 0;
    
    if (successRate >= 99 && p95ResponseTime <= 100) {
        return {
            verdict: 'excellent',
            summary: 'System performs exceptionally well under load'
        };
    } else if (successRate >= 95 && p95ResponseTime <= 200) {
        return {
            verdict: 'good',
            summary: 'System meets performance expectations with minor optimization opportunities'
        };
    } else if (successRate >= 90 && p95ResponseTime <= 500) {
        return {
            verdict: 'acceptable',
            summary: 'System performance is acceptable but requires optimization'
        };
    } else {
        return {
            verdict: 'needs_improvement',
            summary: 'System requires significant performance improvements'
        };
    }
}

function calculateConcurrencyEfficiency(testResults) {
    const targetConcurrency = testResults.testConfiguration?.concurrency || 0;
    const actualThroughput = testResults.metrics?.throughput || 0;
    const expectedThroughput = targetConcurrency * 10; // Rough estimate
    
    return expectedThroughput > 0 ? (actualThroughput / expectedThroughput) * 100 : 0;
}

function calculateCapacityUtilization(testResults) {
    // Placeholder implementation for capacity utilization calculation
    return {
        cpu: 0,
        memory: 0,
        network: 0,
        overall: 0
    };
}

function generateScalabilityIndicators(testResults) {
    // Placeholder implementation for scalability indicators
    return {
        linearScaling: true,
        scalabilityFactor: 1.0,
        recommendations: []
    };
}

function calculateConsistencyMetrics(testResults) {
    // Placeholder implementation for consistency metrics
    return {
        responseTimeConsistency: 'high',
        throughputConsistency: 'high',
        overallConsistency: 'high'
    };
}

function generateCapacityPlanningRecommendations(testResults) {
    // Placeholder implementation for capacity planning recommendations
    return [];
}

function generateOptimizationRecommendations(testResults) {
    // Placeholder implementation for optimization recommendations
    return [];
}

function generateScalingGuidance(testResults) {
    // Placeholder implementation for scaling guidance
    return [];
}

function generateMonitoringRecommendations(testResults) {
    // Placeholder implementation for monitoring recommendations
    return [];
}

function prioritizeOptimizationActions(bottleneckAnalysis) {
    // Placeholder implementation for optimization action prioritization
    return [];
}

function gatherEnvironmentInfo() {
    // Gather environment information for report context
    return {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
    };
}

function generateTestTimeline(testResults) {
    // Generate timeline of test events
    return [];
}

function formatReportForConsole(report) {
    // Format report for console output
    let output = '\n=== LOAD TEST REPORT ===\n';
    
    if (report.executiveSummary) {
        output += '\nExecutive Summary:\n';
        output += `  Scenario: ${report.executiveSummary.testOverview.scenario}\n`;
        output += `  Duration: ${report.executiveSummary.testOverview.duration}\n`;
        output += `  Success Rate: ${report.executiveSummary.testOverview.successRate}\n`;
        output += `  Average Response Time: ${report.executiveSummary.performanceSummary.averageResponseTime}\n`;
        output += `  Throughput: ${report.executiveSummary.performanceSummary.throughput}\n`;
        output += `  Verdict: ${report.executiveSummary.verdict?.verdict || 'N/A'}\n`;
    }
    
    if (report.recommendations) {
        output += '\nRecommendations:\n';
        Object.entries(report.recommendations).forEach(([category, recs]) => {
            if (Array.isArray(recs) && recs.length > 0) {
                output += `  ${category}: ${recs.length} recommendations\n`;
            }
        });
    }
    
    output += '\n========================\n';
    
    return output;
}

function formatReportForExport(report) {
    // Format report for file export
    return JSON.stringify(report, null, 2);
}

function generateReportSummary(report) {
    // Generate concise report summary
    return {
        reportId: report.metadata?.reportId,
        verdict: report.executiveSummary?.verdict?.verdict || 'unknown',
        keyMetrics: {
            successRate: report.executiveSummary?.testOverview?.successRate,
            averageResponseTime: report.executiveSummary?.performanceSummary?.averageResponseTime,
            throughput: report.executiveSummary?.performanceSummary?.throughput
        },
        recommendationCount: report.recommendations ? 
            Object.values(report.recommendations).reduce((total, arr) => 
                total + (Array.isArray(arr) ? arr.length : 0), 0) : 0
    };
}

// Export all load testing components and utilities
module.exports = {
    // Main classes for load testing orchestration
    LoadTester,
    ConcurrentClient,
    
    // Standalone load testing functions for specific scenarios
    executeLoadTest,
    runLightLoadTest,
    runModerateLoadTest,
    runHeavyLoadTest,
    runStressTest,
    runSpikeTest,
    
    // Utility functions for request generation and analysis
    generateConcurrentRequests,
    measureThroughput,
    analyzeResponseTimes,
    detectPerformanceBottlenecks,
    generateLoadTestReport,
    
    // Constants for load test configuration
    LOAD_TEST_SCENARIOS,
    DEFAULT_LOAD_CONFIG,
    PERFORMANCE_THRESHOLDS,
    LOAD_TEST_ENDPOINTS
};