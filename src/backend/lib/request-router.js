/**
 * Node.js Tutorial HTTP Server - Request Router Component
 * 
 * Comprehensive request routing component that analyzes incoming HTTP requests, performs URL path 
 * matching, validates HTTP methods, and routes requests to appropriate handlers for the Node.js 
 * tutorial HTTP server application. Implements exact path matching for the `/hello` endpoint with 
 * comprehensive error handling, security validation, and educational demonstration of fundamental 
 * Node.js routing concepts.
 * 
 * This component demonstrates enterprise-grade routing patterns including request validation,
 * path sanitization, method validation, handler delegation, performance monitoring, and 
 * correlation tracking while maintaining zero external dependencies and educational clarity.
 * 
 * Educational Features:
 * - Comprehensive HTTP request analysis and routing decision tree implementation
 * - Security-focused input validation and path sanitization for attack prevention
 * - Performance monitoring integration with timing measurement and statistics tracking
 * - Correlation tracking and structured logging for request debugging and monitoring
 * - Integration patterns with handlers, error processors, and response generators
 * 
 * Dependencies: Node.js built-in modules only (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import Node.js built-in URL module for parsing request URLs and extracting path information
import { URL } from 'node:url'; // Node.js built-in

// Import Node.js built-in utility module for request object inspection and debugging information
import util from 'node:util'; // Node.js built-in

// Import Node.js built-in performance API for measuring request routing timing and performance monitoring
import { performance } from 'node:perf_hooks'; // Node.js built-in

// Import hello endpoint handler function and class for processing GET requests to /hello path
import { handleHello, HelloHandler } from './hello-handler.js';

// Import HTTP error handlers for unknown paths, unsupported methods, and internal server errors
import { 
    handleNotFound, 
    handleMethodNotAllowed, 
    handleInternalError 
} from './error-handler.js';

// Import centralized logging functionality for request routing events, performance tracking, and correlation management
import { logger } from './logger.js';

// Import environment configuration for routing behavior customization and debug settings
import { config } from '../config/environment.js';

// Import server routing configuration including supported methods and security settings
import { serverConfig } from '../config/server-config.js';

// Global supported HTTP methods for request method validation and security filtering
const SUPPORTED_HTTP_METHODS = { 
    GET: 'GET' 
};

// Global route definitions for URL path matching and handler delegation
const ROUTE_DEFINITIONS = { 
    HELLO: '/hello', 
    HEALTH: '/health' 
};

// Global error types for error classification and handling strategy determination
const ERROR_TYPES = { 
    NOT_FOUND: 'not_found', 
    METHOD_NOT_ALLOWED: 'method_not_allowed', 
    INTERNAL_ERROR: 'internal_error' 
};

// Global routing statistics for performance monitoring and operational visibility
const ROUTING_STATS = { 
    requestCount: 0, 
    routingTime: 0, 
    errorCount: 0 
};

/**
 * Main routing function that analyzes HTTP requests, validates methods and paths, and delegates 
 * to appropriate handlers with comprehensive error handling and logging
 * @param {object} req - HTTP IncomingMessage object containing request method, URL, headers, and client information
 * @param {object} res - HTTP ServerResponse object for generating responses through handler delegation
 * @param {object} options - Optional routing configuration including correlation ID and context information
 * @returns {Promise<void>} Promise that resolves when request routing and handler delegation is complete
 */
export async function route(req, res, options = {}) {
    // Start routing performance timer using Node.js performance API
    const startTime = performance.now();
    
    try {
        // Extract or generate correlation ID for request tracking across components
        const correlationId = options.correlationId || 
            req.headers['x-correlation-id'] || 
            generateCorrelationId();
        
        // Set request context in logger for correlation-aware logging throughout processing
        logger.setRequestContext(correlationId, {
            method: req.method,
            url: req.url,
            headers: req.headers,
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            timestamp: new Date().toISOString()
        });
        
        // Log incoming request with method, path, and client information
        logger.info('Incoming request received for routing', {
            method: req.method,
            url: req.url,
            correlationId,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress
        });
        
        // Validate HTTP request method against supported methods configuration
        const methodValidation = validateHttpMethod(req.method);
        if (!methodValidation.isValid) {
            logger.warn('Request method validation failed', {
                method: req.method,
                allowedMethods: methodValidation.allowedMethods,
                correlationId
            });
            
            // Update error statistics and delegate to method not allowed handler
            ROUTING_STATS.errorCount++;
            await handleMethodNotAllowed(req, res, methodValidation.allowedMethods);
            return;
        }
        
        // Parse request URL and extract pathname using Node.js URL module
        let parsedUrl;
        try {
            parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        } catch (urlError) {
            logger.error('Failed to parse request URL', {
                url: req.url,
                error: urlError.message,
                correlationId
            });
            
            ROUTING_STATS.errorCount++;
            await handleInternalError(urlError, req, res);
            return;
        }
        
        // Normalize URL path by removing query parameters and fragments
        const rawPathname = parsedUrl.pathname;
        
        // Sanitize URL path to prevent directory traversal and injection attacks
        const sanitizedPath = sanitizePath(rawPathname);
        
        logger.debug('URL path processed for routing', {
            rawPath: rawPathname,
            sanitizedPath,
            correlationId
        });
        
        // Execute path matching algorithm against defined route patterns
        const routeMatch = matchRoute(sanitizedPath);
        
        if (routeMatch.matched) {
            logger.info('Route match found', {
                path: sanitizedPath,
                handler: routeMatch.handler,
                correlationId
            });
            
            // Delegate to appropriate handler based on routing result
            switch (routeMatch.handler) {
                case 'handleHello':
                    await handleHello(req, res);
                    break;
                default:
                    logger.warn('Unknown handler specified in route match', {
                        handler: routeMatch.handler,
                        correlationId
                    });
                    ROUTING_STATS.errorCount++;
                    await handleNotFound(req, res);
                    break;
            }
        } else {
            logger.info('No route match found - delegating to 404 handler', {
                path: sanitizedPath,
                correlationId
            });
            
            // Handle routing errors with appropriate error handlers
            ROUTING_STATS.errorCount++;
            await handleNotFound(req, res);
        }
        
        // Measure routing performance and update routing statistics
        const processingTime = performance.now() - startTime;
        ROUTING_STATS.requestCount++;
        ROUTING_STATS.routingTime += processingTime;
        
        // Log routing completion with handler selection and timing information
        logger.info('Request routing completed successfully', {
            correlationId,
            path: sanitizedPath,
            processingTime: `${processingTime.toFixed(2)}ms`,
            handler: routeMatch.matched ? routeMatch.handler : 'notFoundHandler'
        });
        
    } catch (error) {
        const processingTime = performance.now() - startTime;
        
        logger.error('Unhandled error during request routing', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            processingTime: `${processingTime.toFixed(2)}ms`
        });
        
        ROUTING_STATS.errorCount++;
        
        // Handle routing errors and exceptions with error handler integration
        await handleInternalError(error, req, res);
        
    } finally {
        // Clean up request context to prevent memory leaks
        const correlationId = req.headers['x-correlation-id'] || 
            options.correlationId || 
            generateCorrelationId();
        logger.clearRequestContext(correlationId);
    }
}

