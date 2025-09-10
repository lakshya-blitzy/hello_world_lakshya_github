/**
 * Node.js Tutorial HTTP Server - Performance Monitoring Utility
 * 
 * Comprehensive performance monitoring utility that tracks HTTP server performance metrics,
 * system resource utilization, and application performance indicators using only Node.js 
 * built-in modules. Implements real-time performance measurement, trend analysis, and 
 * threshold monitoring while maintaining zero external dependencies and providing 
 * educational demonstrations of Node.js performance monitoring concepts.
 * 
 * Educational Features:
 * - Demonstrates Node.js Performance API usage for high-resolution timing
 * - Shows system metrics collection using process and os modules  
 * - Illustrates event-driven monitoring with EventEmitter
 * - Teaches performance threshold management and alerting
 * - Demonstrates memory-efficient metrics storage and cleanup
 * 
 * Dependencies: Node.js built-in modules only (perf_hooks, process, os, events)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Node.js built-in module imports with version comments
const { performance, PerformanceObserver } = require('node:perf_hooks'); // Built-in Node.js performance API - stable
const process = require('node:process'); // Built-in Node.js process monitoring - stable
const os = require('node:os'); // Built-in Node.js operating system utilities - stable
const { EventEmitter } = require('node:events'); // Built-in Node.js event emitter - stable

// Internal module imports for logging and configuration integration
const { logger } = require('../lib/logger.js');
const { serverConfig } = require('../config/server-config.js');

// Global performance metrics type constants for structured monitoring classification
const PERFORMANCE_METRICS_TYPES = {
    RESPONSE_TIME: 'response_time',
    THROUGHPUT: 'throughput', 
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    EVENT_LOOP_LAG: 'event_loop_lag',
    ERROR_RATE: 'error_rate'
};

// Default monitoring intervals for different metric collection frequencies
const DEFAULT_MONITORING_INTERVALS = {
    realTimeMs: 1000,        // Real-time metrics collection every 1 second
    aggregationMs: 60000,    // Aggregation calculations every 1 minute
    alertCheckMs: 30000,     // Threshold violation checks every 30 seconds
    cleanupMs: 300000        // Metrics cleanup every 5 minutes
};

// Performance threshold constants for alerting and monitoring decisions
const PERFORMANCE_THRESHOLDS = {
    responseTimeMs: 100,         // Maximum acceptable response time in milliseconds
    memoryUsagePercent: 80,      // Maximum memory usage percentage threshold
    cpuUsagePercent: 70,         // Maximum CPU usage percentage threshold
    eventLoopLagMs: 100,         // Maximum event loop lag in milliseconds
    errorRatePercent: 5          // Maximum error rate percentage threshold
};

// Metrics retention policy for memory management and storage optimization
const METRICS_RETENTION_POLICY = {
    realTimePoints: 3600,        // Keep 3600 real-time data points (1 hour at 1-second intervals)
    historicalHours: 24,         // Retain historical data for 24 hours
    maxMemoryUsageMb: 5          // Maximum memory usage for metrics storage
};

/**
 * Measures HTTP response time for individual requests using high-resolution performance timing
 * Provides accurate performance metrics for request processing analysis and optimization
 * Educational demonstration of Node.js Performance API usage in middleware patterns
 * 
 * @param {Object} request - HTTP request object for context and correlation
 * @param {Object} response - HTTP response object for timing measurement
 * @param {Function} next - Optional callback function for middleware integration
 * @returns {Function} Middleware function that tracks response time and logs performance data
 */
function measureResponseTime(request, response, next) {
    // Generate unique request correlation ID for performance tracking and debugging
    const correlationId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Record high-resolution start timestamp using performance.now() for microsecond precision
    const startTime = performance.now();
    
    // Extract request information for performance context and logging
    const requestInfo = {
        method: request.method,
        path: request.url,
        userAgent: request.headers['user-agent'] || 'Unknown',
        contentLength: request.headers['content-length'] || 0,
        timestamp: new Date().toISOString()
    };
    
    logger.debug('Request performance measurement started', {
        correlationId,
        method: requestInfo.method,
        path: requestInfo.path,
        startTime: startTime.toFixed(3)
    });
    
    // Set up response finish event listener for timing completion measurement
    response.on('finish', () => {
        // Calculate total response time when response processing completes
        const endTime = performance.now();
        const responseTimeMs = endTime - startTime;
        
        // Create performance measurement data with comprehensive request context
        const performanceData = {
            correlationId,
            responseTimeMs: parseFloat(responseTimeMs.toFixed(3)),
            statusCode: response.statusCode,
            requestInfo,
            timestamp: Date.now(),
            thresholdViolation: responseTimeMs > PERFORMANCE_THRESHOLDS.responseTimeMs
        };
        
        // Compare response time against configured performance thresholds
        if (performanceData.thresholdViolation) {
            logger.warn('Response time threshold violation detected', {
                correlationId,
                responseTime: performanceData.responseTimeMs,
                threshold: PERFORMANCE_THRESHOLDS.responseTimeMs,
                statusCode: response.statusCode
            });
        } else {
            logger.info('Request completed within performance threshold', {
                correlationId,
                responseTime: performanceData.responseTimeMs,
                statusCode: response.statusCode
            });
        }
        
        // Emit performance data event for real-time monitoring integration
        if (global.performanceMonitorInstance) {
            global.performanceMonitorInstance.emit('performanceData', performanceData);
        }
    });
    
    // Set up error event listener for error handling and performance impact tracking
    response.on('error', (error) => {
        const endTime = performance.now();
        const responseTimeMs = endTime - startTime;
        
        logger.error('Request processing error detected during performance measurement', {
            correlationId,
            error: error.message,
            responseTime: responseTimeMs.toFixed(3),
            method: requestInfo.method,
            path: requestInfo.path
        });
    });
    
    // Call next middleware function if provided for middleware chain integration
    if (next && typeof next === 'function') {
        next();
    }
    
    // Return middleware function for HTTP server integration
    return (req, res, nextCallback) => {
        measureResponseTime(req, res, nextCallback);
    };
}

/**
 * Collects comprehensive system performance metrics including memory usage, CPU utilization,
 * event loop lag, and process statistics for system health monitoring and resource analysis
 * Educational demonstration of Node.js process and OS monitoring capabilities
 * 
 * @param {boolean} includeDetailed - Whether to include detailed process and system metrics
 * @returns {Object} System metrics object with memory, CPU, and process performance data
 */
