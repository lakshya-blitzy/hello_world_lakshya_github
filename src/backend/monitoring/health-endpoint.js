// Node.js Built-in Modules (Zero External Dependencies)
import { performance } from 'node:perf_hooks'; // v18.0+ - High-resolution performance timing for health endpoint response measurement
import process from 'node:process'; // v18.0+ - Access Node.js process metrics for health endpoint system information

// Internal Application Components
import { HealthChecker, HEALTH_STATUS_TYPES } from '../utils/health-checker.js';
import { ResponseGenerator } from '../lib/response-generator.js';
import { logger } from '../lib/logger.js';
import { MetricsCollector } from './metrics-collector.js';
import { config } from '../config/environment.js';

// ============================================================================
// GLOBAL CONSTANTS AND CONFIGURATION
// ============================================================================

/**
 * Health endpoint path constant for consistent routing
 * Used by HTTP server routing and health check monitoring systems
 */
const HEALTH_ENDPOINT_PATH = '/health';

/**
 * Health check execution timeout in milliseconds
 * Prevents health check operations from hanging indefinitely
 */
const HEALTH_CHECK_TIMEOUT_MS = 10000;

/**
 * Health response cache Time-To-Live in milliseconds
 * Optimizes performance by caching health responses for brief periods
 */
const HEALTH_RESPONSE_CACHE_TTL_MS = 5000;

/**
 * HTTP status codes used in health endpoint responses
 * Following standard HTTP conventions for health check endpoints
 */
const HTTP_STATUS_CODES = {
    OK: 200,                    // Healthy system status
    SERVICE_UNAVAILABLE: 503,   // Degraded or unhealthy system status
    INTERNAL_SERVER_ERROR: 500  // Health check execution errors
};

// ============================================================================
// HEALTH ENDPOINT RESPONSE CACHING
// ============================================================================

/**
 * Simple in-memory cache for health responses
 * Reduces load on health checking systems by caching recent results
 */
let healthResponseCache = {
    data: null,
    timestamp: null,
    isValid() {
        if (!this.data || !this.timestamp) return false;
        return (Date.now() - this.timestamp) < HEALTH_RESPONSE_CACHE_TTL_MS;
    },
    set(data) {
        this.data = data;
        this.timestamp = Date.now();
    },
    clear() {
        this.data = null;
        this.timestamp = null;
    }
};

// ============================================================================
// HEALTH REQUEST VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates incoming HTTP request to health endpoint ensuring proper method, headers,
 * and request format compliance with health endpoint standards and security requirements
 * 
 * @param {Object} req - HTTP IncomingMessage object to validate
 * @returns {boolean} True if request is valid, false otherwise with appropriate logging
 */
function validateHealthRequest(req) {
    try {
        // Validate HTTP method - health endpoints should only accept GET requests
        if (req.method !== 'GET') {
            logger.warn('Health endpoint received invalid HTTP method', {
                method: req.method,
                expectedMethod: 'GET',
                path: req.url,
                clientIP: req.socket?.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });
            return false;
        }

        // Validate request path exactly matches health endpoint path
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (url.pathname !== HEALTH_ENDPOINT_PATH) {
            logger.warn('Health endpoint received request for incorrect path', {
                requestedPath: url.pathname,
                expectedPath: HEALTH_ENDPOINT_PATH,
                method: req.method,
                clientIP: req.socket?.remoteAddress || 'unknown'
            });
            return false;
        }

        // Validate that request has no unexpected query parameters
        // Health endpoints should be simple and not require query parameters
        if (url.search && url.search.length > 1) {
            logger.warn('Health endpoint received unexpected query parameters', {
                queryString: url.search,
                path: req.url,
                method: req.method,
                clientIP: req.socket?.remoteAddress || 'unknown'
            });
            // Allow request to proceed but log warning for monitoring
        }

        // Validate request headers for acceptable content types (if any)
        const acceptHeader = req.headers.accept;
        if (acceptHeader && !acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
            logger.info('Health endpoint received request with non-JSON accept header', {
                acceptHeader: acceptHeader,
                method: req.method,
                path: req.url,
                clientIP: req.socket?.remoteAddress || 'unknown'
            });
            // Allow request to proceed as this is informational only
        }

        return true;

    } catch (error) {
        logger.error('Error validating health endpoint request', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            clientIP: req.socket?.remoteAddress || 'unknown'
        });
        return false;
    }
}

