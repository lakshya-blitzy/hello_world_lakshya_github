/**
 * Node.js Tutorial HTTP Server - Rate Limiting Security Component
 * 
 * Comprehensive HTTP request rate limiting implementation that provides denial-of-service (DoS) 
 * protection through configurable request throttling with in-memory client tracking, IP-based 
 * identification, and educational demonstration of rate limiting patterns using only Node.js 
 * built-in capabilities.
 * 
 * This component implements enterprise-grade rate limiting functionality while maintaining 
 * educational clarity and zero external dependencies. Provides client identification, request 
 * counting with sliding windows, automatic cleanup of expired data, security event logging, 
 * and comprehensive statistics tracking for monitoring and incident response.
 * 
 * Key Features:
 * - HTTP 429 Too Many Requests response generation with appropriate headers
 * - In-memory client tracking with automatic expiration and cleanup mechanisms
 * - Configurable rate limiting windows with request counting algorithms
 * - Client identification using IP addresses with proxy header support
 * - Security event logging for rate limiting violations and suspicious activity
 * - Comprehensive statistics and monitoring integration for operational insights
 * - Memory management with automatic cleanup to prevent resource exhaustion
 * - Educational design demonstrating fundamental security patterns and DoS protection
 * 
 * Educational Objectives:
 * - Demonstrate DoS attack prevention through request throttling techniques
 * - Illustrate client identification and tracking patterns for security monitoring
 * - Show HTTP 429 status code usage and rate limiting header implementation
 * - Teach in-memory data management with expiration and cleanup strategies
 * - Provide security event logging integration for monitoring and alerting
 * - Demonstrate middleware pattern implementation for HTTP request processing
 * 
 * Security Features:
 * - Client IP-based identification with forwarded header support
 * - Request rate limiting with configurable windows and thresholds
 * - Automatic client data expiration to prevent memory exhaustion
 * - Secure error handling without information disclosure
 * - Rate limiting bypass prevention through multiple identification methods
 * 
 * Dependencies: Node.js built-in modules only (util) plus internal modules
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 * HTTP Protocol: HTTP/1.1 compliance with RFC 6585 (429 status code)
 */

// Import Node.js built-in utility module for object inspection and debugging rate limiter state
const util = require('node:util'); // Node.js built-in v22.x

// Import logging functionality for rate limiting events, security violations, and operational monitoring
const { logger } = require('../lib/logger.js');

// Import response generation functionality for HTTP 429 Too Many Requests error responses
const { generateErrorResponse } = require('../lib/response-generator.js');

// Import rate limiting configuration including window duration, request limits, and enabled status
const { serverConfig } = require('../config/server-config.js');

// Global HTTP 429 Too Many Requests status code constant for rate limiting violations
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

// Global rate limiting headers constant providing standard rate limiting response headers
const RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': 'number',        // Maximum requests allowed per window
    'X-RateLimit-Remaining': 'number',    // Requests remaining in current window  
    'X-RateLimit-Reset': 'timestamp',     // Timestamp when current window resets
    'Retry-After': 'seconds'              // Seconds until client can retry requests
};

// Global default rate limiting configuration constant for fallback settings
const DEFAULT_RATE_LIMIT = {
    windowMs: 60000,            // 60 seconds rate limiting window duration
    maxRequests: 100,           // 100 requests maximum per window
    enabled: false              // Rate limiting disabled by default for educational use
};

// Global client store cleanup interval constant (5 minutes) for memory management
const CLIENT_STORE_CLEANUP_INTERVAL = 300000;

/**
 * Generates unique client identifier from HTTP request for rate limiting tracking using IP address, 
 * forwarded headers, and connection information to create consistent tracking key across requests.
 * 
 * @param {Object} req - HTTP request object containing client information and headers
 * @returns {string} Unique client identifier for rate limiting tracking and request counting
 */
function getClientIdentifier(req) {
    try {
        // Extract client IP address from request headers with forwarded request support
        let clientIp = req.connection?.remoteAddress || 
                       req.socket?.remoteAddress || 
                       req.ip || 
                       'unknown';

        // Handle IPv6-mapped IPv4 addresses by extracting IPv4 portion for consistency
        if (clientIp && clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.substring(7);
        }

        // Check X-Forwarded-For header for proxied requests with validation
        const forwardedFor = req.headers?.['x-forwarded-for'];
        if (forwardedFor && typeof forwardedFor === 'string') {
            // Extract first IP from comma-separated list of forwarded addresses
            const forwardedIps = forwardedFor.split(',').map(ip => ip.trim());
            if (forwardedIps.length > 0 && forwardedIps[0] !== '') {
                clientIp = forwardedIps[0];
            }
        }

        // Check X-Real-IP header as alternative proxy header for client identification
        const realIp = req.headers?.['x-real-ip'];
        if (realIp && typeof realIp === 'string' && realIp.trim() !== '') {
            clientIp = realIp.trim();
        }

        // Handle localhost connections for development environment compatibility
        if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost') {
            clientIp = 'localhost';
        }

        // Generate consistent client identifier with IP and optional user agent for uniqueness
        const userAgent = req.headers?.['user-agent'] || '';
        const userAgentHash = userAgent ? userAgent.substring(0, 20) : '';
        
        // Create stable client identifier for tracking across requests in current session
        const clientId = `${clientIp}_${Buffer.from(userAgentHash).toString('base64').substring(0, 8)}`;

        // Log client identification for security monitoring and debugging purposes
        logger.debug('Client identifier generated for rate limiting', {
            clientId: clientId,
            originalIp: req.connection?.remoteAddress,
            forwardedFor: forwardedFor || null,
            realIp: realIp || null,
            resolvedIp: clientIp,
            userAgentPrefix: userAgentHash,
            function: 'getClientIdentifier'
        });

        return clientId;

    } catch (error) {
        // Log client identification error and return fallback identifier
        logger.error('Failed to generate client identifier', {
            error: {
                message: error.message,
                stack: error.stack
            },
            requestUrl: req.url,
            requestMethod: req.method,
            function: 'getClientIdentifier'
        });

        // Return safe fallback identifier to continue rate limiting functionality
        return 'unknown_client_' + Date.now();
    }
}

