// Node.js Tutorial HTTP Server - Request Logging Middleware
// Comprehensive HTTP request tracking, performance monitoring, and correlation management
// Zero external dependencies - uses Node.js built-in modules and internal utilities only

// Node.js built-in module imports with version comments
const { performance } = require('node:perf_hooks'); // Built-in Node.js performance API - stable
const url = require('node:url'); // Built-in Node.js URL parsing and manipulation - stable
const crypto = require('node:crypto'); // Built-in Node.js cryptographic functions - stable

// Internal module imports for logging, performance monitoring, and configuration
const { 
    logger, 
    setRequestContext, 
    clearRequestContext, 
    generateCorrelationId,
    logRequest,
    info,
    warn,
    error
} = require('../lib/logger.js');

const { measureRequestPerformance } = require('../utils/performance-monitor.js');

// Import server configuration - handle potential ES6/CommonJS mismatch
let serverConfig;
try {
    // Try CommonJS require first
    serverConfig = require('../config/server-config.js').serverConfig;
} catch (requireError) {
    try {
        // Fallback to dynamic import for ES6 modules
        const configModule = require('../config/server-config.js');
        serverConfig = configModule.serverConfig || configModule.default?.serverConfig;
    } catch (importError) {
        warn('Failed to import server configuration, using defaults', { 
            requireError: requireError.message,
            importError: importError.message 
        });
        // Provide fallback configuration
        serverConfig = {
            performance: {
                thresholds: { responseTime: 1000 },
                monitoring: { enabled: true }
            },
            http: {
                timeout: 300000,
                keepAliveTimeout: 5000
            }
        };
    }
}

// Global configuration constants for request logging middleware
const REQUEST_LOGGER_CONFIG = {
    enableCorrelation: true,
    logLevel: 'info',
    includeHeaders: false,
    includeTiming: true,
    sanitizeHeaders: true
};

// HTTP header name for correlation ID propagation
const CORRELATION_ID_HEADER = 'x-correlation-id';

// Standard request log field mappings for consistent logging structure
const REQUEST_LOG_FIELDS = {
    method: 'method',
    path: 'path',
    statusCode: 'statusCode',
    responseTime: 'responseTime',
    clientIp: 'clientIp',
    userAgent: 'userAgent',
    correlationId: 'correlationId'
};

// Sensitive HTTP headers that should be sanitized from logs for security
const SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-access-token',
    'authentication',
    'proxy-authorization',
    'x-auth-token',
    'x-session-id'
];

// Request processing timing thresholds for performance classification
const TIMING_THRESHOLDS = {
    FAST: 100,      // < 100ms
    NORMAL: 500,    // 100-500ms
    SLOW: 1000,     // 500ms-1s
    VERY_SLOW: 2000 // 1-2s
    // > 2s considered critical slow
};

/**
 * Factory function that creates a request logging middleware instance with configurable options
 * Provides flexible configuration for logging behavior, performance tracking, and correlation management
 * @param {object} options - Configuration options for request logging including log level, correlation, timing, and sanitization settings
 * @returns {function} Express-style middleware function for HTTP server request logging integration
 */
function createRequestLogger(options = {}) {
    // Merge provided options with default configuration
    const config = {
        ...REQUEST_LOGGER_CONFIG,
        ...options,
        // Override performance settings from server config if available
        performanceThresholds: serverConfig?.performance?.thresholds || { responseTime: 1000 },
        performanceMonitoring: serverConfig?.performance?.monitoring?.enabled !== false
    };
    
    info('Creating request logger middleware', { config });
    
    // Create and return RequestLogger instance with middleware method
    const requestLogger = new RequestLogger(config);
    return requestLogger.middleware.bind(requestLogger);
}

/**
 * Extracts relevant information from HTTP request objects for logging including method, URL, headers, and client information
 * Implements security sanitization to prevent sensitive data exposure in logs
 * @param {object} req - HTTP IncomingMessage object with request details
 * @param {object} options - Extraction options including header inclusion and sanitization settings
 * @returns {object} Sanitized request information object suitable for structured logging
 */