// ============================================================================
// HTTP STATUS CODE DETERMINATION
// ============================================================================

/**
 * Determines appropriate HTTP status code for health endpoint response based on
 * health check results and component status using standard health endpoint conventions
 * 
 * @param {Object} healthResults - Health check results with overall status and component health
 * @returns {number} HTTP status code (200 for healthy, 503 for unhealthy, 500 for errors)
 */
function determineHttpStatusCode(healthResults) {
    try {
        // Handle null or undefined health results as server error
        if (!healthResults) {
            logger.error('Health status determination received null health results');
            return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        }

        // Extract overall health status from results
        const overallStatus = healthResults.status || healthResults.overallStatus;
        
        if (!overallStatus) {
            logger.error('Health results missing overall status field', {
                healthResults: JSON.stringify(healthResults, null, 2)
            });
            return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        }

        // Determine HTTP status code based on health status
        switch (overallStatus.toLowerCase()) {
            case HEALTH_STATUS_TYPES.HEALTHY.toLowerCase():
                // All systems operational - return 200 OK
                return HTTP_STATUS_CODES.OK;

            case HEALTH_STATUS_TYPES.DEGRADED.toLowerCase():
            case HEALTH_STATUS_TYPES.UNHEALTHY.toLowerCase():
                // System experiencing issues - return 503 Service Unavailable
                // This allows load balancers to remove instance from rotation
                return HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;

            default:
                // Unknown status - treat as server error
                logger.error('Unknown health status encountered', {
                    status: overallStatus,
                    validStatuses: Object.values(HEALTH_STATUS_TYPES)
                });
                return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        }

    } catch (error) {
        logger.error('Error determining HTTP status code for health response', {
            error: error.message,
            stack: error.stack,
            healthResults: JSON.stringify(healthResults, null, 2)
        });
        return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    }
}

// ============================================================================
// HEALTH RESPONSE FORMATTING
// ============================================================================

/**
 * Formats comprehensive health check results into structured JSON response object
 * suitable for monitoring systems, load balancers, and operational dashboards
 * with standardized health data schema and complete system information
 * 
 * @param {Object} healthResults - Complete health check results from HealthChecker
 * @param {Object} metricsSnapshot - Current metrics data from MetricsCollector  
 * @param {number} executionTimeMs - Health check execution duration in milliseconds
 * @returns {Object} Formatted health response object with status, metrics, and metadata
 */