/**
 * Comprehensive request validation and routing function that performs security checks, method 
 * validation, and path analysis before handler delegation
 * @param {object} req - HTTP request object to validate and route
 * @param {object} res - HTTP response object for error responses if validation fails
 * @returns {Promise<object>} Promise resolving to routing result with handler, validation status, and context information
 */
export async function validateAndRoute(req, res) {
    const startTime = performance.now();
    
    try {
        // Perform comprehensive request validation including headers and content
        if (!req || typeof req !== 'object') {
            throw new Error('Invalid request object provided');
        }
        
        if (!res || typeof res !== 'object') {
            throw new Error('Invalid response object provided');
        }
        
        // Generate correlation ID for validation tracking
        const correlationId = generateCorrelationId();
        
        logger.debug('Starting comprehensive request validation', {
            method: req.method,
            url: req.url,
            correlationId
        });
        
        // Check HTTP method against whitelist of supported methods (GET only)
        const methodValidation = validateHttpMethod(req.method);
        if (!methodValidation.isValid) {
            logger.warn('Method validation failed in validateAndRoute', {
                method: req.method,
                allowedMethods: methodValidation.allowedMethods,
                correlationId
            });
            
            await handleMethodNotAllowed(req, res, methodValidation.allowedMethods);
            
            return {
                success: false,
                error: 'METHOD_NOT_ALLOWED',
                handler: null,
                correlationId,
                processingTime: performance.now() - startTime
            };
        }
        
        // Validate URL format and check for potential security issues
        let parsedUrl;
        try {
            parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        } catch (urlError) {
            logger.error('URL validation failed in validateAndRoute', {
                url: req.url,
                error: urlError.message,
                correlationId
            });
            
            await handleInternalError(urlError, req, res);
            
            return {
                success: false,
                error: 'INVALID_URL',
                handler: null,
                correlationId,
                processingTime: performance.now() - startTime
            };
        }
        
        // Sanitize URL path to prevent directory traversal and injection attacks
        const sanitizedPath = sanitizePath(parsedUrl.pathname);
        
        // Execute exact string matching for defined route patterns
        const routeMatch = matchRoute(sanitizedPath);
        
        if (routeMatch.matched) {
            logger.debug('Request validation and routing successful', {
                path: sanitizedPath,
                handler: routeMatch.handler,
                correlationId
            });
            
            return {
                success: true,
                handler: routeMatch.handler,
                path: sanitizedPath,
                correlationId,
                processingTime: performance.now() - startTime,
                routeMatch
            };
        } else {
            logger.debug('Request validation successful but no route match', {
                path: sanitizedPath,
                correlationId
            });
            
            return {
                success: false,
                error: 'ROUTE_NOT_FOUND',
                handler: null,
                path: sanitizedPath,
                correlationId,
                processingTime: performance.now() - startTime
            };
        }
        
    } catch (error) {
        const processingTime = performance.now() - startTime;
        
        logger.error('Error during request validation and routing', {
            error: error.message,
            stack: error.stack,
            processingTime: `${processingTime.toFixed(2)}ms`
        });
        
        try {
            await handleInternalError(error, req, res);
        } catch (handlingError) {
            logger.error('Failed to handle validation error', {
                originalError: error.message,
                handlingError: handlingError.message
            });
        }
        
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            handler: null,
            correlationId: generateCorrelationId(),
            processingTime
        };
    }
}

/**
 * Route matching algorithm that performs exact string comparison for URL paths against defined 
 * route patterns with case-sensitive matching
 * @param {string} pathname - Normalized URL pathname to match against route definitions
 * @returns {object} Route match result with handler reference, route parameters, and matching metadata
 */