function extractRequestInfo(req, options = {}) {
    try {
        // Extract basic request information including method, URL, and HTTP version
        const method = req.method || 'UNKNOWN';
        const requestUrl = req.url || '/';
        const httpVersion = req.httpVersion || '1.1';
        
        // Parse request URL to separate path, query parameters, and fragments
        let parsedUrl;
        try {
            // Handle relative URLs by adding a base URL for parsing
            const baseUrl = `http://${req.headers.host || 'localhost'}`;
            parsedUrl = new url.URL(requestUrl, baseUrl);
        } catch (urlError) {
            warn('Failed to parse request URL', { url: requestUrl, error: urlError.message });
            parsedUrl = { pathname: requestUrl, search: '', hash: '' };
        }
        
        // Extract client IP address with proxy header consideration
        const clientIp = extractClientIp(req);
        
        // Get user agent and other client identification headers
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const contentType = req.headers['content-type'] || null;
        const contentLength = req.headers['content-length'] || null;
        const acceptHeader = req.headers.accept || null;
        
        // Include request timestamp and processing start time
        const timestamp = new Date().toISOString();
        const startTime = performance.now();
        
        // Build basic request information object
        const requestInfo = {
            method,
            path: parsedUrl.pathname,
            query: parsedUrl.search,
            httpVersion,
            clientIp,
            userAgent,
            contentType,
            contentLength: contentLength ? parseInt(contentLength, 10) : null,
            acceptHeader,
            timestamp,
            startTime,
            host: req.headers.host || null
        };
        
        // Sanitize header information to remove sensitive authentication data if requested
        if (options.includeHeaders) {
            requestInfo.headers = sanitizeHeaders(req.headers, SENSITIVE_HEADERS);
        }
        
        // Return structured request information object for logging
        return requestInfo;
        
    } catch (extractError) {
        error('Failed to extract request information', extractError);
        
        // Return minimal safe request information on extraction failure
        return {
            method: req.method || 'UNKNOWN',
            path: req.url || '/',
            clientIp: extractClientIp(req),
            userAgent: 'Unknown',
            timestamp: new Date().toISOString(),
            startTime: performance.now(),
            extractionError: true
        };
    }
}

/**
 * Extracts client IP address from request considering proxy headers and connection information
 * Implements standard proxy header precedence for accurate client identification
 * @param {object} req - HTTP request object
 * @returns {string} Client IP address or 'unknown' if unavailable
 */
function extractClientIp(req) {
    // Check standard proxy headers in order of precedence
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs, use the first (original client)
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0] || 'unknown';
    }
    
    // Check other common proxy headers
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp;
    
    const forwardedHeader = req.headers.forwarded;
    if (forwardedHeader) {
        const forMatch = forwardedHeader.match(/for=([^;,]+)/);
        if (forMatch) return forMatch[1].replace(/"/g, '');
    }
    
    // Fall back to connection remote address
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
}

/**
 * Generates unique correlation ID for request tracking using secure random generation with timestamp and entropy components
 * Ensures collision avoidance and chronological ordering for debugging purposes
 * @returns {string} Unique correlation ID for request tracking across middleware and handlers
 */
function generateCorrelationId() {
    try {
        // Generate timestamp component for uniqueness and chronological ordering
        const timestamp = Date.now().toString(36);
        
        // Create secure random component using crypto.randomBytes for entropy
        const randomBytes = crypto.randomBytes(8);
        const randomComponent = randomBytes.toString('hex');
        
        // Combine timestamp and random components with standard prefix
        const correlationId = `req_${timestamp}_${randomComponent}`;
        
        // Return formatted correlation ID suitable for HTTP headers and logging
        return correlationId;
        
    } catch (cryptoError) {
        warn('Failed to generate secure correlation ID, using fallback', { error: cryptoError.message });
        
        // Fallback to timestamp + Math.random if crypto fails
        const timestamp = Date.now().toString(36);
        const fallbackRandom = Math.random().toString(36).substring(2, 10);
        return `req_${timestamp}_${fallbackRandom}`;
    }
}