function formatHealthResponse(healthResults, metricsSnapshot, executionTimeMs) {
    try {
        // Generate unique correlation ID for request tracking
        const correlationId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Current timestamp in ISO 8601 format for precise timing
        const timestamp = new Date().toISOString();
        
        // Extract server information from configuration
        const serverInfo = {
            status: healthResults?.server?.status || HEALTH_STATUS_TYPES.HEALTHY,
            uptime_ms: process.uptime() * 1000, // Convert seconds to milliseconds
            port: config?.server?.port || process.env.PORT || 3000,
            environment: config?.environment || process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };

        // Extract system health information with comprehensive resource monitoring
        const systemInfo = {
            status: healthResults?.system?.status || HEALTH_STATUS_TYPES.HEALTHY,
            memory: {
                usage_percent: healthResults?.system?.memory?.usagePercent || 0,
                used_mb: Math.round((process.memoryUsage().rss || 0) / 1024 / 1024),
                total_mb: Math.round((process.memoryUsage().heapTotal || 0) / 1024 / 1024),
                heap_used_mb: Math.round((process.memoryUsage().heapUsed || 0) / 1024 / 1024),
                external_mb: Math.round((process.memoryUsage().external || 0) / 1024 / 1024)
            },
            cpu: {
                usage_percent: healthResults?.system?.cpu?.usagePercent || 0,
                load_average: healthResults?.system?.cpu?.loadAverage || [0, 0, 0]
            },
            disk: {
                usage_percent: healthResults?.system?.disk?.usagePercent || 0,
                available_mb: healthResults?.system?.disk?.availableMB || 0
            }
        };

        // Extract process health information with Node.js specific metrics
        const processInfo = {
            status: healthResults?.process?.status || HEALTH_STATUS_TYPES.HEALTHY,
            pid: process.pid,
            uptime_ms: Math.round(process.uptime() * 1000),
            memory: {
                heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                external_mb: Math.round(process.memoryUsage().external / 1024 / 1024),
                rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
            },
            event_loop_lag_ms: healthResults?.process?.eventLoopLag || 0,
            gc_stats: healthResults?.process?.gcStats || null
        };

        // Extract performance health information
        const performanceInfo = {
            status: healthResults?.performance?.status || HEALTH_STATUS_TYPES.HEALTHY,
            response_time_ms: metricsSnapshot?.performance?.avgResponseTime || 0,
            throughput_rps: metricsSnapshot?.performance?.requestsPerSecond || 0,
            error_rate_percent: metricsSnapshot?.performance?.errorRate || 0,
            concurrent_requests: metricsSnapshot?.performance?.concurrentRequests || 0
        };

        // Extract comprehensive metrics information
        const metricsInfo = {
            total_requests: metricsSnapshot?.totals?.requests || 0,
            success_rate_percent: metricsSnapshot?.totals?.successRate || 100,
            active_connections: metricsSnapshot?.server?.activeConnections || 0,
            avg_response_time_ms: metricsSnapshot?.performance?.avgResponseTime || 0,
            memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
            cpu_usage_percent: metricsSnapshot?.system?.cpuUsage || 0,
            uptime_seconds: Math.round(process.uptime())
        };

        // Extract alerts and recommendations from health results
        const alerts = healthResults?.alerts || [];
        const recommendations = healthResults?.recommendations || [];

        // Calculate overall health score (0-100) based on component health
        let healthScore = 100;
        if (healthResults?.status === HEALTH_STATUS_TYPES.DEGRADED) {
            healthScore = 75;
        } else if (healthResults?.status === HEALTH_STATUS_TYPES.UNHEALTHY) {
            healthScore = 25;
        }

        // Construct comprehensive health response object
        const healthResponse = {
            // Overall health status and scoring
            status: healthResults?.status || HEALTH_STATUS_TYPES.HEALTHY,
            score: healthResults?.score || healthScore,
            timestamp: timestamp,
            execution_time_ms: Math.round(executionTimeMs),
            correlation_id: correlationId,

            // Server component health and configuration
            server: serverInfo,

            // System resource health and utilization
            system: systemInfo,

            // Node.js process health and metrics  
            process: processInfo,

            // Application performance health indicators
            performance: performanceInfo,

            // Comprehensive application metrics
            metrics: metricsInfo,

            // Active health alerts and warnings
            alerts: alerts,

            // System health improvement recommendations
            recommendations: recommendations,

            // Metadata for monitoring system integration
            metadata: {
                endpoint_version: '1.0.0',
                schema_version: '2024-01',
                cache_hit: healthResponseCache.isValid(),
                health_check_timeout_ms: HEALTH_CHECK_TIMEOUT_MS,
                response_cache_ttl_ms: HEALTH_RESPONSE_CACHE_TTL_MS
            }
        };

        return healthResponse;

    } catch (error) {
        logger.error('Error formatting health response', {
            error: error.message,
            stack: error.stack,
            executionTimeMs: executionTimeMs,
            healthResults: healthResults ? Object.keys(healthResults) : null,
            metricsSnapshot: metricsSnapshot ? Object.keys(metricsSnapshot) : null
        });

        // Return minimal fallback response for formatting errors
        return {
            status: HEALTH_STATUS_TYPES.UNHEALTHY,
            score: 0,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round(executionTimeMs),
            error: 'Health response formatting failed',
            metadata: {
                endpoint_version: '1.0.0',
                schema_version: '2024-01',
                error_occurred: true
            }
        };
    }
}