/**
 * Updates request count for specific client within current rate limiting window and manages 
 * window boundaries with automatic window reset when time period expires.
 * 
 * @param {Map} clientStore - In-memory client tracking store with request counts and windows
 * @param {string} clientId - Client identifier for tracking and request counting
 * @param {number} windowMs - Duration of rate limiting window in milliseconds
 * @returns {Object} Client tracking information including count, window start, and remaining requests
 */
function updateClientCount(clientStore, clientId, windowMs) {
    try {
        const currentTime = Date.now();
        
        // Retrieve existing client data from in-memory store or initialize new entry
        let clientData = clientStore.get(clientId);
        
        if (!clientData) {
            // Initialize new client entry with current window start time
            clientData = {
                count: 0,
                windowStart: currentTime,
                lastRequest: currentTime,
                createdAt: currentTime
            };
        }

        // Check if current request falls within existing window or requires reset
        const windowElapsed = currentTime - clientData.windowStart;
        
        if (windowElapsed >= windowMs) {
            // Reset client count and start new window when window duration exceeded
            clientData.count = 0;
            clientData.windowStart = currentTime;
            
            logger.debug('Rate limiting window reset for client', {
                clientId: clientId,
                previousCount: clientData.count,
                windowDuration: windowMs,
                function: 'updateClientCount'
            });
        }

        // Increment request count for current window and update last request timestamp
        clientData.count++;
        clientData.lastRequest = currentTime;

        // Calculate remaining time in current window for reset timestamp calculation
        const windowRemaining = windowMs - (currentTime - clientData.windowStart);
        clientData.windowEnd = clientData.windowStart + windowMs;
        clientData.windowRemaining = windowRemaining;

        // Store updated client data in memory store for future requests
        clientStore.set(clientId, clientData);

        // Log client count update for monitoring and debugging rate limiting behavior
        logger.debug('Client request count updated', {
            clientId: clientId,
            currentCount: clientData.count,
            windowStart: new Date(clientData.windowStart).toISOString(),
            windowEnd: new Date(clientData.windowEnd).toISOString(),
            windowRemaining: windowRemaining,
            function: 'updateClientCount'
        });

        // Return updated client tracking information for rate limit evaluation
        return clientData;

    } catch (error) {
        // Log client count update error and return safe fallback data
        logger.error('Failed to update client count for rate limiting', {
            error: {
                message: error.message,
                stack: error.stack
            },
            clientId: clientId,
            windowMs: windowMs,
            function: 'updateClientCount'
        });

        // Return fallback client data to prevent rate limiting failure
        return {
            count: 1,
            windowStart: Date.now(),
            lastRequest: Date.now(),
            createdAt: Date.now(),
            windowEnd: Date.now() + windowMs,
            windowRemaining: windowMs
        };
    }
}

/**
 * Determines if client has exceeded rate limit based on current request count and configured 
 * maximum requests per window with comprehensive limit evaluation.
 * 
 * @param {Object} clientData - Client tracking data with count and window information
 * @param {number} maxRequests - Maximum requests allowed per window period
 * @returns {boolean} True if client has exceeded rate limit, false if within limits
 */
function isRateLimited(clientData, maxRequests) {
    try {
        // Validate client data object contains required tracking information
        if (!clientData || typeof clientData.count !== 'number') {
            logger.warn('Invalid client data provided for rate limit check', {
                clientData: util.inspect(clientData, { depth: 2 }),
                maxRequests: maxRequests,
                function: 'isRateLimited'
            });
            return false; // Allow request if data is invalid to prevent blocking
        }

        // Compare client request count against maximum allowed requests per window
        const rateLimited = clientData.count > maxRequests;

        // Log rate limit evaluation for security monitoring and debugging
        if (rateLimited) {
            logger.warn('Client rate limit exceeded', {
                currentCount: clientData.count,
                maxRequests: maxRequests,
                windowStart: new Date(clientData.windowStart).toISOString(),
                windowRemaining: clientData.windowRemaining,
                function: 'isRateLimited'
            });
        } else {
            logger.debug('Client within rate limits', {
                currentCount: clientData.count,
                maxRequests: maxRequests,
                remainingRequests: maxRequests - clientData.count,
                function: 'isRateLimited'
            });
        }

        return rateLimited;

    } catch (error) {
        // Log rate limit evaluation error and allow request to prevent blocking
        logger.error('Failed to evaluate rate limit status', {
            error: {
                message: error.message,
                stack: error.stack
            },
            clientData: util.inspect(clientData, { depth: 2 }),
            maxRequests: maxRequests,
            function: 'isRateLimited'
        });

        // Return false (not rate limited) on error to avoid blocking legitimate requests
        return false;
    }
}