export function matchRoute(pathname) {
    try {
        // Normalize pathname by trimming whitespace and ensuring leading slash
        const normalizedPath = pathname ? pathname.trim() : '';
        
        if (!normalizedPath || normalizedPath === '') {
            logger.debug('Empty pathname provided to matchRoute');
            return {
                matched: false,
                handler: null,
                path: normalizedPath,
                metadata: { reason: 'empty_path' }
            };
        }
        
        // Ensure path starts with forward slash for consistency
        const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
        
        logger.debug('Attempting route matching', {
            originalPath: pathname,
            normalizedPath: cleanPath,
            availableRoutes: Object.keys(ROUTE_DEFINITIONS)
        });
        
        // Perform exact string comparison against '/hello' route pattern
        if (cleanPath === ROUTE_DEFINITIONS.HELLO) {
            logger.debug('Route match successful for hello endpoint', {
                path: cleanPath,
                handler: 'handleHello'
            });
            
            return {
                matched: true,
                handler: 'handleHello',
                path: cleanPath,
                routePattern: ROUTE_DEFINITIONS.HELLO,
                metadata: {
                    matchType: 'exact',
                    routeKey: 'HELLO',
                    supportedMethods: ['GET']
                }
            };
        }
        
        // Check for health endpoint route if health monitoring is enabled
        if (cleanPath === ROUTE_DEFINITIONS.HEALTH) {
            logger.debug('Route match found for health endpoint (not implemented)', {
                path: cleanPath
            });
            
            // Health endpoint not implemented in tutorial - return no match
            return {
                matched: false,
                handler: null,
                path: cleanPath,
                metadata: { 
                    reason: 'health_endpoint_not_implemented',
                    note: 'Health endpoint defined but not implemented in tutorial scope'
                }
            };
        }
        
        // Return no-match result for unknown paths with path information
        logger.debug('No route match found', {
            path: cleanPath,
            checkedRoutes: Object.values(ROUTE_DEFINITIONS)
        });
        
        return {
            matched: false,
            handler: null,
            path: cleanPath,
            metadata: { 
                reason: 'no_matching_route',
                availableRoutes: Object.values(ROUTE_DEFINITIONS)
            }
        };
        
    } catch (error) {
        logger.error('Error during route matching', {
            error: error.message,
            pathname,
            stack: error.stack
        });
        
        return {
            matched: false,
            handler: null,
            path: pathname,
            metadata: { 
                reason: 'match_error',
                error: error.message 
            }
        };
    }
}

/**
 * Validates HTTP request method against supported methods whitelist with security filtering and logging
 * @param {string} method - HTTP method from request object (GET, POST, etc.)
 * @returns {object} Method validation result with isValid boolean and allowed methods list
 */
export function validateHttpMethod(method) {
    try {
        // Check if HTTP method is present and properly formatted
        if (!method || typeof method !== 'string') {
            logger.warn('Invalid or missing HTTP method in request', {
                providedMethod: method,
                methodType: typeof method
            });
            
            return {
                isValid: false,
                method: null,
                allowedMethods: Object.values(SUPPORTED_HTTP_METHODS),
                reason: 'missing_or_invalid_method'
            };
        }
        
        // Normalize method to uppercase for consistent comparison
        const normalizedMethod = method.toUpperCase().trim();
        
        // Compare method against SUPPORTED_HTTP_METHODS configuration
        const isMethodSupported = Object.values(SUPPORTED_HTTP_METHODS).includes(normalizedMethod);
        
        if (isMethodSupported) {
            logger.debug('HTTP method validation successful', {
                method: normalizedMethod,
                isValid: true
            });
            
            // Return validation success for GET method requests
            return {
                isValid: true,
                method: normalizedMethod,
                allowedMethods: Object.values(SUPPORTED_HTTP_METHODS),
                reason: 'method_allowed'
            };
        } else {
            logger.warn('HTTP method not supported', {
                method: normalizedMethod,
                supportedMethods: Object.values(SUPPORTED_HTTP_METHODS)
            });
            
            // Return validation failure with allowed methods list for unsupported methods
            return {
                isValid: false,
                method: normalizedMethod,
                allowedMethods: Object.values(SUPPORTED_HTTP_METHODS),
                reason: 'method_not_supported'
            };
        }
        
    } catch (error) {
        logger.error('Error during HTTP method validation', {
            error: error.message,
            method,
            stack: error.stack
        });
        
        // Log method validation attempts for security monitoring
        return {
            isValid: false,
            method: null,
            allowedMethods: Object.values(SUPPORTED_HTTP_METHODS),
            reason: 'validation_error',
            error: error.message
        };
    }
}

/**
 * Sanitizes URL paths to prevent directory traversal attacks and normalize path format for secure routing
 * @param {string} pathname - Raw URL pathname from request to sanitize
 * @returns {string} Sanitized pathname safe for routing and handler delegation
 */
