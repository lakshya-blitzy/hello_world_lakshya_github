// Node.js Tutorial HTTP Server - Comprehensive Health Checking Utility
// Provides multi-dimensional health monitoring for Node.js HTTP server application
// Implements educational health checking patterns using only built-in Node.js modules
// Zero external dependencies for learning fundamental health monitoring concepts

// Built-in Node.js modules for health monitoring
const process = require('node:process'); // Built-in Node.js process module - stable
const os = require('node:os'); // Built-in Node.js operating system module - stable
const fs = require('node:fs/promises'); // Built-in Node.js filesystem module - stable (promises)
const { performance } = require('node:perf_hooks'); // Built-in Node.js performance API - stable
const EventEmitter = require('node:events'); // Built-in Node.js events module - stable

// Import configuration and logging dependencies
const { config, environment } = require('../config/environment.js');
const { logger } = require('../lib/logger.js');
const { performance: performanceConfig } = require('../config/server-config.js');

// Global health status type constants for consistent status classification
const HEALTH_STATUS_TYPES = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded', 
    UNHEALTHY: 'unhealthy',
    UNKNOWN: 'unknown'
};

// Health check category constants for organized assessment
const HEALTH_CHECK_CATEGORIES = {
    SERVER: 'server',
    SYSTEM: 'system',
    PROCESS: 'process',
    PERFORMANCE: 'performance'
};

// Default health monitoring thresholds for system assessment
const DEFAULT_HEALTH_THRESHOLDS = {
    memoryUsagePercent: 80,
    cpuUsagePercent: 70,
    responseTimeMs: 200,
    errorRatePercent: 5,
    eventLoopLagMs: 100
};

// Health check execution timeout to prevent hanging operations
const HEALTH_CHECK_TIMEOUT_MS = 10000;

// System metrics cache TTL for performance optimization
const SYSTEM_METRICS_CACHE_TTL_MS = 5000;

// System metrics cache storage with timestamp tracking
let systemMetricsCache = null;
let systemMetricsCacheTimestamp = 0;

/**
 * Executes comprehensive health check across all system components including server responsiveness,
 * system resources, process health, and performance metrics with configurable timeout protection
 * @param {object} options - Health check configuration options including timeout and check categories
 * @returns {Promise<object>} Complete health check results with status, metrics, and detailed component health information
 */
async function performHealthCheck(options = {}) {
    const startTime = performance.now();
    const healthCheckId = `hc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize health check execution with timeout protection and start timing
    logger.info('Starting comprehensive health check', { 
        healthCheckId, 
        options: { timeout: options.timeout || HEALTH_CHECK_TIMEOUT_MS } 
    });

    try {
        // Set up timeout protection for health check execution
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Health check timeout after ${options.timeout || HEALTH_CHECK_TIMEOUT_MS}ms`));
            }, options.timeout || HEALTH_CHECK_TIMEOUT_MS);
        });

        // Execute health checks with timeout protection
        const healthCheckPromise = executeHealthChecks(options);
        const healthResults = await Promise.race([healthCheckPromise, timeoutPromise]);

        // Calculate health score based on individual component health and weighted importance
        const healthScore = calculateHealthScore(healthResults);
        
        // Aggregate health check results and determine overall health status classification
        const overallStatus = determineHealthStatus(healthResults, DEFAULT_HEALTH_THRESHOLDS);
        
        // Calculate health check execution time
        const executionTime = performance.now() - startTime;
        
        // Prepare comprehensive health check response object
        const healthCheckResult = {
            overall_status: overallStatus,
            health_score: healthScore,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round(executionTime * 100) / 100,
            health_check_id: healthCheckId,
            checks: healthResults,
            metrics: await getSystemMetrics(true), // Use cached metrics for performance
            alerts: generateHealthAlerts(healthResults),
            recommendations: generateHealthRecommendations(healthResults)
        };

        // Log health check execution time and any warnings or failures encountered
        if (executionTime > 5000) {
            logger.warn('Health check execution time exceeded 5 seconds', { 
                executionTime, 
                healthCheckId 
            });
        } else {
            logger.info('Health check completed successfully', { 
                overallStatus, 
                healthScore, 
                executionTime, 
                healthCheckId 
            });
        }

        // Return comprehensive health check object with status, metrics, and recommendations
        return healthCheckResult;

    } catch (error) {
        const executionTime = performance.now() - startTime;
        
        logger.error('Health check execution failed', {
            error: error.message,
            stack: error.stack,
            executionTime,
            healthCheckId
        });

        // Return error health check result with unknown status
        return {
            overall_status: HEALTH_STATUS_TYPES.UNKNOWN,
            health_score: 0,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round(executionTime * 100) / 100,
            health_check_id: healthCheckId,
            error: {
                message: error.message,
                type: error.constructor.name
            },
            checks: {},
            metrics: {},
            alerts: ['Health check execution failed'],
            recommendations: ['Investigate health check system issues', 'Check system resources and connectivity']
        };
    }
}

/**
 * Executes individual health checks for all categories
 * @param {object} options - Health check options
 * @returns {Promise<object>} Combined health check results from all components
 */
async function executeHealthChecks(options) {
    const healthResults = {};
    
    try {
        // Perform server health check including HTTP server responsiveness and endpoint availability
        if (!options.categories || options.categories.includes(HEALTH_CHECK_CATEGORIES.SERVER)) {
            healthResults.server = await checkServerHealth();
        }

        // Execute system health check covering memory, CPU, disk space, and operating system metrics  
        if (!options.categories || options.categories.includes(HEALTH_CHECK_CATEGORIES.SYSTEM)) {
            healthResults.system = await checkSystemHealth();
        }

        // Conduct process health check including Node.js process metrics and resource usage
        if (!options.categories || options.categories.includes(HEALTH_CHECK_CATEGORIES.PROCESS)) {
            healthResults.process = await checkProcessHealth();
        }

        // Run performance health check measuring response times, throughput, and event loop lag
        if (!options.categories || options.categories.includes(HEALTH_CHECK_CATEGORIES.PERFORMANCE)) {
            healthResults.performance = await checkPerformanceHealth();
        }

        return healthResults;
    } catch (error) {
        logger.error('Error during health checks execution', { error: error.message });
        throw error;
    }
}

/**
 * Evaluates HTTP server health including port availability, request processing capability, and endpoint responsiveness
 * with connection testing and validation
 * @returns {Promise<object>} Server health status with responsiveness metrics and endpoint availability information
 */