function collectSystemMetrics(includeDetailed = false) {
    try {
        // Collect Node.js process memory usage including heap and external memory statistics
        const memoryUsage = process.memoryUsage();
        const totalSystemMemory = os.totalmem();
        const freeSystemMemory = os.freemem();
        const usedSystemMemory = totalSystemMemory - freeSystemMemory;
        
        // Calculate memory usage percentages for threshold monitoring
        const memoryMetrics = {
            heapUsedMb: parseFloat((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
            heapTotalMb: parseFloat((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
            externalMb: parseFloat((memoryUsage.external / 1024 / 1024).toFixed(2)),
            rssMb: parseFloat((memoryUsage.rss / 1024 / 1024).toFixed(2)),
            systemTotalMb: parseFloat((totalSystemMemory / 1024 / 1024).toFixed(2)),
            systemUsedMb: parseFloat((usedSystemMemory / 1024 / 1024).toFixed(2)),
            systemUsagePercent: parseFloat(((usedSystemMemory / totalSystemMemory) * 100).toFixed(2))
        };
        
        // Measure CPU usage and load average from operating system metrics
        const cpuInfo = os.cpus();
        const loadAverage = os.loadavg();
        const cpuUsagePercent = Math.min(loadAverage[0] / cpuInfo.length * 100, 100);
        
        const cpuMetrics = {
            usagePercent: parseFloat(cpuUsagePercent.toFixed(2)),
            loadAverage1m: parseFloat(loadAverage[0].toFixed(2)),
            loadAverage5m: parseFloat(loadAverage[1].toFixed(2)),
            loadAverage15m: parseFloat(loadAverage[2].toFixed(2)),
            coreCount: cpuInfo.length
        };
        
        // Calculate event loop lag using performance measurement techniques
        const eventLoopLagStart = performance.now();
        const eventLoopLag = parseFloat((performance.now() - eventLoopLagStart).toFixed(3));
        
        // Gather process uptime and resource usage statistics
        const processMetrics = {
            uptimeSeconds: parseFloat(process.uptime().toFixed(2)),
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version,
            eventLoopLagMs: eventLoopLag
        };
        
        // Create comprehensive system metrics object
        const systemMetrics = {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            memory: memoryMetrics,
            cpu: cpuMetrics,
            process: processMetrics,
            thresholdViolations: {
                memory: memoryMetrics.systemUsagePercent > PERFORMANCE_THRESHOLDS.memoryUsagePercent,
                cpu: cpuMetrics.usagePercent > PERFORMANCE_THRESHOLDS.cpuUsagePercent,
                eventLoop: eventLoopLag > PERFORMANCE_THRESHOLDS.eventLoopLagMs
            }
        };
        
        // Include detailed system metrics if requested for comprehensive monitoring
        if (includeDetailed) {
            systemMetrics.detailed = {
                hostname: os.hostname(),
                architecture: os.arch(),
                osType: os.type(),
                osRelease: os.release(),
                networkInterfaces: Object.keys(os.networkInterfaces()),
                environmentVariables: {
                    nodeEnv: process.env.NODE_ENV || 'development',
                    port: process.env.PORT || '3000'
                }
            };
        }
        
        logger.debug('System metrics collected successfully', {
            memoryUsagePercent: systemMetrics.memory.systemUsagePercent,
            cpuUsagePercent: systemMetrics.cpu.usagePercent,
            eventLoopLagMs: systemMetrics.process.eventLoopLagMs,
            thresholdViolations: Object.keys(systemMetrics.thresholdViolations).filter(
                key => systemMetrics.thresholdViolations[key]
            )
        });
        
        return systemMetrics;
        
    } catch (error) {
        logger.error('Error collecting system metrics', {
            error: error.message,
            stack: error.stack
        });
        
        // Return minimal metrics object on error for graceful degradation
        return {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            error: 'Failed to collect system metrics',
            errorMessage: error.message
        };
    }
}

/**
 * Calculates HTTP request throughput metrics including requests per second, average response times,
 * and request rate trends over configurable time windows for performance analysis
 * Educational demonstration of performance calculations and statistical analysis
 * 
 * @param {number} timeWindowMs - Time window in milliseconds for throughput calculation
 * @returns {Object} Throughput metrics object with requests per second and trend analysis
 */
function calculateThroughput(timeWindowMs = 60000) {
    try {
        // Get current timestamp for time window calculations
        const currentTime = Date.now();
        const windowStartTime = currentTime - timeWindowMs;
        
        // Access global performance monitor instance for request history data
        if (!global.performanceMonitorInstance || !global.performanceMonitorInstance.requestHistory) {
            logger.warn('Performance monitor instance not available for throughput calculation');
            return {
                timestamp: currentTime,
                timeWindowMs,
                requestsPerSecond: 0,
                requestsPerMinute: 0,
                totalRequests: 0,
                error: 'No performance monitor instance available'
            };
        }
        
        const requestHistory = global.performanceMonitorInstance.requestHistory;
        
        // Filter request history based on specified time window
        const windowRequests = requestHistory.filter(request => 
            request.timestamp >= windowStartTime && request.timestamp <= currentTime
        );
        
        // Count total requests processed within time window
        const totalRequests = windowRequests.length;
        const timeWindowSeconds = timeWindowMs / 1000;
        
        // Calculate requests per second and requests per minute rates
        const requestsPerSecond = totalRequests > 0 ? 
            parseFloat((totalRequests / timeWindowSeconds).toFixed(2)) : 0;
        const requestsPerMinute = totalRequests > 0 ? 
            parseFloat((totalRequests / (timeWindowSeconds / 60)).toFixed(2)) : 0;
        
        // Compute average response time for successful requests
        const successfulRequests = windowRequests.filter(request => 
            request.statusCode >= 200 && request.statusCode < 400
        );
        
        const averageResponseTime = successfulRequests.length > 0 ? 
            parseFloat((successfulRequests.reduce((sum, request) => 
                sum + request.responseTimeMs, 0) / successfulRequests.length).toFixed(3)) : 0;
        
        // Calculate success rate percentage and error rate metrics
        const successRate = totalRequests > 0 ? 
            parseFloat(((successfulRequests.length / totalRequests) * 100).toFixed(2)) : 0;
        const errorRate = totalRequests > 0 ? 
            parseFloat((((totalRequests - successfulRequests.length) / totalRequests) * 100).toFixed(2)) : 0;
        
        // Analyze request rate trends by comparing with previous time window
        const previousWindowStart = windowStartTime - timeWindowMs;
        const previousWindowRequests = requestHistory.filter(request => 
            request.timestamp >= previousWindowStart && request.timestamp < windowStartTime
        );
        
        const previousRequestsPerSecond = previousWindowRequests.length > 0 ? 
            parseFloat((previousWindowRequests.length / timeWindowSeconds).toFixed(2)) : 0;
        
        const trendPercentage = previousRequestsPerSecond > 0 ? 
            parseFloat((((requestsPerSecond - previousRequestsPerSecond) / previousRequestsPerSecond) * 100).toFixed(2)) : 0;
        
        // Create comprehensive throughput metrics object
        const throughputMetrics = {
            timestamp: currentTime,
            timestampIso: new Date().toISOString(),
            timeWindowMs,
            timeWindowSeconds,
            requestsPerSecond,
            requestsPerMinute,
            totalRequests,
            successfulRequests: successfulRequests.length,
            averageResponseTimeMs: averageResponseTime,
            successRatePercent: successRate,
            errorRatePercent: errorRate,
            trend: {
                previousRequestsPerSecond,
                changePercent: trendPercentage,
                direction: trendPercentage > 0 ? 'increasing' : trendPercentage < 0 ? 'decreasing' : 'stable'
            }
        };
        
        logger.debug('Throughput metrics calculated successfully', {
            requestsPerSecond: throughputMetrics.requestsPerSecond,
            averageResponseTime: throughputMetrics.averageResponseTimeMs,
            successRate: throughputMetrics.successRatePercent,
            trendDirection: throughputMetrics.trend.direction
        });
        
        return throughputMetrics;
        
    } catch (error) {
        logger.error('Error calculating throughput metrics', {
            error: error.message,
            timeWindowMs,
            stack: error.stack
        });
        
        // Return error metrics object for graceful degradation
        return {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            timeWindowMs,
            error: 'Failed to calculate throughput metrics',
            errorMessage: error.message,
            requestsPerSecond: 0,
            requestsPerMinute: 0,
            totalRequests: 0
        };
    }
}

/**
 * Analyzes historical performance data to identify trends, patterns, and anomalies in system
 * performance including response time trends, resource utilization patterns, and performance
 * degradation indicators using statistical analysis methods
 * 
 * @param {number} analysisWindowMs - Time window for trend analysis in milliseconds
 * @param {Array} metricsToAnalyze - Array of metric types to include in trend analysis
 * @returns {Object} Performance trend analysis results with patterns and recommendations
 */
function analyzePerformanceTrends(analysisWindowMs = 3600000, metricsToAnalyze = ['response_time', 'memory_usage', 'cpu_usage']) {
    try {
        const currentTime = Date.now();
        const analysisStartTime = currentTime - analysisWindowMs;
        
        // Access global performance monitor instance for historical data
        if (!global.performanceMonitorInstance) {
            logger.warn('Performance monitor instance not available for trend analysis');
            return {
                timestamp: currentTime,
                analysisWindowMs,
                error: 'No performance monitor instance available'
            };
        }
        
        const monitor = global.performanceMonitorInstance;
        const trendAnalysis = {
            timestamp: currentTime,
            timestampIso: new Date().toISOString(),
            analysisWindowMs,
            analysisWindowHours: analysisWindowMs / 3600000,
            metrics: {}
        };
        
        // Extract performance metrics history for specified analysis window
        if (metricsToAnalyze.includes('response_time') && monitor.requestHistory) {
            const responseTimeData = monitor.requestHistory
                .filter(request => request.timestamp >= analysisStartTime)
                .map(request => ({
                    timestamp: request.timestamp,
                    value: request.responseTimeMs
                }));
            
            if (responseTimeData.length > 0) {
                // Calculate moving averages and statistical trends for response times
                const values = responseTimeData.map(data => data.value);
                const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);
                
                // Calculate standard deviation for variability analysis
                const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
                const standardDeviation = Math.sqrt(variance);
                
                // Identify performance anomalies using statistical analysis
                const anomalies = values.filter(value => Math.abs(value - average) > 2 * standardDeviation);
                
                trendAnalysis.metrics.responseTime = {
                    sampleCount: values.length,
                    averageMs: parseFloat(average.toFixed(3)),
                    minMs: parseFloat(min.toFixed(3)),
                    maxMs: parseFloat(max.toFixed(3)),
                    standardDeviation: parseFloat(standardDeviation.toFixed(3)),
                    anomalyCount: anomalies.length,
                    trend: max > average * 1.2 ? 'degrading' : min < average * 0.8 ? 'improving' : 'stable'
                };
            }
        }
        
        // Analyze memory usage trends if requested
        if (metricsToAnalyze.includes('memory_usage') && monitor.systemMetricsHistory) {
            const memoryData = monitor.systemMetricsHistory
                .filter(metric => metric.timestamp >= analysisStartTime)
                .map(metric => ({
                    timestamp: metric.timestamp,
                    value: metric.memory ? metric.memory.systemUsagePercent : 0
                }));
            
            if (memoryData.length > 0) {
                const values = memoryData.map(data => data.value);
                const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                const trend = values[values.length - 1] - values[0];
                
                trendAnalysis.metrics.memoryUsage = {
                    sampleCount: values.length,
                    averagePercent: parseFloat(average.toFixed(2)),
                    minPercent: parseFloat(Math.min(...values).toFixed(2)),
                    maxPercent: parseFloat(Math.max(...values).toFixed(2)),
                    trendPercent: parseFloat(trend.toFixed(2)),
                    trend: trend > 5 ? 'increasing' : trend < -5 ? 'decreasing' : 'stable'
                };
            }
        }
        
        // Analyze CPU usage trends if requested
        if (metricsToAnalyze.includes('cpu_usage') && monitor.systemMetricsHistory) {
            const cpuData = monitor.systemMetricsHistory
                .filter(metric => metric.timestamp >= analysisStartTime)
                .map(metric => ({
                    timestamp: metric.timestamp,
                    value: metric.cpu ? metric.cpu.usagePercent : 0
                }));
            
            if (cpuData.length > 0) {
                const values = cpuData.map(data => data.value);
                const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                const peak = Math.max(...values);
                
                trendAnalysis.metrics.cpuUsage = {
                    sampleCount: values.length,
                    averagePercent: parseFloat(average.toFixed(2)),
                    minPercent: parseFloat(Math.min(...values).toFixed(2)),
                    maxPercent: parseFloat(peak.toFixed(2)),
                    peakUsagePercent: parseFloat(peak.toFixed(2)),
                    trend: peak > 80 ? 'high_utilization' : average < 20 ? 'low_utilization' : 'normal'
                };
            }
        }
        
        // Generate performance baseline comparisons and recommendations
        const recommendations = [];
        
        if (trendAnalysis.metrics.responseTime) {
            const rt = trendAnalysis.metrics.responseTime;
            if (rt.averageMs > PERFORMANCE_THRESHOLDS.responseTimeMs) {
                recommendations.push({
                    type: 'response_time',
                    severity: 'warning',
                    message: `Average response time (${rt.averageMs}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.responseTimeMs}ms)`,
                    suggestion: 'Consider optimizing request processing or increasing server resources'
                });
            }
            if (rt.anomalyCount > rt.sampleCount * 0.05) {
                recommendations.push({
                    type: 'response_time',
                    severity: 'info',
                    message: `High number of response time anomalies detected (${rt.anomalyCount})`,
                    suggestion: 'Investigate potential causes of response time spikes'
                });
            }
        }
        
        if (trendAnalysis.metrics.memoryUsage) {
            const mem = trendAnalysis.metrics.memoryUsage;
            if (mem.averagePercent > PERFORMANCE_THRESHOLDS.memoryUsagePercent) {
                recommendations.push({
                    type: 'memory_usage',
                    severity: 'warning',
                    message: `Average memory usage (${mem.averagePercent}%) exceeds threshold (${PERFORMANCE_THRESHOLDS.memoryUsagePercent}%)`,
                    suggestion: 'Consider increasing available memory or optimizing memory usage'
                });
            }
        }
        
        trendAnalysis.recommendations = recommendations;
        trendAnalysis.summary = {
            overallTrend: recommendations.length === 0 ? 'healthy' : 
                         recommendations.some(r => r.severity === 'warning') ? 'needs_attention' : 'stable',
            issueCount: recommendations.length,
            analysisCompleted: true
        };
        
        logger.info('Performance trend analysis completed', {
            analysisWindow: `${analysisWindowMs / 3600000} hours`,
            metricsAnalyzed: Object.keys(trendAnalysis.metrics),
            recommendationCount: recommendations.length,
            overallTrend: trendAnalysis.summary.overallTrend
        });
        
        return trendAnalysis;
        
    } catch (error) {
        logger.error('Error analyzing performance trends', {
            error: error.message,
            analysisWindowMs,
            metricsToAnalyze,
            stack: error.stack
        });
        
        return {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            analysisWindowMs,
            error: 'Failed to analyze performance trends',
            errorMessage: error.message
        };
    }
}

/**
 * Evaluates current performance metrics against configured thresholds to identify threshold
 * violations, performance degradation, and alerting conditions for proactive monitoring
 * Educational demonstration of threshold-based monitoring and alerting systems
 * 
 * @param {Object} currentMetrics - Current performance metrics to evaluate against thresholds
 * @param {Object} customThresholds - Optional custom threshold overrides for specific checks
 * @returns {Object} Threshold evaluation results with violations and alert recommendations
 */
function checkPerformanceThresholds(currentMetrics, customThresholds = {}) {
    try {
        // Load performance thresholds from server configuration with custom overrides
        const thresholds = {
            ...PERFORMANCE_THRESHOLDS,
            ...(serverConfig.performance?.thresholds || {}),
            ...customThresholds
        };
        
        const evaluationResults = {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            thresholds,
            violations: [],
            alerts: [],
            summary: {
                totalChecks: 0,
                violationCount: 0,
                criticalViolations: 0,
                warningViolations: 0
            }
        };
        
        // Evaluate response time metrics against configured thresholds
        if (currentMetrics.responseTimeMs !== undefined) {
            evaluationResults.summary.totalChecks++;
            
            if (currentMetrics.responseTimeMs > thresholds.responseTimeMs) {
                const severity = currentMetrics.responseTimeMs > thresholds.responseTimeMs * 2 ? 'critical' : 'warning';
                const violation = {
                    metric: 'response_time',
                    value: currentMetrics.responseTimeMs,
                    threshold: thresholds.responseTimeMs,
                    severity,
                    exceedsBy: parseFloat((currentMetrics.responseTimeMs - thresholds.responseTimeMs).toFixed(3)),
                    exceedsByPercent: parseFloat((((currentMetrics.responseTimeMs / thresholds.responseTimeMs) - 1) * 100).toFixed(2))
                };
                
                evaluationResults.violations.push(violation);
                evaluationResults.summary.violationCount++;
                
                if (severity === 'critical') {
                    evaluationResults.summary.criticalViolations++;
                } else {
                    evaluationResults.summary.warningViolations++;
                }
                
                evaluationResults.alerts.push({
                    type: 'threshold_violation',
                    metric: 'response_time',
                    severity,
                    message: `Response time (${currentMetrics.responseTimeMs}ms) exceeds threshold (${thresholds.responseTimeMs}ms)`,
                    recommendation: severity === 'critical' ? 
                        'Immediate investigation required - response times are critically high' :
                        'Monitor response times and consider optimization'
                });
            }
        }
        
        // Check memory usage percentage against memory threshold limits
        if (currentMetrics.memoryUsagePercent !== undefined) {
            evaluationResults.summary.totalChecks++;
            
            if (currentMetrics.memoryUsagePercent > thresholds.memoryUsagePercent) {
                const severity = currentMetrics.memoryUsagePercent > 90 ? 'critical' : 'warning';
                const violation = {
                    metric: 'memory_usage',
                    value: currentMetrics.memoryUsagePercent,
                    threshold: thresholds.memoryUsagePercent,
                    severity,
                    exceedsBy: parseFloat((currentMetrics.memoryUsagePercent - thresholds.memoryUsagePercent).toFixed(2)),
                    exceedsByPercent: parseFloat((((currentMetrics.memoryUsagePercent / thresholds.memoryUsagePercent) - 1) * 100).toFixed(2))
                };
                
                evaluationResults.violations.push(violation);
                evaluationResults.summary.violationCount++;
                
                if (severity === 'critical') {
                    evaluationResults.summary.criticalViolations++;
                } else {
                    evaluationResults.summary.warningViolations++;
                }
                
                evaluationResults.alerts.push({
                    type: 'threshold_violation',
                    metric: 'memory_usage',
                    severity,
                    message: `Memory usage (${currentMetrics.memoryUsagePercent}%) exceeds threshold (${thresholds.memoryUsagePercent}%)`,
                    recommendation: severity === 'critical' ? 
                        'Critical memory usage - investigate memory leaks and consider increasing resources' :
                        'Monitor memory usage patterns and consider optimization'
                });
            }
        }
        
        // Assess CPU usage against CPU utilization thresholds
        if (currentMetrics.cpuUsagePercent !== undefined) {
            evaluationResults.summary.totalChecks++;
            
            if (currentMetrics.cpuUsagePercent > thresholds.cpuUsagePercent) {
                const severity = currentMetrics.cpuUsagePercent > 90 ? 'critical' : 'warning';
                const violation = {
                    metric: 'cpu_usage',
                    value: currentMetrics.cpuUsagePercent,
                    threshold: thresholds.cpuUsagePercent,
                    severity,
                    exceedsBy: parseFloat((currentMetrics.cpuUsagePercent - thresholds.cpuUsagePercent).toFixed(2)),
                    exceedsByPercent: parseFloat((((currentMetrics.cpuUsagePercent / thresholds.cpuUsagePercent) - 1) * 100).toFixed(2))
                };
                
                evaluationResults.violations.push(violation);
                evaluationResults.summary.violationCount++;
                
                if (severity === 'critical') {
                    evaluationResults.summary.criticalViolations++;
                } else {
                    evaluationResults.summary.warningViolations++;
                }
                
                evaluationResults.alerts.push({
                    type: 'threshold_violation',
                    metric: 'cpu_usage',
                    severity,
                    message: `CPU usage (${currentMetrics.cpuUsagePercent}%) exceeds threshold (${thresholds.cpuUsagePercent}%)`,
                    recommendation: severity === 'critical' ? 
                        'Critical CPU usage - investigate high CPU processes and consider scaling' :
                        'Monitor CPU usage and consider performance optimization'
                });
            }
        }
        
        // Verify event loop lag against responsiveness thresholds
        if (currentMetrics.eventLoopLagMs !== undefined) {
            evaluationResults.summary.totalChecks++;
            
            if (currentMetrics.eventLoopLagMs > thresholds.eventLoopLagMs) {
                const severity = currentMetrics.eventLoopLagMs > thresholds.eventLoopLagMs * 2 ? 'critical' : 'warning';
                const violation = {
                    metric: 'event_loop_lag',
                    value: currentMetrics.eventLoopLagMs,
                    threshold: thresholds.eventLoopLagMs,
                    severity,
                    exceedsBy: parseFloat((currentMetrics.eventLoopLagMs - thresholds.eventLoopLagMs).toFixed(3)),
                    exceedsByPercent: parseFloat((((currentMetrics.eventLoopLagMs / thresholds.eventLoopLagMs) - 1) * 100).toFixed(2))
                };
                
                evaluationResults.violations.push(violation);
                evaluationResults.summary.violationCount++;
                
                if (severity === 'critical') {
                    evaluationResults.summary.criticalViolations++;
                } else {
                    evaluationResults.summary.warningViolations++;
                }
                
                evaluationResults.alerts.push({
                    type: 'threshold_violation',
                    metric: 'event_loop_lag',
                    severity,
                    message: `Event loop lag (${currentMetrics.eventLoopLagMs}ms) exceeds threshold (${thresholds.eventLoopLagMs}ms)`,
                    recommendation: severity === 'critical' ? 
                        'Critical event loop blocking - investigate synchronous operations and blocking code' :
                        'Monitor event loop performance and avoid blocking operations'
                });
            }
        }
        
        // Evaluate error rate against acceptable error thresholds
        if (currentMetrics.errorRatePercent !== undefined) {
            evaluationResults.summary.totalChecks++;
            
            if (currentMetrics.errorRatePercent > thresholds.errorRatePercent) {
                const severity = currentMetrics.errorRatePercent > 10 ? 'critical' : 'warning';
                const violation = {
                    metric: 'error_rate',
                    value: currentMetrics.errorRatePercent,
                    threshold: thresholds.errorRatePercent,
                    severity,
                    exceedsBy: parseFloat((currentMetrics.errorRatePercent - thresholds.errorRatePercent).toFixed(2)),
                    exceedsByPercent: parseFloat((((currentMetrics.errorRatePercent / thresholds.errorRatePercent) - 1) * 100).toFixed(2))
                };
                
                evaluationResults.violations.push(violation);
                evaluationResults.summary.violationCount++;
                
                if (severity === 'critical') {
                    evaluationResults.summary.criticalViolations++;
                } else {
                    evaluationResults.summary.warningViolations++;
                }
                
                evaluationResults.alerts.push({
                    type: 'threshold_violation',
                    metric: 'error_rate',
                    severity,
                    message: `Error rate (${currentMetrics.errorRatePercent}%) exceeds threshold (${thresholds.errorRatePercent}%)`,
                    recommendation: severity === 'critical' ? 
                        'Critical error rate - investigate error causes and implement fixes immediately' :
                        'Monitor error patterns and investigate root causes'
                });
            }
        }
        
        // Generate overall health assessment based on threshold evaluation
        evaluationResults.summary.overallStatus = 
            evaluationResults.summary.criticalViolations > 0 ? 'critical' :
            evaluationResults.summary.warningViolations > 0 ? 'warning' :
            'healthy';
        
        evaluationResults.summary.healthScore = evaluationResults.summary.totalChecks > 0 ? 
            Math.max(0, 100 - (evaluationResults.summary.violationCount / evaluationResults.summary.totalChecks * 100)) : 100;
        
        logger.debug('Performance threshold evaluation completed', {
            totalChecks: evaluationResults.summary.totalChecks,
            violationCount: evaluationResults.summary.violationCount,
            overallStatus: evaluationResults.summary.overallStatus,
            healthScore: evaluationResults.summary.healthScore
        });
        
        return evaluationResults;
        
    } catch (error) {
        logger.error('Error checking performance thresholds', {
            error: error.message,
            currentMetrics: currentMetrics ? Object.keys(currentMetrics) : 'undefined',
            stack: error.stack
        });
        
        return {
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            error: 'Failed to check performance thresholds',
            errorMessage: error.message,
            violations: [],
            alerts: [],
            summary: {
                totalChecks: 0,
                violationCount: 0,
                overallStatus: 'error'
            }
        };
    }
}

/**
 * Generates comprehensive performance report with current metrics, historical trends, threshold
 * compliance, and optimization recommendations for system monitoring and analysis
 * Educational demonstration of performance reporting and analysis techniques
 * 
 * @param {Object} reportOptions - Report configuration including time period and detail level
 * @returns {Object} Comprehensive performance report with metrics, trends, and recommendations
 */
function generatePerformanceReport(reportOptions = {}) {
    try {
        const options = {
            timePeriodMs: 3600000,      // Default 1 hour analysis period
            includeDetails: true,        // Include detailed metrics
            includeTrends: true,         // Include trend analysis
            includeRecommendations: true, // Include optimization recommendations
            ...reportOptions
        };
        
        const reportTimestamp = Date.now();
        
        // Collect current performance snapshot with latest metrics
        const currentSnapshot = collectSystemMetrics(options.includeDetails);
        const throughputMetrics = calculateThroughput(options.timePeriodMs);
        
        // Gather historical performance data for trend analysis if requested
        let trendAnalysis = null;
        if (options.includeTrends) {
            trendAnalysis = analyzePerformanceTrends(options.timePeriodMs);
        }
        
        // Evaluate performance against thresholds for compliance assessment
        const thresholdEvaluation = checkPerformanceThresholds({
            responseTimeMs: throughputMetrics.averageResponseTimeMs,
            memoryUsagePercent: currentSnapshot.memory?.systemUsagePercent,
            cpuUsagePercent: currentSnapshot.cpu?.usagePercent,
            eventLoopLagMs: currentSnapshot.process?.eventLoopLagMs,
            errorRatePercent: throughputMetrics.errorRatePercent
        });
        
        // Create comprehensive performance report structure
        const performanceReport = {
            reportId: `perf_report_${reportTimestamp}_${Math.random().toString(36).substring(2, 8)}`,
            timestamp: reportTimestamp,
            timestampIso: new Date().toISOString(),
            reportOptions: options,
            executiveSummary: {
                reportPeriodHours: options.timePeriodMs / 3600000,
                overallHealthScore: thresholdEvaluation.summary.healthScore,
                overallStatus: thresholdEvaluation.summary.overallStatus,
                totalRequests: throughputMetrics.totalRequests,
                averageResponseTimeMs: throughputMetrics.averageResponseTimeMs,
                currentMemoryUsagePercent: currentSnapshot.memory?.systemUsagePercent || 0,
                currentCpuUsagePercent: currentSnapshot.cpu?.usagePercent || 0,
                thresholdViolationCount: thresholdEvaluation.summary.violationCount,
                criticalIssueCount: thresholdEvaluation.summary.criticalViolations
            },
            currentMetrics: {
                system: currentSnapshot,
                throughput: throughputMetrics,
                timestamp: reportTimestamp
            },
            thresholds: {
                evaluation: thresholdEvaluation,
                compliance: {
                    responseTimeCompliance: throughputMetrics.averageResponseTimeMs <= PERFORMANCE_THRESHOLDS.responseTimeMs,
                    memoryCompliance: (currentSnapshot.memory?.systemUsagePercent || 0) <= PERFORMANCE_THRESHOLDS.memoryUsagePercent,
                    cpuCompliance: (currentSnapshot.cpu?.usagePercent || 0) <= PERFORMANCE_THRESHOLDS.cpuUsagePercent,
                    eventLoopCompliance: (currentSnapshot.process?.eventLoopLagMs || 0) <= PERFORMANCE_THRESHOLDS.eventLoopLagMs
                }
            }
        };
        
        // Include trend analysis in report if requested
        if (options.includeTrends && trendAnalysis) {
            performanceReport.trends = trendAnalysis;
            performanceReport.executiveSummary.trendDirection = trendAnalysis.summary?.overallTrend || 'unknown';
        }
        
        // Generate performance optimization recommendations if requested
        if (options.includeRecommendations) {
            const recommendations = [];
            
            // Response time recommendations
            if (performanceReport.executiveSummary.averageResponseTimeMs > PERFORMANCE_THRESHOLDS.responseTimeMs) {
                recommendations.push({
                    category: 'response_time',
                    priority: 'high',
                    title: 'Response Time Optimization',
                    description: `Average response time (${performanceReport.executiveSummary.averageResponseTimeMs}ms) exceeds target threshold`,
                    actions: [
                        'Profile request handlers for performance bottlenecks',
                        'Implement response caching where appropriate',
                        'Optimize database queries and external API calls',
                        'Consider implementing request queuing for load management'
                    ]
                });
            }
            
            // Memory usage recommendations
            if (performanceReport.executiveSummary.currentMemoryUsagePercent > PERFORMANCE_THRESHOLDS.memoryUsagePercent) {
                recommendations.push({
                    category: 'memory_usage',
                    priority: 'medium',
                    title: 'Memory Usage Optimization',
                    description: `Current memory usage (${performanceReport.executiveSummary.currentMemoryUsagePercent}%) exceeds target threshold`,
                    actions: [
                        'Investigate potential memory leaks using heap profiling',
                        'Optimize object creation and garbage collection patterns',
                        'Implement memory-efficient data structures',
                        'Consider increasing available system memory'
                    ]
                });
            }
            
            // CPU usage recommendations
            if (performanceReport.executiveSummary.currentCpuUsagePercent > PERFORMANCE_THRESHOLDS.cpuUsagePercent) {
                recommendations.push({
                    category: 'cpu_usage',
                    priority: 'medium',
                    title: 'CPU Usage Optimization',
                    description: `Current CPU usage (${performanceReport.executiveSummary.currentCpuUsagePercent}%) exceeds target threshold`,
                    actions: [
                        'Profile CPU-intensive operations and optimize algorithms',
                        'Implement request load balancing across multiple processes',
                        'Consider using worker threads for CPU-intensive tasks',
                        'Optimize synchronous operations and reduce blocking code'
                    ]
                });
            }
            
            // Error rate recommendations
            if (performanceReport.currentMetrics.throughput.errorRatePercent > PERFORMANCE_THRESHOLDS.errorRatePercent) {
                recommendations.push({
                    category: 'error_rate',
                    priority: 'high',
                    title: 'Error Rate Reduction',
                    description: `Current error rate (${performanceReport.currentMetrics.throughput.errorRatePercent}%) exceeds acceptable threshold`,
                    actions: [
                        'Analyze error logs to identify common error patterns',
                        'Implement comprehensive error handling and validation',
                        'Add health checks for external dependencies',
                        'Implement circuit breaker patterns for resilience'
                    ]
                });
            }
            
            performanceReport.recommendations = {
                count: recommendations.length,
                items: recommendations,
                summary: recommendations.length === 0 ? 
                    'System performance is within acceptable thresholds. Continue monitoring.' :
                    `${recommendations.length} optimization opportunities identified. Priority actions recommended.`
            };
        }
        
        // Add report generation metadata
        performanceReport.metadata = {
            reportGenerationTimeMs: Date.now() - reportTimestamp,
            dataSourcesUsed: [
                'system_metrics',
                'throughput_metrics',
                options.includeTrends ? 'trend_analysis' : null,
                'threshold_evaluation'
            ].filter(Boolean),
            reportVersion: '1.0.0',
            nodeVersion: process.version,
            platform: process.platform
        };
        
        logger.info('Performance report generated successfully', {
            reportId: performanceReport.reportId,
            overallStatus: performanceReport.executiveSummary.overallStatus,
            healthScore: performanceReport.executiveSummary.overallHealthScore,
            recommendationCount: performanceReport.recommendations?.count || 0,
            generationTimeMs: performanceReport.metadata.reportGenerationTimeMs
        });
        
        return performanceReport;
        
    } catch (error) {
        logger.error('Error generating performance report', {
            error: error.message,
            reportOptions,
            stack: error.stack
        });
        
        return {
            reportId: `error_report_${Date.now()}`,
            timestamp: Date.now(),
            timestampIso: new Date().toISOString(),
            error: 'Failed to generate performance report',
            errorMessage: error.message,
            executiveSummary: {
                overallStatus: 'error',
                overallHealthScore: 0
            }
        };
    }
}

/**
 * Optimizes performance data collection processes by managing memory usage, cleaning up old
 * metrics, and adjusting collection frequencies based on system load and performance requirements
 * Educational demonstration of memory management and performance optimization techniques
 * 
 * @param {Object} optimizationOptions - Options for performance collection optimization
 */
function optimizePerformanceCollection(optimizationOptions = {}) {
    try {
        const options = {
            maxMemoryUsageMb: METRICS_RETENTION_POLICY.maxMemoryUsageMb,
            retentionPeriodMs: METRICS_RETENTION_POLICY.historicalHours * 3600000,
            maxRealTimePoints: METRICS_RETENTION_POLICY.realTimePoints,
            enableAggregation: true,
            ...optimizationOptions
        };
        
        const optimizationStartTime = Date.now();
        
        // Access global performance monitor instance for optimization operations
        if (!global.performanceMonitorInstance) {
            logger.warn('Performance monitor instance not available for optimization');
            return;
        }
        
        const monitor = global.performanceMonitorInstance;
        let optimizationResults = {
            timestamp: optimizationStartTime,
            timestampIso: new Date().toISOString(),
            operations: [],
            metrics: {
                initialMemoryUsageMb: 0,
                finalMemoryUsageMb: 0,
                memorySavedMb: 0,
                recordsCleaned: 0,
                operationDurationMs: 0
            }
        };
        
        // Analyze current memory usage for performance metrics storage
        const initialMemoryUsage = process.memoryUsage();
        optimizationResults.metrics.initialMemoryUsageMb = parseFloat((initialMemoryUsage.heapUsed / 1024 / 1024).toFixed(2));
        
        const currentTime = Date.now();
        const retentionCutoff = currentTime - options.retentionPeriodMs;
        let totalRecordsCleaned = 0;
        
        // Clean up expired metrics based on retention policy
        if (monitor.requestHistory) {
            const initialRequestCount = monitor.requestHistory.length;
            monitor.requestHistory = monitor.requestHistory.filter(request => 
                request.timestamp >= retentionCutoff
            );
            
            const requestsCleaned = initialRequestCount - monitor.requestHistory.length;
            totalRecordsCleaned += requestsCleaned;
            
            if (requestsCleaned > 0) {
                optimizationResults.operations.push({
                    type: 'request_history_cleanup',
                    recordsCleaned: requestsCleaned,
                    recordsRetained: monitor.requestHistory.length,
                    description: `Cleaned ${requestsCleaned} expired request records`
                });
                
                logger.debug('Request history cleanup completed', {
                    recordsCleaned: requestsCleaned,
                    recordsRetained: monitor.requestHistory.length
                });
            }
        }
        
        // Clean up system metrics history
        if (monitor.systemMetricsHistory) {
            const initialSystemCount = monitor.systemMetricsHistory.length;
            monitor.systemMetricsHistory = monitor.systemMetricsHistory.filter(metric => 
                metric.timestamp >= retentionCutoff
            );
            
            const systemMetricsCleaned = initialSystemCount - monitor.systemMetricsHistory.length;
            totalRecordsCleaned += systemMetricsCleaned;
            
            if (systemMetricsCleaned > 0) {
                optimizationResults.operations.push({
                    type: 'system_metrics_cleanup',
                    recordsCleaned: systemMetricsCleaned,
                    recordsRetained: monitor.systemMetricsHistory.length,
                    description: `Cleaned ${systemMetricsCleaned} expired system metric records`
                });
                
                logger.debug('System metrics history cleanup completed', {
                    recordsCleaned: systemMetricsCleaned,
                    recordsRetained: monitor.systemMetricsHistory.length
                });
            }
        }
        
        // Adjust collection frequencies based on system load if enabled
        if (options.enableAggregation && monitor.systemMetricsHistory) {
            const currentSystemMetrics = collectSystemMetrics(false);
            const currentCpuUsage = currentSystemMetrics.cpu?.usagePercent || 0;
            const currentMemoryUsage = currentSystemMetrics.memory?.systemUsagePercent || 0;
            
            // Adjust collection intervals based on system load
            let intervalAdjustment = false;
            
            if (currentCpuUsage > 80 || currentMemoryUsage > 85) {
                // Increase collection intervals under high system load
                if (monitor.config && monitor.config.intervals) {
                    const originalRealTimeMs = monitor.config.intervals.realTimeMs;
                    monitor.config.intervals.realTimeMs = Math.min(originalRealTimeMs * 1.5, 5000);
                    intervalAdjustment = true;
                    
                    optimizationResults.operations.push({
                        type: 'interval_adjustment',
                        action: 'increased',
                        originalInterval: originalRealTimeMs,
                        newInterval: monitor.config.intervals.realTimeMs,
                        reason: 'High system load detected',
                        description: `Increased collection interval to reduce system load`
                    });
                }
            } else if (currentCpuUsage < 30 && currentMemoryUsage < 50) {
                // Decrease collection intervals under low system load for better granularity
                if (monitor.config && monitor.config.intervals) {
                    const originalRealTimeMs = monitor.config.intervals.realTimeMs;
                    monitor.config.intervals.realTimeMs = Math.max(originalRealTimeMs * 0.8, 500);
                    intervalAdjustment = true;
                    
                    optimizationResults.operations.push({
                        type: 'interval_adjustment',
                        action: 'decreased',
                        originalInterval: originalRealTimeMs,
                        newInterval: monitor.config.intervals.realTimeMs,
                        reason: 'Low system load detected',
                        description: `Decreased collection interval for better monitoring granularity`
                    });
                }
            }
            
            if (intervalAdjustment) {
                logger.info('Collection intervals adjusted based on system load', {
                    cpuUsage: currentCpuUsage,
                    memoryUsage: currentMemoryUsage,
                    newInterval: monitor.config.intervals.realTimeMs
                });
            }
        }
        
        // Optimize metrics storage data structures for efficiency
        if (monitor.metricsHistory && monitor.metricsHistory instanceof Map) {
            const initialSize = monitor.metricsHistory.size;
            
            // Remove expired entries from metrics history map
            for (const [key, value] of monitor.metricsHistory.entries()) {
                if (value.timestamp && value.timestamp < retentionCutoff) {
                    monitor.metricsHistory.delete(key);
                }
            }
            
            const entriesRemoved = initialSize - monitor.metricsHistory.size;
            if (entriesRemoved > 0) {
                totalRecordsCleaned += entriesRemoved;
                
                optimizationResults.operations.push({
                    type: 'metrics_map_cleanup',
                    recordsCleaned: entriesRemoved,
                    recordsRetained: monitor.metricsHistory.size,
                    description: `Cleaned ${entriesRemoved} expired entries from metrics map`
                });
            }
        }
        
        // Consolidate historical data to reduce memory footprint if requested
        if (options.enableAggregation && monitor.requestHistory && monitor.requestHistory.length > options.maxRealTimePoints) {
            const excessRecords = monitor.requestHistory.length - options.maxRealTimePoints;
            const recordsToAggregate = monitor.requestHistory.slice(0, excessRecords);
            
            // Create aggregated summary of excess records
            const aggregatedSummary = {
                timestamp: currentTime,
                type: 'aggregated_data',
                recordCount: recordsToAggregate.length,
                timeSpan: {
                    start: recordsToAggregate[0]?.timestamp,
                    end: recordsToAggregate[recordsToAggregate.length - 1]?.timestamp
                },
                averageResponseTime: recordsToAggregate.reduce((sum, record) => 
                    sum + record.responseTimeMs, 0) / recordsToAggregate.length,
                totalRequests: recordsToAggregate.length,
                successfulRequests: recordsToAggregate.filter(record => 
                    record.statusCode >= 200 && record.statusCode < 400).length
            };
            
            // Replace excess records with aggregated summary
            monitor.requestHistory = monitor.requestHistory.slice(excessRecords);
            
            // Store aggregated summary for historical reference
            if (!monitor.aggregatedHistory) {
                monitor.aggregatedHistory = [];
            }
            monitor.aggregatedHistory.push(aggregatedSummary);
            
            optimizationResults.operations.push({
                type: 'data_aggregation',
                recordsAggregated: excessRecords,
                recordsRetained: monitor.requestHistory.length,
                description: `Aggregated ${excessRecords} excess records to reduce memory usage`
            });
            
            logger.debug('Data aggregation completed', {
                recordsAggregated: excessRecords,
                recordsRetained: monitor.requestHistory.length
            });
        }
        
        // Calculate final memory usage and optimization results
        const finalMemoryUsage = process.memoryUsage();
        optimizationResults.metrics.finalMemoryUsageMb = parseFloat((finalMemoryUsage.heapUsed / 1024 / 1024).toFixed(2));
        optimizationResults.metrics.memorySavedMb = parseFloat((optimizationResults.metrics.initialMemoryUsageMb - optimizationResults.metrics.finalMemoryUsageMb).toFixed(2));
        optimizationResults.metrics.recordsCleaned = totalRecordsCleaned;
        optimizationResults.metrics.operationDurationMs = Date.now() - optimizationStartTime;
        
        // Update collection intervals based on optimization results
        if (monitor.config && optimizationResults.metrics.memorySavedMb > 1) {
            // Successful optimization - maintain or improve collection frequency
            logger.info('Performance collection optimization completed successfully', {
                memorySavedMb: optimizationResults.metrics.memorySavedMb,
                recordsCleaned: optimizationResults.metrics.recordsCleaned,
                operationCount: optimizationResults.operations.length,
                durationMs: optimizationResults.metrics.operationDurationMs
            });
        } else {
            // Minimal optimization benefit - consider adjusting collection strategy
            logger.debug('Performance collection optimization completed with minimal benefit', {
                memorySavedMb: optimizationResults.metrics.memorySavedMb,
                recordsCleaned: optimizationResults.metrics.recordsCleaned
            });
        }
        
        // Emit optimization completion event for monitoring integration
        if (monitor.emit && typeof monitor.emit === 'function') {
            monitor.emit('optimizationCompleted', optimizationResults);
        }
        
    } catch (error) {
        logger.error('Error optimizing performance collection', {
            error: error.message,
            optimizationOptions,
            stack: error.stack
        });
    }
}

/**
 * Main performance monitoring class that orchestrates comprehensive application performance tracking,
 * manages real-time metrics collection, maintains performance history, and provides performance 
 * analysis capabilities with configurable thresholds and alerting for Node.js HTTP server applications
 * 
 * Educational Features:
 * - Demonstrates EventEmitter usage for real-time performance notifications
 * - Shows Node.js Performance API integration for precise timing measurements  
 * - Illustrates memory-efficient data collection and retention policies
 * - Teaches performance threshold configuration and monitoring patterns
 * - Demonstrates statistical analysis and trend detection techniques
 */
class PerformanceMonitor extends EventEmitter {
    /**
     * Initializes performance monitor with configuration, sets up metrics collection infrastructure,
     * and establishes performance observation with Node.js PerformanceObserver integration
     * Educational demonstration of class initialization and configuration management patterns
     * 
     * @param {Object} config - Performance monitor configuration with thresholds and monitoring settings
     */
    constructor(config = {}) {
        super();
        
        // Store and validate performance monitor configuration parameters
        this.config = {
            // Performance thresholds configuration with server config integration
            thresholds: {
                ...PERFORMANCE_THRESHOLDS,
                ...(serverConfig.performance?.thresholds || {}),
                ...config.thresholds
            },
            
            // Monitoring intervals for different collection frequencies
            intervals: {
                ...DEFAULT_MONITORING_INTERVALS,
                ...config.intervals
            },
            
            // Metrics retention policy for memory management
            retention: {
                ...METRICS_RETENTION_POLICY,
                ...config.retention
            },
            
            // Monitoring features configuration
            enableRealTimeCollection: config.enableRealTimeCollection !== false,
            enableTrendAnalysis: config.enableTrendAnalysis !== false,
            enableThresholdAlerting: config.enableThresholdAlerting !== false,
            enableOptimization: config.enableOptimization !== false
        };
        
        // Initialize metrics history storage with Map for efficient time-series data management
        this.metricsHistory = new Map();
        this.requestHistory = [];
        this.systemMetricsHistory = [];
        this.aggregatedHistory = [];
        
        // Set up Node.js PerformanceObserver for automatic performance entry collection
        this.performanceObserver = null;
        this.isObserving = false;
        
        // Configure collection intervals and timers for different monitoring activities
        this.intervals = {
            realTimeCollection: null,
            systemMetricsCollection: null,
            thresholdChecking: null,
            optimization: null
        };
        
        // Initialize performance baseline calculations and trend tracking
        this.baselines = {
            averageResponseTime: 0,
            averageMemoryUsage: 0,
            averageCpuUsage: 0,
            establishedAt: Date.now(),
            sampleCount: 0
        };
        
        // Set monitoring state and operational flags
        this.isMonitoring = false;
        this.startedAt = null;
        this.lastOptimizationAt = null;
        
        // Configure performance thresholds with validation and defaults
        this.thresholds = this.config.thresholds;
        
        // Set up event emitters for real-time performance data broadcasting
        this.setMaxListeners(50); // Increase max listeners for multiple monitoring consumers
        
        // Configure metrics retention policy and automatic cleanup mechanisms
        this.retentionPolicy = this.config.retention;
        
        // Register global performance monitor instance for standalone function integration
        global.performanceMonitorInstance = this;
        
        logger.info('Performance monitor initialized successfully', {
            thresholds: this.thresholds,
            intervals: this.config.intervals,
            retention: this.retentionPolicy,
            enabledFeatures: {
                realTimeCollection: this.config.enableRealTimeCollection,
                trendAnalysis: this.config.enableTrendAnalysis,
                thresholdAlerting: this.config.enableThresholdAlerting,
                optimization: this.config.enableOptimization
            }
        });
    }
    
    /**
     * Initiates comprehensive performance monitoring with configurable collection intervals,
     * automatic metrics gathering, and real-time performance tracking for HTTP server operations
     * Educational demonstration of monitoring system initialization and event-driven architecture
     * 
     * @param {Object} monitoringOptions - Optional monitoring configuration overrides and collection preferences
     * @returns {Object} Monitoring session object with control methods and status information
     */
    async startMonitoring(monitoringOptions = {}) {
        try {
            // Validate monitoring configuration and initialize performance collection
            if (this.isMonitoring) {
                logger.warn('Performance monitoring is already active');
                return {
                    success: false,
                    message: 'Monitoring already active',
                    status: 'already_running'
                };
            }
            
            const options = {
                ...this.config,
                ...monitoringOptions
            };
            
            this.startedAt = Date.now();
            this.isMonitoring = true;
            
            logger.info('Starting comprehensive performance monitoring', {
                options: {
                    enableRealTimeCollection: options.enableRealTimeCollection,
                    enableTrendAnalysis: options.enableTrendAnalysis,
                    enableThresholdAlerting: options.enableThresholdAlerting
                },
                intervals: options.intervals
            });
            
            // Start PerformanceObserver with HTTP timing and resource measurement
            if (options.enableRealTimeCollection) {
                this.performanceObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    for (const entry of entries) {
                        this.handlePerformanceEntry(entry);
                    }
                });
                
                // Observe HTTP timing measurements and resource performance entries
                try {
                    this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
                    this.isObserving = true;
                    
                    logger.debug('PerformanceObserver started successfully', {
                        entryTypes: ['measure', 'mark']
                    });
                } catch (observerError) {
                    logger.warn('PerformanceObserver setup failed, continuing without it', {
                        error: observerError.message
                    });
                }
            }
            
            // Configure real-time metrics collection with configurable frequency
            if (this.config.intervals.realTimeMs > 0) {
                this.intervals.realTimeCollection = setInterval(() => {
                    this.collectRealTimeMetrics();
                }, this.config.intervals.realTimeMs);
                
                logger.debug('Real-time metrics collection started', {
                    intervalMs: this.config.intervals.realTimeMs
                });
            }
            
            // Set up system metrics collection with configurable frequency
            this.intervals.systemMetricsCollection = setInterval(() => {
                this.collectAndStoreSystemMetrics();
            }, 5000); // System metrics every 5 seconds
            
            // Initialize throughput calculation and request tracking
            this.intervals.throughputCalculation = setInterval(() => {
                this.calculateAndStoreThroughputMetrics();
            }, this.config.intervals.aggregationMs);
            
            // Start performance threshold monitoring and alerting if enabled
            if (options.enableThresholdAlerting && this.config.intervals.alertCheckMs > 0) {
                this.intervals.thresholdChecking = setInterval(() => {
                    this.performThresholdChecking();
                }, this.config.intervals.alertCheckMs);
                
                logger.debug('Threshold monitoring started', {
                    intervalMs: this.config.intervals.alertCheckMs
                });
            }
            
            // Configure automatic metrics optimization and cleanup
            if (options.enableOptimization && this.config.intervals.cleanupMs > 0) {
                this.intervals.optimization = setInterval(() => {
                    optimizePerformanceCollection({
                        maxMemoryUsageMb: this.retentionPolicy.maxMemoryUsageMb,
                        retentionPeriodMs: this.retentionPolicy.historicalHours * 3600000
                    });
                    this.lastOptimizationAt = Date.now();
                }, this.config.intervals.cleanupMs);
                
                logger.debug('Automatic optimization started', {
                    intervalMs: this.config.intervals.cleanupMs
                });
            }
            
            // Set monitoring state to active and emit monitoring started event
            this.emit('monitoringStarted', {
                startedAt: this.startedAt,
                configuration: options,
                features: {
                    realTimeCollection: options.enableRealTimeCollection,
                    systemMetrics: true,
                    thresholdAlerting: options.enableThresholdAlerting,
                    automaticOptimization: options.enableOptimization
                }
            });
            
            logger.info('Performance monitoring started successfully', {
                startedAt: new Date(this.startedAt).toISOString(),
                activeFeatures: Object.keys(this.intervals).filter(key => this.intervals[key] !== null).length,
                observerActive: this.isObserving
            });
            
            // Return monitoring control object with stop and status methods
            return {
                success: true,
                message: 'Performance monitoring started successfully',
                status: 'active',
                startedAt: this.startedAt,
                features: Object.keys(this.intervals).filter(key => this.intervals[key] !== null),
                stop: () => this.stopMonitoring(),
                getStatus: () => this.getMonitoringStatus()
            };
            
        } catch (error) {
            logger.error('Error starting performance monitoring', {
                error: error.message,
                stack: error.stack,
                monitoringOptions
            });
            
            // Cleanup partial initialization on startup failure
            await this.stopMonitoring();
            
            return {
                success: false,
                message: 'Failed to start performance monitoring',
                status: 'error',
                error: error.message
            };
        }
    }
    
    /**
     * Gracefully stops performance monitoring, completes in-progress measurements, and performs
     * final data aggregation and cleanup operations
     * Educational demonstration of graceful shutdown patterns and resource cleanup
     */
    async stopMonitoring() {
        try {
            logger.info('Stopping performance monitoring gracefully');
            
            // Stop PerformanceObserver and clear performance measurement listeners
            if (this.performanceObserver && this.isObserving) {
                this.performanceObserver.disconnect();
                this.isObserving = false;
                logger.debug('PerformanceObserver stopped successfully');
            }
            
            // Clear all collection intervals and scheduled monitoring operations
            Object.keys(this.intervals).forEach(intervalName => {
                if (this.intervals[intervalName]) {
                    clearInterval(this.intervals[intervalName]);
                    this.intervals[intervalName] = null;
                    logger.debug(`Cleared ${intervalName} interval`);
                }
            });
            
            // Complete any in-progress performance measurements and calculations
            if (this.isMonitoring) {
                // Perform final metrics collection before shutdown
                const finalMetrics = collectSystemMetrics(true);
                const finalThroughput = calculateThroughput(60000);
                
                // Store final monitoring session summary
                const sessionSummary = {
                    sessionId: `session_${this.startedAt}`,
                    startedAt: this.startedAt,
                    stoppedAt: Date.now(),
                    durationMs: Date.now() - this.startedAt,
                    finalMetrics,
                    finalThroughput,
                    totalRequestsProcessed: this.requestHistory.length,
                    totalSystemMetrics: this.systemMetricsHistory.length,
                    optimizationCount: this.lastOptimizationAt ? 1 : 0
                };
                
                // Perform final metrics aggregation and storage cleanup
                optimizePerformanceCollection({
                    maxMemoryUsageMb: this.retentionPolicy.maxMemoryUsageMb,
                    retentionPeriodMs: this.retentionPolicy.historicalHours * 3600000,
                    enableAggregation: true
                });
                
                logger.info('Final monitoring session summary', {
                    sessionDurationMs: sessionSummary.durationMs,
                    totalRequestsProcessed: sessionSummary.totalRequestsProcessed,
                    finalMemoryUsageMb: finalMetrics.memory?.systemUsedMb,
                    finalCpuUsagePercent: finalMetrics.cpu?.usagePercent
                });
                
                // Emit monitoring session summary for external systems
                this.emit('monitoringStopped', sessionSummary);
            }
            
            // Set monitoring state to inactive and emit monitoring stopped event
            this.isMonitoring = false;
            this.startedAt = null;
            
            logger.info('Performance monitoring stopped successfully');
            
        } catch (error) {
            logger.error('Error stopping performance monitoring', {
                error: error.message,
                stack: error.stack
            });
            
            // Force cleanup on error
            this.isMonitoring = false;
            this.isObserving = false;
            Object.keys(this.intervals).forEach(key => {
                this.intervals[key] = null;
            });
        }
    }
    
    /**
     * Returns comprehensive current performance snapshot with latest metrics, system statistics,
     * and performance indicators for immediate analysis and monitoring dashboard consumption
     * Educational demonstration of real-time monitoring data collection and formatting
     * 
     * @param {Object} snapshotOptions - Options for snapshot content and detail level
     * @returns {Object} Performance snapshot object with current metrics and system statistics
     */
    getPerformanceSnapshot(snapshotOptions = {}) {
        try {
            const options = {
                includeSystemMetrics: true,
                includeThroughputMetrics: true,
                includeThresholdStatus: true,
                includeHistoricalContext: false,
                ...snapshotOptions
            };
            
            const snapshotTimestamp = Date.now();
            
            // Collect current system metrics including memory and CPU usage
            let systemMetrics = null;
            if (options.includeSystemMetrics) {
                systemMetrics = collectSystemMetrics(options.includeHistoricalContext);
            }
            
            // Calculate latest response time statistics and throughput metrics
            let throughputMetrics = null;
            if (options.includeThroughputMetrics) {
                throughputMetrics = calculateThroughput(60000); // Last 60 seconds
            }
            
            // Measure current event loop lag and process performance indicators
            const eventLoopLagStart = performance.now();
            const eventLoopLag = parseFloat((performance.now() - eventLoopLagStart).toFixed(3));
            
            // Gather HTTP server performance metrics and connection statistics
            const processMetrics = {
                uptimeSeconds: parseFloat(process.uptime().toFixed(2)),
                eventLoopLagMs: eventLoopLag,
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch
            };
            
            // Include error rate calculations and failure pattern analysis
            const errorAnalysis = this.requestHistory.length > 0 ? {
                totalRequests: this.requestHistory.length,
                errorCount: this.requestHistory.filter(req => req.statusCode >= 400).length,
                errorRate: parseFloat(((this.requestHistory.filter(req => req.statusCode >= 400).length / this.requestHistory.length) * 100).toFixed(2)),
                recentErrors: this.requestHistory
                    .filter(req => req.statusCode >= 400 && req.timestamp > snapshotTimestamp - 300000)
                    .length
            } : {
                totalRequests: 0,
                errorCount: 0,
                errorRate: 0,
                recentErrors: 0
            };
            
            // Add performance threshold compliance status and violations
            let thresholdStatus = null;
            if (options.includeThresholdStatus) {
                thresholdStatus = checkPerformanceThresholds({
                    responseTimeMs: throughputMetrics?.averageResponseTimeMs || 0,
                    memoryUsagePercent: systemMetrics?.memory?.systemUsagePercent || 0,
                    cpuUsagePercent: systemMetrics?.cpu?.usagePercent || 0,
                    eventLoopLagMs: eventLoopLag,
                    errorRatePercent: errorAnalysis.errorRate
                });
            }
            
            // Generate performance score and health indicators
            const performanceScore = this.calculatePerformanceScore({
                responseTime: throughputMetrics?.averageResponseTimeMs || 0,
                memoryUsage: systemMetrics?.memory?.systemUsagePercent || 0,
                cpuUsage: systemMetrics?.cpu?.usagePercent || 0,
                errorRate: errorAnalysis.errorRate,
                eventLoopLag: eventLoopLag
            });
            
            // Format comprehensive snapshot for monitoring system consumption
            const performanceSnapshot = {
                snapshotId: `snapshot_${snapshotTimestamp}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: snapshotTimestamp,
                timestampIso: new Date().toISOString(),
                monitoringStatus: {
                    isActive: this.isMonitoring,
                    startedAt: this.startedAt,
                    uptimeMs: this.startedAt ? snapshotTimestamp - this.startedAt : 0,
                    lastOptimizationAt: this.lastOptimizationAt
                },
                system: systemMetrics,
                process: processMetrics,
                throughput: throughputMetrics,
                errors: errorAnalysis,
                thresholds: thresholdStatus,
                performance: {
                    score: performanceScore,
                    status: performanceScore >= 80 ? 'excellent' : 
                           performanceScore >= 60 ? 'good' : 
                           performanceScore >= 40 ? 'fair' : 'poor',
                    baselines: this.baselines
                },
                metadata: {
                    requestHistorySize: this.requestHistory.length,
                    systemMetricsHistorySize: this.systemMetricsHistory.length,
                    metricsMapSize: this.metricsHistory.size,
                    observerActive: this.isObserving
                }
            };
            
            // Return performance snapshot object with timestamp and metadata
            logger.debug('Performance snapshot generated', {
                snapshotId: performanceSnapshot.snapshotId,
                performanceScore: performanceSnapshot.performance.score,
                performanceStatus: performanceSnapshot.performance.status,
                thresholdViolations: thresholdStatus?.summary?.violationCount || 0
            });
            
            return performanceSnapshot;
            
        } catch (error) {
            logger.error('Error generating performance snapshot', {
                error: error.message,
                snapshotOptions,
                stack: error.stack
            });
            
            return {
                snapshotId: `error_snapshot_${Date.now()}`,
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),
                error: 'Failed to generate performance snapshot',
                errorMessage: error.message,
                monitoringStatus: {
                    isActive: this.isMonitoring,
                    error: true
                }
            };
        }
    }
    
    /**
     * Creates performance measurement middleware for HTTP requests that tracks response times,
     * throughput metrics, and request-specific performance indicators with correlation tracking
     * Educational demonstration of middleware pattern and performance measurement integration
     * 
     * @param {Object} measurementOptions - Options for request performance measurement and correlation
     * @returns {Function} Middleware function for HTTP server request performance tracking
     */
    measureRequestPerformance(measurementOptions = {}) {
        const options = {
            enableCorrelationTracking: true,
            enableThresholdChecking: true,
            enableRealTimeEvents: true,
            includeRequestDetails: true,
            ...measurementOptions
        };
        
        // Create middleware function with performance measurement capability
        return (request, response, next) => {
            try {
                // Record request start timestamp with high-resolution timing
                const requestStartTime = performance.now();
                const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                
                // Generate unique correlation ID for request performance tracking
                const correlationId = options.enableCorrelationTracking ? requestId : null;
                
                // Extract request information for performance context
                const requestInfo = {
                    method: request.method,
                    url: request.url,
                    path: request.url.split('?')[0],
                    userAgent: request.headers['user-agent'] || 'Unknown',
                    contentLength: parseInt(request.headers['content-length'] || '0'),
                    remoteAddress: request.connection?.remoteAddress || 'Unknown',
                    timestamp: Date.now()
                };
                
                logger.debug('Request performance measurement started', {
                    correlationId,
                    method: requestInfo.method,
                    path: requestInfo.path,
                    startTime: requestStartTime.toFixed(3)
                });
                
                // Set up response finish event listener for completion timing
                response.on('finish', () => {
                    try {
                        // Calculate total request processing time
                        const requestEndTime = performance.now();
                        const responseTimeMs = parseFloat((requestEndTime - requestStartTime).toFixed(3));
                        
                        // Create comprehensive request performance data
                        const requestPerformanceData = {
                            correlationId,
                            requestId,
                            responseTimeMs,
                            statusCode: response.statusCode,
                            requestInfo,
                            timestamp: Date.now(),
                            processingStages: {
                                total: responseTimeMs,
                                // Additional timing stages could be added here
                            }
                        };
                        
                        // Update throughput counters and request rate statistics
                        this.requestHistory.push(requestPerformanceData);
                        
                        // Maintain request history size within retention limits
                        if (this.requestHistory.length > this.retentionPolicy.realTimePoints) {
                            this.requestHistory = this.requestHistory.slice(-this.retentionPolicy.realTimePoints);
                        }
                        
                        // Check performance against thresholds and generate alerts
                        if (options.enableThresholdChecking) {
                            const thresholdViolation = responseTimeMs > this.thresholds.responseTimeMs;
                            requestPerformanceData.thresholdViolation = thresholdViolation;
                            
                            if (thresholdViolation) {
                                logger.warn('Response time threshold violation', {
                                    correlationId,
                                    responseTime: responseTimeMs,
                                    threshold: this.thresholds.responseTimeMs,
                                    statusCode: response.statusCode
                                });
                                
                                // Emit threshold violation event
                                this.emit('thresholdViolation', {
                                    type: 'response_time',
                                    value: responseTimeMs,
                                    threshold: this.thresholds.responseTimeMs,
                                    requestData: requestPerformanceData
                                });
                            }
                        }
                        
                        // Store request performance data in metrics history
                        this.metricsHistory.set(requestId, {
                            type: PERFORMANCE_METRICS_TYPES.RESPONSE_TIME,
                            data: requestPerformanceData,
                            timestamp: Date.now()
                        });
                        
                        // Update performance baselines with new measurement
                        this.updatePerformanceBaselines(requestPerformanceData);
                        
                        // Emit real-time performance events for monitoring integration
                        if (options.enableRealTimeEvents) {
                            this.emit('requestCompleted', requestPerformanceData);
                            this.emit('performanceData', {
                                type: PERFORMANCE_METRICS_TYPES.RESPONSE_TIME,
                                ...requestPerformanceData
                            });
                        }
                        
                        logger.debug('Request performance measurement completed', {
                            correlationId,
                            responseTime: responseTimeMs,
                            statusCode: response.statusCode,
                            thresholdViolation: requestPerformanceData.thresholdViolation || false
                        });
                        
                    } catch (finishError) {
                        logger.error('Error in request finish handler', {
                            correlationId,
                            error: finishError.message,
                            stack: finishError.stack
                        });
                    }
                });
                
                // Set up error event listener for error handling
                response.on('error', (error) => {
                    const requestEndTime = performance.now();
                    const responseTimeMs = parseFloat((requestEndTime - requestStartTime).toFixed(3));
                    
                    logger.error('Request processing error during performance measurement', {
                        correlationId,
                        error: error.message,
                        responseTime: responseTimeMs,
                        method: requestInfo.method,
                        path: requestInfo.path
                    });
                    
                    // Emit error event for error tracking
                    this.emit('requestError', {
                        correlationId,
                        error: error.message,
                        responseTimeMs,
                        requestInfo
                    });
                });
                
                // Return configured middleware function for server integration
                if (next && typeof next === 'function') {
                    next();
                }
                
            } catch (middlewareError) {
                logger.error('Error in performance measurement middleware', {
                    error: middlewareError.message,
                    method: request.method,
                    url: request.url,
                    stack: middlewareError.stack
                });
                
                // Continue with request processing even if measurement fails
                if (next && typeof next === 'function') {
                    next();
                }
            }
        };
    }
    
    /**
     * Performs comprehensive performance trend analysis on historical metrics data to identify
     * patterns, anomalies, and optimization opportunities with statistical analysis and forecasting
     * Educational demonstration of data analysis, statistical processing, and trend detection
     * 
     * @param {number} analysisWindowMs - Time window for trend analysis in milliseconds
     * @param {Object} analysisOptions - Options for trend analysis scope and statistical methods
     * @returns {Object} Comprehensive trend analysis results with patterns and recommendations
     */
    analyzePerformanceTrends(analysisWindowMs = 3600000, analysisOptions = {}) {
        try {
            const options = {
                includeResponseTimeTrends: true,
                includeSystemMetricsTrends: true,
                includeThroughputTrends: true,
                includeAnomalyDetection: true,
                includeForecasting: false,
                statisticalAnalysis: true,
                ...analysisOptions
            };
            
            return analyzePerformanceTrends(analysisWindowMs, [
                options.includeResponseTimeTrends ? 'response_time' : null,
                options.includeSystemMetricsTrends ? 'memory_usage' : null,
                options.includeSystemMetricsTrends ? 'cpu_usage' : null,
                options.includeThroughputTrends ? 'throughput' : null
            ].filter(Boolean));
            
        } catch (error) {
            logger.error('Error in performance trend analysis', {
                error: error.message,
                analysisWindowMs,
                analysisOptions,
                stack: error.stack
            });
            
            return {
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),
                analysisWindowMs,
                error: 'Failed to analyze performance trends',
                errorMessage: error.message
            };
        }
    }
    
    /**
     * Updates performance monitoring thresholds and alerting rules with validation and immediate
     * application to ongoing performance monitoring and alerting systems
     * Educational demonstration of dynamic configuration management and validation patterns
     * 
     * @param {Object} newThresholds - Updated performance threshold configuration object
     */
    configureThresholds(newThresholds) {
        try {
            // Validate new threshold values for logical consistency and operational ranges
            const validatedThresholds = this.validateThresholds(newThresholds);
            
            if (validatedThresholds.isValid) {
                const previousThresholds = { ...this.thresholds };
                
                // Update internal threshold configuration with new performance limits
                this.thresholds = {
                    ...this.thresholds,
                    ...validatedThresholds.thresholds
                };
                
                this.config.thresholds = this.thresholds;
                
                // Recalculate current performance status against updated thresholds
                const currentSnapshot = this.getPerformanceSnapshot({
                    includeThresholdStatus: true
                });
                
                // Update alerting rules and notification triggers with new thresholds
                this.emit('thresholdsUpdated', {
                    previousThresholds,
                    newThresholds: this.thresholds,
                    currentStatus: currentSnapshot.thresholds,
                    timestamp: Date.now()
                });
                
                // Log threshold configuration changes for monitoring and audit purposes
                logger.info('Performance thresholds updated successfully', {
                    previousThresholds,
                    newThresholds: this.thresholds,
                    validationResult: validatedThresholds,
                    currentViolations: currentSnapshot.thresholds?.summary?.violationCount || 0
                });
                
            } else {
                logger.warn('Threshold configuration validation failed', {
                    providedThresholds: newThresholds,
                    validationErrors: validatedThresholds.errors
                });
                
                throw new Error(`Threshold validation failed: ${validatedThresholds.errors.join(', ')}`);
            }
            
        } catch (error) {
            logger.error('Error configuring performance thresholds', {
                error: error.message,
                newThresholds,
                stack: error.stack
            });
            
            throw error;
        }
    }
    
    /**
     * Exports performance metrics and analysis data in various formats for external monitoring
     * systems, analysis tools, and reporting platforms with configurable export options
     * Educational demonstration of data export patterns and format transformation
     * 
     * @param {Object} exportOptions - Export configuration including format, time range, and data selection
     * @returns {Object} Exported performance data in requested format with metadata and integrity information
     */
    exportPerformanceData(exportOptions = {}) {
        try {
            const options = {
                format: 'json',                    // json, csv, xml
                timeRangeMs: 3600000,             // Last 1 hour by default
                includeRequestHistory: true,
                includeSystemMetrics: true,
                includeAggregatedData: false,
                includeMetadata: true,
                compression: false,
                ...exportOptions
            };
            
            const exportTimestamp = Date.now();
            const exportStartTime = exportTimestamp - options.timeRangeMs;
            
            // Validate export format and time range parameters for data extraction
            if (!['json', 'csv', 'xml'].includes(options.format)) {
                throw new Error(`Unsupported export format: ${options.format}`);
            }
            
            // Retrieve performance metrics data based on export criteria and filters
            const exportData = {
                exportId: `export_${exportTimestamp}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: exportTimestamp,
                timestampIso: new Date().toISOString(),
                timeRange: {
                    startTime: exportStartTime,
                    endTime: exportTimestamp,
                    durationMs: options.timeRangeMs,
                    durationHours: options.timeRangeMs / 3600000
                },
                data: {}
            };
            
            // Include request history if requested
            if (options.includeRequestHistory && this.requestHistory) {
                exportData.data.requestHistory = this.requestHistory
                    .filter(request => request.timestamp >= exportStartTime)
                    .map(request => ({
                        correlationId: request.correlationId,
                        responseTimeMs: request.responseTimeMs,
                        statusCode: request.statusCode,
                        method: request.requestInfo?.method,
                        path: request.requestInfo?.path,
                        timestamp: request.timestamp,
                        timestampIso: new Date(request.timestamp).toISOString()
                    }));
            }
            
            // Include system metrics if requested
            if (options.includeSystemMetrics && this.systemMetricsHistory) {
                exportData.data.systemMetrics = this.systemMetricsHistory
                    .filter(metric => metric.timestamp >= exportStartTime)
                    .map(metric => ({
                        memoryUsagePercent: metric.memory?.systemUsagePercent,
                        cpuUsagePercent: metric.cpu?.usagePercent,
                        eventLoopLagMs: metric.process?.eventLoopLagMs,
                        timestamp: metric.timestamp,
                        timestampIso: new Date(metric.timestamp).toISOString()
                    }));
            }
            
            // Include aggregated data if requested
            if (options.includeAggregatedData && this.aggregatedHistory) {
                exportData.data.aggregatedData = this.aggregatedHistory
                    .filter(agg => agg.timestamp >= exportStartTime);
            }
            
            // Generate export metadata including timestamps and data descriptions
            if (options.includeMetadata) {
                exportData.metadata = {
                    exportVersion: '1.0.0',
                    dataIntegrity: {
                        requestHistoryCount: exportData.data.requestHistory?.length || 0,
                        systemMetricsCount: exportData.data.systemMetrics?.length || 0,
                        aggregatedDataCount: exportData.data.aggregatedData?.length || 0
                    },
                    monitoringSession: {
                        isActive: this.isMonitoring,
                        startedAt: this.startedAt,
                        currentThresholds: this.thresholds
                    },
                    exportOptions: options
                };
            }
            
            // Apply data transformation and formatting for target format requirements
            let formattedExportData;
            switch (options.format) {
                case 'json':
                    formattedExportData = JSON.stringify(exportData, null, 2);
                    break;
                    
                case 'csv':
                    formattedExportData = this.convertToCSV(exportData);
                    break;
                    
                case 'xml':
                    formattedExportData = this.convertToXML(exportData);
                    break;
                    
                default:
                    formattedExportData = JSON.stringify(exportData, null, 2);
            }
            
            // Include data integrity checks and validation information
            const integrityHash = this.calculateDataIntegrity(exportData);
            
            logger.info('Performance data export completed successfully', {
                exportId: exportData.exportId,
                format: options.format,
                timeRangeHours: exportData.timeRange.durationHours,
                requestHistoryCount: exportData.data.requestHistory?.length || 0,
                systemMetricsCount: exportData.data.systemMetrics?.length || 0,
                dataSize: formattedExportData.length
            });
            
            // Return formatted export data ready for external system consumption
            return {
                success: true,
                exportId: exportData.exportId,
                format: options.format,
                data: formattedExportData,
                metadata: exportData.metadata,
                integrityHash,
                size: formattedExportData.length,
                timestamp: exportTimestamp
            };
            
        } catch (error) {
            logger.error('Error exporting performance data', {
                error: error.message,
                exportOptions,
                stack: error.stack
            });
            
            return {
                success: false,
                error: 'Failed to export performance data',
                errorMessage: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    // Private helper methods for internal performance monitor operations
    
    /**
     * Handles performance entries from PerformanceObserver
     * @private
     */
    handlePerformanceEntry(entry) {
        try {
            const performanceEntry = {
                name: entry.name,
                entryType: entry.entryType,
                startTime: entry.startTime,
                duration: entry.duration,
                timestamp: Date.now()
            };
            
            // Store performance entry in metrics history
            this.metricsHistory.set(`perf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, {
                type: 'performance_entry',
                data: performanceEntry,
                timestamp: Date.now()
            });
            
            // Emit performance entry event
            this.emit('performanceEntry', performanceEntry);
            
        } catch (error) {
            logger.error('Error handling performance entry', {
                error: error.message,
                entryName: entry.name,
                entryType: entry.entryType
            });
        }
    }
    
    /**
     * Collects real-time metrics for continuous monitoring
     * @private
     */
    collectRealTimeMetrics() {
        try {
            const throughputMetrics = calculateThroughput(this.config.intervals.realTimeMs);
            
            // Store throughput metrics
            this.metricsHistory.set(`throughput_${Date.now()}`, {
                type: PERFORMANCE_METRICS_TYPES.THROUGHPUT,
                data: throughputMetrics,
                timestamp: Date.now()
            });
            
            // Emit real-time throughput data
            this.emit('realTimeMetrics', {
                type: PERFORMANCE_METRICS_TYPES.THROUGHPUT,
                data: throughputMetrics
            });
            
        } catch (error) {
            logger.error('Error collecting real-time metrics', {
                error: error.message
            });
        }
    }
    
    /**
     * Collects and stores system metrics
     * @private
     */
    collectAndStoreSystemMetrics() {
        try {
            const systemMetrics = collectSystemMetrics(false);
            
            // Store in system metrics history
            this.systemMetricsHistory.push(systemMetrics);
            
            // Maintain history size within retention limits
            if (this.systemMetricsHistory.length > this.retentionPolicy.realTimePoints) {
                this.systemMetricsHistory = this.systemMetricsHistory.slice(-this.retentionPolicy.realTimePoints);
            }
            
            // Emit system metrics event
            this.emit('systemMetrics', systemMetrics);
            
        } catch (error) {
            logger.error('Error collecting system metrics', {
                error: error.message
            });
        }
    }
    
    /**
     * Calculates and stores throughput metrics
     * @private
     */
    calculateAndStoreThroughputMetrics() {
        try {
            const throughputMetrics = calculateThroughput(this.config.intervals.aggregationMs);
            
            // Store throughput metrics in metrics history
            this.metricsHistory.set(`throughput_agg_${Date.now()}`, {
                type: PERFORMANCE_METRICS_TYPES.THROUGHPUT,
                data: throughputMetrics,
                timestamp: Date.now()
            });
            
            // Emit aggregated throughput metrics
            this.emit('throughputMetrics', throughputMetrics);
            
        } catch (error) {
            logger.error('Error calculating throughput metrics', {
                error: error.message
            });
        }
    }
    
    /**
     * Performs periodic threshold checking
     * @private
     */
    performThresholdChecking() {
        try {
            const currentSnapshot = this.getPerformanceSnapshot({
                includeThresholdStatus: true
            });
            
            if (currentSnapshot.thresholds && currentSnapshot.thresholds.summary.violationCount > 0) {
                this.emit('thresholdViolations', {
                    violations: currentSnapshot.thresholds.violations,
                    alerts: currentSnapshot.thresholds.alerts,
                    summary: currentSnapshot.thresholds.summary,
                    timestamp: Date.now()
                });
                
                logger.warn('Performance threshold violations detected', {
                    violationCount: currentSnapshot.thresholds.summary.violationCount,
                    criticalViolations: currentSnapshot.thresholds.summary.criticalViolations
                });
            }
            
        } catch (error) {
            logger.error('Error performing threshold checking', {
                error: error.message
            });
        }
    }
    
    /**
     * Updates performance baselines with new measurements
     * @private
     */
    updatePerformanceBaselines(requestData) {
        try {
            this.baselines.sampleCount++;
            
            // Update response time baseline
            this.baselines.averageResponseTime = 
                (this.baselines.averageResponseTime * (this.baselines.sampleCount - 1) + requestData.responseTimeMs) / 
                this.baselines.sampleCount;
            
            // Update other baselines periodically
            if (this.baselines.sampleCount % 10 === 0) {
                const currentMetrics = collectSystemMetrics(false);
                if (currentMetrics.memory && currentMetrics.cpu) {
                    this.baselines.averageMemoryUsage = 
                        (this.baselines.averageMemoryUsage * 0.9) + (currentMetrics.memory.systemUsagePercent * 0.1);
                    this.baselines.averageCpuUsage = 
                        (this.baselines.averageCpuUsage * 0.9) + (currentMetrics.cpu.usagePercent * 0.1);
                }
            }
            
        } catch (error) {
            logger.error('Error updating performance baselines', {
                error: error.message
            });
        }
    }
    
    /**
     * Calculates overall performance score
     * @private
     */
    calculatePerformanceScore(metrics) {
        try {
            let score = 100;
            
            // Response time impact (30% weight)
            if (metrics.responseTime > this.thresholds.responseTimeMs) {
                score -= Math.min(30, (metrics.responseTime / this.thresholds.responseTimeMs - 1) * 30);
            }
            
            // Memory usage impact (25% weight)
            if (metrics.memoryUsage > this.thresholds.memoryUsagePercent) {
                score -= Math.min(25, (metrics.memoryUsage / this.thresholds.memoryUsagePercent - 1) * 25);
            }
            
            // CPU usage impact (25% weight)
            if (metrics.cpuUsage > this.thresholds.cpuUsagePercent) {
                score -= Math.min(25, (metrics.cpuUsage / this.thresholds.cpuUsagePercent - 1) * 25);
            }
            
            // Error rate impact (15% weight)
            if (metrics.errorRate > this.thresholds.errorRatePercent) {
                score -= Math.min(15, (metrics.errorRate / this.thresholds.errorRatePercent - 1) * 15);
            }
            
            // Event loop lag impact (5% weight)
            if (metrics.eventLoopLag > this.thresholds.eventLoopLagMs) {
                score -= Math.min(5, (metrics.eventLoopLag / this.thresholds.eventLoopLagMs - 1) * 5);
            }
            
            return Math.max(0, Math.round(score));
            
        } catch (error) {
            logger.error('Error calculating performance score', {
                error: error.message,
                metrics
            });
            return 0;
        }
    }
    
    /**
     * Validates threshold configuration
     * @private
     */
    validateThresholds(thresholds) {
        const errors = [];
        const validatedThresholds = {};
        
        try {
            // Validate response time threshold
            if (thresholds.responseTimeMs !== undefined) {
                if (typeof thresholds.responseTimeMs !== 'number' || thresholds.responseTimeMs <= 0) {
                    errors.push('responseTimeMs must be a positive number');
                } else {
                    validatedThresholds.responseTimeMs = thresholds.responseTimeMs;
                }
            }
            
            // Validate memory usage threshold
            if (thresholds.memoryUsagePercent !== undefined) {
                if (typeof thresholds.memoryUsagePercent !== 'number' || 
                    thresholds.memoryUsagePercent <= 0 || 
                    thresholds.memoryUsagePercent > 100) {
                    errors.push('memoryUsagePercent must be a number between 0 and 100');
                } else {
                    validatedThresholds.memoryUsagePercent = thresholds.memoryUsagePercent;
                }
            }
            
            // Validate CPU usage threshold
            if (thresholds.cpuUsagePercent !== undefined) {
                if (typeof thresholds.cpuUsagePercent !== 'number' || 
                    thresholds.cpuUsagePercent <= 0 || 
                    thresholds.cpuUsagePercent > 100) {
                    errors.push('cpuUsagePercent must be a number between 0 and 100');
                } else {
                    validatedThresholds.cpuUsagePercent = thresholds.cpuUsagePercent;
                }
            }
            
            // Validate event loop lag threshold
            if (thresholds.eventLoopLagMs !== undefined) {
                if (typeof thresholds.eventLoopLagMs !== 'number' || thresholds.eventLoopLagMs <= 0) {
                    errors.push('eventLoopLagMs must be a positive number');
                } else {
                    validatedThresholds.eventLoopLagMs = thresholds.eventLoopLagMs;
                }
            }
            
            // Validate error rate threshold
            if (thresholds.errorRatePercent !== undefined) {
                if (typeof thresholds.errorRatePercent !== 'number' || 
                    thresholds.errorRatePercent < 0 || 
                    thresholds.errorRatePercent > 100) {
                    errors.push('errorRatePercent must be a number between 0 and 100');
                } else {
                    validatedThresholds.errorRatePercent = thresholds.errorRatePercent;
                }
            }
            
            return {
                isValid: errors.length === 0,
                thresholds: validatedThresholds,
                errors
            };
            
        } catch (error) {
            return {
                isValid: false,
                thresholds: {},
                errors: [`Validation error: ${error.message}`]
            };
        }
    }
    
    /**
     * Gets current monitoring status
     * @private
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            startedAt: this.startedAt,
            uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
            isObserving: this.isObserving,
            activeIntervals: Object.keys(this.intervals).filter(key => this.intervals[key] !== null),
            requestHistorySize: this.requestHistory.length,
            systemMetricsHistorySize: this.systemMetricsHistory.length,
            metricsMapSize: this.metricsHistory.size
        };
    }
    
    /**
     * Converts data to CSV format
     * @private
     */
    convertToCSV(data) {
        // Simplified CSV conversion for demonstration
        let csv = 'timestamp,metric_type,value\n';
        
        if (data.data.requestHistory) {
            data.data.requestHistory.forEach(request => {
                csv += `${request.timestamp},response_time,${request.responseTimeMs}\n`;
            });
        }
        
        if (data.data.systemMetrics) {
            data.data.systemMetrics.forEach(metric => {
                csv += `${metric.timestamp},memory_usage,${metric.memoryUsagePercent}\n`;
                csv += `${metric.timestamp},cpu_usage,${metric.cpuUsagePercent}\n`;
            });
        }
        
        return csv;
    }
    
    /**
     * Converts data to XML format
     * @private
     */
    convertToXML(data) {
        // Simplified XML conversion for demonstration
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<performance_data>\n';
        xml += `  <export_id>${data.exportId}</export_id>\n`;
        xml += `  <timestamp>${data.timestamp}</timestamp>\n`;
        
        if (data.data.requestHistory) {
            xml += '  <request_history>\n';
            data.data.requestHistory.forEach(request => {
                xml += '    <request>\n';
                xml += `      <timestamp>${request.timestamp}</timestamp>\n`;
                xml += `      <response_time>${request.responseTimeMs}</response_time>\n`;
                xml += `      <status_code>${request.statusCode}</status_code>\n`;
                xml += '    </request>\n';
            });
            xml += '  </request_history>\n';
        }
        
        xml += '</performance_data>';
        return xml;
    }
    
    /**
     * Calculates data integrity hash
     * @private
     */
    calculateDataIntegrity(data) {
        try {
            // Simple integrity hash for demonstration
            const dataString = JSON.stringify(data);
            let hash = 0;
            for (let i = 0; i < dataString.length; i++) {
                const char = dataString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return hash.toString(16);
        } catch (error) {
            logger.error('Error calculating data integrity hash', {
                error: error.message
            });
            return 'error';
        }
    }
}

// Create default performance monitor instance configured with server settings for immediate use
const performanceMonitor = new PerformanceMonitor({
    thresholds: {
        ...PERFORMANCE_THRESHOLDS,
        ...(serverConfig.performance?.thresholds || {})
    },
    intervals: {
        ...DEFAULT_MONITORING_INTERVALS,
        ...(serverConfig.performance?.monitoring || {})
    },
    enableRealTimeCollection: true,
    enableTrendAnalysis: true,
    enableThresholdAlerting: true,
    enableOptimization: true
});

// Export all performance monitoring components and utilities
module.exports = {
    // Main performance monitoring class for comprehensive tracking
    PerformanceMonitor,
    
    // Standalone utility functions for specific performance measurements
    measureResponseTime,
    collectSystemMetrics,
    calculateThroughput,
    analyzePerformanceTrends,
    checkPerformanceThresholds,
    generatePerformanceReport,
    optimizePerformanceCollection,
    
    // Performance metrics type constants for structured classification
    PERFORMANCE_METRICS_TYPES,
    
    // Default performance monitor instance for immediate use
    performanceMonitor
};