// ============================================================================
// HEALTH REQUEST LOGGING
// ============================================================================

/**
 * Logs health endpoint request with correlation tracking, client information,
 * and performance metrics for comprehensive monitoring and debugging purposes
 * 
 * @param {Object} req - HTTP request object with client and request details
 * @param {string} correlationId - Unique identifier for request correlation and tracing
 * @param {number} responseTime - Request processing duration in milliseconds
 * @param {string} healthStatus - Health check result status for operational visibility
 */
function logHealthRequest(req, correlationId, responseTime, healthStatus) {
    try {
        // Extract client information for monitoring and security purposes
        const clientIP = req.socket?.remoteAddress || 
                        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                        req.connection?.remoteAddress || 
                        'unknown';
        
        const userAgent = req.headers['user-agent'] || 'unknown';
        const acceptHeader = req.headers.accept || 'not-specified';
        const hostHeader = req.headers.host || 'not-specified';

        // Extract request timing information
        const requestTimestamp = new Date().toISOString();
        const method = req.method || 'unknown';
        const url = req.url || 'unknown';

        // Log successful health endpoint access with comprehensive context
        logger.info('Health endpoint request processed', {
            // Request correlation and identification
            correlationId: correlationId,
            requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: requestTimestamp,

            // HTTP request details
            method: method,
            url: url,
            path: HEALTH_ENDPOINT_PATH,

            // Client information for monitoring
            clientIP: clientIP,
            userAgent: userAgent,
            acceptHeader: acceptHeader,
            hostHeader: hostHeader,

            // Performance and health metrics
            responseTime: Math.round(responseTime),
            healthStatus: healthStatus,
            statusCategory: healthStatus === HEALTH_STATUS_TYPES.HEALTHY ? 'healthy' : 
                          healthStatus === HEALTH_STATUS_TYPES.DEGRADED ? 'degraded' : 'unhealthy',

            // Operational metrics
            serverUptime: Math.round(process.uptime()),
            memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024),
            nodeVersion: process.version,
            environment: config?.environment || 'unknown',

            // Request classification
            requestType: 'health-check',
            endpoint: 'health',
            component: 'health-endpoint'
        });

        // Update health endpoint usage statistics
        if (global.healthEndpointStats) {
            global.healthEndpointStats.totalRequests = (global.healthEndpointStats.totalRequests || 0) + 1;
            global.healthEndpointStats.lastRequestTime = Date.now();
            global.healthEndpointStats.avgResponseTime = 
                ((global.healthEndpointStats.avgResponseTime || 0) * 0.9) + (responseTime * 0.1);
        }

    } catch (error) {
        // Log errors in request logging to ensure monitoring visibility
        logger.error('Error logging health endpoint request', {
            error: error.message,
            stack: error.stack,
            correlationId: correlationId,
            method: req?.method,
            url: req?.url,
            responseTime: responseTime,
            healthStatus: healthStatus
        });
    }
}

// ============================================================================
// MAIN HEALTH ENDPOINT HANDLER FUNCTION
// ============================================================================

/**
 * Main health endpoint handler that processes HTTP requests to /health endpoint,
 * executes comprehensive health checks, and returns detailed health status information
 * in JSON format with appropriate HTTP status codes for monitoring and load balancing
 * 
 * @param {Object} req - HTTP IncomingMessage object with health request details
 * @param {Object} res - HTTP ServerResponse object for health response generation
 * @returns {Promise<void>} Promise resolving when health response is sent to client
 */