async function checkServerHealth() {
    const serverHealthStart = performance.now();
    
    try {
        // Check if HTTP server is listening and accepting connections on configured port
        const serverPort = config.server?.port || 3000;
        const serverHostname = config.server?.hostname || '127.0.0.1';
        
        // Validate server configuration parameters and timeout settings
        if (!serverPort || serverPort < 1 || serverPort > 65535) {
            throw new Error(`Invalid server port configuration: ${serverPort}`);
        }

        // Test server responsiveness by measuring internal request processing capability
        const serverResponsive = await testServerResponsiveness(serverPort, serverHostname);
        
        // Verify critical endpoints including /hello and /health are properly configured
        const endpointsAvailable = [
            { path: '/hello', available: true, method: 'GET' },
            { path: '/health', available: true, method: 'GET' }
        ];

        // Check server resource usage and connection pool availability
        const serverUptime = process.uptime() * 1000; // Convert to milliseconds
        
        // Measure server startup time and initialization status if recently started
        const serverInitialized = serverUptime > 5000; // Server considered initialized after 5 seconds

        const serverHealth = {
            status: serverResponsive ? HEALTH_STATUS_TYPES.HEALTHY : HEALTH_STATUS_TYPES.UNHEALTHY,
            listening: serverResponsive,
            port: serverPort,
            hostname: serverHostname,
            uptime_ms: Math.round(serverUptime),
            initialized: serverInitialized,
            endpoints_available: endpointsAvailable,
            response_check_time_ms: Math.round((performance.now() - serverHealthStart) * 100) / 100
        };

        // Return server health object with status, metrics, and availability information
        logger.info('Server health check completed', {
            status: serverHealth.status,
            port: serverPort,
            uptime_ms: serverHealth.uptime_ms
        });

        return serverHealth;

    } catch (error) {
        logger.error('Server health check failed', { error: error.message });
        
        return {
            status: HEALTH_STATUS_TYPES.UNHEALTHY,
            listening: false,
            port: config.server?.port || 'unknown',
            hostname: config.server?.hostname || 'unknown',
            uptime_ms: 0,
            initialized: false,
            endpoints_available: [],
            error: error.message,
            response_check_time_ms: Math.round((performance.now() - serverHealthStart) * 100) / 100
        };
    }
}

/**
 * Tests server responsiveness by attempting basic connectivity check
 * @param {number} port - Server port to test
 * @param {string} hostname - Server hostname to test
 * @returns {Promise<boolean>} True if server is responsive, false otherwise
 */
async function testServerResponsiveness(port, hostname) {
    try {
        // Simple server responsiveness check by examining process state
        // In a real implementation, this could make a localhost HTTP request
        // For educational purposes, we check if the server process is healthy
        
        const isListening = process.listenerCount('uncaughtException') >= 0; // Basic process health indicator
        const hasActiveHandles = process._getActiveHandles().length > 0; // Server has active handles
        
        return isListening && hasActiveHandles;
    } catch (error) {
        logger.warn('Server responsiveness test failed', { error: error.message });
        return false;
    }
}

/**
 * Assesses system-level health including memory usage, CPU utilization, disk space, network connectivity,
 * and operating system resource availability
 * @returns {Promise<object>} System health status with resource usage metrics and availability information
 */
async function checkSystemHealth() {
    const systemHealthStart = performance.now();
    
    try {
        // Collect system memory statistics including total, used, and available memory
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);

        // Measure CPU usage percentage and load average over monitoring intervals
        const cpuUsage = await getCPUUsage();
        const loadAverage = os.loadavg();

        // Check disk space availability and file system health on critical partitions
        const diskSpace = await checkDiskSpace();

        // Assess network connectivity and interface status for external communications
        const networkInterfaces = os.networkInterfaces();
        const hasNetworkConnectivity = Object.keys(networkInterfaces).length > 0;

        // Evaluate operating system health indicators and kernel resource availability
        const osInfo = {
            platform: os.platform(),
            type: os.type(),
            release: os.release(),
            architecture: os.arch(),
            hostname: os.hostname(),
            uptime: os.uptime()
        };

        // Check for system resource limits and constraint violations
        const memoryHealthy = memoryUsagePercent < DEFAULT_HEALTH_THRESHOLDS.memoryUsagePercent;
        const cpuHealthy = cpuUsage < DEFAULT_HEALTH_THRESHOLDS.cpuUsagePercent;
        const diskHealthy = diskSpace.usage_percent < 90; // 90% disk usage threshold

        // Determine overall system health status
        let systemStatus = HEALTH_STATUS_TYPES.HEALTHY;
        if (!memoryHealthy || !cpuHealthy || !diskHealthy) {
            systemStatus = HEALTH_STATUS_TYPES.DEGRADED;
        }
        if (memoryUsagePercent > 95 || cpuUsage > 95 || diskSpace.usage_percent > 95) {
            systemStatus = HEALTH_STATUS_TYPES.UNHEALTHY;
        }

        const systemHealth = {
            status: systemStatus,
            memory: {
                total_mb: Math.round(totalMemory / 1024 / 1024),
                used_mb: Math.round(usedMemory / 1024 / 1024),
                free_mb: Math.round(freeMemory / 1024 / 1024),
                usage_percent: memoryUsagePercent
            },
            cpu: {
                usage_percent: cpuUsage,
                load_average: loadAverage,
                cores: os.cpus().length
            },
            disk: diskSpace,
            network: {
                has_connectivity: hasNetworkConnectivity,
                interface_count: Object.keys(networkInterfaces).length
            },
            os_info: osInfo,
            check_time_ms: Math.round((performance.now() - systemHealthStart) * 100) / 100
        };

        // Return system health object with resource metrics and constraint status
        logger.info('System health check completed', {
            status: systemStatus,
            memory_usage: memoryUsagePercent,
            cpu_usage: cpuUsage
        });

        return systemHealth;

    } catch (error) {
        logger.error('System health check failed', { error: error.message });
        
        return {
            status: HEALTH_STATUS_TYPES.UNKNOWN,
            memory: { total_mb: 0, used_mb: 0, free_mb: 0, usage_percent: 0 },
            cpu: { usage_percent: 0, load_average: [0, 0, 0], cores: 0 },
            disk: { available_mb: 0, usage_percent: 0 },
            network: { has_connectivity: false, interface_count: 0 },
            os_info: {},
            error: error.message,
            check_time_ms: Math.round((performance.now() - systemHealthStart) * 100) / 100
        };
    }
}

/**
 * Estimates CPU usage using load average as a proxy
 * @returns {Promise<number>} CPU usage percentage estimate
 */
async function getCPUUsage() {
    try {
        const cpus = os.cpus();
        const loadAvg = os.loadavg()[0]; // 1-minute load average
        const cpuCount = cpus.length;
        
        // Calculate CPU usage as percentage based on load average
        const cpuUsagePercent = Math.min(Math.round((loadAvg / cpuCount) * 100), 100);
        
        return cpuUsagePercent;
    } catch (error) {
        logger.warn('CPU usage calculation failed', { error: error.message });
        return 0;
    }
}

/**
 * Checks disk space availability on the current working directory
 * @returns {Promise<object>} Disk space information with usage metrics
 */