/**
 * Sanitizes HTTP headers by removing sensitive authentication information while preserving useful debugging headers
 * Implements comprehensive security filtering to prevent credential exposure in logs
 * @param {object} headers - HTTP headers object from request
 * @param {array} sensitiveHeaders - Array of header names to sanitize or remove
 * @returns {object} Sanitized headers object safe for logging without sensitive information
 */
function sanitizeHeaders(headers, sensitiveHeaders = SENSITIVE_HEADERS) {
    try {
        // Create copy of headers object to avoid mutation of original request
        const sanitizedHeaders = {};
        
        // Iterate through headers and apply sanitization rules
        for (const [headerName, headerValue] of Object.entries(headers)) {
            const normalizedHeaderName = headerName.toLowerCase();
            
            // Check if field name matches sensitive patterns
            const isSensitive = sensitiveHeaders.some(sensitiveHeader => 
                normalizedHeaderName.includes(sensitiveHeader.toLowerCase())
            );
            
            if (isSensitive) {
                // Replace sensitive header values with placeholder text
                sanitizedHeaders[headerName] = '[REDACTED]';
            } else {
                // Truncate excessively long header values to prevent log pollution
                const stringValue = String(headerValue);
                if (stringValue.length > 200) {
                    sanitizedHeaders[headerName] = stringValue.substring(0, 200) + '...[truncated]';
                } else {
                    sanitizedHeaders[headerName] = stringValue;
                }
            }
        }
        
        // Return sanitized headers object suitable for secure logging
        return sanitizedHeaders;
        
    } catch (sanitizeError) {
        warn('Failed to sanitize headers, returning empty object', { error: sanitizeError.message });
        return {};
    }
}

/**
 * Formats request information into structured log entry with timestamp, correlation ID, and standardized field formatting
 * Provides consistent logging structure across all request logging operations
 * @param {object} requestInfo - Request information object from extraction
 * @param {string} correlationId - Request correlation identifier
 * @param {object} timing - Performance timing information including start time and duration
 * @returns {object} Formatted log entry object ready for structured logging output
 */
function formatRequestLog(requestInfo, correlationId, timing = null) {
    try {
        // Create base log entry with timestamp and correlation ID
        const logEntry = {
            timestamp: new Date().toISOString(),
            correlationId: correlationId,
            type: 'request'
        };
        
        // Add request method, path, and HTTP version information
        if (requestInfo.method) logEntry.method = requestInfo.method;
        if (requestInfo.path) logEntry.path = requestInfo.path;
        if (requestInfo.httpVersion) logEntry.httpVersion = requestInfo.httpVersion;
        
        // Include client information like IP address and user agent
        if (requestInfo.clientIp) logEntry.clientIp = requestInfo.clientIp;
        if (requestInfo.userAgent) logEntry.userAgent = requestInfo.userAgent;
        if (requestInfo.host) logEntry.host = requestInfo.host;
        
        // Add content information if available
        if (requestInfo.contentType) logEntry.contentType = requestInfo.contentType;
        if (requestInfo.contentLength) logEntry.contentLength = requestInfo.contentLength;
        
        // Add performance timing information if available
        if (timing) {
            logEntry.timing = {
                startTime: timing.startTime,
                duration: timing.duration,
                classification: classifyResponseTime(timing.duration)
            };
        }
        
        // Include additional context if present
        if (requestInfo.query && requestInfo.query !== '?') {
            logEntry.queryString = requestInfo.query;
        }
        
        // Return structured log entry for logger consumption
        return logEntry;
        
    } catch (formatError) {
        error('Failed to format request log entry', formatError);
        
        // Return minimal log entry on formatting failure
        return {
            timestamp: new Date().toISOString(),
            correlationId: correlationId || 'unknown',
            type: 'request',
            error: 'log_formatting_failed',
            originalRequest: {
                method: requestInfo?.method || 'unknown',
                path: requestInfo?.path || 'unknown'
            }
        };
    }
}