async function handleHealthRequest(req, res) {
    // Record health check request start time for performance measurement
    const startTime = performance.now();
    let correlationId = null;
    let healthStatus = HEALTH_STATUS_TYPES.UNHEALTHY;

    try {
        // Generate unique correlation ID for request tracking across systems
        correlationId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        logger.info('Health endpoint request received', {
            correlationId: correlationId,
            method: req.method,
            url: req.url,
            clientIP: req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            timestamp: new Date().toISOString()
        });

        // Validate HTTP request method, path, and headers for security
        if (!validateHealthRequest(req)) {
            const responseTime = performance.now() - startTime;
            
            // Generate error response for invalid requests
            const responseGenerator = new ResponseGenerator();
            await responseGenerator.sendInternalError(res, {
                error: 'Invalid health endpoint request',
                correlationId: correlationId,
                timestamp: new Date().toISOString()
            });

            // Log invalid request attempt for security monitoring
            logHealthRequest(req, correlationId, responseTime, 'invalid-request');
            return;
        }

        // Check response cache for recent health data to optimize performance
        if (healthResponseCache.isValid()) {
            const responseTime = performance.now() - startTime;
            healthStatus = healthResponseCache.data.status;

            logger.info('Returning cached health response', {
                correlationId: correlationId,
                cacheAge: Date.now() - healthResponseCache.timestamp,
                responseTime: Math.round(responseTime),
                healthStatus: healthStatus
            });

            // Send cached response with appropriate HTTP status
            const httpStatus = determineHttpStatusCode(healthResponseCache.data);
            const responseGenerator = new ResponseGenerator();
            await responseGenerator.sendSuccess(res, healthResponseCache.data, httpStatus);
            
            logHealthRequest(req, correlationId, responseTime, healthStatus);
            return;
        }

        // Initialize health checker with comprehensive monitoring configuration
        const healthChecker = new HealthChecker({
            timeout: HEALTH_CHECK_TIMEOUT_MS,
            includeSystemMetrics: true,
            includeProcessMetrics: true,
            includePerformanceMetrics: true,
            correlationId: correlationId
        });

        // Execute comprehensive health check with timeout protection
        logger.info('Executing comprehensive health check', {
            correlationId: correlationId,
            timeout: HEALTH_CHECK_TIMEOUT_MS,
            timestamp: new Date().toISOString()
        });

        const healthResults = await Promise.race([
            healthChecker.performHealthCheck(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT_MS)
            )
        ]);

        // Collect current metrics snapshot for detailed health response
        const metricsCollector = new MetricsCollector();
        const metricsSnapshot = await metricsCollector.getMetricsSnapshot();

        // Calculate total execution time for performance monitoring
        const executionTimeMs = performance.now() - startTime;
        healthStatus = healthResults?.status || HEALTH_STATUS_TYPES.UNHEALTHY;

        // Format comprehensive health response with all system information
        const healthResponse = formatHealthResponse(
            healthResults, 
            metricsSnapshot, 
            executionTimeMs
        );

        // Cache formatted response for performance optimization
        healthResponseCache.set(healthResponse);

        // Determine appropriate HTTP status code based on health results
        const httpStatusCode = determineHttpStatusCode(healthResults);

        logger.info('Health check completed successfully', {
            correlationId: correlationId,
            executionTime: Math.round(executionTimeMs),
            healthStatus: healthStatus,
            httpStatus: httpStatusCode,
            componentCount: Object.keys(healthResults || {}).length,
            metricsCount: Object.keys(metricsSnapshot || {}).length
        });

        // Generate JSON health response with security headers
        const responseGenerator = new ResponseGenerator();
        await responseGenerator.sendSuccess(res, healthResponse, httpStatusCode);

        // Log successful health request completion
        logHealthRequest(req, correlationId, executionTimeMs, healthStatus);

    } catch (error) {
        const executionTimeMs = performance.now() - startTime;
        
        logger.error('Health check execution failed', {
            error: error.message,
            stack: error.stack,
            correlationId: correlationId,
            executionTime: Math.round(executionTimeMs),
            method: req?.method,
            url: req?.url,
            clientIP: req.socket?.remoteAddress || 'unknown'
        });

        try {
            // Generate fallback error response for health check failures
            const errorResponse = {
                status: HEALTH_STATUS_TYPES.UNHEALTHY,
                score: 0,
                timestamp: new Date().toISOString(),
                execution_time_ms: Math.round(executionTimeMs),
                error: 'Health check execution failed',
                correlationId: correlationId || 'unknown',
                metadata: {
                    endpoint_version: '1.0.0',
                    schema_version: '2024-01',
                    error_occurred: true,
                    error_type: error.name || 'UnknownError'
                }
            };

            const responseGenerator = new ResponseGenerator();
            await responseGenerator.sendInternalError(res, errorResponse);

            // Log error response for monitoring systems
            logHealthRequest(req, correlationId, executionTimeMs, HEALTH_STATUS_TYPES.UNHEALTHY);

        } catch (responseError) {
            logger.error('Failed to send health check error response', {
                originalError: error.message,
                responseError: responseError.message,
                correlationId: correlationId,
                executionTime: Math.round(executionTimeMs)
            });
        }
    }
}