/**
 * Generates standard rate limiting HTTP headers to inform clients about current rate limit 
 * status including remaining requests, reset time, and retry recommendations.
 * 
 * @param {Object} clientData - Client tracking information including count and window details
 * @param {number} maxRequests - Maximum requests allowed per window for limit calculations
 * @param {number} windowMs - Rate limiting window duration in milliseconds
 * @returns {Object} HTTP headers object with complete rate limiting information
 */
function generateRateLimitHeaders(clientData, maxRequests, windowMs) {
    try {
        // Calculate remaining requests allowed in current window with bounds checking
        const remaining = Math.max(0, maxRequests - clientData.count);
        
        // Calculate window reset timestamp for X-RateLimit-Reset header
        const resetTimestamp = Math.ceil((clientData.windowStart + windowMs) / 1000);
        
        // Calculate seconds until window reset for Retry-After header
        const retryAfterSeconds = Math.ceil(clientData.windowRemaining / 1000);

        // Generate complete set of rate limiting headers per RFC standards
        const rateLimitHeaders = {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': remaining.toString(), 
            'X-RateLimit-Reset': resetTimestamp.toString(),
            'Retry-After': Math.max(1, retryAfterSeconds).toString()
        };

        // Log rate limiting header generation for monitoring and debugging
        logger.debug('Rate limiting headers generated', {
            limit: maxRequests,
            remaining: remaining,
            resetTimestamp: resetTimestamp,
            retryAfterSeconds: retryAfterSeconds,
            windowStart: new Date(clientData.windowStart).toISOString(),
            windowEnd: new Date(clientData.windowStart + windowMs).toISOString(),
            function: 'generateRateLimitHeaders'
        });

        return rateLimitHeaders;

    } catch (error) {
        // Log header generation error and return minimal headers for client guidance
        logger.error('Failed to generate rate limiting headers', {
            error: {
                message: error.message,
                stack: error.stack
            },
            clientData: util.inspect(clientData, { depth: 2 }),
            maxRequests: maxRequests,
            windowMs: windowMs,
            function: 'generateRateLimitHeaders'
        });

        // Return basic headers as fallback to provide some client guidance
        return {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil((Date.now() + windowMs) / 1000).toString(),
            'Retry-After': Math.ceil(windowMs / 1000).toString()
        };
    }
}

/**
 * Removes expired client entries from in-memory store to prevent memory leaks and maintain 
 * optimal performance through automatic cleanup of stale tracking data.
 * 
 * @param {Map} clientStore - In-memory client tracking store for cleanup operations
 * @param {number} windowMs - Rate limiting window duration for expiration calculations
 * @returns {number} Number of expired client entries removed from store
 */
function cleanupExpiredClients(clientStore, windowMs) {
    try {
        const currentTime = Date.now();
        let cleanedCount = 0;
        const expiredClients = [];

        // Iterate through all client entries to identify expired windows
        for (const [clientId, clientData] of clientStore.entries()) {
            // Calculate time since last client activity for expiration check
            const timeSinceLastRequest = currentTime - clientData.lastRequest;
            
            // Remove client entry if window has expired beyond cleanup threshold
            if (timeSinceLastRequest > (windowMs * 2)) { // Grace period of 2x window duration
                expiredClients.push(clientId);
                cleanedCount++;
            }
        }

        // Remove all identified expired client entries from store
        expiredClients.forEach(clientId => {
            clientStore.delete(clientId);
        });

        // Log cleanup operation results for monitoring and performance analysis
        if (cleanedCount > 0) {
            logger.info('Expired rate limiting clients cleaned up', {
                cleanedCount: cleanedCount,
                remainingClients: clientStore.size,
                cleanupThreshold: windowMs * 2,
                memoryReclaimed: `${cleanedCount * 200}B (estimated)`,
                function: 'cleanupExpiredClients'
            });
        } else {
            logger.debug('No expired clients found during cleanup', {
                totalClients: clientStore.size,
                function: 'cleanupExpiredClients'
            });
        }

        return cleanedCount;

    } catch (error) {
        // Log cleanup error and return 0 to indicate cleanup failure
        logger.error('Failed to cleanup expired rate limiting clients', {
            error: {
                message: error.message,
                stack: error.stack
            },
            clientStoreSize: clientStore.size,
            windowMs: windowMs,
            function: 'cleanupExpiredClients'
        });

        return 0;
    }
}