/**
 * Classifies response time performance into human-readable categories
 * Provides performance analysis context for monitoring and alerting
 * @param {number} duration - Response time in milliseconds
 * @returns {string} Performance classification (fast, normal, slow, very_slow, critical)
 */
function classifyResponseTime(duration) {
    if (duration < TIMING_THRESHOLDS.FAST) return 'fast';
    if (duration < TIMING_THRESHOLDS.NORMAL) return 'normal';
    if (duration < TIMING_THRESHOLDS.SLOW) return 'slow';
    if (duration < TIMING_THRESHOLDS.VERY_SLOW) return 'very_slow';
    return 'critical';
}

/**
 * Updates request tracking metrics including request count, response time statistics, and endpoint usage patterns
 * Maintains in-memory metrics for monitoring dashboard and performance analysis
 * @param {object} requestInfo - Request information including method, path, and timing
 * @param {number} responseTime - Request processing duration in milliseconds
 * @param {number} statusCode - HTTP response status code
 * @returns {void} No return value - updates internal request metrics for monitoring
 */
function trackRequestMetrics(requestInfo, responseTime, statusCode) {
    try {
        // This would typically integrate with a metrics collection system
        // For the tutorial application, we'll log metrics information
        const metricsData = {
            timestamp: new Date().toISOString(),
            method: requestInfo.method,
            path: requestInfo.path,
            statusCode: statusCode,
            responseTime: responseTime,
            classification: classifyResponseTime(responseTime),
            clientIp: requestInfo.clientIp
        };
        
        // Log metrics data for monitoring and analysis
        info('Request metrics collected', { metrics: metricsData });
        
        // In a production system, this would update:
        // - Request counters for method and endpoint tracking
        // - Response time statistics including averages and percentiles
        // - Status code distribution for success and error rate calculation
        // - Endpoint usage patterns and request frequency
        // - Throughput metrics for requests per second calculation
        // - Client IP patterns for basic usage analysis
        
    } catch (metricsError) {
        warn('Failed to track request metrics', { error: metricsError.message });
    }
}

/**
 * Main request logging middleware class that provides comprehensive HTTP request tracking
 * Integrates performance monitoring, correlation management, and structured logging capabilities
 */
class RequestLogger {
    /**
     * Initializes request logger with configuration, logger integration, performance monitoring, and metrics collection
     * @param {object} options - Configuration options for request logging behavior and integration
     */
    constructor(options = {}) {
        // Store configuration options with defaults for undefined values
        this.config = {
            ...REQUEST_LOGGER_CONFIG,
            ...options
        };
        
        // Initialize request metrics collection and tracking
        this.requestMetrics = {
            totalRequests: 0,
            requestsByMethod: {},
            requestsByPath: {},
            responseTimeStats: {
                min: Infinity,
                max: 0,
                sum: 0,
                count: 0
            }
        };
        
        // Configure correlation ID generation and management
        this.correlationEnabled = this.config.enableCorrelation;
        
        // Set up active request tracking with cleanup mechanisms
        this.activeRequests = new Map();
        
        // Configure header sanitization and security filtering
        this.sensitiveHeaders = SENSITIVE_HEADERS.slice(); // Copy default list
        
        info('RequestLogger initialized', { 
            config: this.config,
            correlationEnabled: this.correlationEnabled 
        });
    }
    