// ============================================================================
// HEALTH ENDPOINT MANAGEMENT CLASS
// ============================================================================

/**
 * Health endpoint management class that provides HTTP health check functionality
 * with comprehensive health monitoring, metrics integration, and standardized
 * response formatting for monitoring systems and operational visibility
 */
class HealthEndpoint {
    /**
     * Initializes health endpoint with health checker, response generator, metrics collector,
     * and caching configuration for comprehensive health monitoring capabilities
     * 
     * @param {Object} options - Configuration options for health endpoint behavior and monitoring integration
     */
    constructor(options = {}) {
        // Configuration with defaults and validation
        this.config = {
            timeout: options.timeout || HEALTH_CHECK_TIMEOUT_MS,
            cacheTTL: options.cacheTTL || HEALTH_RESPONSE_CACHE_TTL_MS,
            includeMetrics: options.includeMetrics !== false,
            includeSystemInfo: options.includeSystemInfo !== false,
            includeProcessInfo: options.includeProcessInfo !== false,
            enableCaching: options.enableCaching !== false,
            logLevel: options.logLevel || 'info'
        };

        // Initialize health checker with comprehensive monitoring configuration
        this.healthChecker = new HealthChecker({
            timeout: this.config.timeout,
            includeSystemMetrics: this.config.includeSystemInfo,
            includeProcessMetrics: this.config.includeProcessInfo,
            includePerformanceMetrics: true
        });

        // Initialize response generator for standardized HTTP response formatting
        this.responseGenerator = new ResponseGenerator();

        // Initialize metrics collector for performance and health data integration
        this.metricsCollector = new MetricsCollector();

        // Initialize response cache with configured TTL
        this.responseCache = {
            data: null,
            timestamp: null,
            ttl: this.config.cacheTTL
        };

        // Initialize request correlation tracking
        this.requestStats = {
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: null
        };

        logger.info('HealthEndpoint initialized', {
            config: this.config,
            timestamp: new Date().toISOString(),
            component: 'health-endpoint'
        });
    }