/**
 * Main rate limiting class that provides comprehensive HTTP request throttling capabilities 
 * with in-memory client tracking, configurable windows, security monitoring, and automatic 
 * cleanup mechanisms for DoS protection and resource management.
 */
class RateLimiter {
    /**
     * Initializes rate limiter with configuration settings, client tracking store, cleanup 
     * mechanisms, and monitoring capabilities for comprehensive request throttling.
     * 
     * @param {Object} config - Rate limiter configuration with windowMs, maxRequests, and security settings
     */
    constructor(config = {}) {
        try {
            // Load and validate rate limiting configuration from parameters and server settings
            this.config = {
                ...DEFAULT_RATE_LIMIT,
                ...serverConfig.security?.rateLimiting,
                ...config
            };

            // Validate configuration parameters for security and stability
            this.windowMs = Math.max(1000, parseInt(this.config.windowMs) || DEFAULT_RATE_LIMIT.windowMs);
            this.maxRequests = Math.max(1, parseInt(this.config.maxRequests) || DEFAULT_RATE_LIMIT.maxRequests);
            this.enabled = this.config.enabled !== false;

            // Initialize in-memory Map for client request tracking with efficient lookups
            this.clientStore = new Map();

            // Set up logger instance for rate limiting event tracking and security monitoring
            this.logger = logger;

            // Initialize rate limiting statistics for monitoring and operational insights
            this.statistics = {
                totalRequests: 0,
                allowedRequests: 0,
                blockedRequests: 0,
                uniqueClients: 0,
                cleanupOperations: 0,
                startTime: Date.now(),
                lastCleanup: Date.now(),
                averageRequestsPerMinute: 0,
                peakRequestsPerMinute: 0,
                currentRequestsPerMinute: 0
            };

            // Configure cleanup interval for expired client entries to prevent memory leaks
            this.cleanupInterval = setInterval(() => {
                const cleanedCount = cleanupExpiredClients(this.clientStore, this.windowMs);
                this.statistics.cleanupOperations++;
                this.statistics.lastCleanup = Date.now();
                this.statistics.uniqueClients = this.clientStore.size;
            }, CLIENT_STORE_CLEANUP_INTERVAL);

            // Initialize request counting for rate calculations and trend analysis
            this.requestCounters = {
                lastMinute: 0,
                currentMinute: Math.floor(Date.now() / 60000),
                minuteHistory: []
            };

            // Log successful rate limiter initialization with configuration details
            this.logger.info('Rate limiter initialized successfully', {
                enabled: this.enabled,
                windowMs: this.windowMs,
                maxRequests: this.maxRequests,
                cleanupInterval: CLIENT_STORE_CLEANUP_INTERVAL,
                memoryStore: 'Map-based in-memory storage',
                features: ['client-tracking', 'automatic-cleanup', 'security-logging', 'statistics'],
                function: 'RateLimiter.constructor'
            });

        } catch (error) {
            // Log initialization error and disable rate limiting for safety
            this.logger.error('Failed to initialize rate limiter', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                config: config,
                function: 'RateLimiter.constructor'
            });

            // Set safe fallback configuration to prevent complete failure
            this.config = { ...DEFAULT_RATE_LIMIT };
            this.enabled = false;
            this.clientStore = new Map();
            this.statistics = {};
            
            throw error;
        }
    }

    /**
     * Main middleware function that processes HTTP requests through rate limiting logic and 
     * applies throttling with HTTP 429 responses, security headers, and comprehensive logging.
     * 
     * @param {Object} req - HTTP request object for client identification and processing
     * @param {Object} res - HTTP response object for rate limit headers and error responses  
     * @param {Function} next - Next middleware function in processing chain for request continuation
     * @returns {Promise<void>} No return value - processes request and calls next middleware or sends error response
     */
    async middleware(req, res, next) {
        try {
            // Check if rate limiting is enabled in configuration before processing
            if (!this.enabled) {
                logger.debug('Rate limiting disabled, allowing request', {
                    url: req.url,
                    method: req.method,
                    function: 'RateLimiter.middleware'
                });
                return next();
            }

            // Update total request statistics for monitoring and trend analysis
            this.statistics.totalRequests++;
            this.updateRequestCounters();

            // Extract client identifier from request headers and connection information
            const clientId = getClientIdentifier(req);

            // Update client request count within current rate limiting window
            const clientData = updateClientCount(this.clientStore, clientId, this.windowMs);

            // Evaluate if client has exceeded configured rate limits for current window
            const rateLimited = isRateLimited(clientData, this.maxRequests);

            // Generate rate limiting headers for all responses (limited or not)
            const rateLimitHeaders = generateRateLimitHeaders(clientData, this.maxRequests, this.windowMs);

            // Apply rate limiting headers to response for client guidance
            Object.entries(rateLimitHeaders).forEach(([headerName, headerValue]) => {
                res.setHeader(headerName, headerValue);
            });

            if (rateLimited) {
                // Update blocked request statistics and log security event
                this.statistics.blockedRequests++;
                
                // Log rate limiting violation for security monitoring and incident response
                this.logger.warn('Rate limit exceeded - request blocked', {
                    clientId: clientId,
                    requestCount: clientData.count,
                    maxRequests: this.maxRequests,
                    windowStart: new Date(clientData.windowStart).toISOString(),
                    windowRemaining: clientData.windowRemaining,
                    url: req.url,
                    method: req.method,
                    userAgent: req.headers?.['user-agent'] || 'unknown',
                    clientIp: req.connection?.remoteAddress || 'unknown',
                    function: 'RateLimiter.middleware'
                });

                // Send HTTP 429 Too Many Requests response with rate limiting information
                return await generateErrorResponse(
                    res, 
                    HTTP_STATUS_TOO_MANY_REQUESTS, 
                    'Too Many Requests - Rate limit exceeded',
                    rateLimitHeaders
                );

            } else {
                // Update allowed request statistics and continue request processing
                this.statistics.allowedRequests++;
                this.statistics.uniqueClients = this.clientStore.size;

                // Log successful rate limiting check for monitoring and debugging
                this.logger.debug('Request allowed through rate limiting', {
                    clientId: clientId,
                    requestCount: clientData.count,
                    maxRequests: this.maxRequests,
                    remainingRequests: this.maxRequests - clientData.count,
                    url: req.url,
                    method: req.method,
                    function: 'RateLimiter.middleware'
                });

                // Call next middleware function to continue request processing pipeline
                return next();
            }

        } catch (error) {
            // Log middleware error and allow request to continue to prevent blocking
            this.logger.error('Rate limiting middleware error', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                url: req.url,
                method: req.method,
                function: 'RateLimiter.middleware'
            });

            // Continue request processing despite rate limiting error to avoid blocking legitimate requests
            return next();
        }
    }

    /**
     * Evaluates rate limit status for specific client and updates tracking data without 
     * sending HTTP response, useful for programmatic rate limit checking and monitoring.
     * 
     * @param {string} clientId - Client identifier for rate limit checking and evaluation
     * @returns {Object} Rate limit status object with exceeded flag, remaining requests, and reset time
     */
    checkRateLimit(clientId) {
        try {
            // Validate client identifier parameter for proper rate limit checking
            if (!clientId || typeof clientId !== 'string') {
                this.logger.warn('Invalid client ID provided for rate limit check', {
                    clientId: clientId,
                    function: 'RateLimiter.checkRateLimit'
                });
                return {
                    exceeded: false,
                    remaining: this.maxRequests,
                    resetTime: Date.now() + this.windowMs,
                    error: 'Invalid client ID'
                };
            }

            // Update client request count and retrieve current tracking data
            const clientData = updateClientCount(this.clientStore, clientId, this.windowMs);

            // Evaluate current count against configured maximum for limit assessment
            const exceeded = isRateLimited(clientData, this.maxRequests);

            // Calculate remaining requests and window reset time for client guidance
            const remaining = Math.max(0, this.maxRequests - clientData.count);
            const resetTime = clientData.windowStart + this.windowMs;

            // Generate comprehensive rate limit status information
            const status = {
                exceeded: exceeded,
                remaining: remaining,
                resetTime: resetTime,
                windowStart: clientData.windowStart,
                currentCount: clientData.count,
                maxRequests: this.maxRequests,
                windowMs: this.windowMs
            };

            // Log rate limit status check for monitoring and debugging purposes
            this.logger.debug('Rate limit status checked', {
                clientId: clientId,
                ...status,
                function: 'RateLimiter.checkRateLimit'
            });

            return status;

        } catch (error) {
            // Log rate limit check error and return safe status information
            this.logger.error('Failed to check rate limit status', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                clientId: clientId,
                function: 'RateLimiter.checkRateLimit'
            });

            // Return safe rate limit status to prevent blocking on error
            return {
                exceeded: false,
                remaining: this.maxRequests,
                resetTime: Date.now() + this.windowMs,
                error: error.message
            };
        }
    }

    /**
     * Resets rate limiting data for specific client, effectively removing all tracking 
     * information and allowing fresh start for rate limiting evaluation.
     * 
     * @param {string} clientId - Client identifier to reset and remove from tracking
     * @returns {boolean} True if client was found and reset, false if client not found
     */
    resetClient(clientId) {
        try {
            // Validate client identifier parameter for safe reset operations
            if (!clientId || typeof clientId !== 'string') {
                this.logger.warn('Invalid client ID provided for reset operation', {
                    clientId: clientId,
                    function: 'RateLimiter.resetClient'
                });
                return false;
            }

            // Check if client entry exists in tracking store before attempting reset
            const clientExists = this.clientStore.has(clientId);

            if (clientExists) {
                // Remove client entry from in-memory store to reset rate limiting
                this.clientStore.delete(clientId);
                this.statistics.uniqueClients = this.clientStore.size;

                // Log client reset event for security monitoring and audit trail
                this.logger.info('Client rate limiting data reset', {
                    clientId: clientId,
                    remainingClients: this.clientStore.size,
                    resetTimestamp: new Date().toISOString(),
                    function: 'RateLimiter.resetClient'
                });

                return true;
            } else {
                // Log attempt to reset non-existent client for monitoring
                this.logger.debug('Attempted to reset non-existent client', {
                    clientId: clientId,
                    totalClients: this.clientStore.size,
                    function: 'RateLimiter.resetClient'
                });

                return false;
            }

        } catch (error) {
            // Log client reset error and return failure status
            this.logger.error('Failed to reset client rate limiting data', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                clientId: clientId,
                function: 'RateLimiter.resetClient'
            });

            return false;
        }
    }

    /**
     * Returns comprehensive statistical information about rate limiting activity including 
     * client counts, blocking events, performance metrics, and system health indicators.
     * 
     * @returns {Object} Statistics object with client count, blocked requests, cleanup events, and performance data
     */
    getStats() {
        try {
            // Calculate runtime metrics and performance indicators
            const currentTime = Date.now();
            const uptimeMs = currentTime - this.statistics.startTime;
            const uptimeSeconds = Math.floor(uptimeMs / 1000);

            // Calculate request rates and blocking percentages for analysis
            const blockingRate = this.statistics.totalRequests > 0 ? 
                ((this.statistics.blockedRequests / this.statistics.totalRequests) * 100) : 0;

            const allowedRate = this.statistics.totalRequests > 0 ? 
                ((this.statistics.allowedRequests / this.statistics.totalRequests) * 100) : 0;

            // Calculate requests per minute average for performance trending
            const requestsPerMinute = uptimeMs > 0 ? 
                ((this.statistics.totalRequests / uptimeMs) * 60000) : 0;

            // Update current requests per minute calculation
            this.updateCurrentRequestsPerMinute();

            // Compile comprehensive statistics object for monitoring and analysis
            const stats = {
                // Core rate limiting metrics
                rateLimiting: {
                    enabled: this.enabled,
                    windowMs: this.windowMs,
                    maxRequests: this.maxRequests,
                    activeClients: this.clientStore.size,
                    uniqueClientsTotal: this.statistics.uniqueClients
                },

                // Request processing statistics
                requests: {
                    total: this.statistics.totalRequests,
                    allowed: this.statistics.allowedRequests,
                    blocked: this.statistics.blockedRequests,
                    blockingRate: Math.round(blockingRate * 100) / 100,
                    allowedRate: Math.round(allowedRate * 100) / 100
                },

                // Performance and rate metrics
                performance: {
                    uptime: uptimeSeconds,
                    uptimeFormatted: this.formatUptime(uptimeSeconds),
                    requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
                    currentRequestsPerMinute: this.statistics.currentRequestsPerMinute,
                    peakRequestsPerMinute: this.statistics.peakRequestsPerMinute,
                    averageRequestsPerMinute: this.statistics.averageRequestsPerMinute
                },

                // Memory and maintenance statistics  
                maintenance: {
                    cleanupOperations: this.statistics.cleanupOperations,
                    lastCleanup: new Date(this.statistics.lastCleanup).toISOString(),
                    memoryUsage: this.estimateMemoryUsage(),
                    storeSize: this.clientStore.size
                },

                // System health indicators
                health: {
                    status: this.getHealthStatus(),
                    memoryPressure: this.clientStore.size > 10000,
                    highBlockingRate: blockingRate > 10,
                    functioning: this.enabled && this.clientStore instanceof Map
                },

                // Configuration summary
                configuration: {
                    cleanupInterval: CLIENT_STORE_CLEANUP_INTERVAL,
                    defaultWindowMs: DEFAULT_RATE_LIMIT.windowMs,
                    defaultMaxRequests: DEFAULT_RATE_LIMIT.maxRequests,
                    httpStatusCode: HTTP_STATUS_TOO_MANY_REQUESTS
                },

                // Timestamp information
                timestamps: {
                    generated: new Date().toISOString(),
                    startTime: new Date(this.statistics.startTime).toISOString(),
                    lastCleanup: new Date(this.statistics.lastCleanup).toISOString()
                }
            };

            // Log statistics compilation for monitoring and debugging
            this.logger.debug('Rate limiting statistics compiled', {
                totalRequests: stats.requests.total,
                activeClients: stats.rateLimiting.activeClients,
                blockingRate: stats.requests.blockingRate,
                uptime: stats.performance.uptime,
                function: 'RateLimiter.getStats'
            });

            return stats;

        } catch (error) {
            // Log statistics compilation error and return error status
            this.logger.error('Failed to compile rate limiting statistics', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                function: 'RateLimiter.getStats'
            });

            // Return basic statistics with error indication
            return {
                error: true,
                errorMessage: error.message,
                rateLimiting: { enabled: this.enabled },
                requests: { total: this.statistics.totalRequests || 0 },
                performance: { uptime: 0 },
                timestamps: { generated: new Date().toISOString() }
            };
        }
    }

    /**
     * Performs manual cleanup of expired client entries and releases associated memory 
     * resources, useful for immediate memory pressure relief and maintenance operations.
     * 
     * @returns {number} Number of client entries removed during cleanup operation
     */
    cleanup() {
        try {
            // Execute expired client cleanup operation with current window settings
            const cleanedCount = cleanupExpiredClients(this.clientStore, this.windowMs);

            // Update cleanup statistics and tracking information
            this.statistics.cleanupOperations++;
            this.statistics.lastCleanup = Date.now();
            this.statistics.uniqueClients = this.clientStore.size;

            // Log manual cleanup operation results for monitoring and maintenance tracking
            this.logger.info('Manual rate limiter cleanup performed', {
                cleanedEntries: cleanedCount,
                remainingClients: this.clientStore.size,
                memoryReclaimed: `${cleanedCount * 200}B (estimated)`,
                totalCleanups: this.statistics.cleanupOperations,
                function: 'RateLimiter.cleanup'
            });

            return cleanedCount;

        } catch (error) {
            // Log cleanup error and return 0 to indicate cleanup failure
            this.logger.error('Manual rate limiter cleanup failed', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                clientStoreSize: this.clientStore.size,
                function: 'RateLimiter.cleanup'
            });

            return 0;
        }
    }

    /**
     * Shuts down rate limiter by clearing all client data, stopping cleanup intervals, 
     * and releasing system resources for graceful application termination.
     * 
     * @returns {void} No return value - performs cleanup and shutdown operations
     */
    destroy() {
        try {
            // Stop periodic cleanup interval timer to prevent further cleanup operations
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            // Record final statistics before shutdown for operational records
            const finalStats = {
                totalRequests: this.statistics.totalRequests,
                blockedRequests: this.statistics.blockedRequests,
                activeClients: this.clientStore.size,
                uptime: Date.now() - this.statistics.startTime,
                cleanupOperations: this.statistics.cleanupOperations
            };

            // Clear all client entries from memory store for complete resource cleanup
            this.clientStore.clear();

            // Reset internal statistics and counters to clean state
            this.statistics = {
                ...this.statistics,
                uniqueClients: 0,
                destroyed: true,
                destroyedAt: Date.now()
            };

            // Log rate limiter shutdown event with final operational statistics
            this.logger.info('Rate limiter destroyed and resources released', {
                finalStats: finalStats,
                destroyedAt: new Date().toISOString(),
                resourcesReleased: ['client-store', 'cleanup-interval', 'statistics'],
                function: 'RateLimiter.destroy'
            });

        } catch (error) {
            // Log destruction error for debugging and system monitoring
            this.logger.error('Error occurred during rate limiter destruction', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                function: 'RateLimiter.destroy'
            });
        }
    }

    // Private helper methods for internal functionality and utility operations

    /**
     * Updates request counters for rate calculations and trend analysis
     * @private
     */
    updateRequestCounters() {
        const currentMinute = Math.floor(Date.now() / 60000);
        
        if (currentMinute !== this.requestCounters.currentMinute) {
            // Store the count for the completed minute
            this.requestCounters.minuteHistory.push(this.requestCounters.lastMinute);
            
            // Keep only last 60 minutes of history
            if (this.requestCounters.minuteHistory.length > 60) {
                this.requestCounters.minuteHistory.shift();
            }
            
            // Reset for new minute
            this.requestCounters.currentMinute = currentMinute;
            this.requestCounters.lastMinute = 1;
        } else {
            this.requestCounters.lastMinute++;
        }
    }

    /**
     * Updates current requests per minute calculation
     * @private
     */
    updateCurrentRequestsPerMinute() {
        this.statistics.currentRequestsPerMinute = this.requestCounters.lastMinute;
        
        if (this.statistics.currentRequestsPerMinute > this.statistics.peakRequestsPerMinute) {
            this.statistics.peakRequestsPerMinute = this.statistics.currentRequestsPerMinute;
        }
        
        if (this.requestCounters.minuteHistory.length > 0) {
            const total = this.requestCounters.minuteHistory.reduce((a, b) => a + b, 0);
            this.statistics.averageRequestsPerMinute = total / this.requestCounters.minuteHistory.length;
        }
    }

    /**
     * Estimates memory usage of the rate limiter
     * @private
     * @returns {Object} Memory usage estimation
     */
    estimateMemoryUsage() {
        const clientCount = this.clientStore.size;
        const estimatedBytesPerClient = 200; // Rough estimate for client data structure
        
        return {
            clientStore: `${(clientCount * estimatedBytesPerClient / 1024).toFixed(2)}KB`,
            clientCount: clientCount,
            estimatedBytesPerClient: estimatedBytesPerClient
        };
    }

    /**
     * Gets health status of the rate limiter
     * @private
     * @returns {string} Health status description
     */
    getHealthStatus() {
        if (!this.enabled) return 'disabled';
        if (this.clientStore.size > 50000) return 'memory-pressure';
        if (this.statistics.blockingRate > 50) return 'high-blocking';
        return 'healthy';
    }

    /**
     * Formats uptime seconds into human-readable string
     * @private
     * @param {number} seconds - Uptime in seconds
     * @returns {string} Formatted uptime string
     */
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