    /**
     * Main request logging middleware function that captures request information, sets up correlation tracking, and logs request/response lifecycle events
     * @param {object} req - HTTP IncomingMessage object with request details
     * @param {object} res - HTTP ServerResponse object for response tracking
     * @param {function} next - Express-style next function for middleware chain continuation
     * @returns {void} No return value - processes request and continues middleware chain
     */
    middleware(req, res, next) {
        try {
            // Generate unique correlation ID for request tracking
            const correlationId = this.correlationEnabled ? generateCorrelationId() : null;
            
            // Extract request information including method, path, and client details
            const requestInfo = extractRequestInfo(req, {
                includeHeaders: this.config.includeHeaders,
                sanitizeHeaders: this.config.sanitizeHeaders
            });
            
            // Set up request context with correlation ID and timing information
            if (correlationId) {
                setRequestContext(correlationId, {
                    method: requestInfo.method,
                    path: requestInfo.path,
                    clientIp: requestInfo.clientIp,
                    startTime: requestInfo.startTime
                });
                
                // Add correlation ID to request and response headers
                req.correlationId = correlationId;
                res.setHeader(CORRELATION_ID_HEADER, correlationId);
            }
            
            // Log request start event with structured information
            this.logRequestStart(requestInfo, correlationId);
            
            // Start performance measurement for request processing time
            let performanceMeasure;
            if (this.config.performanceMonitoring) {
                try {
                    performanceMeasure = measureRequestPerformance(`request_${correlationId || Date.now()}`);
                } catch (perfError) {
                    warn('Failed to start performance measurement', { error: perfError.message });
                }
            }
            
            // Set up response finish event listener for completion logging
            const originalEnd = res.end;
            const self = this;
            
            res.end = function(chunk, encoding) {
                try {
                    // Calculate total request processing duration from start time
                    const endTime = performance.now();
                    const duration = endTime - requestInfo.startTime;
                    
                    // Stop performance measurement if started
                    if (performanceMeasure && typeof performanceMeasure.stop === 'function') {
                        try {
                            performanceMeasure.stop();
                        } catch (perfStopError) {
                            warn('Failed to stop performance measurement', { error: perfStopError.message });
                        }
                    }
                    
                    // Prepare response information for completion logging
                    const responseInfo = {
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        contentLength: res.getHeader('content-length'),
                        contentType: res.getHeader('content-type')
                    };
                    
                    // Log request completion event with performance metrics
                    self.logRequestComplete(requestInfo, responseInfo, correlationId, duration);
                    
                    // Update request tracking metrics and throughput statistics
                    if (self.config.trackMetrics !== false) {
                        trackRequestMetrics(requestInfo, duration, res.statusCode);
                    }
                    
                    // Clean up request context and correlation tracking for correlation ID
                    if (correlationId) {
                        clearRequestContext(correlationId);
                        self.activeRequests.delete(correlationId);
                    }
                    
                } catch (endError) {
                    self.handleLoggingError(endError, 'response_end', correlationId);
                }
                
                // Call original response.end method to complete the response
                return originalEnd.call(this, chunk, encoding);
            };
            
            // Track active request
            if (correlationId) {
                this.activeRequests.set(correlationId, {
                    startTime: requestInfo.startTime,
                    method: requestInfo.method,
                    path: requestInfo.path
                });
            }
            
            // Update total request counter
            this.requestMetrics.totalRequests++;
            
            // Continue middleware chain by calling next() function
            if (typeof next === 'function') {
                next();
            }
            
        } catch (middlewareError) {
            this.handleLoggingError(middlewareError, 'middleware_setup', req.correlationId);
            
            // Ensure middleware chain continues even on logging failure
            if (typeof next === 'function') {
                next();
            }
        }
    }
    
    /**
     * Logs the start of HTTP request processing with request information, correlation ID, and performance timing initialization
     * @param {object} requestInfo - Extracted request information object
     * @param {string} correlationId - Request correlation identifier
     * @returns {void} No return value - logs request start event
     */
    logRequestStart(requestInfo, correlationId) {
        try {
            // Format request start log entry with timestamp and correlation
            const logData = formatRequestLog(requestInfo, correlationId);
            logData.event = 'request_start';
            
            // Log request start event using configured log level
            info('Request started', logData);
            
            // Update request tracking metrics for endpoint usage
            const method = requestInfo.method || 'UNKNOWN';
            const path = requestInfo.path || '/unknown';
            
            this.requestMetrics.requestsByMethod[method] = (this.requestMetrics.requestsByMethod[method] || 0) + 1;
            this.requestMetrics.requestsByPath[path] = (this.requestMetrics.requestsByPath[path] || 0) + 1;
            
        } catch (startLogError) {
            this.handleLoggingError(startLogError, 'request_start_logging', correlationId);
        }
    }
    