    /**
     * Processes HTTP health endpoint requests with comprehensive validation, health checking,
     * metrics collection, and standardized response formatting for monitoring systems
     * 
     * @param {Object} req - HTTP request object with health endpoint request details
     * @param {Object} res - HTTP response object for health endpoint response generation
     * @returns {Promise<void>} Promise resolving when health endpoint response is complete
     */
    async handleRequest(req, res) {
        const startTime = performance.now();
        let correlationId = null;

        try {
            // Generate unique correlation ID for comprehensive request tracking
            correlationId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Update request statistics for operational monitoring
            this.requestStats.totalRequests++;
            this.requestStats.lastRequestTime = Date.now();

            // Validate health endpoint request for security and correctness
            if (!validateHealthRequest(req)) {
                this.requestStats.errorRequests++;
                const responseTime = performance.now() - startTime;
                
                await this.responseGenerator.sendInternalError(res, {
                    error: 'Invalid health endpoint request',
                    correlationId: correlationId
                });
                
                this._updateResponseTimeStats(responseTime);
                return;
            }

            // Check response cache if caching is enabled for performance optimization
            if (this.config.enableCaching && this._isCacheValid()) {
                const responseTime = performance.now() - startTime;
                
                logger.info('Serving cached health response', {
                    correlationId: correlationId,
                    cacheAge: Date.now() - this.responseCache.timestamp,
                    responseTime: Math.round(responseTime)
                });

                const httpStatus = determineHttpStatusCode(this.responseCache.data);
                await this.responseGenerator.sendSuccess(res, this.responseCache.data, httpStatus);
                
                this.requestStats.successfulRequests++;
                this._updateResponseTimeStats(responseTime);
                return;
            }

            // Execute comprehensive health check with configured timeout
            const healthResults = await this.healthChecker.performHealthCheck();
            
            // Collect current metrics snapshot if metrics integration is enabled
            let metricsSnapshot = null;
            if (this.config.includeMetrics) {
                metricsSnapshot = await this.metricsCollector.getMetricsSnapshot();
            }

            // Calculate execution time and format comprehensive response
            const executionTimeMs = performance.now() - startTime;
            const healthResponse = formatHealthResponse(
                healthResults, 
                metricsSnapshot, 
                executionTimeMs
            );

            // Cache formatted response for performance optimization
            if (this.config.enableCaching) {
                this._setCache(healthResponse);
            }

            // Send health response with appropriate HTTP status code
            const httpStatusCode = determineHttpStatusCode(healthResults);
            await this.responseGenerator.sendSuccess(res, healthResponse, httpStatusCode);

            // Update operational statistics
            this.requestStats.successfulRequests++;
            this._updateResponseTimeStats(executionTimeMs);

            // Log successful health endpoint request processing
            logHealthRequest(req, correlationId, executionTimeMs, healthResults?.status);

        } catch (error) {
            this.requestStats.errorRequests++;
            const executionTimeMs = performance.now() - startTime;

            logger.error('Health endpoint request processing failed', {
                error: error.message,
                stack: error.stack,
                correlationId: correlationId,
                executionTime: Math.round(executionTimeMs)
            });

            // Send error response for health endpoint failures
            const errorResponse = {
                status: HEALTH_STATUS_TYPES.UNHEALTHY,
                score: 0,
                timestamp: new Date().toISOString(),
                execution_time_ms: Math.round(executionTimeMs),
                error: 'Health endpoint processing failed',
                correlationId: correlationId
            };

            await this.responseGenerator.sendInternalError(res, errorResponse);
            this._updateResponseTimeStats(executionTimeMs);
        }
    }

    /**
     * Returns current health status without HTTP request processing, useful for
     * internal health checks and programmatic access to health information
     * 
     * @param {Object} options - Options for health status retrieval including timeout and detail level
     * @returns {Promise<Object>} Promise resolving to health status object with comprehensive health data
     */
    async getHealthStatus(options = {}) {
        try {
            const startTime = performance.now();

            // Execute health check with specified or default configuration
            const healthResults = await this.healthChecker.performHealthCheck();
            
            // Collect metrics snapshot if requested
            let metricsSnapshot = null;
            if (options.includeMetrics !== false && this.config.includeMetrics) {
                metricsSnapshot = await this.metricsCollector.getMetricsSnapshot();
            }

            // Format and return comprehensive health status
            const executionTimeMs = performance.now() - startTime;
            return formatHealthResponse(healthResults, metricsSnapshot, executionTimeMs);

        } catch (error) {
            logger.error('Error retrieving health status', {
                error: error.message,
                stack: error.stack,
                options: options
            });

            // Return error health status for programmatic access
            return {
                status: HEALTH_STATUS_TYPES.UNHEALTHY,
                score: 0,
                timestamp: new Date().toISOString(),
                error: 'Health status retrieval failed'
            };
        }
    }

