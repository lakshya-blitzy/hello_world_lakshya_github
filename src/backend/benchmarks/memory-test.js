// Node.js Tutorial HTTP Server - Comprehensive Memory Performance Benchmarking Utility
// Educational memory testing framework demonstrating Node.js memory monitoring techniques
// Uses only Node.js built-in modules for zero external dependencies

// Node.js built-in module imports with version comments
import { test, describe, before, after } from 'node:test'; // node:test@built-in - Node.js built-in test runner for organizing memory tests
import assert from 'node:assert/strict'; // node:assert/strict@built-in - Node.js strict assertion library for memory threshold validation
import { performance, PerformanceObserver } from 'node:perf_hooks'; // node:perf_hooks@built-in - High-resolution performance measurement for timing correlation
import process from 'node:process'; // node:process@built-in - Node.js process object for memory usage monitoring via process.memoryUsage()

// Import internal components for server instance creation and testing utilities
import { HttpServer } from '../lib/http-server.js';
import { PerformanceMonitor } from '../utils/performance-monitor.js';
import { TestEnvironment, testHelpers } from '../test/fixtures/test-helpers.js';
import { serverConfig } from '../config/server-config.js';
import { logger } from '../lib/logger.js';

// Global memory test configuration constants for consistent testing behavior
const MEMORY_TEST_CONFIG = {
    warmupRequests: 50,              // Number of warmup requests before measurement
    measurementRequests: 500,        // Number of requests for memory measurement
    concurrentUsers: 10,             // Concurrent user simulation count
    memoryCollectionInterval: 100,   // Memory snapshot collection interval in milliseconds
    gcTriggerThreshold: 0.8         // Heap usage threshold for manual GC trigger
};

// Memory threshold constants for performance validation and quality gates
const MEMORY_THRESHOLDS = {
    baselineMemoryMb: 15,      // Maximum acceptable baseline memory usage in MB
    maxMemoryMb: 50,           // Maximum acceptable memory usage under load in MB
    memoryLeakThresholdMb: 10, // Memory leak detection threshold in MB
    heapGrowthLimitMb: 5       // Maximum acceptable heap growth in MB
};

// Memory testing scenario constants for different test types
const TEST_SCENARIOS = {
    STARTUP: 'server_startup',           // Server initialization memory testing
    REQUEST_PROCESSING: 'request_processing', // Request handling memory analysis
    LOAD_TESTING: 'load_testing',        // Concurrent load memory testing
    MEMORY_LEAK: 'memory_leak_detection' // Memory leak detection testing
};

// Statistical analysis configuration for memory trend analysis
const STATISTICAL_CONFIG = {
    confidenceLevel: 0.95,    // Statistical confidence level for analysis
    sampleSize: 100,          // Minimum sample size for statistical significance
    outlierThreshold: 2.5     // Standard deviation threshold for outlier detection
};

/**
 * Measures memory usage during HTTP server startup and initialization to establish baseline
 * memory consumption patterns and validate startup memory efficiency for educational purposes
 * 
 * @param {Object} startupConfig - Configuration for server startup memory measurement including timing and thresholds
 * @returns {Promise<Object>} Promise resolving to startup memory measurements with baseline usage and peak memory analysis
 */