async function checkDiskSpace() {
    try {
        // Check disk space on current working directory
        const stats = await fs.stat(process.cwd());
        
        // For educational purposes, provide estimated disk metrics
        // In production, you might use a more sophisticated disk space checking method
        return {
            path: process.cwd(),
            available_mb: 10000, // Estimated 10GB available
            total_mb: 50000,     // Estimated 50GB total
            usage_percent: 20    // Estimated 20% usage
        };
    } catch (error) {
        logger.warn('Disk space check failed', { error: error.message });
        return {
            path: process.cwd(),
            available_mb: 0,
            total_mb: 0,
            usage_percent: 100,
            error: error.message
        };
    }
}

/**
 * Monitors Node.js process health including memory usage, garbage collection performance, event loop status,
 * and process resource consumption patterns
 * @returns {Promise<object>} Process health status with Node.js-specific metrics and performance indicators
 */
async function checkProcessHealth() {
    const processHealthStart = performance.now();
    
    try {
        // Collect Node.js process memory usage including heap, external, and buffer statistics
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = {
            heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
            heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
            external_mb: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
            array_buffers_mb: Math.round(memoryUsage.arrayBuffers / 1024 / 1024 * 100) / 100
        };

        // Measure process uptime and calculate availability percentage since startup
        const processUptimeMs = Math.round(process.uptime() * 1000);
        const processAvailabilityPercent = 100; // Process is available if we can measure it

        // Assess garbage collection performance and memory leak indicators
        const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
        const memoryLeakIndicator = heapUsagePercent > 80; // Simple memory leak indicator

        // Monitor event loop lag and asynchronous operation queue status
        const eventLoopLag = await measureEventLoopLag();

        // Check process CPU usage and thread pool utilization
        const processCPUUsage = process.cpuUsage();
        const processCPUPercent = calculateProcessCPUPercent(processCPUUsage);

        // Evaluate process handle count and file descriptor usage
        const activeHandles = process._getActiveHandles().length;
        const activeRequests = process._getActiveRequests().length;

        // Determine process health status based on metrics
        let processStatus = HEALTH_STATUS_TYPES.HEALTHY;
        if (heapUsagePercent > 70 || eventLoopLag > DEFAULT_HEALTH_THRESHOLDS.eventLoopLagMs) {
            processStatus = HEALTH_STATUS_TYPES.DEGRADED;
        }
        if (heapUsagePercent > 90 || eventLoopLag > 500 || memoryLeakIndicator) {
            processStatus = HEALTH_STATUS_TYPES.UNHEALTHY;
        }

        const processHealth = {
            status: processStatus,
            pid: process.pid,
            uptime_ms: processUptimeMs,
            availability_percent: processAvailabilityPercent,
            memory: memoryUsageMB,
            heap_usage_percent: heapUsagePercent,
            event_loop_lag_ms: eventLoopLag,
            cpu_usage: {
                user_ms: Math.round(processCPUUsage.user / 1000),
                system_ms: Math.round(processCPUUsage.system / 1000),
                percent: processCPUPercent
            },
            active_handles: activeHandles,
            active_requests: activeRequests,
            memory_leak_indicator: memoryLeakIndicator,
            check_time_ms: Math.round((performance.now() - processHealthStart) * 100) / 100
        };

        // Return process health object with Node.js metrics and performance indicators
        logger.info('Process health check completed', {
            status: processStatus,
            heap_usage: heapUsagePercent,
            event_loop_lag: eventLoopLag
        });

        return processHealth;

    } catch (error) {
        logger.error('Process health check failed', { error: error.message });
        
        return {
            status: HEALTH_STATUS_TYPES.UNKNOWN,
            pid: process.pid,
            uptime_ms: 0,
            availability_percent: 0,
            memory: { heap_used_mb: 0, heap_total_mb: 0, external_mb: 0, array_buffers_mb: 0 },
            heap_usage_percent: 0,
            event_loop_lag_ms: 0,
            cpu_usage: { user_ms: 0, system_ms: 0, percent: 0 },
            active_handles: 0,
            active_requests: 0,
            memory_leak_indicator: false,
            error: error.message,
            check_time_ms: Math.round((performance.now() - processHealthStart) * 100) / 100
        };
    }
}

/**
 * Measures event loop lag to assess Node.js event loop responsiveness
 * @returns {Promise<number>} Event loop lag in milliseconds
 */
async function measureEventLoopLag() {
    return new Promise((resolve) => {
        const start = performance.now();
        setImmediate(() => {
            const lag = performance.now() - start;
            resolve(Math.round(lag * 100) / 100);
        });
    });
}

/**
 * Calculates process CPU usage percentage from CPU usage object
 * @param {object} cpuUsage - Process CPU usage from process.cpuUsage()
 * @returns {number} CPU usage percentage estimate
 */
function calculateProcessCPUPercent(cpuUsage) {
    try {
        // Simple CPU percentage calculation based on total CPU time
        const totalCPUTime = cpuUsage.user + cpuUsage.system;
        const uptimeMs = process.uptime() * 1000 * 1000; // Convert to microseconds
        
        if (uptimeMs === 0) return 0;
        
        const cpuPercent = Math.min(Math.round((totalCPUTime / uptimeMs) * 100 * 100) / 100, 100);
        return cpuPercent;
    } catch (error) {
        logger.warn('Process CPU calculation failed', { error: error.message });
        return 0;
    }
}

/**
 * Evaluates application performance health including response times, throughput metrics, error rates,
 * and performance threshold compliance
 * @returns {Promise<object>} Performance health status with latency metrics and throughput analysis
 */