    /**
     * Configures health check parameters including timeout values, check intervals,
     * and component monitoring settings for customized health assessment
     * 
     * @param {Object} healthConfig - Health check configuration with timeouts and monitoring settings
     * @returns {void} No return value - updates internal health checking configuration
     */
    configureHealthChecks(healthConfig) {
        try {
            // Validate configuration parameters
            if (healthConfig.timeout && (healthConfig.timeout < 1000 || healthConfig.timeout > 60000)) {
                throw new Error('Health check timeout must be between 1000ms and 60000ms');
            }

            if (healthConfig.cacheTTL && (healthConfig.cacheTTL < 1000 || healthConfig.cacheTTL > 300000)) {
                throw new Error('Cache TTL must be between 1000ms and 300000ms');
            }

            // Update configuration with validated parameters
            this.config = {
                ...this.config,
                ...healthConfig
            };

            // Reconfigure health checker with updated settings
            this.healthChecker = new HealthChecker({
                timeout: this.config.timeout,
                includeSystemMetrics: this.config.includeSystemInfo,
                includeProcessMetrics: this.config.includeProcessInfo,
                includePerformanceMetrics: true
            });

            // Clear cache to force refresh with new configuration
            this._clearCache();

            logger.info('Health check configuration updated', {
                newConfig: this.config,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error configuring health checks', {
                error: error.message,
                stack: error.stack,
                providedConfig: healthConfig
            });
            throw error;
        }
    }

    /**
     * Internal method to check if cached response is still valid based on TTL
     * @private
     */
    _isCacheValid() {
        if (!this.responseCache.data || !this.responseCache.timestamp) {
            return false;
        }
        return (Date.now() - this.responseCache.timestamp) < this.responseCache.ttl;
    }

    /**
     * Internal method to set cached response with current timestamp
     * @private
     */
    _setCache(data) {
        this.responseCache.data = data;
        this.responseCache.timestamp = Date.now();
    }

    /**
     * Internal method to clear cached response data
     * @private
     */
    _clearCache() {
        this.responseCache.data = null;
        this.responseCache.timestamp = null;
    }

    /**
     * Internal method to update rolling average response time statistics
     * @private
     */
    _updateResponseTimeStats(responseTime) {
        const alpha = 0.1; // Exponential moving average factor
        this.requestStats.averageResponseTime = 
            (this.requestStats.averageResponseTime * (1 - alpha)) + (responseTime * alpha);
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

// Create default health endpoint instance with environment-based configuration
const healthEndpoint = new HealthEndpoint({
    timeout: config?.monitoring?.healthCheckTimeout || HEALTH_CHECK_TIMEOUT_MS,
    cacheTTL: config?.monitoring?.healthCacheTTL || HEALTH_RESPONSE_CACHE_TTL_MS,
    includeMetrics: config?.monitoring?.includeMetrics !== false,
    includeSystemInfo: config?.monitoring?.includeSystemInfo !== false,
    includeProcessInfo: config?.monitoring?.includeProcessInfo !== false,
    enableCaching: config?.monitoring?.enableCaching !== false
});

// Export comprehensive health endpoint functionality
export {
    // Main health endpoint handler function
    handleHealthRequest,
    
    // Health response formatting function
    formatHealthResponse,
    
    // HTTP status code determination function  
    determineHttpStatusCode,
    
    // Request validation function
    validateHealthRequest,
    
    // Request logging function
    logHealthRequest,
    
    // Health endpoint management class
    HealthEndpoint,
    
    // Pre-configured default health endpoint instance
    healthEndpoint,
    
    // Global constants for external use
    HEALTH_ENDPOINT_PATH,
    HEALTH_CHECK_TIMEOUT_MS,
    HEALTH_RESPONSE_CACHE_TTL_MS,
    HTTP_STATUS_CODES
};