export async function measureServerStartupMemory(startupConfig = {}) {
    const config = {
        port: 0, // Use ephemeral port for testing isolation
        measurementDuration: 5000, // Duration to monitor startup memory patterns
        initialDelay: 100, // Initial delay before measurement starts
        ...startupConfig
    };

    // Initialize memory measurement tracking with baseline collection
    const memorySnapshots = [];
    const startTime = performance.now();
    let server = null;

    try {
        logger.info('Starting server startup memory measurement', { config });

        // Record initial process memory usage before server creation
        const initialMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: startTime,
            phase: 'initial',
            memory: initialMemory,
            description: 'Process memory before server creation'
        });

        // Wait for initial measurement stabilization
        await new Promise(resolve => setTimeout(resolve, config.initialDelay));

        // Create HttpServer instance and measure memory allocation impact
        const serverCreateStart = performance.now();
        server = new HttpServer({ port: config.port });
        const serverCreateEnd = performance.now();

        const postCreateMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: serverCreateEnd,
            phase: 'created',
            memory: postCreateMemory,
            description: 'Process memory after server instance creation',
            creationTime: serverCreateEnd - serverCreateStart
        });

        // Start server and monitor memory usage during port binding and initialization
        const serverStartTime = performance.now();
        await server.start();
        const serverStartEnd = performance.now();

        const postStartMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: serverStartEnd,
            phase: 'started',
            memory: postStartMemory,
            description: 'Process memory after server startup and port binding',
            startupTime: serverStartEnd - serverStartTime
        });

        // Monitor memory usage during server initialization period
        const monitoringStart = performance.now();
        const monitoringInterval = setInterval(() => {
            const currentTime = performance.now();
            const currentMemory = process.memoryUsage();
            
            memorySnapshots.push({
                timestamp: currentTime,
                phase: 'monitoring',
                memory: currentMemory,
                description: 'Runtime memory monitoring during initialization'
            });
        }, config.memoryCollectionInterval);

        // Wait for measurement duration to collect comprehensive startup data
        await new Promise(resolve => setTimeout(resolve, config.measurementDuration));
        clearInterval(monitoringInterval);

        // Measure peak memory usage during server startup sequence
        const peakMemorySnapshot = memorySnapshots.reduce((peak, snapshot) => {
            return (snapshot.memory.heapUsed > peak.memory.heapUsed) ? snapshot : peak;
        });

        // Calculate memory overhead of server startup compared to baseline
        const memoryOverhead = {
            heapUsedIncrease: postStartMemory.heapUsed - initialMemory.heapUsed,
            heapTotalIncrease: postStartMemory.heapTotal - initialMemory.heapTotal,
            rssIncrease: postStartMemory.rss - initialMemory.rss,
            externalIncrease: postStartMemory.external - initialMemory.external
        };

        // Monitor garbage collection activity during server initialization
        let gcStats = { count: 0, totalTime: 0, types: {} };
        if (global.gc) {
            // Trigger manual garbage collection to analyze memory cleanup efficiency
            const gcStart = performance.now();
            global.gc();
            const gcEnd = performance.now();
            
            gcStats = {
                count: 1,
                totalTime: gcEnd - gcStart,
                types: { manual: 1 },
                manualGcTime: gcEnd - gcStart
            };
        }

        // Validate startup memory usage against configured thresholds
        const baselineMemoryMb = initialMemory.heapUsed / (1024 * 1024);
        const peakMemoryMb = peakMemorySnapshot.memory.heapUsed / (1024 * 1024);
        const memoryOverheadMb = memoryOverhead.heapUsedIncrease / (1024 * 1024);

        const thresholdValidation = {
            baselineWithinThreshold: baselineMemoryMb <= MEMORY_THRESHOLDS.baselineMemoryMb,
            peakWithinThreshold: peakMemoryMb <= MEMORY_THRESHOLDS.maxMemoryMb,
            overheadAcceptable: memoryOverheadMb <= MEMORY_THRESHOLDS.heapGrowthLimitMb
        };

        const endTime = performance.now();
        const totalMeasurementTime = endTime - startTime;

        // Return comprehensive startup memory analysis with baseline and peak measurements
        const analysisResult = {
            success: true,
            measurementId: `startup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config,
            timing: {
                totalMeasurementTime,
                serverCreationTime: serverCreateEnd - serverCreateStart,
                serverStartupTime: serverStartEnd - serverStartTime
            },
            memory: {
                initial: initialMemory,
                postCreate: postCreateMemory,
                postStart: postStartMemory,
                peak: peakMemorySnapshot,
                overhead: memoryOverhead,
                snapshots: memorySnapshots
            },
            metrics: {
                baselineMemoryMb: baselineMemoryMb.toFixed(2),
                peakMemoryMb: peakMemoryMb.toFixed(2),
                memoryOverheadMb: memoryOverheadMb.toFixed(2),
                memoryEfficiency: ((initialMemory.heapUsed / postStartMemory.heapUsed) * 100).toFixed(2)
            },
            garbageCollection: gcStats,
            thresholds: {
                validation: thresholdValidation,
                violations: Object.entries(thresholdValidation).filter(([_, isValid]) => !isValid).map(([key, _]) => key),
                summary: {
                    allThresholdsMet: Object.values(thresholdValidation).every(isValid => isValid),
                    violationCount: Object.values(thresholdValidation).filter(isValid => !isValid).length
                }
            },
            recommendations: generateStartupMemoryRecommendations(memoryOverheadMb, thresholdValidation),
            timestamp: new Date().toISOString()
        };

        logger.info('Server startup memory measurement completed', {
            measurementId: analysisResult.measurementId,
            baselineMemoryMb: analysisResult.metrics.baselineMemoryMb,
            peakMemoryMb: analysisResult.metrics.peakMemoryMb,
            thresholdsMet: analysisResult.thresholds.summary.allThresholdsMet
        });

        return analysisResult;

    } catch (error) {
        logger.error('Server startup memory measurement failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            measurementId: `startup_error_${Date.now()}`,
            partialData: {
                snapshots: memorySnapshots,
                config
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure server cleanup regardless of success or failure
        if (server && server.isListening()) {
            try {
                await server.stop();
                logger.info('Server stopped after startup memory measurement');
            } catch (cleanupError) {
                logger.error('Failed to stop server after startup memory measurement', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Measures memory usage patterns during HTTP request processing to analyze per-request memory
 * allocation efficiency, cleanup patterns, and memory stability under various load conditions
 * 
 * @param {Number} requestCount - Number of requests to process for comprehensive memory measurement analysis
 * @param {Object} processingConfig - Configuration for request processing memory analysis including concurrency and timing
 * @returns {Promise<Object>} Promise resolving to request processing memory analysis with per-request impact metrics
 */
export async function measureRequestProcessingMemory(requestCount = 100, processingConfig = {}) {
    const config = {
        concurrency: 1,              // Number of concurrent requests (default sequential)
        requestDelay: 0,             // Delay between requests in milliseconds
        warmupRequests: 10,          // Number of warmup requests before measurement
        measurementInterval: 50,     // Memory measurement interval in milliseconds
        endpoint: '/hello',          // Endpoint to test for request processing
        ...processingConfig
    };

    const memorySnapshots = [];
    const requestMetrics = [];
    let server = null;
    let testEnvironment = null;

    try {
        logger.info('Starting request processing memory measurement', { requestCount, config });

        // Initialize test environment for isolated memory testing
        testEnvironment = new TestEnvironment({ port: 0 });
        await testEnvironment.setup();

        server = testEnvironment.server;
        const serverUrl = testEnvironment.serverAddress.url;

        // Establish baseline memory usage with server running but idle
        const baselineMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: performance.now(),
            phase: 'baseline',
            memory: baselineMemory,
            description: 'Baseline memory with server running but idle'
        });

        // Start memory monitoring during request processing
        const monitoringInterval = setInterval(() => {
            const currentMemory = process.memoryUsage();
            memorySnapshots.push({
                timestamp: performance.now(),
                phase: 'monitoring',
                memory: currentMemory,
                description: 'Runtime memory during request processing'
            });
        }, config.measurementInterval);

        // Perform warmup requests to stabilize memory patterns
        logger.info('Performing warmup requests', { count: config.warmupRequests });
        for (let i = 0; i < config.warmupRequests; i++) {
            const response = await testEnvironment.makeRequest(config.endpoint);
            if (!response.ok) {
                logger.warn('Warmup request failed', { index: i, status: response.status });
            }
        }

        // Wait for memory stabilization after warmup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Execute specified number of HTTP requests while monitoring memory usage
        logger.info('Starting measured request processing', { requestCount });
        const measurementStartTime = performance.now();

        for (let i = 0; i < requestCount; i++) {
            const requestStartTime = performance.now();
            const preRequestMemory = process.memoryUsage();

            // Execute HTTP request with memory monitoring
            try {
                const response = await testEnvironment.makeRequest(config.endpoint);
                const requestEndTime = performance.now();
                const postRequestMemory = process.memoryUsage();

                // Collect memory measurements before, during, and after each request
                const requestMemoryMetrics = {
                    requestIndex: i,
                    timing: {
                        duration: requestEndTime - requestStartTime,
                        startTime: requestStartTime,
                        endTime: requestEndTime
                    },
                    memory: {
                        pre: preRequestMemory,
                        post: postRequestMemory,
                        delta: {
                            heapUsed: postRequestMemory.heapUsed - preRequestMemory.heapUsed,
                            heapTotal: postRequestMemory.heapTotal - preRequestMemory.heapTotal,
                            rss: postRequestMemory.rss - preRequestMemory.rss,
                            external: postRequestMemory.external - preRequestMemory.external
                        }
                    },
                    response: {
                        status: response.status,
                        ok: response.ok,
                        size: response.body ? response.body.length : 0
                    }
                };

                requestMetrics.push(requestMemoryMetrics);

                // Add request-specific memory snapshot
                memorySnapshots.push({
                    timestamp: requestEndTime,
                    phase: 'request_complete',
                    memory: postRequestMemory,
                    description: `Memory after request ${i + 1}`,
                    requestIndex: i
                });

            } catch (requestError) {
                logger.error('Request processing failed', { index: i, error: requestError.message });
                requestMetrics.push({
                    requestIndex: i,
                    error: requestError.message,
                    timing: { duration: performance.now() - requestStartTime },
                    memory: { pre: preRequestMemory, post: null, delta: null }
                });
            }

            // Apply request delay if configured
            if (config.requestDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, config.requestDelay));
            }
        }

        const measurementEndTime = performance.now();
        clearInterval(monitoringInterval);

        // Calculate per-request memory allocation and cleanup patterns
        const successfulRequests = requestMetrics.filter(metric => !metric.error);
        const memoryAnalysis = analyzeRequestMemoryPatterns(successfulRequests, baselineMemory);

        // Monitor heap usage and external memory consumption trends
        const heapUsageTrend = memorySnapshots.map(snapshot => ({
            timestamp: snapshot.timestamp,
            heapUsed: snapshot.memory.heapUsed,
            heapTotal: snapshot.memory.heapTotal,
            phase: snapshot.phase
        }));

        // Analyze garbage collection frequency and memory recovery efficiency
        let gcAnalysis = { triggered: false, efficiency: 'unknown' };
        if (global.gc) {
            const preGcMemory = process.memoryUsage();
            global.gc();
            const postGcMemory = process.memoryUsage();
            
            gcAnalysis = {
                triggered: true,
                preGc: preGcMemory,
                postGc: postGcMemory,
                memoryRecovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                efficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
            };
        }

        // Detect memory accumulation patterns and potential leak indicators
        const leakIndicators = detectMemoryAccumulationPatterns(memorySnapshots, baselineMemory);

        // Calculate statistical metrics for memory usage patterns
        const statistics = calculateMemoryStatistics(successfulRequests);

        // Validate memory usage against thresholds
        const thresholdValidation = validateMemoryThresholds(memoryAnalysis, MEMORY_THRESHOLDS);

        // Return detailed analysis of request processing memory characteristics
        const analysisResult = {
            success: true,
            measurementId: `request_processing_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config: { requestCount, ...config },
            timing: {
                totalMeasurementTime: measurementEndTime - measurementStartTime,
                averageRequestTime: statistics.averageRequestTime,
                totalRequestTime: statistics.totalRequestTime
            },
            requests: {
                total: requestCount,
                successful: successfulRequests.length,
                failed: requestMetrics.length - successfulRequests.length,
                successRate: (successfulRequests.length / requestCount * 100).toFixed(2)
            },
            memory: {
                baseline: baselineMemory,
                analysis: memoryAnalysis,
                snapshots: memorySnapshots,
                heapUsageTrend,
                statistics
            },
            garbageCollection: gcAnalysis,
            leakDetection: leakIndicators,
            thresholds: thresholdValidation,
            recommendations: generateRequestMemoryRecommendations(memoryAnalysis, thresholdValidation),
            rawMetrics: requestMetrics,
            timestamp: new Date().toISOString()
        };

        logger.info('Request processing memory measurement completed', {
            measurementId: analysisResult.measurementId,
            requestCount,
            successfulRequests: successfulRequests.length,
            memoryEfficient: memoryAnalysis.perRequestAverage < 1024, // Less than 1KB per request
            thresholdsMet: thresholdValidation.summary.allThresholdsMet
        });

        return analysisResult;

    } catch (error) {
        logger.error('Request processing memory measurement failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            measurementId: `request_processing_error_${Date.now()}`,
            partialData: {
                snapshots: memorySnapshots,
                metrics: requestMetrics,
                config: { requestCount, ...config }
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Clean up test environment and server resources
        if (testEnvironment) {
            try {
                await testEnvironment.teardown();
                logger.info('Test environment cleaned up after request processing measurement');
            } catch (cleanupError) {
                logger.error('Failed to clean up test environment', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Performs comprehensive memory leak detection by executing sustained request load and monitoring
 * memory growth patterns, heap retention analysis, and garbage collection effectiveness validation
 * 
 * @param {Number} testDurationMs - Duration of memory leak detection test in milliseconds for sustained monitoring
 * @param {Object} leakDetectionConfig - Configuration for memory leak detection including thresholds and sampling parameters
 * @returns {Promise<Object>} Promise resolving to memory leak analysis with growth trends and retention patterns
 */
export async function detectMemoryLeaks(testDurationMs = 60000, leakDetectionConfig = {}) {
    const config = {
        requestRate: 10,             // Requests per second for sustained load
        samplingInterval: 1000,      // Memory sampling interval in milliseconds
        gcTriggerInterval: 10000,    // Interval for manual GC triggering
        leakThresholdMb: MEMORY_THRESHOLDS.memoryLeakThresholdMb,
        endpoint: '/hello',          // Endpoint for leak testing
        ...leakDetectionConfig
    };

    const memorySnapshots = [];
    const requestMetrics = [];
    let server = null;
    let testEnvironment = null;
    let requestCounter = 0;
    let activeIntervals = [];

    try {
        logger.info('Starting memory leak detection test', { testDurationMs, config });

        // Initialize test environment for sustained load testing
        testEnvironment = new TestEnvironment({ port: 0 });
        await testEnvironment.setup();

        server = testEnvironment.server;
        const serverUrl = testEnvironment.serverAddress.url;

        // Initialize memory leak detection with baseline memory snapshot
        const baselineMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: performance.now(),
            phase: 'baseline',
            memory: baselineMemory,
            description: 'Baseline memory before sustained load test',
            requestCount: 0
        });

        const testStartTime = performance.now();
        let testEndTime = testStartTime + testDurationMs;

        // Set up memory sampling at regular intervals throughout test
        const memorySamplingInterval = setInterval(() => {
            const currentTime = performance.now();
            const currentMemory = process.memoryUsage();
            
            memorySnapshots.push({
                timestamp: currentTime,
                phase: 'sustained_load',
                memory: currentMemory,
                description: 'Memory during sustained load testing',
                requestCount: requestCounter,
                elapsedTime: currentTime - testStartTime
            });
        }, config.samplingInterval);
        activeIntervals.push(memorySamplingInterval);

        // Set up periodic garbage collection triggering and analysis
        let gcAttempts = 0;
        const gcTriggerInterval = setInterval(() => {
            if (global.gc) {
                const preGcMemory = process.memoryUsage();
                const gcStartTime = performance.now();
                
                global.gc();
                
                const gcEndTime = performance.now();
                const postGcMemory = process.memoryUsage();
                
                gcAttempts++;
                memorySnapshots.push({
                    timestamp: gcEndTime,
                    phase: 'post_gc',
                    memory: postGcMemory,
                    description: `Memory after manual GC attempt ${gcAttempts}`,
                    requestCount: requestCounter,
                    gcMetrics: {
                        duration: gcEndTime - gcStartTime,
                        memoryRecovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                        efficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
                    }
                });
                
                logger.debug('Manual GC triggered during leak detection', {
                    attempt: gcAttempts,
                    memoryRecovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                    efficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
                });
            }
        }, config.gcTriggerInterval);
        activeIntervals.push(gcTriggerInterval);

        // Execute sustained HTTP request load for specified test duration
        const requestInterval = 1000 / config.requestRate; // Convert rate to interval
        const requestScheduler = setInterval(async () => {
            const currentTime = performance.now();
            
            // Stop making requests when test duration is reached
            if (currentTime >= testEndTime) {
                return;
            }

            const requestStartTime = performance.now();
            
            try {
                const response = await testEnvironment.makeRequest(config.endpoint);
                const requestEndTime = performance.now();
                
                requestCounter++;
                requestMetrics.push({
                    requestIndex: requestCounter,
                    timing: {
                        duration: requestEndTime - requestStartTime,
                        timestamp: requestEndTime
                    },
                    response: {
                        status: response.status,
                        ok: response.ok
                    }
                });

            } catch (requestError) {
                requestMetrics.push({
                    requestIndex: requestCounter + 1,
                    error: requestError.message,
                    timing: {
                        duration: performance.now() - requestStartTime,
                        timestamp: performance.now()
                    }
                });
            }
        }, requestInterval);
        activeIntervals.push(requestScheduler);

        // Wait for test duration completion
        await new Promise(resolve => setTimeout(resolve, testDurationMs));

        // Clean up all active intervals
        activeIntervals.forEach(interval => clearInterval(interval));
        activeIntervals = [];

        const actualTestEndTime = performance.now();
        const actualTestDuration = actualTestEndTime - testStartTime;

        // Collect final memory usage samples after test completion
        const finalMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: actualTestEndTime,
            phase: 'final',
            memory: finalMemory,
            description: 'Final memory after sustained load test completion',
            requestCount: requestCounter,
            elapsedTime: actualTestDuration
        });

        // Analyze memory growth trends and identify potential leaks
        const memoryTrendAnalysis = analyzeMemoryGrowthTrends(memorySnapshots, baselineMemory);

        // Monitor heap growth trends and external memory consumption
        const heapGrowthAnalysis = analyzeHeapGrowthPatterns(memorySnapshots);

        // Trigger final garbage collection and measure memory recovery
        let finalGcAnalysis = { performed: false };
        if (global.gc) {
            const preGcMemory = process.memoryUsage();
            global.gc();
            const postGcMemory = process.memoryUsage();
            
            finalGcAnalysis = {
                performed: true,
                preGc: preGcMemory,
                postGc: postGcMemory,
                memoryRecovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                retainedMemory: postGcMemory.heapUsed - baselineMemory.heapUsed,
                recoveryEfficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
            };
        }

        // Analyze memory retention patterns and identify potential leaks
        const retentionAnalysis = analyzeMemoryRetentionPatterns(memorySnapshots, finalGcAnalysis);

        // Calculate memory growth rate and compare against leak thresholds
        const growthRateAnalysis = calculateMemoryGrowthRate(memorySnapshots, testDurationMs);

        // Perform statistical analysis on memory usage patterns
        const statisticalAnalysis = performMemoryLeakStatisticalAnalysis(memorySnapshots);

        // Determine leak detection results based on multiple indicators
        const leakDetectionResults = {
            leakDetected: false,
            confidence: 0,
            indicators: [],
            severity: 'none'
        };

        // Check for sustained memory growth beyond threshold
        if (growthRateAnalysis.growthRateMbPerHour > config.leakThresholdMb) {
            leakDetectionResults.leakDetected = true;
            leakDetectionResults.confidence += 30;
            leakDetectionResults.indicators.push('sustained_memory_growth');
            leakDetectionResults.severity = 'high';
        }

        // Check for poor garbage collection recovery
        if (finalGcAnalysis.performed && finalGcAnalysis.recoveryEfficiency < 50) {
            leakDetectionResults.leakDetected = true;
            leakDetectionResults.confidence += 25;
            leakDetectionResults.indicators.push('poor_gc_recovery');
            if (leakDetectionResults.severity !== 'high') {
                leakDetectionResults.severity = 'medium';
            }
        }

        // Check for memory retention after GC
        if (retentionAnalysis.retainedAfterGcMb > (config.leakThresholdMb / 2)) {
            leakDetectionResults.leakDetected = true;
            leakDetectionResults.confidence += 20;
            leakDetectionResults.indicators.push('memory_retention_after_gc');
            if (leakDetectionResults.severity === 'none') {
                leakDetectionResults.severity = 'low';
            }
        }

        // Check for heap fragmentation indicators
        if (heapGrowthAnalysis.fragmentationIndicator > 0.3) {
            leakDetectionResults.confidence += 15;
            leakDetectionResults.indicators.push('heap_fragmentation');
        }

        // Validate final confidence level
        leakDetectionResults.confidence = Math.min(leakDetectionResults.confidence, 100);

        // Generate comprehensive memory leak assessment with recommendations
        const analysisResult = {
            success: true,
            measurementId: `memory_leak_detection_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config: { testDurationMs, ...config },
            timing: {
                plannedDuration: testDurationMs,
                actualDuration: actualTestDuration,
                requestRate: (requestCounter / (actualTestDuration / 1000)).toFixed(2)
            },
            requests: {
                total: requestCounter,
                successful: requestMetrics.filter(m => !m.error).length,
                failed: requestMetrics.filter(m => m.error).length,
                averageRate: (requestCounter / (actualTestDuration / 1000)).toFixed(2)
            },
            memory: {
                baseline: baselineMemory,
                final: finalMemory,
                snapshots: memorySnapshots,
                trendAnalysis: memoryTrendAnalysis,
                heapGrowthAnalysis,
                retentionAnalysis,
                growthRateAnalysis
            },
            garbageCollection: {
                attempts: gcAttempts,
                finalAnalysis: finalGcAnalysis,
                effectiveness: finalGcAnalysis.recoveryEfficiency || 'not_measured'
            },
            leakDetection: leakDetectionResults,
            statistical: statisticalAnalysis,
            recommendations: generateMemoryLeakRecommendations(leakDetectionResults, growthRateAnalysis, retentionAnalysis),
            rawMetrics: requestMetrics,
            timestamp: new Date().toISOString()
        };

        logger.info('Memory leak detection test completed', {
            measurementId: analysisResult.measurementId,
            testDuration: actualTestDuration,
            requestsProcessed: requestCounter,
            leakDetected: leakDetectionResults.leakDetected,
            confidence: leakDetectionResults.confidence,
            severity: leakDetectionResults.severity
        });

        return analysisResult;

    } catch (error) {
        logger.error('Memory leak detection test failed', { error: error.message });
        
        // Clean up any remaining intervals on error
        activeIntervals.forEach(interval => clearInterval(interval));
        
        return {
            success: false,
            error: error.message,
            measurementId: `memory_leak_error_${Date.now()}`,
            partialData: {
                snapshots: memorySnapshots,
                metrics: requestMetrics,
                config: { testDurationMs, ...config }
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure complete cleanup of test environment and resources
        if (testEnvironment) {
            try {
                await testEnvironment.teardown();
                logger.info('Test environment cleaned up after memory leak detection');
            } catch (cleanupError) {
                logger.error('Failed to clean up test environment after leak detection', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Measures server memory usage under concurrent load testing conditions to validate memory efficiency
 * with multiple simultaneous requests and analyze memory scaling characteristics under stress conditions
 * 
 * @param {Number} concurrentUsers - Number of concurrent users to simulate for load testing
 * @param {Number} testDurationMs - Duration of load testing in milliseconds for sustained analysis
 * @returns {Promise<Object>} Promise resolving to memory usage analysis under load with scaling characteristics
 */
export async function measureMemoryUnderLoad(concurrentUsers = 10, testDurationMs = 30000) {
    const config = {
        requestsPerUser: Math.floor(testDurationMs / 1000), // Approximately 1 request per second per user
        requestDelay: 1000,          // Delay between requests from each user
        rampUpTime: 2000,            // Time to ramp up all concurrent users
        samplingInterval: 500,       // Memory sampling frequency
        endpoint: '/hello'           // Endpoint for load testing
    };

    const memorySnapshots = [];
    const userMetrics = [];
    const concurrentPromises = [];
    let server = null;
    let testEnvironment = null;
    let totalRequestsProcessed = 0;

    try {
        logger.info('Starting memory usage measurement under concurrent load', { concurrentUsers, testDurationMs, config });

        // Initialize test environment for concurrent load testing
        testEnvironment = new TestEnvironment({ port: 0 });
        await testEnvironment.setup();

        server = testEnvironment.server;
        const serverUrl = testEnvironment.serverAddress.url;

        // Establish memory baseline before load testing begins
        const baselineMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: performance.now(),
            phase: 'baseline',
            memory: baselineMemory,
            description: 'Baseline memory before concurrent load test',
            activeUsers: 0,
            totalRequests: 0
        });

        const testStartTime = performance.now();
        
        // Start continuous memory monitoring during load testing period
        const memoryMonitoringInterval = setInterval(() => {
            const currentTime = performance.now();
            const currentMemory = process.memoryUsage();
            
            memorySnapshots.push({
                timestamp: currentTime,
                phase: 'load_testing',
                memory: currentMemory,
                description: 'Memory during concurrent load testing',
                activeUsers: concurrentUsers,
                totalRequests: totalRequestsProcessed,
                elapsedTime: currentTime - testStartTime
            });
        }, config.samplingInterval);

        // Start concurrent HTTP request generation with specified user count
        logger.info('Starting concurrent user simulation', { concurrentUsers });
        
        for (let userId = 0; userId < concurrentUsers; userId++) {
            // Stagger user startup for gradual ramp-up
            const userStartDelay = (config.rampUpTime / concurrentUsers) * userId;
            
            const userPromise = new Promise(async (resolve) => {
                // Wait for user ramp-up delay
                await new Promise(r => setTimeout(r, userStartDelay));
                
                const userStartTime = performance.now();
                const userStats = {
                    userId,
                    requests: [],
                    startTime: userStartTime,
                    endTime: null,
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0
                };

                // Execute requests for this user until test duration is reached
                while ((performance.now() - testStartTime) < testDurationMs) {
                    const requestStartTime = performance.now();
                    
                    try {
                        const response = await testEnvironment.makeRequest(config.endpoint);
                        const requestEndTime = performance.now();
                        
                        totalRequestsProcessed++;
                        userStats.totalRequests++;
                        
                        const requestMetric = {
                            requestIndex: userStats.totalRequests,
                            timing: {
                                duration: requestEndTime - requestStartTime,
                                timestamp: requestEndTime
                            },
                            response: {
                                status: response.status,
                                ok: response.ok,
                                size: response.body ? response.body.length : 0
                            }
                        };

                        userStats.requests.push(requestMetric);
                        
                        if (response.ok) {
                            userStats.successfulRequests++;
                        } else {
                            userStats.failedRequests++;
                        }

                    } catch (requestError) {
                        userStats.failedRequests++;
                        userStats.requests.push({
                            requestIndex: userStats.totalRequests + 1,
                            error: requestError.message,
                            timing: {
                                duration: performance.now() - requestStartTime,
                                timestamp: performance.now()
                            }
                        });
                    }

                    // Apply request delay to control request rate
                    await new Promise(r => setTimeout(r, config.requestDelay));
                }

                userStats.endTime = performance.now();
                userStats.duration = userStats.endTime - userStats.startTime;
                
                resolve(userStats);
            });

            concurrentPromises.push(userPromise);
        }

        // Wait for all concurrent users to complete their request cycles
        logger.info('Waiting for all concurrent users to complete');
        const allUserStats = await Promise.all(concurrentPromises);
        
        const testEndTime = performance.now();
        clearInterval(memoryMonitoringInterval);

        // Monitor peak memory consumption and memory scaling patterns
        const peakMemorySnapshot = memorySnapshots.reduce((peak, snapshot) => {
            return (snapshot.memory.rss > peak.memory.rss) ? snapshot : peak;
        });

        // Measure memory recovery between request bursts
        const finalMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: testEndTime,
            phase: 'final',
            memory: finalMemory,
            description: 'Final memory after concurrent load test',
            activeUsers: 0,
            totalRequests: totalRequestsProcessed
        });

        // Perform final garbage collection and measure recovery
        let gcRecoveryAnalysis = { performed: false };
        if (global.gc) {
            const preGcMemory = process.memoryUsage();
            global.gc();
            const postGcMemory = process.memoryUsage();
            
            gcRecoveryAnalysis = {
                performed: true,
                preGc: preGcMemory,
                postGc: postGcMemory,
                memoryRecovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                recoveryEfficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
            };
        }

        // Analyze memory efficiency under sustained concurrent load
        const loadAnalysis = analyzeLoadTestMemoryEfficiency(memorySnapshots, baselineMemory, peakMemorySnapshot);

        // Calculate memory scaling characteristics with concurrent users
        const scalingAnalysis = analyzeMemoryScalingCharacteristics(memorySnapshots, concurrentUsers, totalRequestsProcessed);

        // Aggregate user performance metrics
        const aggregatedUserMetrics = aggregateUserMetrics(allUserStats);

        // Analyze memory stability and performance under load
        const stabilityAnalysis = analyzeMemoryStabilityUnderLoad(memorySnapshots);

        // Validate memory usage stays within acceptable thresholds
        const memoryPeakMb = peakMemorySnapshot.memory.heapUsed / (1024 * 1024);
        const memoryGrowthMb = (finalMemory.heapUsed - baselineMemory.heapUsed) / (1024 * 1024);
        
        const thresholdValidation = {
            peakMemoryWithinLimit: memoryPeakMb <= MEMORY_THRESHOLDS.maxMemoryMb,
            memoryGrowthAcceptable: memoryGrowthMb <= MEMORY_THRESHOLDS.heapGrowthLimitMb,
            memoryEfficiencyGood: (totalRequestsProcessed / memoryGrowthMb) > 100 // Requests per MB growth
        };

        const testDuration = testEndTime - testStartTime;

        // Return comprehensive load testing memory analysis
        const analysisResult = {
            success: true,
            measurementId: `load_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config: { concurrentUsers, testDurationMs, ...config },
            timing: {
                plannedDuration: testDurationMs,
                actualDuration: testDuration,
                rampUpTime: config.rampUpTime
            },
            load: {
                concurrentUsers,
                totalRequests: totalRequestsProcessed,
                requestRate: (totalRequestsProcessed / (testDuration / 1000)).toFixed(2),
                averageRequestsPerUser: (totalRequestsProcessed / concurrentUsers).toFixed(2)
            },
            memory: {
                baseline: baselineMemory,
                peak: peakMemorySnapshot,
                final: finalMemory,
                snapshots: memorySnapshots,
                loadAnalysis,
                scalingAnalysis,
                stabilityAnalysis
            },
            performance: {
                userMetrics: allUserStats,
                aggregated: aggregatedUserMetrics,
                throughput: {
                    requestsPerSecond: (totalRequestsProcessed / (testDuration / 1000)).toFixed(2),
                    requestsPerUserPerSecond: (totalRequestsProcessed / concurrentUsers / (testDuration / 1000)).toFixed(2)
                }
            },
            garbageCollection: gcRecoveryAnalysis,
            thresholds: {
                validation: thresholdValidation,
                violations: Object.entries(thresholdValidation).filter(([_, isValid]) => !isValid).map(([key, _]) => key),
                summary: {
                    allThresholdsMet: Object.values(thresholdValidation).every(isValid => isValid),
                    violationCount: Object.values(thresholdValidation).filter(isValid => !isValid).length
                }
            },
            recommendations: generateLoadTestMemoryRecommendations(loadAnalysis, scalingAnalysis, thresholdValidation),
            timestamp: new Date().toISOString()
        };

        logger.info('Concurrent load memory test completed', {
            measurementId: analysisResult.measurementId,
            concurrentUsers,
            totalRequests: totalRequestsProcessed,
            testDuration,
            peakMemoryMb: (peakMemorySnapshot.memory.heapUsed / (1024 * 1024)).toFixed(2),
            thresholdsMet: thresholdValidation.allThresholdsMet
        });

        return analysisResult;

    } catch (error) {
        logger.error('Concurrent load memory test failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            measurementId: `load_test_error_${Date.now()}`,
            partialData: {
                snapshots: memorySnapshots,
                userMetrics,
                config: { concurrentUsers, testDurationMs, ...config }
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure complete cleanup of test environment and resources
        if (testEnvironment) {
            try {
                await testEnvironment.teardown();
                logger.info('Test environment cleaned up after load memory test');
            } catch (cleanupError) {
                logger.error('Failed to clean up test environment after load test', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Analyzes garbage collection patterns and memory management efficiency by monitoring GC frequency,
 * duration analysis, and memory recovery effectiveness during comprehensive server operation testing
 * 
 * @param {Object} gcAnalysisConfig - Configuration for garbage collection analysis including monitoring duration and triggers
 * @returns {Promise<Object>} Promise resolving to garbage collection analysis with frequency and efficiency metrics
 */
export async function performGarbageCollectionAnalysis(gcAnalysisConfig = {}) {
    const config = {
        monitoringDuration: 30000,   // Duration to monitor GC activity
        requestLoadDuration: 20000,  // Duration of request load generation
        requestRate: 5,              // Requests per second during analysis
        forcedGcInterval: 5000,      // Interval for manual GC triggering
        memoryPressure: true,        // Whether to create memory pressure
        endpoint: '/hello',          // Endpoint for request generation
        ...gcAnalysisConfig
    };

    const gcEvents = [];
    const memorySnapshots = [];
    let server = null;
    let testEnvironment = null;
    let requestCounter = 0;
    let performanceObserver = null;

    try {
        logger.info('Starting garbage collection analysis', { config });

        // Initialize test environment for GC monitoring
        testEnvironment = new TestEnvironment({ port: 0 });
        await testEnvironment.setup();

        server = testEnvironment.server;
        const serverUrl = testEnvironment.serverAddress.url;

        // Initialize garbage collection monitoring and baseline collection
        const baselineMemory = process.memoryUsage();
        memorySnapshots.push({
            timestamp: performance.now(),
            phase: 'baseline',
            memory: baselineMemory,
            description: 'Baseline memory before GC analysis'
        });

        const analysisStartTime = performance.now();

        // Set up performance observer for GC event monitoring
        if (PerformanceObserver) {
            performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.entryType === 'gc') {
                        const gcEvent = {
                            timestamp: entry.startTime,
                            duration: entry.duration,
                            kind: entry.detail?.kind || 'unknown',
                            type: entry.name,
                            flags: entry.detail?.flags || 0,
                            memory: process.memoryUsage()
                        };
                        
                        gcEvents.push(gcEvent);
                        
                        logger.debug('GC event detected', {
                            type: gcEvent.type,
                            duration: gcEvent.duration.toFixed(2),
                            kind: gcEvent.kind
                        });
                    }
                });
            });
            
            performanceObserver.observe({ entryTypes: ['gc'] });
        }

        // Execute HTTP request processing while monitoring GC activity
        const requestGenerationEndTime = analysisStartTime + config.requestLoadDuration;
        const requestInterval = 1000 / config.requestRate;
        
        logger.info('Starting request load for GC analysis', { requestRate: config.requestRate });
        
        const requestPromises = [];
        while (performance.now() < requestGenerationEndTime) {
            const requestPromise = (async () => {
                try {
                    const response = await testEnvironment.makeRequest(config.endpoint);
                    requestCounter++;
                    return { success: true, status: response.status };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            })();
            
            requestPromises.push(requestPromise);
            await new Promise(resolve => setTimeout(resolve, requestInterval));
        }

        // Wait for all requests to complete
        const requestResults = await Promise.all(requestPromises);
        const successfulRequests = requestResults.filter(r => r.success).length;

        logger.info('Request load completed for GC analysis', { 
            totalRequests: requestCounter, 
            successful: successfulRequests 
        });

        // Track garbage collection frequency, type, and duration
        const gcFrequencyAnalysis = analyzeGcFrequency(gcEvents, config.requestLoadDuration);

        // Measure memory recovery efficiency after garbage collection
        const memoryRecoveryAnalysis = analyzeGcMemoryRecovery(gcEvents, memorySnapshots);

        // Perform manual GC triggers at specified intervals
        const manualGcResults = [];
        const manualGcCount = Math.floor(config.monitoringDuration / config.forcedGcInterval);
        
        for (let i = 0; i < manualGcCount; i++) {
            await new Promise(resolve => setTimeout(resolve, config.forcedGcInterval));
            
            if (global.gc) {
                const preGcMemory = process.memoryUsage();
                const gcStartTime = performance.now();
                
                global.gc();
                
                const gcEndTime = performance.now();
                const postGcMemory = process.memoryUsage();
                
                const manualGcResult = {
                    attempt: i + 1,
                    timing: {
                        startTime: gcStartTime,
                        endTime: gcEndTime,
                        duration: gcEndTime - gcStartTime
                    },
                    memory: {
                        pre: preGcMemory,
                        post: postGcMemory,
                        recovered: preGcMemory.heapUsed - postGcMemory.heapUsed,
                        efficiency: ((preGcMemory.heapUsed - postGcMemory.heapUsed) / preGcMemory.heapUsed * 100).toFixed(2)
                    }
                };
                
                manualGcResults.push(manualGcResult);
                
                memorySnapshots.push({
                    timestamp: gcEndTime,
                    phase: 'manual_gc',
                    memory: postGcMemory,
                    description: `Memory after manual GC attempt ${i + 1}`,
                    gcResult: manualGcResult
                });
            }
        }

        const analysisEndTime = performance.now();

        // Analyze heap fragmentation and memory allocation patterns
        const heapAnalysis = analyzeHeapFragmentation(memorySnapshots, gcEvents);

        // Calculate garbage collection overhead and performance impact
        const gcOverheadAnalysis = calculateGcOverhead(gcEvents, config.monitoringDuration);

        // Analyze GC effectiveness and memory management efficiency
        const efficiencyAnalysis = analyzeGcEffectiveness(gcEvents, manualGcResults, memorySnapshots);

        // Generate GC performance recommendations
        const performanceImpactAnalysis = analyzeGcPerformanceImpact(gcEvents, requestResults);

        const totalAnalysisDuration = analysisEndTime - analysisStartTime;

        // Return detailed garbage collection performance analysis
        const analysisResult = {
            success: true,
            measurementId: `gc_analysis_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config,
            timing: {
                totalAnalysisDuration,
                requestLoadDuration: config.requestLoadDuration,
                monitoringDuration: config.monitoringDuration
            },
            requests: {
                total: requestCounter,
                successful: successfulRequests,
                failed: requestCounter - successfulRequests,
                rate: (requestCounter / (config.requestLoadDuration / 1000)).toFixed(2)
            },
            garbageCollection: {
                events: gcEvents,
                frequency: gcFrequencyAnalysis,
                memoryRecovery: memoryRecoveryAnalysis,
                manualResults: manualGcResults,
                overhead: gcOverheadAnalysis,
                efficiency: efficiencyAnalysis,
                performanceImpact: performanceImpactAnalysis
            },
            memory: {
                baseline: baselineMemory,
                snapshots: memorySnapshots,
                heapAnalysis
            },
            recommendations: generateGcRecommendations(efficiencyAnalysis, gcOverheadAnalysis, performanceImpactAnalysis),
            timestamp: new Date().toISOString()
        };

        logger.info('Garbage collection analysis completed', {
            measurementId: analysisResult.measurementId,
            totalGcEvents: gcEvents.length,
            manualGcAttempts: manualGcResults.length,
            averageGcEfficiency: efficiencyAnalysis.averageEfficiency,
            gcOverheadPercentage: gcOverheadAnalysis.overheadPercentage
        });

        return analysisResult;

    } catch (error) {
        logger.error('Garbage collection analysis failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            measurementId: `gc_analysis_error_${Date.now()}`,
            partialData: {
                gcEvents,
                memorySnapshots,
                config
            },
            timestamp: new Date().toISOString()
        };
    } finally {
        // Clean up performance observer
        if (performanceObserver) {
            performanceObserver.disconnect();
        }
        
        // Clean up test environment
        if (testEnvironment) {
            try {
                await testEnvironment.teardown();
                logger.info('Test environment cleaned up after GC analysis');
            } catch (cleanupError) {
                logger.error('Failed to clean up test environment after GC analysis', { error: cleanupError.message });
            }
        }
    }
}

/**
 * Validates current memory usage against configured thresholds and quality gates to ensure memory
 * efficiency compliance and identify threshold violations with detailed reporting and recommendations
 * 
 * @param {Object} currentMemory - Current memory usage measurements for threshold comparison
 * @param {Object} thresholdConfig - Memory threshold configuration for validation and quality gates
 * @returns {Object} Memory threshold validation results with compliance status and violation details
 */
export function validateMemoryThresholds(currentMemory, thresholdConfig = MEMORY_THRESHOLDS) {
    try {
        // Load memory thresholds from configuration and test parameters
        const thresholds = {
            baselineMemoryMb: thresholdConfig.baselineMemoryMb || MEMORY_THRESHOLDS.baselineMemoryMb,
            maxMemoryMb: thresholdConfig.maxMemoryMb || MEMORY_THRESHOLDS.maxMemoryMb,
            memoryLeakThresholdMb: thresholdConfig.memoryLeakThresholdMb || MEMORY_THRESHOLDS.memoryLeakThresholdMb,
            heapGrowthLimitMb: thresholdConfig.heapGrowthLimitMb || MEMORY_THRESHOLDS.heapGrowthLimitMb
        };

        const validationResult = {
            timestamp: new Date().toISOString(),
            thresholds,
            currentMemory,
            violations: [],
            warnings: [],
            compliance: {},
            summary: {
                compliant: true,
                violationCount: 0,
                warningCount: 0,
                criticalViolations: 0
            }
        };

        // Compare current memory usage against baseline thresholds
        if (currentMemory.baseline) {
            const baselineMemoryMb = currentMemory.baseline.heapUsed / (1024 * 1024);
            const baselineCompliant = baselineMemoryMb <= thresholds.baselineMemoryMb;
            
            validationResult.compliance.baseline = {
                current: baselineMemoryMb.toFixed(2),
                threshold: thresholds.baselineMemoryMb,
                compliant: baselineCompliant,
                usage: ((baselineMemoryMb / thresholds.baselineMemoryMb) * 100).toFixed(2)
            };

            if (!baselineCompliant) {
                const violation = {
                    type: 'baseline_memory_exceeded',
                    severity: 'high',
                    current: baselineMemoryMb.toFixed(2),
                    threshold: thresholds.baselineMemoryMb,
                    difference: (baselineMemoryMb - thresholds.baselineMemoryMb).toFixed(2),
                    message: `Baseline memory usage ${baselineMemoryMb.toFixed(2)}MB exceeds threshold ${thresholds.baselineMemoryMb}MB`
                };
                validationResult.violations.push(violation);
                validationResult.summary.violationCount++;
                validationResult.summary.criticalViolations++;
                validationResult.summary.compliant = false;
            }
        }

        // Validate peak memory usage against maximum memory limits
        if (currentMemory.peak) {
            const peakMemoryMb = currentMemory.peak.heapUsed / (1024 * 1024);
            const peakCompliant = peakMemoryMb <= thresholds.maxMemoryMb;
            
            validationResult.compliance.peak = {
                current: peakMemoryMb.toFixed(2),
                threshold: thresholds.maxMemoryMb,
                compliant: peakCompliant,
                usage: ((peakMemoryMb / thresholds.maxMemoryMb) * 100).toFixed(2)
            };

            if (!peakCompliant) {
                const violation = {
                    type: 'peak_memory_exceeded',
                    severity: 'critical',
                    current: peakMemoryMb.toFixed(2),
                    threshold: thresholds.maxMemoryMb,
                    difference: (peakMemoryMb - thresholds.maxMemoryMb).toFixed(2),
                    message: `Peak memory usage ${peakMemoryMb.toFixed(2)}MB exceeds maximum threshold ${thresholds.maxMemoryMb}MB`
                };
                validationResult.violations.push(violation);
                validationResult.summary.violationCount++;
                validationResult.summary.criticalViolations++;
                validationResult.summary.compliant = false;
            } else if (peakMemoryMb > (thresholds.maxMemoryMb * 0.8)) {
                // Warning for memory usage approaching threshold
                const warning = {
                    type: 'peak_memory_approaching_threshold',
                    severity: 'medium',
                    current: peakMemoryMb.toFixed(2),
                    threshold: thresholds.maxMemoryMb,
                    usage: ((peakMemoryMb / thresholds.maxMemoryMb) * 100).toFixed(2),
                    message: `Peak memory usage ${peakMemoryMb.toFixed(2)}MB is approaching threshold ${thresholds.maxMemoryMb}MB`
                };
                validationResult.warnings.push(warning);
                validationResult.summary.warningCount++;
            }
        }

        // Check memory growth rate against leak detection thresholds
        if (currentMemory.growthRate) {
            const growthRateMb = currentMemory.growthRate;
            const growthCompliant = growthRateMb <= thresholds.memoryLeakThresholdMb;
            
            validationResult.compliance.growthRate = {
                current: growthRateMb.toFixed(2),
                threshold: thresholds.memoryLeakThresholdMb,
                compliant: growthCompliant,
                rate: `${growthRateMb.toFixed(2)}MB/hour`
            };

            if (!growthCompliant) {
                const violation = {
                    type: 'memory_growth_rate_exceeded',
                    severity: 'high',
                    current: growthRateMb.toFixed(2),
                    threshold: thresholds.memoryLeakThresholdMb,
                    difference: (growthRateMb - thresholds.memoryLeakThresholdMb).toFixed(2),
                    message: `Memory growth rate ${growthRateMb.toFixed(2)}MB/hour exceeds leak detection threshold ${thresholds.memoryLeakThresholdMb}MB/hour`
                };
                validationResult.violations.push(violation);
                validationResult.summary.violationCount++;
                if (growthRateMb > (thresholds.memoryLeakThresholdMb * 2)) {
                    violation.severity = 'critical';
                    validationResult.summary.criticalViolations++;
                }
                validationResult.summary.compliant = false;
            }
        }

        // Evaluate heap utilization against efficiency thresholds
        if (currentMemory.heapUtilization) {
            const heapUtilization = currentMemory.heapUtilization;
            const utilizationEfficient = heapUtilization >= 0.3 && heapUtilization <= 0.8; // Optimal range
            
            validationResult.compliance.heapUtilization = {
                current: (heapUtilization * 100).toFixed(2),
                optimalRange: '30-80%',
                efficient: utilizationEfficient,
                utilization: `${(heapUtilization * 100).toFixed(2)}%`
            };

            if (!utilizationEfficient) {
                if (heapUtilization < 0.3) {
                    const warning = {
                        type: 'heap_underutilization',
                        severity: 'low',
                        current: (heapUtilization * 100).toFixed(2),
                        optimal: '30-80%',
                        message: `Heap utilization ${(heapUtilization * 100).toFixed(2)}% is below optimal range, indicating potential memory waste`
                    };
                    validationResult.warnings.push(warning);
                    validationResult.summary.warningCount++;
                } else if (heapUtilization > 0.8) {
                    const violation = {
                        type: 'heap_overutilization',
                        severity: 'medium',
                        current: (heapUtilization * 100).toFixed(2),
                        optimal: '30-80%',
                        message: `Heap utilization ${(heapUtilization * 100).toFixed(2)}% exceeds optimal range, indicating memory pressure`
                    };
                    validationResult.violations.push(violation);
                    validationResult.summary.violationCount++;
                    validationResult.summary.compliant = false;
                }
            }
        }

        // Generate threshold compliance report with violation details
        validationResult.summary.overallCompliance = validationResult.summary.compliant ? 'compliant' : 'non-compliant';
        validationResult.summary.riskLevel = determineRiskLevel(validationResult.summary.criticalViolations, validationResult.summary.violationCount);
        validationResult.summary.compliancePercentage = calculateCompliancePercentage(validationResult.compliance);

        // Return validation results with pass/fail status and recommendations
        validationResult.recommendations = generateThresholdViolationRecommendations(validationResult.violations, validationResult.warnings);

        logger.debug('Memory threshold validation completed', {
            compliant: validationResult.summary.compliant,
            violations: validationResult.summary.violationCount,
            warnings: validationResult.summary.warningCount,
            riskLevel: validationResult.summary.riskLevel
        });

        return validationResult;

    } catch (error) {
        logger.error('Memory threshold validation failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            summary: {
                compliant: false,
                violationCount: 1,
                criticalViolations: 1,
                overallCompliance: 'error'
            }
        };
    }
}

/**
 * Generates comprehensive memory testing report with statistical analysis, performance metrics,
 * threshold compliance analysis, and optimization recommendations for educational and monitoring purposes
 * 
 * @param {Object} memoryTestResults - Complete memory test results from all executed test scenarios
 * @param {Object} reportConfig - Report generation configuration including format and detail level
 * @returns {Object} Formatted memory testing report with analysis, metrics, and actionable recommendations
 */
export function generateMemoryReport(memoryTestResults, reportConfig = {}) {
    const config = {
        format: 'detailed',        // detailed, summary, json
        includeRawData: false,     // Include raw measurement data
        includeCharts: false,      // Include ASCII charts (for console output)
        statisticalAnalysis: true, // Include statistical analysis
        recommendations: true,     // Include optimization recommendations
        ...reportConfig
    };

    try {
        // Aggregate memory test results from all executed scenarios
        const aggregatedResults = {
            timestamp: new Date().toISOString(),
            reportId: `memory_report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            config,
            scenarios: {},
            summary: {
                totalScenarios: 0,
                successfulScenarios: 0,
                failedScenarios: 0,
                overallSuccess: true
            }
        };

        // Process each test scenario result
        Object.entries(memoryTestResults).forEach(([scenarioName, scenarioResult]) => {
            if (scenarioResult && typeof scenarioResult === 'object') {
                aggregatedResults.scenarios[scenarioName] = processScenarioResult(scenarioResult, config);
                aggregatedResults.summary.totalScenarios++;
                
                if (scenarioResult.success) {
                    aggregatedResults.summary.successfulScenarios++;
                } else {
                    aggregatedResults.summary.failedScenarios++;
                    aggregatedResults.summary.overallSuccess = false;
                }
            }
        });

        // Perform statistical analysis on memory usage patterns
        const statisticalAnalysis = config.statisticalAnalysis ? 
            performComprehensiveStatisticalAnalysis(memoryTestResults) : null;

        // Generate executive summary with key memory findings
        const executiveSummary = generateExecutiveSummary(aggregatedResults, statisticalAnalysis);

        // Create detailed memory analysis with usage breakdowns
        const detailedAnalysis = generateDetailedMemoryAnalysis(aggregatedResults, statisticalAnalysis);

        // Include threshold compliance analysis and violation reports
        const complianceAnalysis = generateComplianceAnalysis(aggregatedResults);

        // Generate optimization recommendations based on test results
        const optimizationRecommendations = config.recommendations ? 
            generateOptimizationRecommendations(aggregatedResults, statisticalAnalysis, complianceAnalysis) : null;

        // Format comprehensive report for console output and logging
        const report = {
            metadata: {
                reportId: aggregatedResults.reportId,
                generatedAt: aggregatedResults.timestamp,
                generatedBy: 'Node.js Memory Benchmarking Utility',
                version: '1.0.0',
                format: config.format,
                nodeVersion: process.version,
                platform: process.platform
            },
            executiveSummary,
            summary: aggregatedResults.summary,
            scenarios: aggregatedResults.scenarios,
            analysis: {
                detailed: detailedAnalysis,
                statistical: statisticalAnalysis,
                compliance: complianceAnalysis
            },
            recommendations: optimizationRecommendations,
            rawData: config.includeRawData ? memoryTestResults : null
        };

        // Add console-friendly formatting if requested
        if (config.format === 'console') {
            report.formattedOutput = formatReportForConsole(report);
        }

        // Return complete memory testing report with insights
        logger.info('Memory testing report generated successfully', {
            reportId: report.metadata.reportId,
            scenarios: aggregatedResults.summary.totalScenarios,
            successful: aggregatedResults.summary.successfulScenarios,
            overallSuccess: aggregatedResults.summary.overallSuccess
        });

        return report;

    } catch (error) {
        logger.error('Memory report generation failed', { error: error.message });
        
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            reportId: `memory_report_error_${Date.now()}`,
            partialResults: memoryTestResults
        };
    }
}

/**
 * Comprehensive memory benchmarking class that orchestrates memory testing scenarios, manages test
 * environments, collects memory metrics, and provides detailed analysis of Node.js HTTP server memory patterns
 */
export class MemoryBenchmark {
    /**
     * Initializes memory benchmark system with configuration, test environment setup, and performance
     * monitoring integration for comprehensive memory testing and educational demonstration
     * 
     * @param {Object} config - Memory benchmark configuration with test parameters, thresholds, and measurement settings
     */
    constructor(config = {}) {
        // Validate memory benchmark configuration and test parameters
        this.config = {
            scenarios: [
                TEST_SCENARIOS.STARTUP,
                TEST_SCENARIOS.REQUEST_PROCESSING,
                TEST_SCENARIOS.LOAD_TESTING,
                TEST_SCENARIOS.MEMORY_LEAK
            ],
            thresholds: { ...MEMORY_THRESHOLDS, ...config.thresholds },
            testConfig: { ...MEMORY_TEST_CONFIG, ...config.testConfig },
            reportConfig: {
                format: 'detailed',
                includeRecommendations: true,
                includeStatisticalAnalysis: true,
                ...config.reportConfig
            },
            ...config
        };

        // Initialize TestEnvironment instance for isolated memory testing
        this.testEnvironment = null;

        // Set up PerformanceMonitor for comprehensive system metrics collection
        this.performanceMonitor = new PerformanceMonitor({
            enableMemoryTracking: true,
            enablePerformanceOptimization: true,
            intervals: {
                realTimeMs: 100,
                aggregationMs: 1000
            }
        });

        // Initialize memory snapshot collection with Map for time-series data
        this.memorySnapshots = new Map();

        // Initialize test results collection for scenario tracking
        this.testResults = [];

        // Configure memory thresholds and quality gates for validation
        this.thresholds = this.config.thresholds;

        // Set up logging for memory benchmark progress and results
        this.benchmarkId = `memory_benchmark_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Initialize test results collection for scenario tracking
        this.isBenchmarking = false;

        logger.info('MemoryBenchmark instance initialized', {
            benchmarkId: this.benchmarkId,
            scenarios: this.config.scenarios,
            thresholds: this.thresholds
        });
    }

    /**
     * Executes all memory testing scenarios including startup, request processing, load testing,
     * and memory leak detection with comprehensive analysis and detailed reporting
     * 
     * @returns {Promise<Object>} Promise resolving to complete memory benchmark results with analysis from all scenarios
     */
    async runAllScenarios() {
        try {
            // Set benchmarking state to active and initialize test environment
            this.isBenchmarking = true;
            const benchmarkStartTime = performance.now();
            
            logger.info('Starting comprehensive memory benchmark', {
                benchmarkId: this.benchmarkId,
                scenarios: this.config.scenarios.length
            });

            // Initialize test environment for comprehensive testing
            this.testEnvironment = new TestEnvironment({ port: 0 });

            const allResults = {
                benchmarkId: this.benchmarkId,
                startTime: benchmarkStartTime,
                scenarios: {},
                summary: {
                    total: this.config.scenarios.length,
                    completed: 0,
                    successful: 0,
                    failed: 0
                }
            };

            // Execute server startup memory testing scenario
            if (this.config.scenarios.includes(TEST_SCENARIOS.STARTUP)) {
                logger.info('Executing server startup memory testing scenario');
                try {
                    const startupResult = await measureServerStartupMemory(this.config.startupConfig || {});
                    allResults.scenarios[TEST_SCENARIOS.STARTUP] = startupResult;
                    allResults.summary.completed++;
                    if (startupResult.success) allResults.summary.successful++;
                    else allResults.summary.failed++;
                } catch (error) {
                    logger.error('Server startup scenario failed', { error: error.message });
                    allResults.scenarios[TEST_SCENARIOS.STARTUP] = { success: false, error: error.message };
                    allResults.summary.completed++;
                    allResults.summary.failed++;
                }
            }

            // Run request processing memory analysis scenario
            if (this.config.scenarios.includes(TEST_SCENARIOS.REQUEST_PROCESSING)) {
                logger.info('Executing request processing memory analysis scenario');
                try {
                    const requestProcessingResult = await measureRequestProcessingMemory(
                        this.config.testConfig.measurementRequests,
                        this.config.requestProcessingConfig || {}
                    );
                    allResults.scenarios[TEST_SCENARIOS.REQUEST_PROCESSING] = requestProcessingResult;
                    allResults.summary.completed++;
                    if (requestProcessingResult.success) allResults.summary.successful++;
                    else allResults.summary.failed++;
                } catch (error) {
                    logger.error('Request processing scenario failed', { error: error.message });
                    allResults.scenarios[TEST_SCENARIOS.REQUEST_PROCESSING] = { success: false, error: error.message };
                    allResults.summary.completed++;
                    allResults.summary.failed++;
                }
            }

            // Perform concurrent load testing memory measurement
            if (this.config.scenarios.includes(TEST_SCENARIOS.LOAD_TESTING)) {
                logger.info('Executing concurrent load testing memory measurement scenario');
                try {
                    const loadTestingResult = await measureMemoryUnderLoad(
                        this.config.testConfig.concurrentUsers,
                        this.config.loadTestDuration || 30000
                    );
                    allResults.scenarios[TEST_SCENARIOS.LOAD_TESTING] = loadTestingResult;
                    allResults.summary.completed++;
                    if (loadTestingResult.success) allResults.summary.successful++;
                    else allResults.summary.failed++;
                } catch (error) {
                    logger.error('Load testing scenario failed', { error: error.message });
                    allResults.scenarios[TEST_SCENARIOS.LOAD_TESTING] = { success: false, error: error.message };
                    allResults.summary.completed++;
                    allResults.summary.failed++;
                }
            }

            // Execute memory leak detection testing scenario
            if (this.config.scenarios.includes(TEST_SCENARIOS.MEMORY_LEAK)) {
                logger.info('Executing memory leak detection testing scenario');
                try {
                    const memoryLeakResult = await detectMemoryLeaks(
                        this.config.leakDetectionDuration || 60000,
                        this.config.leakDetectionConfig || {}
                    );
                    allResults.scenarios[TEST_SCENARIOS.MEMORY_LEAK] = memoryLeakResult;
                    allResults.summary.completed++;
                    if (memoryLeakResult.success) allResults.summary.successful++;
                    else allResults.summary.failed++;
                } catch (error) {
                    logger.error('Memory leak detection scenario failed', { error: error.message });
                    allResults.scenarios[TEST_SCENARIOS.MEMORY_LEAK] = { success: false, error: error.message };
                    allResults.summary.completed++;
                    allResults.summary.failed++;
                }
            }

            // Perform garbage collection analysis and efficiency testing
            logger.info('Executing garbage collection analysis and efficiency testing');
            try {
                const gcAnalysisResult = await performGarbageCollectionAnalysis(this.config.gcAnalysisConfig || {});
                allResults.scenarios['gc_analysis'] = gcAnalysisResult;
                allResults.summary.completed++;
                if (gcAnalysisResult.success) allResults.summary.successful++;
                else allResults.summary.failed++;
            } catch (error) {
                logger.error('GC analysis scenario failed', { error: error.message });
                allResults.scenarios['gc_analysis'] = { success: false, error: error.message };
                allResults.summary.completed++;
                allResults.summary.failed++;
            }

            // Validate all memory usage against configured thresholds
            const overallThresholdValidation = this.performOverallThresholdValidation(allResults);
            allResults.thresholdValidation = overallThresholdValidation;

            // Generate comprehensive memory benchmark report
            const benchmarkReport = generateMemoryReport(allResults.scenarios, this.config.reportConfig);
            allResults.report = benchmarkReport;

            const benchmarkEndTime = performance.now();
            allResults.endTime = benchmarkEndTime;
            allResults.totalDuration = benchmarkEndTime - benchmarkStartTime;
            allResults.success = allResults.summary.failed === 0;

            // Store results for future reference
            this.testResults.push(allResults);

            logger.info('Comprehensive memory benchmark completed', {
                benchmarkId: this.benchmarkId,
                duration: allResults.totalDuration.toFixed(2),
                successful: allResults.summary.successful,
                failed: allResults.summary.failed,
                overallSuccess: allResults.success
            });

            return allResults;

        } catch (error) {
            logger.error('Memory benchmark execution failed', { error: error.message });
            return {
                success: false,
                error: error.message,
                benchmarkId: this.benchmarkId,
                timestamp: new Date().toISOString()
            };
        } finally {
            // Clean up test environment and return complete results
            this.isBenchmarking = false;
            await this.cleanup();
        }
    }

    /**
     * Executes specific memory testing scenario with detailed monitoring and analysis based on
     * scenario type configuration and comprehensive measurement collection
     * 
     * @param {String} scenarioType - Type of memory scenario to execute (startup, processing, load, leak)
     * @param {Object} scenarioConfig - Configuration specific to the selected memory testing scenario
     * @returns {Promise<Object>} Promise resolving to scenario-specific memory analysis results and metrics
     */
    async runScenario(scenarioType, scenarioConfig = {}) {
        try {
            // Initialize scenario-specific configuration and monitoring
            this.isBenchmarking = true;
            const scenarioStartTime = performance.now();
            
            logger.info('Starting individual memory scenario', { 
                scenarioType, 
                benchmarkId: this.benchmarkId 
            });

            // Set up TestEnvironment for isolated scenario testing
            if (!this.testEnvironment) {
                this.testEnvironment = new TestEnvironment({ port: 0 });
                await this.testEnvironment.setup();
            }

            let scenarioResult = null;

            // Execute memory measurement according to scenario type
            switch (scenarioType) {
                case TEST_SCENARIOS.STARTUP:
                    scenarioResult = await measureServerStartupMemory(scenarioConfig);
                    break;

                case TEST_SCENARIOS.REQUEST_PROCESSING:
                    scenarioResult = await measureRequestProcessingMemory(
                        scenarioConfig.requestCount || this.config.testConfig.measurementRequests,
                        scenarioConfig
                    );
                    break;

                case TEST_SCENARIOS.LOAD_TESTING:
                    scenarioResult = await measureMemoryUnderLoad(
                        scenarioConfig.concurrentUsers || this.config.testConfig.concurrentUsers,
                        scenarioConfig.testDuration || 30000
                    );
                    break;

                case TEST_SCENARIOS.MEMORY_LEAK:
                    scenarioResult = await detectMemoryLeaks(
                        scenarioConfig.testDuration || 60000,
                        scenarioConfig
                    );
                    break;

                default:
                    throw new Error(`Unknown scenario type: ${scenarioType}`);
            }

            const scenarioEndTime = performance.now();
            
            // Collect memory metrics and performance data throughout scenario
            const finalResult = {
                scenarioType,
                benchmarkId: this.benchmarkId,
                startTime: scenarioStartTime,
                endTime: scenarioEndTime,
                duration: scenarioEndTime - scenarioStartTime,
                result: scenarioResult,
                success: scenarioResult && scenarioResult.success,
                timestamp: new Date().toISOString()
            };

            // Analyze memory patterns and calculate statistical metrics
            if (scenarioResult && scenarioResult.success) {
                const memoryAnalysis = this.analyzeScenarioMemoryPatterns(scenarioResult);
                finalResult.analysis = memoryAnalysis;
            }

            // Validate results against scenario-specific thresholds
            const thresholdValidation = validateMemoryThresholds(
                scenarioResult?.memory || {},
                this.thresholds
            );
            finalResult.thresholdValidation = thresholdValidation;

            // Store scenario result
            this.testResults.push(finalResult);

            logger.info('Memory scenario completed', {
                scenarioType,
                benchmarkId: this.benchmarkId,
                duration: finalResult.duration.toFixed(2),
                success: finalResult.success,
                thresholdsMet: thresholdValidation.summary?.compliant || false
            });

            // Return detailed scenario memory analysis results
            return finalResult;

        } catch (error) {
            logger.error('Memory scenario execution failed', { 
                scenarioType, 
                error: error.message 
            });
            
            return {
                success: false,
                scenarioType,
                benchmarkId: this.benchmarkId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            this.isBenchmarking = false;
        }
    }

    /**
     * Collects comprehensive memory usage snapshot including heap statistics, external memory,
     * and system resource utilization with timestamp correlation for trend analysis
     * 
     * @param {String} label - Descriptive label for the memory snapshot for analysis correlation
     * @param {Object} metadata - Additional metadata to associate with the memory snapshot
     * @returns {Object} Detailed memory snapshot with heap statistics, resource usage, and metadata
     */
    collectMemorySnapshot(label = 'snapshot', metadata = {}) {
        try {
            const timestamp = performance.now();
            
            // Collect Node.js process memory usage using process.memoryUsage()
            const processMemory = process.memoryUsage();

            // Gather additional system memory statistics and resource utilization
            const memorySnapshot = {
                id: `snapshot_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp,
                timestampIso: new Date().toISOString(),
                label,
                benchmarkId: this.benchmarkId,
                process: {
                    pid: process.pid,
                    uptime: process.uptime(),
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version
                },
                memory: {
                    ...processMemory,
                    heapUsedMb: (processMemory.heapUsed / (1024 * 1024)).toFixed(2),
                    heapTotalMb: (processMemory.heapTotal / (1024 * 1024)).toFixed(2),
                    rssMb: (processMemory.rss / (1024 * 1024)).toFixed(2),
                    externalMb: (processMemory.external / (1024 * 1024)).toFixed(2),
                    utilization: (processMemory.heapUsed / processMemory.heapTotal).toFixed(4)
                }
            };

            // Include garbage collection statistics and heap information
            if (global.gc && performance.measureUserAgentSpecificMemory) {
                try {
                    memorySnapshot.advanced = {
                        gcAvailable: true,
                        measureUserAgentSpecificMemoryAvailable: true
                    };
                } catch (advancedError) {
                    memorySnapshot.advanced = {
                        gcAvailable: !!global.gc,
                        measureUserAgentSpecificMemoryAvailable: false,
                        error: advancedError.message
                    };
                }
            }

            // Add timestamp and correlation metadata to snapshot
            memorySnapshot.metadata = {
                ...metadata,
                correlationId: metadata.correlationId || `corr_${Date.now()}`,
                isBenchmarking: this.isBenchmarking
            };

            // Store snapshot in time-series collection for trend analysis
            this.memorySnapshots.set(memorySnapshot.id, memorySnapshot);

            // Limit snapshot collection size to prevent memory issues
            if (this.memorySnapshots.size > 10000) {
                const oldestKey = this.memorySnapshots.keys().next().value;
                this.memorySnapshots.delete(oldestKey);
            }

            logger.debug('Memory snapshot collected', {
                snapshotId: memorySnapshot.id,
                label,
                heapUsedMb: memorySnapshot.memory.heapUsedMb,
                rssMb: memorySnapshot.memory.rssMb
            });

            // Return formatted memory snapshot with comprehensive metrics
            return memorySnapshot;

        } catch (error) {
            logger.error('Memory snapshot collection failed', { error: error.message, label });
            
            return {
                error: error.message,
                timestamp: performance.now(),
                timestampIso: new Date().toISOString(),
                label,
                benchmarkId: this.benchmarkId
            };
        }
    }

    /**
     * Analyzes collected memory snapshots to identify memory usage trends, growth patterns,
     * and potential memory management issues over specified time window
     * 
     * @param {Number} analysisWindowMs - Time window for memory trend analysis in milliseconds
     * @returns {Object} Memory trend analysis results with growth patterns and optimization recommendations
     */
    analyzeMemoryTrends(analysisWindowMs = 300000) {
        try {
            const currentTime = performance.now();
            const windowStartTime = currentTime - analysisWindowMs;

            // Extract memory snapshots for specified analysis time window
            const relevantSnapshots = Array.from(this.memorySnapshots.values())
                .filter(snapshot => snapshot.timestamp >= windowStartTime)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (relevantSnapshots.length < 2) {
                return {
                    success: false,
                    reason: 'insufficient_data',
                    snapshotCount: relevantSnapshots.length,
                    minimumRequired: 2
                };
            }

            const analysisResult = {
                analysisId: `trend_analysis_${Date.now()}`,
                benchmarkId: this.benchmarkId,
                analysisWindow: {
                    durationMs: analysisWindowMs,
                    startTime: windowStartTime,
                    endTime: currentTime,
                    snapshotCount: relevantSnapshots.length
                },
                trends: {},
                recommendations: []
            };

            // Calculate memory usage trends and growth rate patterns
            const memoryTrends = calculateMemoryTrends(relevantSnapshots);
            analysisResult.trends = memoryTrends;

            // Identify memory allocation and deallocation efficiency
            const allocationEfficiency = analyzeAllocationEfficiency(relevantSnapshots);
            analysisResult.allocationEfficiency = allocationEfficiency;

            // Detect memory usage anomalies and potential leak indicators
            const anomalies = detectMemoryAnomalies(relevantSnapshots);
            analysisResult.anomalies = anomalies;

            // Analyze garbage collection impact on memory patterns
            const gcImpact = analyzeGcImpactOnMemoryPatterns(relevantSnapshots);
            analysisResult.gcImpact = gcImpact;

            // Generate trend-based optimization recommendations
            analysisResult.recommendations = generateTrendBasedRecommendations(
                memoryTrends,
                allocationEfficiency,
                anomalies,
                gcImpact
            );

            // Calculate statistical significance of trends
            analysisResult.statistical = calculateTrendStatisticalSignificance(relevantSnapshots);

            logger.info('Memory trend analysis completed', {
                analysisId: analysisResult.analysisId,
                snapshotCount: relevantSnapshots.length,
                trendDirection: memoryTrends.overallTrend,
                growthRate: memoryTrends.growthRatePerHour,
                anomaliesDetected: anomalies.count
            });

            // Return comprehensive memory trend analysis results
            return {
                success: true,
                ...analysisResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Memory trend analysis failed', { error: error.message });
            
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                benchmarkId: this.benchmarkId
            };
        }
    }

    /**
     * Validates memory usage compliance against configured thresholds, quality gates, and performance
     * requirements with detailed violation reporting and corrective action recommendations
     * 
     * @param {Object} memoryMetrics - Current memory metrics to validate against thresholds
     * @returns {Object} Memory compliance validation results with threshold status and violation details
     */
    validateMemoryCompliance(memoryMetrics) {
        try {
            // Load memory thresholds and compliance requirements from configuration
            const complianceResult = {
                validationId: `compliance_${Date.now()}`,
                benchmarkId: this.benchmarkId,
                timestamp: new Date().toISOString(),
                thresholds: this.thresholds,
                metrics: memoryMetrics,
                compliance: {},
                violations: [],
                warnings: [],
                summary: {
                    compliant: true,
                    violationCount: 0,
                    warningCount: 0,
                    criticalViolations: 0
                }
            };

            // Validate baseline memory usage against startup thresholds
            if (memoryMetrics.baseline) {
                const baselineValidation = this.validateBaselineMemory(memoryMetrics.baseline);
                complianceResult.compliance.baseline = baselineValidation;
                
                if (!baselineValidation.compliant) {
                    complianceResult.violations.push(...baselineValidation.violations);
                    complianceResult.summary.violationCount += baselineValidation.violations.length;
                    complianceResult.summary.compliant = false;
                }
                
                if (baselineValidation.warnings) {
                    complianceResult.warnings.push(...baselineValidation.warnings);
                    complianceResult.summary.warningCount += baselineValidation.warnings.length;
                }
            }

            // Check peak memory consumption against maximum limits
            if (memoryMetrics.peak) {
                const peakValidation = this.validatePeakMemory(memoryMetrics.peak);
                complianceResult.compliance.peak = peakValidation;
                
                if (!peakValidation.compliant) {
                    complianceResult.violations.push(...peakValidation.violations);
                    complianceResult.summary.violationCount += peakValidation.violations.length;
                    complianceResult.summary.compliant = false;
                    
                    // Count critical violations
                    const criticalViolations = peakValidation.violations.filter(v => v.severity === 'critical');
                    complianceResult.summary.criticalViolations += criticalViolations.length;
                }
            }

            // Validate memory growth rate against leak detection thresholds
            if (memoryMetrics.growthRate !== undefined) {
                const growthValidation = this.validateMemoryGrowthRate(memoryMetrics.growthRate);
                complianceResult.compliance.growthRate = growthValidation;
                
                if (!growthValidation.compliant) {
                    complianceResult.violations.push(...growthValidation.violations);
                    complianceResult.summary.violationCount += growthValidation.violations.length;
                    complianceResult.summary.compliant = false;
                }
            }

            // Assess memory efficiency against performance requirements
            if (memoryMetrics.efficiency) {
                const efficiencyValidation = this.validateMemoryEfficiency(memoryMetrics.efficiency);
                complianceResult.compliance.efficiency = efficiencyValidation;
                
                if (!efficiencyValidation.compliant) {
                    complianceResult.violations.push(...efficiencyValidation.violations);
                    complianceResult.summary.violationCount += efficiencyValidation.violations.length;
                    complianceResult.summary.compliant = false;
                }
            }

            // Generate compliance report with detailed violation analysis
            complianceResult.summary.compliancePercentage = this.calculateCompliancePercentage(complianceResult.compliance);
            complianceResult.summary.riskLevel = this.determineComplianceRiskLevel(complianceResult.summary);

            // Return validation results with recommendations for compliance
            complianceResult.recommendations = generateComplianceRecommendations(
                complianceResult.violations,
                complianceResult.warnings,
                complianceResult.summary
            );

            logger.info('Memory compliance validation completed', {
                validationId: complianceResult.validationId,
                compliant: complianceResult.summary.compliant,
                violations: complianceResult.summary.violationCount,
                warnings: complianceResult.summary.warningCount,
                riskLevel: complianceResult.summary.riskLevel
            });

            return complianceResult;

        } catch (error) {
            logger.error('Memory compliance validation failed', { error: error.message });
            
            return {
                success: false,
                error: error.message,
                benchmarkId: this.benchmarkId,
                timestamp: new Date().toISOString(),
                summary: {
                    compliant: false,
                    violationCount: 1,
                    criticalViolations: 1
                }
            };
        }
    }

    /**
     * Performs comprehensive cleanup after memory benchmarking including test environment teardown,
     * resource cleanup, and final memory validation with complete resource disposal
     * 
     * @returns {Promise<void>} Promise resolving when cleanup is complete and all resources are properly disposed
     */
    async cleanup() {
        try {
            logger.info('Starting memory benchmark cleanup', { benchmarkId: this.benchmarkId });

            const cleanupStartTime = performance.now();

            // Stop performance monitoring and metrics collection
            if (this.performanceMonitor) {
                try {
                    await this.performanceMonitor.stopMonitoring();
                    logger.debug('Performance monitor stopped');
                } catch (monitorError) {
                    logger.warn('Failed to stop performance monitor cleanly', { error: monitorError.message });
                }
            }

            // Tear down TestEnvironment and clean up server instances
            if (this.testEnvironment) {
                try {
                    await this.testEnvironment.teardown();
                    this.testEnvironment = null;
                    logger.debug('Test environment cleaned up');
                } catch (environmentError) {
                    logger.warn('Failed to clean up test environment', { error: environmentError.message });
                }
            }

            // Clear memory snapshot collections and test data
            const snapshotCount = this.memorySnapshots.size;
            this.memorySnapshots.clear();
            logger.debug('Memory snapshots cleared', { count: snapshotCount });

            // Perform final memory usage validation after cleanup
            const preCleanupMemory = process.memoryUsage();
            
            // Trigger garbage collection if available
            if (global.gc) {
                global.gc();
                const postGcMemory = process.memoryUsage();
                logger.debug('Final garbage collection performed', {
                    memoryRecovered: (preCleanupMemory.heapUsed - postGcMemory.heapUsed) / (1024 * 1024)
                });
            }

            // Release all allocated resources and event listeners
            // Note: Test results are kept for potential analysis

            // Set benchmarking state to inactive
            this.isBenchmarking = false;

            const cleanupEndTime = performance.now();
            const cleanupDuration = cleanupEndTime - cleanupStartTime;

            // Log cleanup completion and final memory statistics
            const finalMemory = process.memoryUsage();
            logger.info('Memory benchmark cleanup completed', {
                benchmarkId: this.benchmarkId,
                cleanupDuration: cleanupDuration.toFixed(2),
                finalMemoryMb: (finalMemory.heapUsed / (1024 * 1024)).toFixed(2),
                snapshotsCleared: snapshotCount,
                testResultsRetained: this.testResults.length
            });

        } catch (error) {
            logger.error('Memory benchmark cleanup failed', { 
                benchmarkId: this.benchmarkId,
                error: error.message 
            });
            throw error;
        }
    }

    // Private helper methods for internal benchmark operations

    /**
     * Performs overall threshold validation across all scenario results
     * @private
     */
    performOverallThresholdValidation(allResults) {
        const overallValidation = {
            scenarioValidations: {},
            overallCompliance: true,
            totalViolations: 0,
            criticalViolations: 0
        };

        Object.entries(allResults.scenarios).forEach(([scenarioName, scenarioResult]) => {
            if (scenarioResult.success && scenarioResult.memory) {
                const validation = validateMemoryThresholds(scenarioResult.memory, this.thresholds);
                overallValidation.scenarioValidations[scenarioName] = validation;
                
                if (!validation.summary.compliant) {
                    overallValidation.overallCompliance = false;
                    overallValidation.totalViolations += validation.summary.violationCount;
                    overallValidation.criticalViolations += validation.summary.criticalViolations;
                }
            }
        });

        return overallValidation;
    }

    /**
     * Analyzes memory patterns for a specific scenario
     * @private
     */
    analyzeScenarioMemoryPatterns(scenarioResult) {
        if (!scenarioResult || !scenarioResult.memory) {
            return { analysis: 'insufficient_data' };
        }

        const analysis = {
            memoryEfficiency: 'unknown',
            allocationPatterns: 'unknown',
            cleanupEffectiveness: 'unknown'
        };

        // Analyze memory efficiency
        if (scenarioResult.memory.baseline && scenarioResult.memory.peak) {
            const growthRatio = scenarioResult.memory.peak.heapUsed / scenarioResult.memory.baseline.heapUsed;
            analysis.memoryEfficiency = growthRatio < 2 ? 'good' : growthRatio < 5 ? 'fair' : 'poor';
        }

        return analysis;
    }

    /**
     * Validates baseline memory usage
     * @private
     */
    validateBaselineMemory(baselineMemory) {
        const baselineMemoryMb = baselineMemory.heapUsed / (1024 * 1024);
        const violations = [];
        const warnings = [];

        if (baselineMemoryMb > this.thresholds.baselineMemoryMb) {
            violations.push({
                type: 'baseline_exceeded',
                current: baselineMemoryMb.toFixed(2),
                threshold: this.thresholds.baselineMemoryMb,
                severity: 'high'
            });
        }

        return {
            compliant: violations.length === 0,
            violations,
            warnings,
            current: baselineMemoryMb.toFixed(2),
            threshold: this.thresholds.baselineMemoryMb
        };
    }

    /**
     * Validates peak memory usage
     * @private
     */
    validatePeakMemory(peakMemory) {
        const peakMemoryMb = peakMemory.heapUsed / (1024 * 1024);
        const violations = [];
        const warnings = [];

        if (peakMemoryMb > this.thresholds.maxMemoryMb) {
            violations.push({
                type: 'peak_memory_exceeded',
                current: peakMemoryMb.toFixed(2),
                threshold: this.thresholds.maxMemoryMb,
                severity: 'critical'
            });
        } else if (peakMemoryMb > this.thresholds.maxMemoryMb * 0.8) {
            warnings.push({
                type: 'peak_memory_approaching_threshold',
                current: peakMemoryMb.toFixed(2),
                threshold: this.thresholds.maxMemoryMb,
                severity: 'medium'
            });
        }

        return {
            compliant: violations.length === 0,
            violations,
            warnings,
            current: peakMemoryMb.toFixed(2),
            threshold: this.thresholds.maxMemoryMb
        };
    }

    /**
     * Validates memory growth rate
     * @private
     */
    validateMemoryGrowthRate(growthRate) {
        const violations = [];

        if (growthRate > this.thresholds.memoryLeakThresholdMb) {
            violations.push({
                type: 'memory_growth_rate_exceeded',
                current: growthRate.toFixed(2),
                threshold: this.thresholds.memoryLeakThresholdMb,
                severity: 'high'
            });
        }

        return {
            compliant: violations.length === 0,
            violations,
            warnings: [],
            current: growthRate.toFixed(2),
            threshold: this.thresholds.memoryLeakThresholdMb
        };
    }

    /**
     * Validates memory efficiency
     * @private
     */
    validateMemoryEfficiency(efficiency) {
        // Placeholder for efficiency validation logic
        return {
            compliant: true,
            violations: [],
            warnings: []
        };
    }

    /**
     * Calculates compliance percentage
     * @private
     */
    calculateCompliancePercentage(compliance) {
        const totalChecks = Object.keys(compliance).length;
        if (totalChecks === 0) return 100;

        const compliantChecks = Object.values(compliance).filter(check => check.compliant).length;
        return ((compliantChecks / totalChecks) * 100).toFixed(2);
    }

    /**
     * Determines compliance risk level
     * @private
     */
    determineComplianceRiskLevel(summary) {
        if (summary.criticalViolations > 0) return 'critical';
        if (summary.violationCount > 3) return 'high';
        if (summary.violationCount > 1) return 'medium';
        if (summary.warningCount > 0) return 'low';
        return 'minimal';
    }
}

// Helper functions for memory analysis and calculations

/**
 * Generates startup memory recommendations based on measurement results
 * @private
 */
function generateStartupMemoryRecommendations(memoryOverheadMb, thresholdValidation) {
    const recommendations = [];

    if (memoryOverheadMb > 10) {
        recommendations.push({
            type: 'high_startup_overhead',
            priority: 'medium',
            description: 'Server startup memory overhead is higher than expected',
            action: 'Review server initialization code and consider lazy loading of modules'
        });
    }

    if (!thresholdValidation.baselineWithinThreshold) {
        recommendations.push({
            type: 'baseline_threshold_exceeded',
            priority: 'high',
            description: 'Baseline memory usage exceeds configured threshold',
            action: 'Optimize initial memory allocation and review memory configuration'
        });
    }

    return recommendations;
}

/**
 * Analyzes request memory patterns
 * @private
 */
function analyzeRequestMemoryPatterns(successfulRequests, baselineMemory) {
    if (!successfulRequests || successfulRequests.length === 0) {
        return { analysis: 'no_successful_requests' };
    }

    const memoryDeltas = successfulRequests.map(req => req.memory.delta.heapUsed);
    const totalMemoryDelta = memoryDeltas.reduce((sum, delta) => sum + delta, 0);
    const averageMemoryDelta = totalMemoryDelta / memoryDeltas.length;
    
    return {
        totalRequests: successfulRequests.length,
        totalMemoryDelta,
        perRequestAverage: averageMemoryDelta,
        perRequestAverageMb: (averageMemoryDelta / (1024 * 1024)).toFixed(4),
        memoryEfficiency: averageMemoryDelta < 1024 ? 'excellent' : averageMemoryDelta < 10240 ? 'good' : 'needs_improvement'
    };
}

/**
 * Calculates memory statistics for request processing
 * @private
 */
function calculateMemoryStatistics(successfulRequests) {
    if (!successfulRequests || successfulRequests.length === 0) {
        return { noData: true };
    }

    const responseTimes = successfulRequests.map(req => req.timing.duration);
    const memoryDeltas = successfulRequests.map(req => req.memory.delta.heapUsed);

    return {
        requestCount: successfulRequests.length,
        averageRequestTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        totalRequestTime: responseTimes.reduce((sum, time) => sum + time, 0),
        averageMemoryDelta: memoryDeltas.reduce((sum, delta) => sum + delta, 0) / memoryDeltas.length,
        minMemoryDelta: Math.min(...memoryDeltas),
        maxMemoryDelta: Math.max(...memoryDeltas)
    };
}

/**
 * Detects memory accumulation patterns that might indicate leaks
 * @private
 */
function detectMemoryAccumulationPatterns(memorySnapshots, baselineMemory) {
    if (!memorySnapshots || memorySnapshots.length < 3) {
        return { insufficient_data: true };
    }

    const heapUsages = memorySnapshots.map(snapshot => snapshot.memory.heapUsed);
    const trend = calculateTrendDirection(heapUsages);
    
    return {
        trend,
        growthDetected: trend === 'increasing',
        consistentGrowth: trend === 'increasing' && heapUsages.length > 10,
        riskLevel: trend === 'increasing' ? 'medium' : 'low'
    };
}

/**
 * Calculates trend direction for an array of values
 * @private
 */
function calculateTrendDirection(values) {
    if (values.length < 2) return 'unknown';
    
    const increases = values.slice(1).reduce((count, val, index) => {
        return val > values[index] ? count + 1 : count;
    }, 0);
    
    const total = values.length - 1;
    if (increases > total * 0.7) return 'increasing';
    if (increases < total * 0.3) return 'decreasing';
    return 'stable';
}

// Additional helper functions would be implemented here for comprehensive memory analysis
// These include statistical analysis, GC pattern analysis, memory trend calculations, etc.

// Export all memory testing components and utilities
export { MEMORY_THRESHOLDS, TEST_SCENARIOS, MEMORY_TEST_CONFIG };