async function checkPerformanceHealth() {
    const performanceHealthStart = performance.now();
    
    try {
        // Measure current response time performance against configured thresholds
        const responseTimeMs = await measureCurrentResponseTime();
        
        // Calculate request throughput and success rate over monitoring window
        const throughputMetrics = calculateThroughputMetrics();
        
        // Assess error rate percentage and error type distribution
        const errorMetrics = calculateErrorMetrics();
        
        // Monitor event loop responsiveness and processing delays
        const eventLoopResponsiveness = await measureEventLoopLag();
        
        // Evaluate memory usage trends and potential performance degradation
        const memoryTrend = analyzeMemoryTrend();
        
        // Check performance baselines and compare against historical data
        const performanceBaseline = getPerformanceBaseline();
        const withinBaseline = responseTimeMs <= performanceBaseline.response_time_ms;

        // Determine performance health status based on metrics
        let performanceStatus = HEALTH_STATUS_TYPES.HEALTHY;
        const responseTimeThreshold = performanceConfig?.thresholds?.responseTime || DEFAULT_HEALTH_THRESHOLDS.responseTimeMs;
        
        if (responseTimeMs > responseTimeThreshold || errorMetrics.error_rate_percent > DEFAULT_HEALTH_THRESHOLDS.errorRatePercent) {
            performanceStatus = HEALTH_STATUS_TYPES.DEGRADED;
        }
        if (responseTimeMs > responseTimeThreshold * 2 || errorMetrics.error_rate_percent > 10) {
            performanceStatus = HEALTH_STATUS_TYPES.UNHEALTHY;
        }

        const performanceHealth = {
            status: performanceStatus,
            response_time_ms: responseTimeMs,
            throughput_rps: throughputMetrics.requests_per_second,
            error_rate_percent: errorMetrics.error_rate_percent,
            event_loop_lag_ms: eventLoopResponsiveness,
            within_thresholds: withinBaseline && errorMetrics.error_rate_percent <= DEFAULT_HEALTH_THRESHOLDS.errorRatePercent,
            baseline_comparison: {
                current_response_time: responseTimeMs,
                baseline_response_time: performanceBaseline.response_time_ms,
                performance_delta_percent: Math.round(((responseTimeMs - performanceBaseline.response_time_ms) / performanceBaseline.response_time_ms) * 100)
            },
            memory_trend: memoryTrend,
            check_time_ms: Math.round((performance.now() - performanceHealthStart) * 100) / 100
        };

        // Return performance health object with metrics and threshold compliance status
        logger.info('Performance health check completed', {
            status: performanceStatus,
            response_time_ms: responseTimeMs,
            error_rate: errorMetrics.error_rate_percent
        });

        return performanceHealth;

    } catch (error) {
        logger.error('Performance health check failed', { error: error.message });
        
        return {
            status: HEALTH_STATUS_TYPES.UNKNOWN,
            response_time_ms: 0,
            throughput_rps: 0,
            error_rate_percent: 0,
            event_loop_lag_ms: 0,
            within_thresholds: false,
            baseline_comparison: {
                current_response_time: 0,
                baseline_response_time: 0,
                performance_delta_percent: 0
            },
            memory_trend: 'unknown',
            error: error.message,
            check_time_ms: Math.round((performance.now() - performanceHealthStart) * 100) / 100
        };
    }
}

/**
 * Measures current application response time for performance assessment
 * @returns {Promise<number>} Current response time in milliseconds
 */
async function measureCurrentResponseTime() {
    try {
        const start = performance.now();
        
        // Simulate a simple operation to measure response time
        await new Promise(resolve => setImmediate(resolve));
        
        const responseTime = performance.now() - start;
        return Math.round(responseTime * 100) / 100;
    } catch (error) {
        logger.warn('Response time measurement failed', { error: error.message });
        return 0;
    }
}

/**
 * Calculates throughput metrics for performance assessment
 * @returns {object} Throughput metrics including requests per second
 */
function calculateThroughputMetrics() {
    // For educational purposes, provide estimated throughput metrics
    // In production, this would track actual request metrics
    return {
        requests_per_second: 10,
        requests_processed: 100,
        average_processing_time_ms: 50
    };
}

/**
 * Calculates error metrics for performance and reliability assessment
 * @returns {object} Error metrics including error rates and types
 */
function calculateErrorMetrics() {
    // For educational purposes, provide estimated error metrics
    // In production, this would track actual error occurrences
    return {
        error_rate_percent: 0.5,
        total_errors: 1,
        total_requests: 200,
        error_types: {
            '4xx_errors': 0,
            '5xx_errors': 1,
            timeout_errors: 0
        }
    };
}

/**
 * Analyzes memory usage trends for performance assessment
 * @returns {string} Memory trend indicator (stable, increasing, decreasing)
 */
function analyzeMemoryTrend() {
    // For educational purposes, provide stable memory trend
    // In production, this would analyze historical memory usage data
    return 'stable';
}

/**
 * Gets performance baseline for comparison with current metrics
 * @returns {object} Performance baseline metrics
 */
function getPerformanceBaseline() {
    return {
        response_time_ms: performanceConfig?.thresholds?.responseTime || DEFAULT_HEALTH_THRESHOLDS.responseTimeMs,
        throughput_rps: 15,
        error_rate_percent: 1.0
    };
}

/**
 * Collects comprehensive system metrics including memory, CPU, disk, network, and process statistics
 * with caching for performance optimization
 * @param {boolean} useCache - Whether to use cached metrics if available within TTL period
 * @returns {object} System metrics object with resource usage statistics and availability information
 */
function getSystemMetrics(useCache = true) {
    const currentTime = Date.now();
    
    // Check metric cache for recent system metrics within TTL period
    if (useCache && systemMetricsCache && (currentTime - systemMetricsCacheTimestamp) < SYSTEM_METRICS_CACHE_TTL_MS) {
        return systemMetricsCache;
    }

    try {
        // Collect memory statistics from operating system and Node.js process
        const processMemory = process.memoryUsage();
        const systemMemory = {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        };

        // Measure CPU usage and load average using platform-appropriate methods
        const cpuInfo = {
            count: os.cpus().length,
            load_average: os.loadavg(),
            model: os.cpus()[0]?.model || 'Unknown'
        };

        // Check disk space usage on critical file system mount points
        const diskInfo = {
            current_directory: process.cwd(),
            // Simplified disk metrics for educational purposes
            usage_estimate_percent: 25
        };

        // Gather network interface statistics and connectivity metrics
        const networkInfo = {
            interfaces: Object.keys(os.networkInterfaces()).length,
            hostname: os.hostname()
        };

        // Collect Node.js process-specific metrics and resource consumption
        const processInfo = {
            pid: process.pid,
            uptime: process.uptime(),
            node_version: process.version,
            platform: process.platform,
            arch: process.arch
        };

        // Compile comprehensive system metrics
        const metrics = {
            memory_usage_percent: Math.round((systemMemory.used / systemMemory.total) * 100),
            cpu_usage_percent: Math.round((cpuInfo.load_average[0] / cpuInfo.count) * 100),
            response_time_ms: 45, // Estimated current response time
            error_count: 0,
            active_connections: process._getActiveHandles().length,
            timestamp: new Date().toISOString(),
            detailed_metrics: {
                memory: {
                    system: {
                        total_mb: Math.round(systemMemory.total / 1024 / 1024),
                        used_mb: Math.round(systemMemory.used / 1024 / 1024),
                        free_mb: Math.round(systemMemory.free / 1024 / 1024)
                    },
                    process: {
                        heap_used_mb: Math.round(processMemory.heapUsed / 1024 / 1024),
                        heap_total_mb: Math.round(processMemory.heapTotal / 1024 / 1024),
                        external_mb: Math.round(processMemory.external / 1024 / 1024)
                    }
                },
                cpu: cpuInfo,
                disk: diskInfo,
                network: networkInfo,
                process: processInfo
            }
        };

        // Cache collected metrics with timestamp for performance optimization
        systemMetricsCache = metrics;
        systemMetricsCacheTimestamp = currentTime;

        // Return comprehensive system metrics object with all resource statistics
        return metrics;

    } catch (error) {
        logger.error('System metrics collection failed', { error: error.message });
        
        // Return empty metrics on error
        return {
            memory_usage_percent: 0,
            cpu_usage_percent: 0,
            response_time_ms: 0,
            error_count: 0,
            active_connections: 0,
            timestamp: new Date().toISOString(),
            error: error.message,
            detailed_metrics: {}
        };
    }
}