    /**
     * Logs the completion of HTTP request processing with response information, timing metrics, and performance statistics
     * @param {object} requestInfo - Request information from start of processing
     * @param {object} responseInfo - Response information including status and size
     * @param {string} correlationId - Request correlation identifier
     * @param {number} duration - Request processing duration in milliseconds
     * @returns {void} No return value - logs request completion event
     */
    logRequestComplete(requestInfo, responseInfo, correlationId, duration) {
        try {
            // Format request completion log with response status and timing
            const logData = formatRequestLog(requestInfo, correlationId, {
                startTime: requestInfo.startTime,
                duration: duration
            });
            
            // Add response information to log entry
            logData.event = 'request_complete';
            logData.response = {
                statusCode: responseInfo.statusCode,
                statusMessage: responseInfo.statusMessage,
                contentLength: responseInfo.contentLength,
                contentType: responseInfo.contentType
            };
            
            // Determine log level based on response status code and duration
            let logLevel = 'info';
            if (responseInfo.statusCode >= 500) {
                logLevel = 'error';
            } else if (responseInfo.statusCode >= 400 || duration > TIMING_THRESHOLDS.SLOW) {
                logLevel = 'warn';
            }
            
            // Log request completion event with performance metrics
            const message = `${requestInfo.method} ${requestInfo.path} - ${responseInfo.statusCode} - ${duration.toFixed(2)}ms`;
            
            if (logLevel === 'error') {
                error(message, logData);
            } else if (logLevel === 'warn') {
                warn(message, logData);
            } else {
                info(message, logData);
            }
            
            // Update response time statistics
            this.updateResponseTimeStats(duration);
            
        } catch (completeLogError) {
            this.handleLoggingError(completeLogError, 'request_complete_logging', correlationId);
        }
    }
    
    /**
     * Updates response time statistics for monitoring dashboard
     * @param {number} duration - Request duration in milliseconds
     */
    updateResponseTimeStats(duration) {
        try {
            const stats = this.requestMetrics.responseTimeStats;
            stats.min = Math.min(stats.min, duration);
            stats.max = Math.max(stats.max, duration);
            stats.sum += duration;
            stats.count++;
        } catch (statsError) {
            warn('Failed to update response time statistics', { error: statsError.message });
        }
    }
    
    /**
     * Handles errors that occur during request logging to prevent logging failures from affecting request processing
     * @param {Error} loggingError - Error object from logging operation
     * @param {string} operation - Description of logging operation that failed
     * @param {string} correlationId - Request correlation identifier for error context
     * @returns {void} No return value - handles logging error gracefully
     */
    handleLoggingError(loggingError, operation, correlationId) {
        try {
            // Log logging failure to error log with error details
            error('Request logging operation failed', {
                operation: operation,
                correlationId: correlationId || 'unknown',
                error: {
                    name: loggingError.name,
                    message: loggingError.message,
                    stack: loggingError.stack
                },
                timestamp: new Date().toISOString()
            });
            
            // Clean up any partial logging state or resources if correlation ID exists
            if (correlationId && this.activeRequests.has(correlationId)) {
                this.activeRequests.delete(correlationId);
                clearRequestContext(correlationId);
            }
            
        } catch (errorHandlingError) {
            // Last resort: use console.error to prevent total logging failure
            console.error('Critical error in request logging error handler:', errorHandlingError.message);
            console.error('Original logging error:', loggingError.message);
        }
    }
    