export function sanitizePath(pathname) {
    try {
        // Handle null, undefined, or non-string inputs
        if (!pathname || typeof pathname !== 'string') {
            logger.debug('Invalid pathname provided to sanitizePath', {
                pathname,
                type: typeof pathname
            });
            return '/';
        }
        
        // Start with the original pathname
        let sanitized = pathname.trim();
        
        // Remove potential directory traversal sequences like '../' and '..\' 
        sanitized = sanitized.replace(/\.\.[\\/]/g, '');
        sanitized = sanitized.replace(/\.\.$/g, '');
        
        // Normalize path separators to forward slashes for consistency
        sanitized = sanitized.replace(/\\/g, '/');
        
        // Remove multiple consecutive slashes and trailing slashes
        sanitized = sanitized.replace(/\/+/g, '/');
        sanitized = sanitized.replace(/\/+$/, '');
        
        // Ensure path starts with single forward slash
        if (!sanitized.startsWith('/')) {
            sanitized = '/' + sanitized;
        }
        
        // Handle root path case
        if (sanitized === '') {
            sanitized = '/';
        }
        
        // Validate path length and character set for security compliance
        if (sanitized.length > 2048) {
            logger.warn('URL path exceeds maximum length, truncating', {
                originalLength: sanitized.length,
                maxLength: 2048
            });
            sanitized = sanitized.substring(0, 2048);
        }
        
        // Check for suspicious characters that could indicate attacks
        const suspiciousPatterns = [
            /[<>]/,      // HTML injection characters
            /['"]/,      // Quote characters that could indicate injection
            /[;]/,       // Command injection separator
            /[\x00-\x1f\x7f]/ // Control characters
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(sanitized)) {
                logger.warn('Suspicious characters detected in URL path', {
                    originalPath: pathname,
                    pattern: pattern.toString()
                });
                // Remove suspicious characters
                sanitized = sanitized.replace(pattern, '');
            }
        }
        
        logger.debug('Path sanitization completed', {
            original: pathname,
            sanitized: sanitized,
            changed: pathname !== sanitized
        });
        
        return sanitized;
        
    } catch (error) {
        logger.error('Error during path sanitization', {
            error: error.message,
            pathname,
            stack: error.stack
        });
        
        // Return safe default path on sanitization errors
        return '/';
    }
}

/**
 * Generates unique correlation ID for request tracking using timestamp and random components 
 * for distributed tracing
 * @returns {string} Unique correlation ID for request tracking across components
 */