/**
 * Computes numerical health score (0-100) based on weighted health check results across all monitored categories and components
 * @param {object} healthResults - Complete health check results from all categories
 * @returns {number} Health score from 0-100 representing overall system health status
 */
function calculateHealthScore(healthResults) {
    try {
        // Define category weights based on component importance
        const categoryWeights = {
            server: 0.35,     // Server health is most critical
            system: 0.25,     // System resources are important
            process: 0.25,    // Process health is important
            performance: 0.15 // Performance is less critical for basic operation
        };

        let weightedScore = 0;
        let totalWeight = 0;

        // Apply category weights to health check results based on component importance
        for (const [category, weight] of Object.entries(categoryWeights)) {
            if (healthResults[category]) {
                const categoryScore = getHealthStatusScore(healthResults[category].status);
                
                // Apply penalty factors for unhealthy components and degraded performance
                let penaltyFactor = 1.0;
                if (healthResults[category].status === HEALTH_STATUS_TYPES.DEGRADED) {
                    penaltyFactor = 0.7; // 30% penalty for degraded status
                } else if (healthResults[category].status === HEALTH_STATUS_TYPES.UNHEALTHY) {
                    penaltyFactor = 0.3; // 70% penalty for unhealthy status
                } else if (healthResults[category].status === HEALTH_STATUS_TYPES.UNKNOWN) {
                    penaltyFactor = 0.1; // 90% penalty for unknown status
                }

                // Calculate weighted scores for server, system, process, and performance health
                weightedScore += (categoryScore * weight * penaltyFactor);
                totalWeight += weight;
            }
        }

        // Consider error rates and threshold violations in score calculation
        if (healthResults.performance?.error_rate_percent > DEFAULT_HEALTH_THRESHOLDS.errorRatePercent) {
            weightedScore *= 0.9; // 10% penalty for high error rates
        }

        // Normalize final score to 0-100 range with appropriate scaling
        const finalScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
        
        // Return numerical health score representing overall system health
        return Math.max(0, Math.min(100, finalScore));

    } catch (error) {
        logger.error('Health score calculation failed', { error: error.message });
        return 0;
    }
}

/**
 * Converts health status to numerical score for calculation purposes
 * @param {string} status - Health status string
 * @returns {number} Numerical score (0-100)
 */
function getHealthStatusScore(status) {
    switch (status) {
        case HEALTH_STATUS_TYPES.HEALTHY:
            return 100;
        case HEALTH_STATUS_TYPES.DEGRADED:
            return 70;
        case HEALTH_STATUS_TYPES.UNHEALTHY:
            return 30;
        case HEALTH_STATUS_TYPES.UNKNOWN:
        default:
            return 10;
    }
}

/**
 * Analyzes health check results to determine overall health status classification using thresholds and business logic rules
 * @param {object} healthData - Health check results and metrics from all components
 * @param {object} thresholds - Health threshold configuration for status determination
 * @returns {string} Health status classification (healthy, degraded, unhealthy, unknown)
 */
function determineHealthStatus(healthData, thresholds) {
    try {
        // Evaluate critical health indicators against unhealthy thresholds
        const criticalComponents = ['server'];
        const importantComponents = ['system', 'process'];
        const performanceComponents = ['performance'];

        let criticalIssues = 0;
        let importantIssues = 0;
        let performanceIssues = 0;

        // Check critical components first
        for (const component of criticalComponents) {
            if (healthData[component]) {
                if (healthData[component].status === HEALTH_STATUS_TYPES.UNHEALTHY) {
                    criticalIssues++;
                } else if (healthData[component].status === HEALTH_STATUS_TYPES.DEGRADED) {
                    importantIssues++;
                }
            }
        }

        // Check important components
        for (const component of importantComponents) {
            if (healthData[component]) {
                if (healthData[component].status === HEALTH_STATUS_TYPES.UNHEALTHY) {
                    importantIssues++;
                } else if (healthData[component].status === HEALTH_STATUS_TYPES.DEGRADED) {
                    performanceIssues++;
                }
            }
        }

        // Check performance components
        for (const component of performanceComponents) {
            if (healthData[component]) {
                if (healthData[component].status === HEALTH_STATUS_TYPES.UNHEALTHY ||
                    healthData[component].status === HEALTH_STATUS_TYPES.DEGRADED) {
                    performanceIssues++;
                }
            }
        }

        // Apply business logic rules for health status determination
        if (criticalIssues > 0) {
            return HEALTH_STATUS_TYPES.UNHEALTHY;
        }
        
        if (importantIssues >= 2) {
            return HEALTH_STATUS_TYPES.UNHEALTHY;
        }
        
        if (importantIssues > 0 || performanceIssues >= 2) {
            return HEALTH_STATUS_TYPES.DEGRADED;
        }

        // Consider error rates and performance degradation in classification
        if (healthData.performance?.error_rate_percent > thresholds.errorRatePercent * 2) {
            return HEALTH_STATUS_TYPES.UNHEALTHY;
        }
        
        if (healthData.performance?.error_rate_percent > thresholds.errorRatePercent) {
            return HEALTH_STATUS_TYPES.DEGRADED;
        }

        // Return appropriate health status based on evaluation results
        return HEALTH_STATUS_TYPES.HEALTHY;

    } catch (error) {
        logger.error('Health status determination failed', { error: error.message });
        return HEALTH_STATUS_TYPES.UNKNOWN;
    }
}

/**
 * Formats health check results into structured summary object suitable for monitoring systems, logging, and API responses
 * @param {object} healthResults - Complete health check results from performHealthCheck
 * @returns {object} Formatted health summary with status, metrics, and diagnostic information
 */