    /**
     * Returns comprehensive request logging statistics including request counts, response times, and endpoint usage metrics
     * @returns {object} Request statistics object with counts, averages, and performance metrics
     */
    getRequestStats() {
        try {
            const stats = this.requestMetrics.responseTimeStats;
            const averageResponseTime = stats.count > 0 ? (stats.sum / stats.count) : 0;
            
            return {
                totalRequests: this.requestMetrics.totalRequests,
                activeRequests: this.activeRequests.size,
                requestsByMethod: { ...this.requestMetrics.requestsByMethod },
                requestsByPath: { ...this.requestMetrics.requestsByPath },
                responseTime: {
                    min: stats.min === Infinity ? 0 : stats.min,
                    max: stats.max,
                    average: parseFloat(averageResponseTime.toFixed(2)),
                    total: stats.sum,
                    count: stats.count
                },
                configuration: {
                    correlationEnabled: this.correlationEnabled,
                    performanceMonitoring: this.config.performanceMonitoring,
                    includeHeaders: this.config.includeHeaders
                },
                timestamp: new Date().toISOString()
            };
        } catch (statsError) {
            warn('Failed to generate request statistics', { error: statsError.message });
            return {
                error: 'stats_generation_failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Updates request logger configuration dynamically including log levels, correlation settings, and performance tracking options
     * @param {object} newConfig - New configuration options to apply to request logging
     * @returns {void} No return value - updates logger configuration
     */
    configure(newConfig) {
        try {
            if (!newConfig || typeof newConfig !== 'object') {
                warn('Invalid configuration provided to configure method', { newConfig });
                return;
            }
            
            const oldConfig = { ...this.config };
            
            // Update configuration with validation
            if (typeof newConfig.enableCorrelation === 'boolean') {
                this.config.enableCorrelation = newConfig.enableCorrelation;
                this.correlationEnabled = newConfig.enableCorrelation;
            }
            
            if (typeof newConfig.includeHeaders === 'boolean') {
                this.config.includeHeaders = newConfig.includeHeaders;
            }
            
            if (typeof newConfig.sanitizeHeaders === 'boolean') {
                this.config.sanitizeHeaders = newConfig.sanitizeHeaders;
            }
            
            if (typeof newConfig.performanceMonitoring === 'boolean') {
                this.config.performanceMonitoring = newConfig.performanceMonitoring;
            }
            
            if (newConfig.logLevel && ['debug', 'info', 'warn', 'error'].includes(newConfig.logLevel)) {
                this.config.logLevel = newConfig.logLevel;
            }
            
            // Log configuration change event for audit and monitoring purposes
            info('Request logger configuration updated', {
                oldConfig: oldConfig,
                newConfig: this.config,
                timestamp: new Date().toISOString()
            });
            
        } catch (configError) {
            error('Failed to update request logger configuration', configError);
        }
    }
}

// Create default request logging middleware instance configured with server settings for immediate use
const requestLogger = createRequestLogger({
    enableCorrelation: true,
    logLevel: 'info',
    includeHeaders: false,
    includeTiming: true,
    sanitizeHeaders: true,
    performanceMonitoring: serverConfig?.performance?.monitoring?.enabled !== false
});

// Export comprehensive request logging functionality
module.exports = {
    // RequestLogger class for creating request logging middleware instances with full configuration and monitoring capabilities
    RequestLogger,
    
    // Factory function to create request logging middleware with specific configuration options
    createRequestLogger,
    
    // Default request logging middleware configured with server settings for immediate use in HTTP server middleware stack
    requestLogger,
    
    // Utility function to extract and sanitize request information for logging and analysis
    extractRequestInfo,
    
    // Utility function to generate unique correlation IDs for request tracking
    generateCorrelationId,
    
    // Utility function to sanitize HTTP headers for secure logging without sensitive information
    sanitizeHeaders,
    
    // Configuration constants for external reference and extension
    REQUEST_LOGGER_CONFIG,
    CORRELATION_ID_HEADER,
    REQUEST_LOG_FIELDS,
    SENSITIVE_HEADERS,
    TIMING_THRESHOLDS
};