export function generateCorrelationId() {
    try {
        // Generate high-resolution timestamp component using performance API
        const timestamp = performance.now().toString(36);
        
        // Create random component using Math.random for uniqueness
        const random = Math.random().toString(36).substring(2, 8);
        
        // Get process ID for multi-process environments
        const pid = process.pid.toString(36);
        
        // Combine components with standard prefix 'req-' for identification
        const correlationId = `req-${timestamp}-${random}-${pid}`;
        
        logger.debug('Generated correlation ID', {
            correlationId,
            components: {
                timestamp: timestamp,
                random: random,
                pid: pid
            }
        });
        
        // Return formatted correlation ID suitable for logging and tracking
        return correlationId;
        
    } catch (error) {
        logger.error('Failed to generate correlation ID', {
            error: error.message,
            stack: error.stack
        });
        
        // Fallback correlation ID using simple timestamp
        const fallbackId = `req-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        logger.warn('Using fallback correlation ID', { correlationId: fallbackId });
        
        return fallbackId;
    }
}

/**
 * Specialized logging function for routing events with structured information including timing, 
 * handler selection, and correlation data
 * @param {string} event - Routing event type (start, match, error, complete)
 * @param {object} context - Routing context with request, handler, timing, and correlation information
 * @returns {void} No return value - logs routing event information
 */
export function logRouting(event, context) {
    try {
        // Validate event type parameter
        if (!event || typeof event !== 'string') {
            logger.warn('Invalid event type provided to logRouting', {
                event,
                eventType: typeof event
            });
            return;
        }
        
        // Validate context object
        if (!context || typeof context !== 'object') {
            logger.warn('Invalid context provided to logRouting', {
                context,
                contextType: typeof context
            });
            return;
        }
        
        // Format routing event with timestamp and correlation ID
        const timestamp = new Date().toISOString();
        const correlationId = context.correlationId || generateCorrelationId();
        
        // Include request details (method, path) and routing results
        const logData = {
            event,
            timestamp,
            correlationId,
            request: {
                method: context.req?.method || 'unknown',
                url: context.req?.url || 'unknown',
                userAgent: context.req?.headers?.['user-agent'] || 'unknown'
            },
            routing: {
                handler: context.handler || null,
                matched: context.matched || false,
                path: context.path || null
            }
        };
        
        // Add performance timing information for routing operations
        if (context.startTime) {
            const processingTime = performance.now() - context.startTime;
            logData.performance = {
                processingTime: `${processingTime.toFixed(2)}ms`,
                startTime: context.startTime
            };
        }
        
        // Add error information if present
        if (context.error) {
            logData.error = {
                message: context.error.message || 'Unknown error',
                name: context.error.name || 'Error',
                stack: config.isDevelopment ? context.error.stack : undefined
            };
        }
        
        // Log event using appropriate level based on event type and outcome
        switch (event) {
            case 'start':
                logger.info('Routing started', logData);
                break;
            case 'match':
                logger.info('Route matched', logData);
                break;
            case 'error':
                logger.error('Routing error', logData);
                break;
            case 'complete':
                logger.info('Routing completed', logData);
                break;
            default:
                logger.debug('Routing event', logData);
                break;
        }
        
        // Update routing statistics counters for monitoring integration
        if (event === 'complete') {
            ROUTING_STATS.requestCount++;
            if (context.error) {
                ROUTING_STATS.errorCount++;
            }
        }
        
    } catch (error) {
        // Fallback logging for logging failures
        console.error('Failed to log routing event:', {
            event,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Comprehensive request router class that encapsulates HTTP request analysis, method validation, 
 * path matching, handler delegation, and routing statistics with full logging integration and 
 * error handling for the Node.js tutorial application
 */
export class RequestRouter {
    /**
     * Initializes request router with configuration, route definitions, handler registration, 
     * logging setup, and statistics tracking
     * @param {object} options - Configuration options including routes, handlers, security settings, and monitoring
     */
    constructor(options = {}) {
        try {
            // Load router configuration from server config and environment settings
            this.config = {
                environment: config.environment,
                isDevelopment: config.isDevelopment,
                isProduction: config.isProduction,
                ...serverConfig.routing,
                ...options
            };
            
            // Initialize logger instance for routing event tracking and correlation
            this.logger = logger;
            
            // Create route map and register route patterns with corresponding handlers
            this.routeMap = new Map();
            this.routeMap.set(ROUTE_DEFINITIONS.HELLO, {
                handler: 'handleHello',
                methods: ['GET'],
                description: 'Primary tutorial endpoint that returns Hello world response',
                responseType: 'text/plain'
            });
            
            // Set up supported HTTP methods from configuration (GET only for tutorial)
            this.supportedMethods = new Set(Object.values(SUPPORTED_HTTP_METHODS));
            
            // Initialize routing statistics collection for performance monitoring
            this.routingStats = {
                requestCount: 0,
                successCount: 0,
                errorCount: 0,
                routingTime: 0,
                averageRoutingTime: 0,
                errorsByType: {},
                methodCounts: {},
                pathCounts: {},
                handlerCounts: {},
                startTime: Date.now()
            };
            
            // Configure security settings for path sanitization and validation
            this.securityConfig = {
                maxPathLength: 2048,
                allowedMethods: Array.from(this.supportedMethods),
                sanitizePaths: true,
                validateMethods: true,
                logSecurityEvents: config.isDevelopment || config.isProduction
            };
            
            // Set up error handling integration for routing failures and validation errors
            this.errorHandlers = {
                notFound: handleNotFound,
                methodNotAllowed: handleMethodNotAllowed,
                internalError: handleInternalError
            };
            
            this.logger.info('RequestRouter instance initialized successfully', {
                environment: this.config.environment,
                routeCount: this.routeMap.size,
                supportedMethods: Array.from(this.supportedMethods),
                securityEnabled: this.securityConfig.sanitizePaths
            });
            
        } catch (error) {
            logger.error('Failed to initialize RequestRouter', {
                error: error.message,
                stack: error.stack,
                options
            });
            throw error;
        }
    }
    
    /**
     * Primary routing method that processes HTTP requests through validation, path matching, 
     * and handler delegation pipeline
     * @param {object} req - HTTP IncomingMessage object with request details and headers
     * @param {object} res - HTTP ServerResponse object for response generation through handlers
     * @param {object} context - Optional routing context with correlation ID and additional metadata
     * @returns {Promise<void>} Promise that resolves when routing and handler execution is complete
     */
    async route(req, res, context = {}) {
        // Start routing timer for performance measurement and monitoring
        const startTime = performance.now();
        
        try {
            // Extract or generate correlation ID for request tracking
            const correlationId = context.correlationId || 
                req.headers['x-correlation-id'] || 
                generateCorrelationId();
            
            // Set request context in logger for correlation-aware logging
            this.logger.setRequestContext(correlationId, {
                method: req.method,
                url: req.url,
                userAgent: req.headers['user-agent'],
                clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress,
                timestamp: new Date().toISOString()
            });
            
            // Log routing start event with request details and correlation ID
            logRouting('start', {
                req,
                correlationId,
                startTime
            });
            
            // Validate HTTP method against supported methods configuration
            const methodValidation = this.validateRequest(req);
            if (!methodValidation.isValid) {
                this.logger.warn('Request validation failed in RequestRouter', {
                    reason: methodValidation.reason,
                    method: req.method,
                    correlationId
                });
                
                // Update error statistics and delegate to appropriate error handler
                this.updateRoutingStats({ 
                    error: true, 
                    errorType: 'validation_failure',
                    method: req.method,
                    processingTime: performance.now() - startTime
                });
                
                await this.handleRoutingError(new Error(methodValidation.reason), req, res);
                return;
            }
            
            // Parse and sanitize request URL path for secure processing
            const urlInfo = this.parseRequestUrl(req);
            if (!urlInfo.isValid) {
                this.logger.error('URL parsing failed in RequestRouter', {
                    url: req.url,
                    error: urlInfo.error,
                    correlationId
                });
                
                this.updateRoutingStats({ 
                    error: true, 
                    errorType: 'url_parsing_error',
                    method: req.method,
                    processingTime: performance.now() - startTime
                });
                
                await this.handleRoutingError(new Error(urlInfo.error), req, res);
                return;
            }
            
            // Execute route matching algorithm against registered route patterns
            const routeMatch = this.matchPath(urlInfo.sanitizedPath);
            
            if (routeMatch.matched) {
                logRouting('match', {
                    req,
                    correlationId,
                    handler: routeMatch.handler,
                    path: urlInfo.sanitizedPath,
                    matched: true
                });
                
                // Delegate to matched handler or appropriate error handler
                await this.delegateToHandler(routeMatch.handler, req, res, {
                    correlationId,
                    routeMatch,
                    startTime
                });
                
                // Update success statistics
                this.updateRoutingStats({
                    success: true,
                    method: req.method,
                    path: urlInfo.sanitizedPath,
                    handler: routeMatch.handler,
                    processingTime: performance.now() - startTime
                });
                
            } else {
                this.logger.info('No route match found in RequestRouter', {
                    path: urlInfo.sanitizedPath,
                    correlationId
                });
                
                // Handle no match found with 404 error handler
                await this.errorHandlers.notFound(req, res);
                
                this.updateRoutingStats({
                    error: true,
                    errorType: 'not_found',
                    method: req.method,
                    path: urlInfo.sanitizedPath,
                    processingTime: performance.now() - startTime
                });
            }
            
            // Measure routing performance and update performance statistics
            const processingTime = performance.now() - startTime;
            this.routingStats.routingTime += processingTime;
            this.routingStats.requestCount++;
            this.routingStats.averageRoutingTime = this.routingStats.routingTime / this.routingStats.requestCount;
            
            // Log routing completion with handler selection and performance metrics
            logRouting('complete', {
                req,
                correlationId,
                handler: routeMatch.matched ? routeMatch.handler : null,
                path: urlInfo.sanitizedPath,
                processingTime,
                startTime
            });
            
        } catch (error) {
            const processingTime = performance.now() - startTime;
            
            this.logger.error('Unhandled error in RequestRouter.route', {
                error: error.message,
                stack: error.stack,
                method: req.method,
                url: req.url,
                processingTime: `${processingTime.toFixed(2)}ms`
            });
            
            // Handle routing errors and exceptions with error handler integration
            await this.handleRoutingError(error, req, res);
            
            this.updateRoutingStats({
                error: true,
                errorType: 'internal_error',
                method: req.method,
                processingTime
            });
            
            logRouting('error', {
                req,
                error,
                processingTime,
                startTime
            });
            
        } finally {
            // Clean up request context to prevent memory leaks
            const correlationId = context.correlationId || 
                req.headers['x-correlation-id'] || 
                generateCorrelationId();
            this.logger.clearRequestContext(correlationId);
        }
    }
    
    /**
     * Comprehensive request validation including HTTP method, URL format, headers, and security 
     * checks before routing
     * @param {object} req - HTTP request object to validate for routing compatibility
     * @returns {object} Request validation result with isValid status and detailed error information
     */
    validateRequest(req) {
        try {
            // Validate HTTP method is present and in supported methods list
            if (!req.method || typeof req.method !== 'string') {
                return {
                    isValid: false,
                    reason: 'Missing or invalid HTTP method',
                    details: { method: req.method, type: typeof req.method }
                };
            }
            
            const normalizedMethod = req.method.toUpperCase();
            if (!this.supportedMethods.has(normalizedMethod)) {
                return {
                    isValid: false,
                    reason: 'HTTP method not supported',
                    details: { 
                        method: normalizedMethod, 
                        supported: Array.from(this.supportedMethods) 
                    }
                };
            }
            
            // Check request URL format and detect potential security issues
            if (!req.url || typeof req.url !== 'string') {
                return {
                    isValid: false,
                    reason: 'Missing or invalid request URL',
                    details: { url: req.url, type: typeof req.url }
                };
            }
            
            // Validate request headers for proper format and security compliance
            if (!req.headers || typeof req.headers !== 'object') {
                return {
                    isValid: false,
                    reason: 'Missing or invalid request headers',
                    details: { headers: req.headers, type: typeof req.headers }
                };
            }
            
            // Additional security validations
            if (req.url.length > this.securityConfig.maxPathLength) {
                return {
                    isValid: false,
                    reason: 'Request URL exceeds maximum length',
                    details: { 
                        urlLength: req.url.length, 
                        maxLength: this.securityConfig.maxPathLength 
                    }
                };
            }
            
            // Return comprehensive validation result with success status and error details
            return {
                isValid: true,
                method: normalizedMethod,
                url: req.url,
                validation: 'passed'
            };
            
        } catch (error) {
            this.logger.error('Error during request validation', {
                error: error.message,
                stack: error.stack
            });
            
            return {
                isValid: false,
                reason: 'Validation error occurred',
                details: { error: error.message }
            };
        }
    }
    
    /**
     * Advanced path matching with exact string comparison and route parameter extraction for 
     * flexible routing
     * @param {string} pathname - URL pathname to match against registered route patterns
     * @returns {object} Path match result with handler reference, parameters, and routing metadata
     */
    matchPath(pathname) {
        try {
            // Normalize pathname format for consistent matching
            const normalizedPath = pathname ? pathname.trim() : '';
            
            if (!normalizedPath) {
                return {
                    matched: false,
                    handler: null,
                    path: normalizedPath,
                    metadata: { reason: 'empty_pathname' }
                };
            }
            
            const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
            
            this.logger.debug('Path matching attempt in RequestRouter', {
                originalPath: pathname,
                normalizedPath: cleanPath,
                registeredRoutes: Array.from(this.routeMap.keys())
            });
            
            // Perform exact string match against '/hello' route pattern
            if (this.routeMap.has(cleanPath)) {
                const routeConfig = this.routeMap.get(cleanPath);
                
                this.logger.debug('Exact path match found', {
                    path: cleanPath,
                    handler: routeConfig.handler,
                    methods: routeConfig.methods
                });
                
                return {
                    matched: true,
                    handler: routeConfig.handler,
                    path: cleanPath,
                    routeConfig,
                    metadata: {
                        matchType: 'exact',
                        methods: routeConfig.methods,
                        description: routeConfig.description
                    }
                };
            }
            
            // Check for special routes like health endpoint if enabled
            // (Not implemented in tutorial scope but structure provided for extension)
            
            // Return no-match result with path information for unknown routes
            return {
                matched: false,
                handler: null,
                path: cleanPath,
                metadata: { 
                    reason: 'no_matching_route',
                    availableRoutes: Array.from(this.routeMap.keys())
                }
            };
            
        } catch (error) {
            this.logger.error('Error during path matching in RequestRouter', {
                error: error.message,
                pathname,
                stack: error.stack
            });
            
            return {
                matched: false,
                handler: null,
                path: pathname,
                metadata: { 
                    reason: 'matching_error',
                    error: error.message 
                }
            };
        }
    }
    
    /**
     * Handler delegation method that executes matched handlers with error handling and 
     * performance monitoring
     * @param {string} handlerName - Handler function name to execute for the matched route
     * @param {object} req - HTTP request object to pass to handler
     * @param {object} res - HTTP response object to pass to handler
     * @param {object} context - Routing context with correlation and metadata
     * @returns {Promise<void>} Promise that resolves when handler execution is complete
     */
    async delegateToHandler(handlerName, req, res, context) {
        // Start handler execution timer for performance tracking
        const handlerStartTime = performance.now();
        
        try {
            this.logger.info('Delegating request to handler', {
                handler: handlerName,
                correlationId: context.correlationId,
                path: req.url
            });
            
            // Execute handler function with request, response, and context parameters
            switch (handlerName) {
                case 'handleHello':
                    await handleHello(req, res);
                    break;
                default:
                    throw new Error(`Unknown handler: ${handlerName}`);
            }
            
            // Measure handler execution time and update performance statistics
            const handlerDuration = performance.now() - handlerStartTime;
            
            this.logger.info('Handler execution completed successfully', {
                handler: handlerName,
                correlationId: context.correlationId,
                executionTime: `${handlerDuration.toFixed(2)}ms`
            });
            
            // Update handler-specific statistics
            if (!this.routingStats.handlerCounts[handlerName]) {
                this.routingStats.handlerCounts[handlerName] = 0;
            }
            this.routingStats.handlerCounts[handlerName]++;
            
        } catch (error) {
            const handlerDuration = performance.now() - handlerStartTime;
            
            this.logger.error('Handler execution failed', {
                handler: handlerName,
                correlationId: context.correlationId,
                error: error.message,
                executionTime: `${handlerDuration.toFixed(2)}ms`,
                stack: error.stack
            });
            
            // Handle handler execution errors with error handler integration
            await this.handleRoutingError(error, req, res);
        }
    }
    
    /**
     * Routing error handler that processes routing failures and delegates to appropriate 
     * error handlers
     * @param {Error} error - Routing error object with details and stack trace
     * @param {object} req - HTTP request object for error context
     * @param {object} res - HTTP response object for error response generation
     * @returns {Promise<void>} Promise that resolves when error handling is complete
     */
    async handleRoutingError(error, req, res) {
        try {
            // Classify routing error type and determine appropriate response
            let errorHandler;
            let errorType;
            
            if (error.message?.includes('not supported') || error.message?.includes('Method')) {
                errorHandler = this.errorHandlers.methodNotAllowed;
                errorType = 'method_not_allowed';
            } else if (error.message?.includes('not found') || error.message?.includes('Unknown handler')) {
                errorHandler = this.errorHandlers.notFound;
                errorType = 'not_found';
            } else {
                errorHandler = this.errorHandlers.internalError;
                errorType = 'internal_error';
            }
            
            // Log routing error with request context and correlation information
            this.logger.error('Routing error handled by RequestRouter', {
                error: error.message,
                errorType,
                method: req.method,
                url: req.url,
                stack: config.isDevelopment ? error.stack : undefined
            });
            
            // Delegate to appropriate error handler (404, 405, or 500)
            if (errorType === 'method_not_allowed') {
                await errorHandler(req, res, Array.from(this.supportedMethods));
            } else {
                await errorHandler(req, res);
            }
            
            // Update error statistics for monitoring and alerting
            if (!this.routingStats.errorsByType[errorType]) {
                this.routingStats.errorsByType[errorType] = 0;
            }
            this.routingStats.errorsByType[errorType]++;
            this.routingStats.errorCount++;
            
        } catch (handlingError) {
            this.logger.error('Failed to handle routing error', {
                originalError: error.message,
                handlingError: handlingError.message,
                method: req.method,
                url: req.url
            });
            
            // Ensure error response is sent even if error handling fails
            try {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Internal Server Error');
                }
            } catch (fallbackError) {
                this.logger.error('Fallback error response failed', {
                    error: fallbackError.message
                });
            }
        }
    }
    
    /**
     * Returns comprehensive routing statistics including request counts, timing metrics, error 
     * rates, and handler performance
     * @returns {object} Routing statistics object with counts, averages, error rates, and performance data
     */
    getRoutingStats() {
        try {
            // Collect total request count and successful routing count
            const totalRequests = this.routingStats.requestCount;
            const successfulRequests = totalRequests - this.routingStats.errorCount;
            
            // Calculate average routing time and handler execution time
            const averageRoutingTime = totalRequests > 0 ? 
                (this.routingStats.routingTime / totalRequests) : 0;
            
            // Calculate success rate percentage
            const successRate = totalRequests > 0 ? 
                ((successfulRequests / totalRequests) * 100) : 100;
            
            // Calculate uptime since router initialization
            const uptimeMs = Date.now() - this.routingStats.startTime;
            const uptimeSeconds = Math.floor(uptimeMs / 1000);
            
            // Include error counts by type (404, 405, 500) for monitoring
            const errorRates = {};
            Object.entries(this.routingStats.errorsByType).forEach(([type, count]) => {
                errorRates[type] = {
                    count,
                    percentage: totalRequests > 0 ? ((count / totalRequests) * 100).toFixed(2) : '0'
                };
            });
            
            // Add route-specific statistics for each registered route pattern
            const routeStats = {};
            Array.from(this.routeMap.keys()).forEach(route => {
                routeStats[route] = {
                    requestCount: this.routingStats.pathCounts[route] || 0,
                    handler: this.routeMap.get(route).handler,
                    methods: this.routeMap.get(route).methods
                };
            });
            
            // Return comprehensive statistics object for monitoring integration
            return {
                overview: {
                    totalRequests,
                    successfulRequests,
                    errorCount: this.routingStats.errorCount,
                    successRate: `${successRate.toFixed(2)}%`,
                    uptimeSeconds,
                    routesRegistered: this.routeMap.size
                },
                
                performance: {
                    averageRoutingTime: `${averageRoutingTime.toFixed(2)}ms`,
                    totalRoutingTime: `${this.routingStats.routingTime.toFixed(2)}ms`,
                    requestsPerSecond: uptimeSeconds > 0 ? 
                        (totalRequests / uptimeSeconds).toFixed(2) : '0'
                },
                
                errors: {
                    totalErrors: this.routingStats.errorCount,
                    errorRate: totalRequests > 0 ? 
                        `${((this.routingStats.errorCount / totalRequests) * 100).toFixed(2)}%` : '0%',
                    errorsByType: errorRates
                },
                
                methods: {
                    supportedMethods: Array.from(this.supportedMethods),
                    methodCounts: { ...this.routingStats.methodCounts }
                },
                
                routes: routeStats,
                
                handlers: {
                    handlerCounts: { ...this.routingStats.handlerCounts }
                },
                
                configuration: {
                    environment: this.config.environment,
                    maxPathLength: this.securityConfig.maxPathLength,
                    pathSanitization: this.securityConfig.sanitizePaths,
                    methodValidation: this.securityConfig.validateMethods
                },
                
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error('Failed to generate routing statistics', {
                error: error.message,
                stack: error.stack
            });
            
            return {
                error: true,
                message: 'Failed to generate statistics',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Updates internal routing statistics based on processed requests for monitoring and 
     * performance analysis
     * @param {object} routingResult - Routing result with timing, handler, and outcome information
     * @returns {void} No return value - updates internal statistics
     */
    updateRoutingStats(routingResult) {
        try {
            // Increment success or error counters based on routing outcome
            if (routingResult.success) {
                this.routingStats.successCount++;
                
                // Update method-specific statistics
                if (routingResult.method) {
                    if (!this.routingStats.methodCounts[routingResult.method]) {
                        this.routingStats.methodCounts[routingResult.method] = 0;
                    }
                    this.routingStats.methodCounts[routingResult.method]++;
                }
                
                // Update path-specific statistics
                if (routingResult.path) {
                    if (!this.routingStats.pathCounts[routingResult.path]) {
                        this.routingStats.pathCounts[routingResult.path] = 0;
                    }
                    this.routingStats.pathCounts[routingResult.path]++;
                }
                
            } else if (routingResult.error) {
                this.routingStats.errorCount++;
                
                // Update error type statistics
                if (routingResult.errorType) {
                    if (!this.routingStats.errorsByType[routingResult.errorType]) {
                        this.routingStats.errorsByType[routingResult.errorType] = 0;
                    }
                    this.routingStats.errorsByType[routingResult.errorType]++;
                }
            }
            
            // Update timing statistics
            if (routingResult.processingTime) {
                this.routingStats.routingTime += routingResult.processingTime;
            }
            
            // Trigger alerts if error thresholds are exceeded
            const errorRate = this.routingStats.requestCount > 0 ? 
                (this.routingStats.errorCount / this.routingStats.requestCount) : 0;
            
            if (errorRate > 0.1) { // 10% error rate threshold
                this.logger.warn('High error rate detected in routing', {
                    errorRate: `${(errorRate * 100).toFixed(2)}%`,
                    totalRequests: this.routingStats.requestCount,
                    totalErrors: this.routingStats.errorCount
                });
            }
            
        } catch (error) {
            this.logger.error('Failed to update routing statistics', {
                error: error.message,
                routingResult
            });
        }
    }
    
    // Private helper methods
    
    /**
     * Parses and validates request URL with security filtering
     * @private
     * @param {object} req - HTTP request object
     * @returns {object} URL parsing result with validation status
     */
    parseRequestUrl(req) {
        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const sanitizedPath = sanitizePath(parsedUrl.pathname);
            
            return {
                isValid: true,
                originalPath: parsedUrl.pathname,
                sanitizedPath,
                queryParams: parsedUrl.searchParams,
                hash: parsedUrl.hash
            };
            
        } catch (error) {
            return {
                isValid: false,
                error: error.message,
                originalPath: req.url
            };
        }
    }
}

// Create and export default request router instance configured with environment settings
const requestRouter = new RequestRouter({
    environment: config.environment,
    isDevelopment: config.isDevelopment,
    logLevel: config.logging?.level || 'info'
});

// Export individual routing functions for granular request processing
export { route, validateAndRoute, matchRoute };

// Export utility functions for path processing and correlation tracking
export { validateHttpMethod, sanitizePath, generateCorrelationId, logRouting };

// Export RequestRouter class for creating custom router instances
export { RequestRouter };

// Export default request router instance configured with environment settings for immediate use by HTTP server
export { requestRouter };

// Export the default router instance as default export for convenience
export default requestRouter;