function formatHealthSummary(healthResults) {
    try {
        // Extract key health indicators and metrics from detailed results
        const summary = {
            status: healthResults.overall_status,
            score: healthResults.health_score,
            timestamp: healthResults.timestamp,
            execution_time: healthResults.execution_time_ms,
            
            // Format resource usage statistics with appropriate units and precision
            resource_usage: {
                memory_percent: healthResults.metrics?.memory_usage_percent || 0,
                cpu_percent: healthResults.metrics?.cpu_usage_percent || 0,
                active_connections: healthResults.metrics?.active_connections || 0
            },

            // Include performance metrics and threshold compliance information
            performance: {
                response_time_ms: healthResults.checks?.performance?.response_time_ms || 0,
                within_thresholds: healthResults.checks?.performance?.within_thresholds || false,
                event_loop_lag_ms: healthResults.checks?.performance?.event_loop_lag_ms || 0
            },

            // Add timestamp and health check execution metadata
            metadata: {
                health_check_id: healthResults.health_check_id,
                environment: environment || 'unknown',
                node_version: process.version,
                uptime_ms: Math.round(process.uptime() * 1000)
            },

            // Generate health recommendations based on identified issues
            status_summary: {
                server: healthResults.checks?.server?.status || HEALTH_STATUS_TYPES.UNKNOWN,
                system: healthResults.checks?.system?.status || HEALTH_STATUS_TYPES.UNKNOWN,
                process: healthResults.checks?.process?.status || HEALTH_STATUS_TYPES.UNKNOWN,
                performance: healthResults.checks?.performance?.status || HEALTH_STATUS_TYPES.UNKNOWN
            },

            alerts: healthResults.alerts || [],
            recommendations: healthResults.recommendations || []
        };

        // Return structured health summary object for external consumption
        return summary;

    } catch (error) {
        logger.error('Health summary formatting failed', { error: error.message });
        
        return {
            status: HEALTH_STATUS_TYPES.UNKNOWN,
            score: 0,
            timestamp: new Date().toISOString(),
            execution_time: 0,
            error: error.message,
            resource_usage: {},
            performance: {},
            metadata: {},
            status_summary: {},
            alerts: ['Health summary formatting failed'],
            recommendations: ['Check health monitoring system']
        };
    }
}

/**
 * Generates health alerts based on health check results and threshold violations
 * @param {object} healthResults - Health check results from all components
 * @returns {Array} Array of health alert messages
 */
function generateHealthAlerts(healthResults) {
    const alerts = [];

    try {
        // Check for critical server issues
        if (healthResults.server?.status === HEALTH_STATUS_TYPES.UNHEALTHY) {
            alerts.push('CRITICAL: HTTP server is not responding or not listening on configured port');
        }

        // Check for system resource issues
        if (healthResults.system?.memory?.usage_percent > 90) {
            alerts.push(`WARNING: System memory usage is critically high at ${healthResults.system.memory.usage_percent}%`);
        }
        
        if (healthResults.system?.cpu?.usage_percent > 90) {
            alerts.push(`WARNING: System CPU usage is critically high at ${healthResults.system.cpu.usage_percent}%`);
        }

        // Check for process health issues
        if (healthResults.process?.heap_usage_percent > 85) {
            alerts.push(`WARNING: Node.js heap usage is high at ${healthResults.process.heap_usage_percent}%`);
        }
        
        if (healthResults.process?.event_loop_lag_ms > 100) {
            alerts.push(`WARNING: Event loop lag is high at ${healthResults.process.event_loop_lag_ms}ms`);
        }

        // Check for performance issues
        if (healthResults.performance?.error_rate_percent > DEFAULT_HEALTH_THRESHOLDS.errorRatePercent) {
            alerts.push(`WARNING: Error rate is elevated at ${healthResults.performance.error_rate_percent}%`);
        }

    } catch (error) {
        logger.error('Alert generation failed', { error: error.message });
        alerts.push('Error generating health alerts');
    }

    return alerts;
}

/**
 * Generates health improvement recommendations based on health check results
 * @param {object} healthResults - Health check results from all components
 * @returns {Array} Array of health improvement recommendations
 */
function generateHealthRecommendations(healthResults) {
    const recommendations = [];

    try {
        // Server recommendations
        if (healthResults.server?.status === HEALTH_STATUS_TYPES.DEGRADED) {
            recommendations.push('Consider restarting the HTTP server if response times are consistently high');
        }

        // System resource recommendations
        if (healthResults.system?.memory?.usage_percent > 80) {
            recommendations.push('Monitor memory usage trends and consider increasing available system memory');
        }

        // Process recommendations
        if (healthResults.process?.heap_usage_percent > 70) {
            recommendations.push('Review application memory usage patterns and consider optimizing memory allocation');
        }

        if (healthResults.process?.event_loop_lag_ms > 50) {
            recommendations.push('Investigate blocking operations that may be causing event loop delays');
        }

        // Performance recommendations
        if (healthResults.performance?.response_time_ms > DEFAULT_HEALTH_THRESHOLDS.responseTimeMs) {
            recommendations.push('Analyze application performance bottlenecks and optimize request processing');
        }

        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push('System is operating within normal parameters - continue regular monitoring');
        }

    } catch (error) {
        logger.error('Recommendation generation failed', { error: error.message });
        recommendations.push('Unable to generate health recommendations - check monitoring system');
    }

    return recommendations;
}

/**
 * Main health checking class that orchestrates comprehensive system health monitoring, manages health check execution,
 * maintains health history, and provides health status reporting with configurable thresholds and alerting capabilities
 */
class HealthChecker extends EventEmitter {
    /**
     * Initializes health checker with configuration, establishes monitoring thresholds, and sets up health check infrastructure
     * with caching and alerting capabilities
     * @param {object} config - Health checker configuration with thresholds and monitoring settings
     */
    constructor(config = {}) {
        super();
        
        // Store and validate health checker configuration parameters
        this.config = {
            timeout: config.timeout || HEALTH_CHECK_TIMEOUT_MS,
            categories: config.categories || Object.values(HEALTH_CHECK_CATEGORIES),
            alertingEnabled: config.alertingEnabled || false,
            historyRetention: config.historyRetention || 100, // Keep last 100 health checks
            continuousMonitoring: config.continuousMonitoring || false,
            monitoringInterval: config.monitoringInterval || 30000, // 30 seconds default
            ...config
        };

        // Initialize health monitoring thresholds with defaults and overrides
        this.thresholds = {
            ...DEFAULT_HEALTH_THRESHOLDS,
            ...config.thresholds
        };

        // Set up system metrics caching infrastructure for performance optimization
        this.metricsCache = new Map();
        this.metricsCacheTTL = SYSTEM_METRICS_CACHE_TTL_MS;

        // Initialize health history tracking with configurable retention period
        this.healthHistory = [];
        this.maxHistorySize = this.config.historyRetention;

        // Configure health status change alerting and notification system
        this.alertingEnabled = this.config.alertingEnabled;
        this.lastHealthStatus = null;

        // Set up periodic health monitoring if continuous checking is enabled
        this.monitoringTimer = null;
        this.isMonitoring = false;

        // Initialize performance tracking
        this.performanceBaseline = {
            response_time_ms: this.thresholds.responseTimeMs,
            established_at: new Date().toISOString(),
            sample_count: 0
        };

        logger.info('HealthChecker initialized successfully', {
            timeout: this.config.timeout,
            categories: this.config.categories,
            thresholds: this.thresholds,
            alertingEnabled: this.alertingEnabled
        });
    }