/**
 * Factory function that creates and configures a rate limiter instance with specified 
 * window duration, request limits, and client tracking capabilities for HTTP middleware integration.
 * 
 * @param {Object} options - Rate limiter configuration including windowMs, maxRequests, enabled status, and custom settings
 * @returns {Function} Middleware function that can be used in HTTP request processing pipeline
 */
function createRateLimiter(options = {}) {
    try {
        // Load rate limiting configuration from options and server configuration
        const rateLimiterConfig = {
            ...DEFAULT_RATE_LIMIT,
            ...serverConfig.security?.rateLimiting,
            ...options
        };

        // Initialize in-memory client store for tracking request counts and windows
        const clientStore = new Map();

        // Set up cleanup interval for expired client entries to prevent memory leaks
        const cleanupInterval = setInterval(() => {
            cleanupExpiredClients(clientStore, rateLimiterConfig.windowMs);
        }, CLIENT_STORE_CLEANUP_INTERVAL);

        // Configure request counting algorithm with sliding window implementation
        const rateLimiter = {
            config: rateLimiterConfig,
            clientStore: clientStore,
            cleanupInterval: cleanupInterval,
            statistics: {
                totalRequests: 0,
                blockedRequests: 0,
                allowedRequests: 0,
                startTime: Date.now()
            }
        };

        // Return configured middleware function for integration with HTTP server
        const middleware = async (req, res, next) => {
            try {
                // Check if rate limiting is enabled before processing requests
                if (!rateLimiterConfig.enabled) {
                    return next();
                }

                // Update total request statistics for monitoring
                rateLimiter.statistics.totalRequests++;

                // Extract client identifier from request for rate limiting tracking
                const clientId = getClientIdentifier(req);

                // Update client request count within current rate limiting window
                const clientData = updateClientCount(clientStore, clientId, rateLimiterConfig.windowMs);

                // Evaluate if client has exceeded configured rate limits
                const rateLimited = isRateLimited(clientData, rateLimiterConfig.maxRequests);

                // Generate rate limiting headers for client guidance
                const rateLimitHeaders = generateRateLimitHeaders(
                    clientData, 
                    rateLimiterConfig.maxRequests, 
                    rateLimiterConfig.windowMs
                );

                // Apply rate limiting headers to response
                Object.entries(rateLimitHeaders).forEach(([headerName, headerValue]) => {
                    res.setHeader(headerName, headerValue);
                });

                if (rateLimited) {
                    // Update blocked request statistics and log security event
                    rateLimiter.statistics.blockedRequests++;
                    
                    logger.warn('Rate limit exceeded by factory rate limiter', {
                        clientId: clientId,
                        requestCount: clientData.count,
                        maxRequests: rateLimiterConfig.maxRequests,
                        function: 'createRateLimiter.middleware'
                    });

                    // Send HTTP 429 Too Many Requests response with appropriate headers
                    return await generateErrorResponse(
                        res, 
                        HTTP_STATUS_TOO_MANY_REQUESTS, 
                        'Too Many Requests',
                        rateLimitHeaders
                    );

                } else {
                    // Update allowed request statistics and continue processing
                    rateLimiter.statistics.allowedRequests++;
                    return next();
                }

            } catch (error) {
                // Log middleware error and continue request processing
                logger.error('Factory rate limiter middleware error', {
                    error: error.message,
                    function: 'createRateLimiter.middleware'
                });
                return next();
            }
        };

        // Attach cleanup method to middleware for resource management
        middleware.cleanup = () => {
            if (cleanupInterval) {
                clearInterval(cleanupInterval);
            }
            clientStore.clear();
        };

        // Attach statistics method to middleware for monitoring
        middleware.getStats = () => ({
            ...rateLimiter.statistics,
            activeClients: clientStore.size,
            config: rateLimiterConfig
        });

        // Initialize logging for rate limiting events and security monitoring
        logger.info('Rate limiter factory created middleware function', {
            enabled: rateLimiterConfig.enabled,
            windowMs: rateLimiterConfig.windowMs,
            maxRequests: rateLimiterConfig.maxRequests,
            function: 'createRateLimiter'
        });

        return middleware;

    } catch (error) {
        // Log factory creation error and return pass-through middleware
        logger.error('Failed to create rate limiter via factory', {
            error: {
                message: error.message,
                stack: error.stack
            },
            options: options,
            function: 'createRateLimiter'
        });

        // Return pass-through middleware that doesn't block requests on error
        return (req, res, next) => next();
    }
}

// Create default rate limiter instance configured with server configuration settings
const rateLimiter = new RateLimiter({
    enabled: serverConfig.security?.rateLimiting?.enabled || false,
    windowMs: serverConfig.security?.rateLimiting?.windowMs || DEFAULT_RATE_LIMIT.windowMs,
    maxRequests: serverConfig.security?.rateLimiting?.maxRequests || DEFAULT_RATE_LIMIT.maxRequests
});

// Export RateLimiter class for creating rate limiting instances with comprehensive throttling capabilities
module.exports = {
    RateLimiter,
    createRateLimiter,
    rateLimiter,
    getClientIdentifier,
    updateClientCount,
    isRateLimited,
    generateRateLimitHeaders,
    cleanupExpiredClients,
    DEFAULT_RATE_LIMIT,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    RATE_LIMIT_HEADERS,
    CLIENT_STORE_CLEANUP_INTERVAL
};