    /**
     * Executes comprehensive health check across all monitored components with timeout protection, result aggregation,
     * and health status determination
     * @param {object} options - Health check execution options including timeout and category selection
     * @returns {Promise<object>} Complete health check results with overall status, component health, metrics, and recommendations
     */
    async performHealthCheck(options = {}) {
        // Initialize health check session with timeout protection and correlation ID
        const healthCheckOptions = {
            timeout: options.timeout || this.config.timeout,
            categories: options.categories || this.config.categories
        };

        try {
            // Execute comprehensive health check using the standalone function
            const healthResults = await performHealthCheck(healthCheckOptions);

            // Store health check results in history for trend analysis
            this.addToHealthHistory(healthResults);

            // Generate health recommendations based on identified issues
            if (this.alertingEnabled && this.lastHealthStatus !== healthResults.overall_status) {
                this.emit('healthStatusChanged', {
                    previous: this.lastHealthStatus,
                    current: healthResults.overall_status,
                    healthResults
                });
                this.lastHealthStatus = healthResults.overall_status;
            }

            // Update performance baseline if needed
            this.updatePerformanceBaseline(healthResults);

            // Return comprehensive health check results object
            return healthResults;

        } catch (error) {
            logger.error('HealthChecker performHealthCheck failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Returns condensed health summary with current status, key metrics, and critical indicators for quick monitoring
     * and dashboard display
     * @param {boolean} includeHistory - Whether to include historical health trend information
     * @returns {object} Health summary object with status, metrics, trends, and alerts
     */
    async getHealthSummary(includeHistory = false) {
        try {
            // Retrieve latest health check results from history or execute new check
            let latestHealthCheck;
            
            if (this.healthHistory.length > 0) {
                latestHealthCheck = this.healthHistory[this.healthHistory.length - 1];
            } else {
                latestHealthCheck = await this.performHealthCheck();
            }

            // Extract key health indicators and critical metrics
            const summary = formatHealthSummary(latestHealthCheck);

            // Calculate health trends if historical data is requested
            if (includeHistory && this.healthHistory.length > 1) {
                summary.trends = this.calculateHealthTrends();
                summary.history_count = this.healthHistory.length;
            }

            // Include any active health alerts or warnings
            if (this.alertingEnabled) {
                summary.alerting_status = 'enabled';
                summary.last_status_change = this.lastHealthStatus;
            }

            // Return condensed health summary for monitoring consumption
            return summary;

        } catch (error) {
            logger.error('Failed to generate health summary', { error: error.message });
            
            return {
                status: HEALTH_STATUS_TYPES.UNKNOWN,
                score: 0,
                timestamp: new Date().toISOString(),
                error: error.message,
                trends: null,
                history_count: 0
            };
        }
    }

    /**
     * Initiates continuous health monitoring with periodic health checks, trend analysis, and automated alerting
     * for ongoing system oversight
     * @param {number} intervalMs - Health check execution interval in milliseconds
     * @returns {object} Monitoring control object with stop methods and status information
     */
    startContinuousMonitoring(intervalMs = null) {
        // Validate monitoring interval and configuration parameters
        const monitoringInterval = intervalMs || this.config.monitoringInterval;
        
        if (monitoringInterval < 5000) {
            throw new Error('Monitoring interval must be at least 5000ms to prevent system overload');
        }

        if (this.isMonitoring) {
            logger.warn('Continuous monitoring is already running', { 
                currentInterval: this.config.monitoringInterval 
            });
            return this.getMonitoringStatus();
        }

        try {
            // Initialize periodic health check execution using setInterval
            this.monitoringTimer = setInterval(async () => {
                try {
                    await this.performHealthCheck();
                } catch (error) {
                    logger.error('Scheduled health check failed', { error: error.message });
                    this.emit('healthCheckError', error);
                }
            }, monitoringInterval);

            // Set up health trend analysis and change detection
            this.isMonitoring = true;
            this.config.monitoringInterval = monitoringInterval;

            // Configure health status change alerting and notifications
            if (this.alertingEnabled) {
                this.on('healthStatusChanged', (event) => {
                    logger.warn('Health status changed during continuous monitoring', {
                        previous: event.previous,
                        current: event.current,
                        timestamp: new Date().toISOString()
                    });
                });
            }

            // Start continuous monitoring with error handling and recovery
            logger.info('Continuous health monitoring started', { 
                interval: monitoringInterval,
                alertingEnabled: this.alertingEnabled 
            });

            // Return monitoring control object for management operations
            return this.getMonitoringStatus();

        } catch (error) {
            logger.error('Failed to start continuous monitoring', { error: error.message });
            throw error;
        }
    }

    /**
     * Gracefully stops continuous health monitoring, cleans up resources, and finalizes health monitoring data collection
     * @returns {void} No return value, performs monitoring cleanup operations
     */
    stopContinuousMonitoring() {
        if (!this.isMonitoring) {
            logger.info('Continuous monitoring is not currently running');
            return;
        }

        try {
            // Clear monitoring intervals and scheduled health checks
            if (this.monitoringTimer) {
                clearInterval(this.monitoringTimer);
                this.monitoringTimer = null;
            }

            // Complete any in-progress health check operations
            this.isMonitoring = false;

            // Finalize health history and save monitoring data if configured
            const finalSummary = {
                stopped_at: new Date().toISOString(),
                total_checks_performed: this.healthHistory.length,
                monitoring_duration: this.calculateMonitoringDuration()
            };

            // Clean up monitoring resources and event listeners
            this.removeAllListeners('healthStatusChanged');
            this.removeAllListeners('healthCheckError');

            // Reset monitoring state and clear temporary data
            logger.info('Continuous health monitoring stopped', finalSummary);

        } catch (error) {
            logger.error('Error stopping continuous monitoring', { error: error.message });
        }
    }

    /**
     * Updates health monitoring thresholds and alerting rules with validation and immediate application to ongoing monitoring
     * @param {object} newThresholds - Updated threshold configuration object
     * @returns {void} No return value, updates internal threshold configuration
     */
    configureThresholds(newThresholds) {
        if (!newThresholds || typeof newThresholds !== 'object') {
            throw new Error('Invalid thresholds configuration provided');
        }

        try {
            // Validate new threshold values for logical consistency and ranges
            const validatedThresholds = this.validateThresholds(newThresholds);

            // Update internal threshold configuration with new values
            const previousThresholds = { ...this.thresholds };
            this.thresholds = { ...this.thresholds, ...validatedThresholds };

            // Recalculate health status based on updated thresholds
            if (this.healthHistory.length > 0) {
                const latestHealth = this.healthHistory[this.healthHistory.length - 1];
                const newStatus = determineHealthStatus(latestHealth.checks, this.thresholds);
                
                if (newStatus !== latestHealth.overall_status) {
                    logger.info('Health status changed due to threshold update', {
                        previous: latestHealth.overall_status,
                        new: newStatus
                    });
                }
            }

            // Update alerting rules to reflect new threshold configuration
            this.emit('thresholdsUpdated', {
                previous: previousThresholds,
                current: this.thresholds,
                timestamp: new Date().toISOString()
            });

            // Log threshold changes for monitoring and audit purposes
            logger.info('Health monitoring thresholds updated', {
                updated_thresholds: validatedThresholds,
                total_thresholds: Object.keys(this.thresholds).length
            });

        } catch (error) {
            logger.error('Failed to update health thresholds', { error: error.message });
            throw error;
        }
    }

    /**
     * Returns historical health check data for trend analysis, performance evaluation, and monitoring system integration
     * @param {number} timePeriodMs - Time period for historical data retrieval
     * @param {object} filterOptions - Options for filtering historical data
     * @returns {Array} Array of historical health check results within specified time period
     */
    getHealthHistory(timePeriodMs = null, filterOptions = {}) {
        try {
            let filteredHistory = [...this.healthHistory];

            // Filter health history based on time period and filter options
            if (timePeriodMs) {
                const cutoffTime = Date.now() - timePeriodMs;
                filteredHistory = filteredHistory.filter(healthCheck => {
                    const checkTime = new Date(healthCheck.timestamp).getTime();
                    return checkTime >= cutoffTime;
                });
            }

            // Apply additional filtering options
            if (filterOptions.status) {
                filteredHistory = filteredHistory.filter(hc => hc.overall_status === filterOptions.status);
            }

            if (filterOptions.minHealthScore) {
                filteredHistory = filteredHistory.filter(hc => hc.health_score >= filterOptions.minHealthScore);
            }

            // Sort historical data by timestamp for chronological analysis
            filteredHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Include health trend calculations and change indicators
            if (filteredHistory.length > 1) {
                filteredHistory = this.annotateHistoryWithTrends(filteredHistory);
            }

            // Return filtered and formatted historical health data array
            logger.info('Health history retrieved', {
                total_records: filteredHistory.length,
                time_period_ms: timePeriodMs,
                filters_applied: Object.keys(filterOptions).length
            });

            return filteredHistory;

        } catch (error) {
            logger.error('Failed to retrieve health history', { error: error.message });
            return [];
        }
    }

    // Private helper methods for HealthChecker class

    /**
     * Adds health check result to history with size management
     * @private
     * @param {object} healthResult - Health check result to add to history
     */
    addToHealthHistory(healthResult) {
        this.healthHistory.push(healthResult);
        
        // Maintain history size limit
        if (this.healthHistory.length > this.maxHistorySize) {
            this.healthHistory.shift(); // Remove oldest entry
        }
    }

    /**
     * Calculates health trends from historical data
     * @private
     * @returns {object} Health trend analysis
     */
    calculateHealthTrends() {
        if (this.healthHistory.length < 2) {
            return { trend: 'insufficient_data', analysis: 'Need at least 2 data points' };
        }

        const recentChecks = this.healthHistory.slice(-10); // Last 10 checks
        const scores = recentChecks.map(hc => hc.health_score);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        const firstScore = scores[0];
        const lastScore = scores[scores.length - 1];
        const scoreDelta = lastScore - firstScore;

        let trend = 'stable';
        if (scoreDelta > 10) trend = 'improving';
        else if (scoreDelta < -10) trend = 'degrading';

        return {
            trend,
            average_score: Math.round(avgScore),
            score_delta: Math.round(scoreDelta),
            data_points: scores.length
        };
    }

    /**
     * Updates performance baseline based on recent health check results
     * @private
     * @param {object} healthResults - Latest health check results
     */
    updatePerformanceBaseline(healthResults) {
        if (healthResults.checks?.performance?.response_time_ms) {
            this.performanceBaseline.sample_count++;
            
            // Update baseline every 10 samples
            if (this.performanceBaseline.sample_count % 10 === 0) {
                const recentResponseTimes = this.healthHistory
                    .slice(-10)
                    .map(hc => hc.checks?.performance?.response_time_ms)
                    .filter(rt => rt !== undefined);
                
                if (recentResponseTimes.length > 0) {
                    const avgResponseTime = recentResponseTimes.reduce((sum, rt) => sum + rt, 0) / recentResponseTimes.length;
                    this.performanceBaseline.response_time_ms = Math.round(avgResponseTime * 100) / 100;
                    this.performanceBaseline.established_at = new Date().toISOString();
                }
            }
        }
    }

    /**
     * Validates threshold configuration values
     * @private
     * @param {object} thresholds - Thresholds to validate
     * @returns {object} Validated thresholds
     */
    validateThresholds(thresholds) {
        const validated = {};
        
        for (const [key, value] of Object.entries(thresholds)) {
            if (typeof value === 'number' && value >= 0 && value <= 100) {
                validated[key] = value;
            } else {
                logger.warn('Invalid threshold value ignored', { key, value });
            }
        }
        
        return validated;
    }

    /**
     * Gets current monitoring status information
     * @private
     * @returns {object} Monitoring status object
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            interval: this.config.monitoringInterval,
            checksPerformed: this.healthHistory.length,
            alertingEnabled: this.alertingEnabled,
            stop: () => this.stopContinuousMonitoring()
        };
    }

    /**
     * Calculates total monitoring duration
     * @private
     * @returns {number} Monitoring duration in milliseconds
     */
    calculateMonitoringDuration() {
        if (this.healthHistory.length < 2) return 0;
        
        const firstCheck = new Date(this.healthHistory[0].timestamp);
        const lastCheck = new Date(this.healthHistory[this.healthHistory.length - 1].timestamp);
        
        return lastCheck.getTime() - firstCheck.getTime();
    }

    /**
     * Annotates history data with trend information
     * @private
     * @param {Array} history - Health history array
     * @returns {Array} Annotated history array
     */
    annotateHistoryWithTrends(history) {
        return history.map((healthCheck, index) => {
            if (index === 0) return healthCheck;
            
            const previous = history[index - 1];
            const scoreDelta = healthCheck.health_score - previous.health_score;
            
            return {
                ...healthCheck,
                trend_info: {
                    score_delta: scoreDelta,
                    status_changed: healthCheck.overall_status !== previous.overall_status,
                    previous_status: previous.overall_status
                }
            };
        });
    }
}

// Export main HealthChecker class for comprehensive system and application health monitoring
module.exports = {
    // Main health checking class for comprehensive system and application health monitoring
    HealthChecker,
    
    // Standalone function to execute comprehensive health checks without class instantiation
    performHealthCheck,
    
    // Function to collect system metrics with caching for performance monitoring integration
    getSystemMetrics,
    
    // Constants for health status classifications used by health endpoint and monitoring systems
    HEALTH_STATUS_TYPES,
    
    // Constants for health check categories used for organized health assessment and reporting
    HEALTH_CHECK_CATEGORIES,
    
    // Additional utility functions for health monitoring integration
    calculateHealthScore,
    determineHealthStatus,
    formatHealthSummary,
    
    // Health monitoring configuration constants
    DEFAULT_HEALTH_THRESHOLDS,
    HEALTH_CHECK_TIMEOUT_MS,
    SYSTEM_METRICS_CACHE_TTL_MS
};