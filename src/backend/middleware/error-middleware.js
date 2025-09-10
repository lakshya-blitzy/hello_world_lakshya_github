/**
 * Node.js Tutorial HTTP Server - Error Middleware Component
 * 
 * Centralized error middleware component that provides comprehensive error interception,
 * processing, and response generation for the Node.js tutorial HTTP server application.
 * Acts as the final error handling layer in the request processing pipeline, capturing
 * unhandled errors, exceptions, and failures from handlers while ensuring consistent
 * error responses, secure error messaging, and comprehensive error logging with
 * correlation tracking.
 * 
 * This middleware implements Express-style error handling patterns with enterprise-grade
 * error classification, recovery mechanisms, security response generation, and monitoring
 * integration. Designed for educational clarity while demonstrating production-ready
 * error handling techniques with zero external dependencies.
 * 
 * Key Features:
 * - Centralized error interception and processing for all request pipeline errors
 * - Error classification system (Client, Server, System, Fatal) with appropriate responses
 * - Security-focused error messaging preventing information disclosure
 * - Comprehensive error logging with correlation tracking and context management
 * - Performance monitoring and error statistics collection
 * - Global error handlers for uncaught exceptions and unhandled Promise rejections
 * - Graceful shutdown handling with proper resource cleanup
 * 
 * Educational Objectives:
 * - Demonstrate Express-style error middleware pattern implementation
 * - Show async error handling and Promise rejection management techniques
 * - Illustrate secure error response generation and information disclosure prevention
 * - Teach error classification and recovery mechanism implementation
 * - Provide examples of global error handlers and process-level error management
 * 
 * Dependencies: Internal modules only (logger, error-handler, response-generator, config)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 * HTTP Protocol: HTTP/1.1 compliance
 */

// Import Node.js built-in utility module for error object inspection and stack trace formatting
import { inspect } from 'node:util'; // Node.js built-in v22.x

// Import Node.js built-in performance API for error handling timing measurement and monitoring
import { performance } from 'node:perf_hooks'; // Node.js built-in v22.x

// Import centralized logging functionality for error event tracking, correlation management, and structured logging
import { 
    logger, 
    error as logError, 
    warn, 
    info, 
    logError as logErrorWithContext, 
    getCurrentContext 
} from '../lib/logger.js';

// Import error processing and classification functionality for comprehensive error handling
import { 
    errorHandler, 
    handle, 
    classifyError, 
    sanitizeError 
} from '../lib/error-handler.js';

// Import HTTP error response generation functions for consistent error responses
import { 
    sendInternalError, 
    generateErrorResponse 
} from '../lib/response-generator.js';

// Import environment configuration for error handling behavior customization based on environment
import { 
    config, 
    environment, 
    isDevelopment, 
    isProduction 
} from '../config/environment.js';

// Global error middleware configuration with environment-specific behavior settings
const ERROR_MIDDLEWARE_CONFIG = {
    enabled: true,                    // Error middleware enabled by default
    logLevel: 'error',               // Default log level for error events
    includeStack: isDevelopment,     // Include stack traces only in development
    sanitizeResponse: true,          // Always sanitize error responses for security
    correlationTracking: true,       // Enable request correlation tracking
    performanceMonitoring: true,     // Monitor error handling performance
    gracefulShutdown: true,         // Enable graceful shutdown on critical errors
    maxRetries: 3,                  // Maximum retry attempts for error recovery
    shutdownTimeout: 30000          // Graceful shutdown timeout in milliseconds
};

// Global error response templates with secure messaging for different error types
const ERROR_RESPONSE_TEMPLATES = {
    generic: 'Internal Server Error',                    // Generic server error message
    network: 'Network Error',                           // Network-related error message
    timeout: 'Request Timeout',                         // Request timeout error message
    unavailable: 'Service Unavailable',                 // Service unavailable message
    badRequest: 'Bad Request',                          // Client request error message
    notFound: 'Not Found',                             // Resource not found message
    methodNotAllowed: 'Method Not Allowed',            // HTTP method not allowed message
    tooManyRequests: 'Too Many Requests'               // Rate limit exceeded message
};

// Global middleware statistics for monitoring and operational visibility
const MIDDLEWARE_STATS = {
    errorsHandled: 0,                // Total number of errors processed
    averageHandlingTime: 0,          // Average error handling time in milliseconds
    lastErrorTime: null,             // Timestamp of last error occurrence
    errorsByType: {                  // Error counts by classification type
        CLIENT_ERROR: 0,
        SERVER_ERROR: 0,
        SYSTEM_ERROR: 0,
        FATAL_ERROR: 0
    },
    totalHandlingTime: 0,           // Cumulative error handling time
    criticalErrors: 0,              // Count of critical errors requiring attention
    recoveryAttempts: 0,            // Number of error recovery attempts
    gracefulShutdowns: 0            // Count of graceful shutdowns triggered
};

/**
 * Main error middleware function that intercepts unhandled errors from the request processing
 * pipeline and generates appropriate error responses with logging and correlation tracking.
 * Implements Express-style error middleware pattern (err, req, res, next).
 * 
 * @param {Error} error - Error object thrown by handlers or other middleware with stack trace
 * @param {Object} req - HTTP IncomingMessage object containing request context for correlation
 * @param {Object} res - HTTP ServerResponse object for error response generation
 * @param {Function} next - Next middleware function for error propagation (typically not called)
 * @returns {Promise<void>} Promise that resolves when error handling and response generation is complete
 */
export async function errorMiddleware(error, req, res, next) {
    // Start error handling timer for performance monitoring and SLA tracking
    const startTime = performance.now();
    let handlingTimeMs = 0;

    try {
        // Extract correlation ID from request context or logger for error tracking
        const correlationId = getCurrentContext() || req.correlationId || 
                              req.headers['x-correlation-id'] || 
                              `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Validate error object and request/response objects for proper middleware operation
        if (!error) {
            warn('Error middleware called without error object', { correlationId });
            return;
        }

        if (!res || res.headersSent) {
            warn('Cannot send error response - response not available or headers already sent', {
                correlationId,
                hasResponse: !!res,
                headersSent: res?.headersSent
            });
            return;
        }

        // Classify error type and severity using error handler classification system
        const errorClassification = await classifyError(error);
        const errorType = errorClassification.type;
        const severity = errorClassification.severity;

        // Log detailed error information with correlation ID, stack trace, and request context
        const errorContext = {
            correlationId,
            errorType,
            severity,
            message: error.message,
            name: error.name,
            stack: ERROR_MIDDLEWARE_CONFIG.includeStack ? error.stack : undefined,
            requestUrl: req.url,
            requestMethod: req.method,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            requestHeaders: isDevelopment ? req.headers : undefined
        };

        // Use appropriate log level based on error severity
        switch (severity) {
            case 'CRITICAL':
            case 'HIGH':
                logError('Critical error intercepted by error middleware', errorContext);
                break;
            case 'MEDIUM':
                logError('Error intercepted by error middleware', errorContext);
                break;
            case 'LOW':
            default:
                warn('Minor error intercepted by error middleware', errorContext);
                break;
        }

        // Sanitize error information to remove sensitive data before response generation
        const sanitizedError = await sanitizeError(error, {
            includeStack: ERROR_MIDDLEWARE_CONFIG.includeStack,
            includeDetails: isDevelopment
        });

        // Generate appropriate HTTP error response using response generator with secure messaging
        let statusCode;
        let errorMessage;

        switch (errorType) {
            case 'CLIENT_ERROR':
                statusCode = error.statusCode || 400;
                errorMessage = ERROR_RESPONSE_TEMPLATES.badRequest;
                break;
            case 'SYSTEM_ERROR':
                statusCode = 503;
                errorMessage = ERROR_RESPONSE_TEMPLATES.unavailable;
                break;
            case 'FATAL_ERROR':
                statusCode = 500;
                errorMessage = ERROR_RESPONSE_TEMPLATES.generic;
                // Trigger graceful shutdown for fatal errors
                if (ERROR_MIDDLEWARE_CONFIG.gracefulShutdown) {
                    setImmediate(() => handleCriticalError(error, { correlationId, req, res }));
                }
                break;
            case 'SERVER_ERROR':
            default:
                statusCode = 500;
                errorMessage = ERROR_RESPONSE_TEMPLATES.generic;
                break;
        }

        // Send error response using response generator with security headers
        try {
            if (statusCode === 500) {
                await sendInternalError(res, sanitizedError);
            } else {
                await generateErrorResponse(res, statusCode, errorMessage);
            }
        } catch (responseError) {
            // Handle response generation failures with fallback error responses
            logError('Failed to send error response', {
                correlationId,
                responseError: responseError.message,
                originalError: error.message
            });
            
            // Final fallback - minimal error response
            try {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Internal Server Error');
                }
            } catch (fallbackError) {
                logError('Critical: Final fallback error response failed', {
                    correlationId,
                    fallbackError: fallbackError.message
                });
            }
        }

        // Calculate error handling timing for performance monitoring
        handlingTimeMs = performance.now() - startTime;

        // Update error handling statistics and monitoring counters for operational visibility
        updateErrorStatistics(errorType, handlingTimeMs, severity);

        // Log completion of error handling with performance metrics
        info('Error handling completed successfully', {
            correlationId,
            errorType,
            statusCode,
            handlingTime: `${handlingTimeMs.toFixed(2)}ms`,
            totalErrorsHandled: MIDDLEWARE_STATS.errorsHandled
        });

        // Complete error handling and cleanup resources without calling next() for error termination
        // Note: In error middleware, next() is typically not called to terminate error propagation

    } catch (middlewareError) {
        // Handle errors in error middleware itself with critical error logging
        handlingTimeMs = performance.now() - startTime;
        
        logError('Critical error in error middleware', {
            middlewareError: {
                message: middlewareError.message,
                stack: middlewareError.stack
            },
            originalError: {
                message: error?.message || 'Unknown error',
                stack: error?.stack
            },
            handlingTime: `${handlingTimeMs.toFixed(2)}ms`,
            url: req?.url,
            method: req?.method
        });

        // Update critical error statistics
        MIDDLEWARE_STATS.criticalErrors++;

        // Emergency response attempt
        try {
            if (res && !res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Critical Server Error');
            }
        } catch (emergencyError) {
            logError('Emergency error response failed', {
                error: emergencyError.message
            });
        }
    }
}

/**
 * Specialized async error handler that captures and processes asynchronous errors from
 * Promise rejections and async/await operations, forwarding them to error middleware.
 * 
 * @param {Function} asyncHandler - Async handler function that may throw errors or return rejected promises
 * @returns {Function} Wrapped handler function that catches async errors and forwards to error middleware
 */
export function handleAsyncError(asyncHandler) {
    // Return wrapped function that accepts req, res, next parameters
    return async function wrappedAsyncHandler(req, res, next) {
        try {
            // Execute original async handler with try-catch for error capture
            await asyncHandler(req, res, next);
        } catch (error) {
            // Catch any thrown errors or Promise rejections from async operations
            logError('Async error caught by handleAsyncError wrapper', {
                error: {
                    message: error.message,
                    name: error.name,
                    stack: ERROR_MIDDLEWARE_CONFIG.includeStack ? error.stack : undefined
                },
                handlerName: asyncHandler.name || 'anonymous',
                url: req.url,
                method: req.method
            });

            // Forward captured errors to error middleware through next() function call
            next(error);
        }
    };
}

/**
 * Process-level uncaught exception handler that logs critical errors and attempts
 * graceful shutdown to prevent application crashes and data corruption.
 * 
 * @param {Error} error - Uncaught exception error object with full error details
 * @returns {void} No return value - handles process-level error and may initiate shutdown
 */
export function handleUncaughtException(error) {
    try {
        // Log critical uncaught exception with full error details and stack trace
        logError('CRITICAL: Uncaught exception detected', {
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack
            },
            processId: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            severity: 'CRITICAL'
        });

        // Update critical error statistics
        MIDDLEWARE_STATS.criticalErrors++;
        MIDDLEWARE_STATS.gracefulShutdowns++;

        // Attempt graceful shutdown sequence
        if (ERROR_MIDDLEWARE_CONFIG.gracefulShutdown) {
            info('Initiating graceful shutdown due to uncaught exception');
            
            // Set process exit timeout to prevent hanging on shutdown
            const shutdownTimer = setTimeout(() => {
                logError('Graceful shutdown timeout exceeded, forcing exit');
                process.exit(1);
            }, ERROR_MIDDLEWARE_CONFIG.shutdownTimeout);

            // Attempt to close HTTP server gracefully to complete active requests
            try {
                // Note: In a complete implementation, you would have access to the server instance
                // and call server.close() here. For this educational example, we'll simulate the process.
                process.nextTick(() => {
                    clearTimeout(shutdownTimer);
                    info('Graceful shutdown completed');
                    // Exit process with error code 1 to indicate failure to process managers
                    process.exit(1);
                });
            } catch (shutdownError) {
                logError('Error during graceful shutdown', {
                    error: shutdownError.message
                });
                clearTimeout(shutdownTimer);
                process.exit(1);
            }
        } else {
            // Exit immediately if graceful shutdown is disabled
            process.exit(1);
        }

    } catch (handlerError) {
        // If error handling itself fails, force exit to prevent infinite loops
        console.error('Critical: Error in uncaught exception handler:', handlerError.message);
        process.exit(1);
    }
}

/**
 * Process-level unhandled Promise rejection handler for async errors not caught by
 * application code, providing comprehensive logging and monitoring for debugging.
 * 
 * @param {any} reason - Promise rejection reason which may be Error object or other value
 * @param {Promise} promise - The Promise that was rejected without a catch handler
 * @returns {void} No return value - logs rejection and monitors for critical failures
 */
export function handleUnhandledRejection(reason, promise) {
    try {
        // Log unhandled Promise rejection with reason details and promise context
        const rejectionDetails = {
            reason: reason instanceof Error ? {
                message: reason.message,
                name: reason.name,
                stack: reason.stack
            } : reason,
            promise: promise.toString().substring(0, 200), // Truncate promise string
            processId: process.pid,
            timestamp: new Date().toISOString()
        };

        // Classify rejection severity to determine if graceful shutdown is required
        const isError = reason instanceof Error;
        const isCritical = isError && (
            reason.name === 'ReferenceError' ||
            reason.name === 'SyntaxError' ||
            reason.message.includes('FATAL') ||
            reason.message.includes('CRITICAL')
        );

        if (isCritical) {
            logError('CRITICAL: Unhandled Promise rejection detected', rejectionDetails);
            MIDDLEWARE_STATS.criticalErrors++;
            
            // Consider graceful shutdown for critical promise rejections
            if (ERROR_MIDDLEWARE_CONFIG.gracefulShutdown) {
                warn('Critical unhandled rejection may require application restart');
            }
        } else {
            warn('Unhandled Promise rejection detected', rejectionDetails);
        }

        // Update unhandled rejection statistics for monitoring and alerting
        MIDDLEWARE_STATS.errorsByType.SYSTEM_ERROR++;

        // In development, provide detailed debugging information to console
        if (isDevelopment) {
            console.warn('🚨 Unhandled Promise Rejection:', reason);
            console.warn('Promise:', promise);
            if (isError) {
                console.warn('Stack trace:', reason.stack);
            }
        }

        // Monitor rejection frequency to detect potential memory leaks or failing components
        const rejectionRate = MIDDLEWARE_STATS.errorsByType.SYSTEM_ERROR / 
                             (process.uptime() / 60); // Rejections per minute
        
        if (rejectionRate > 10) { // More than 10 rejections per minute
            logError('High unhandled rejection rate detected - potential system instability', {
                rejectionRate: rejectionRate.toFixed(2),
                totalRejections: MIDDLEWARE_STATS.errorsByType.SYSTEM_ERROR,
                uptime: process.uptime()
            });
        }

    } catch (handlerError) {
        // Fallback logging if handler itself fails
        console.error('Error in unhandled rejection handler:', handlerError.message);
        console.error('Original rejection reason:', reason);
    }
}

/**
 * Initializes global error handlers for uncaught exceptions and unhandled Promise
 * rejections with proper cleanup and server instance integration.
 * 
 * @param {Object} server - HTTP server instance for graceful shutdown during critical errors
 * @returns {void} No return value - registers global error handlers
 */
export function setupErrorHandlers(server = null) {
    try {
        info('Setting up global error handlers for process-level error management');

        // Register uncaughtException handler for synchronous errors not caught by application
        process.on('uncaughtException', (error) => {
            handleUncaughtException(error);
        });

        // Register unhandledRejection handler for async Promise rejections without catch handlers
        process.on('unhandledRejection', (reason, promise) => {
            handleUnhandledRejection(reason, promise);
        });

        // Set up warning event handler for Node.js runtime warnings and deprecations
        process.on('warning', (warning) => {
            warn('Node.js process warning detected', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });

        // Configure process signal handlers for graceful shutdown on SIGTERM and SIGINT
        const gracefulShutdown = (signal) => {
            info(`Received ${signal}, initiating graceful shutdown`);
            MIDDLEWARE_STATS.gracefulShutdowns++;

            const shutdownTimeout = setTimeout(() => {
                logError('Graceful shutdown timeout, forcing exit');
                process.exit(1);
            }, ERROR_MIDDLEWARE_CONFIG.shutdownTimeout);

            try {
                if (server && typeof server.close === 'function') {
                    server.close((error) => {
                        clearTimeout(shutdownTimeout);
                        if (error) {
                            logError('Error during server shutdown', { error: error.message });
                            process.exit(1);
                        } else {
                            info('Server closed successfully');
                            process.exit(0);
                        }
                    });
                } else {
                    clearTimeout(shutdownTimeout);
                    info('No server instance provided, exiting gracefully');
                    process.exit(0);
                }
            } catch (shutdownError) {
                clearTimeout(shutdownTimeout);
                logError('Error during graceful shutdown', { error: shutdownError.message });
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Initialize error statistics tracking for monitoring and operational visibility
        MIDDLEWARE_STATS.lastErrorTime = null;
        MIDDLEWARE_STATS.errorsHandled = 0;
        
        info('Global error handlers initialized successfully', {
            gracefulShutdown: ERROR_MIDDLEWARE_CONFIG.gracefulShutdown,
            shutdownTimeout: ERROR_MIDDLEWARE_CONFIG.shutdownTimeout,
            hasServerInstance: !!server
        });

    } catch (setupError) {
        logError('Failed to setup global error handlers', {
            error: setupError.message,
            stack: setupError.stack
        });
        throw setupError;
    }
}

/**
 * Returns comprehensive error middleware statistics including error counts, handling time,
 * and error type distribution for monitoring and operational visibility.
 * 
 * @returns {Object} Error statistics object with counts, averages, and timing information
 */
export function getErrorStats() {
    try {
        // Collect total error count handled by middleware since application start
        const totalErrors = MIDDLEWARE_STATS.errorsHandled;
        
        // Calculate average error handling time and performance metrics
        const averageHandlingTime = totalErrors > 0 ? 
            MIDDLEWARE_STATS.totalHandlingTime / totalErrors : 0;

        // Include error type distribution for monitoring and analysis
        const errorDistribution = { ...MIDDLEWARE_STATS.errorsByType };
        const totalErrorsByType = Object.values(errorDistribution).reduce((sum, count) => sum + count, 0);

        // Calculate error type percentages for operational insights
        const errorPercentages = {};
        Object.entries(errorDistribution).forEach(([type, count]) => {
            errorPercentages[type] = totalErrorsByType > 0 ? 
                ((count / totalErrorsByType) * 100).toFixed(2) + '%' : '0%';
        });

        // Add recent error information and trends for operational visibility
        const uptime = process.uptime();
        const errorRate = totalErrors > 0 ? (totalErrors / (uptime / 60)).toFixed(2) : 0; // Errors per minute

        // Return comprehensive statistics object for monitoring integration
        const statisticsReport = {
            summary: {
                totalErrorsHandled: totalErrors,
                averageHandlingTime: Math.round(averageHandlingTime * 100) / 100, // Round to 2 decimal places
                lastErrorTime: MIDDLEWARE_STATS.lastErrorTime,
                errorRate: errorRate + ' errors/min',
                criticalErrors: MIDDLEWARE_STATS.criticalErrors,
                recoveryAttempts: MIDDLEWARE_STATS.recoveryAttempts,
                gracefulShutdowns: MIDDLEWARE_STATS.gracefulShutdowns
            },
            errorsByType: {
                counts: errorDistribution,
                percentages: errorPercentages,
                total: totalErrorsByType
            },
            performance: {
                totalHandlingTime: MIDDLEWARE_STATS.totalHandlingTime,
                averageHandlingTime: averageHandlingTime,
                peakHandlingTime: MIDDLEWARE_STATS.peakHandlingTime || 0,
                handlingTimeThreshold: 100 // milliseconds
            },
            configuration: {
                enabled: ERROR_MIDDLEWARE_CONFIG.enabled,
                logLevel: ERROR_MIDDLEWARE_CONFIG.logLevel,
                includeStack: ERROR_MIDDLEWARE_CONFIG.includeStack,
                sanitizeResponse: ERROR_MIDDLEWARE_CONFIG.sanitizeResponse,
                gracefulShutdown: ERROR_MIDDLEWARE_CONFIG.gracefulShutdown
            },
            system: {
                uptime: uptime,
                processId: process.pid,
                nodeVersion: process.version,
                memoryUsage: process.memoryUsage(),
                environment: environment
            },
            timestamp: new Date().toISOString()
        };

        return statisticsReport;

    } catch (statsError) {
        logError('Failed to compile error statistics', {
            error: statsError.message
        });

        return {
            error: true,
            errorMessage: statsError.message,
            summary: {
                totalErrorsHandled: MIDDLEWARE_STATS.errorsHandled,
                averageHandlingTime: 0,
                lastErrorTime: MIDDLEWARE_STATS.lastErrorTime
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Comprehensive error middleware class that encapsulates error interception, processing,
 * response generation, and statistics tracking with configurable error handling behavior
 * and monitoring integration.
 */
export class ErrorMiddleware {
    /**
     * Initializes error middleware with configuration, logging, error handling, and statistics
     * tracking for comprehensive error management with environment-specific behavior.
     * 
     * @param {Object} options - Configuration options including error handling behavior, logging settings, and response customization
     */
    constructor(options = {}) {
        try {
            // Load error middleware configuration from environment and provided options
            this.config = {
                ...ERROR_MIDDLEWARE_CONFIG,
                ...options
            };

            // Initialize logger instance for error event tracking and correlation management
            this.logger = logger;

            // Set up error handler instance for error classification and processing
            this.errorHandler = errorHandler;

            // Initialize error statistics tracking for monitoring and performance analysis
            this.stats = {
                ...MIDDLEWARE_STATS,
                startTime: Date.now()
            };

            // Flag indicating whether application is in shutdown state
            this.isShuttingDown = false;

            // Configure global error handlers for uncaught exceptions and unhandled rejections
            if (this.config.setupGlobalHandlers !== false) {
                this.setupGlobalHandlers();
            }

            // Set up response templates and error message formatting based on environment
            this.responseTemplates = {
                ...ERROR_RESPONSE_TEMPLATES,
                ...options.responseTemplates
            };

            // Initialize shutdown handling and cleanup procedures for graceful termination
            this.shutdownTimer = null;
            this.shutdownHandlers = [];

            this.logger.info('ErrorMiddleware instance initialized successfully', {
                configEnabled: this.config.enabled,
                logLevel: this.config.logLevel,
                includeStack: this.config.includeStack,
                gracefulShutdown: this.config.gracefulShutdown,
                environment: environment
            });

        } catch (initError) {
            console.error('Failed to initialize ErrorMiddleware:', initError.message);
            throw initError;
        }
    }

    /**
     * Express-style error middleware function that processes errors from the request pipeline
     * with comprehensive logging and response generation, handling correlation tracking and
     * performance monitoring.
     * 
     * @param {Error} error - Error object from handlers or other middleware
     * @param {Object} req - HTTP request object for error context
     * @param {Object} res - HTTP response object for error response
     * @param {Function} next - Next middleware function (typically unused in error middleware)
     * @returns {Promise<void>} Promise resolving when error handling is complete
     */
    async middleware(error, req, res, next) {
        const startTime = performance.now();

        try {
            // Check if application is in shutdown state and handle accordingly
            if (this.isShuttingDown) {
                this.logger.warn('Error occurred during application shutdown', {
                    error: error.message,
                    url: req?.url
                });
                return;
            }

            // Extract correlation ID from request context for error tracking
            const correlationId = this.getCorrelationId(req);

            // Start error handling timing for performance monitoring
            this.stats.errorsHandled++;
            this.stats.lastErrorTime = new Date().toISOString();

            // Log error event with full context and correlation information
            const errorContext = {
                correlationId,
                error: {
                    message: error.message,
                    name: error.name,
                    stack: this.config.includeStack ? error.stack : undefined
                },
                request: {
                    url: req.url,
                    method: req.method,
                    userAgent: req.headers['user-agent']
                },
                timestamp: new Date().toISOString()
            };

            // Classify error type and determine appropriate response strategy
            const classification = await this.classifyError(error);
            errorContext.classification = classification;

            this.logger.error('Error intercepted by ErrorMiddleware', errorContext);

            // Sanitize error information for secure response generation
            const sanitizedError = await this.sanitizeError(error, {
                includeStack: this.config.includeStack && isDevelopment,
                includeDetails: isDevelopment
            });

            // Generate error response using response generator with secure messaging
            await this.generateErrorResponse(res, error, sanitizedError, classification);

            // Update error statistics and trigger monitoring alerts if necessary
            const handlingTime = performance.now() - startTime;
            this.updateStatistics(classification.type, handlingTime);

            // Complete error handling without calling next() to terminate error propagation
            this.logger.info('Error handling completed successfully', {
                correlationId,
                handlingTime: `${handlingTime.toFixed(2)}ms`,
                errorType: classification.type
            });

        } catch (middlewareError) {
            const handlingTime = performance.now() - startTime;
            
            this.logger.error('Critical error in ErrorMiddleware', {
                middlewareError: middlewareError.message,
                originalError: error?.message,
                handlingTime: `${handlingTime.toFixed(2)}ms`
            });

            // Emergency fallback response
            try {
                if (res && !res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Critical Server Error');
                }
            } catch (emergencyError) {
                this.logger.error('Emergency response failed', {
                    error: emergencyError.message
                });
            }
        }
    }

    /**
     * Handles critical system errors that may require application shutdown or restart,
     * including comprehensive logging and graceful shutdown coordination.
     * 
     * @param {Error} error - Critical error object requiring special handling
     * @param {Object} context - Error context including request information if available
     * @returns {Promise<void>} Promise resolving when critical error handling is complete
     */
    async handleCriticalError(error, context = {}) {
        try {
            // Log critical error with highest priority level for immediate attention
            this.logger.error('CRITICAL ERROR: System stability compromised', {
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                },
                context,
                processId: process.pid,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });

            // Evaluate error severity and determine if shutdown is required
            const requiresShutdown = this.evaluateShutdownNecessity(error);
            
            // Update critical error statistics for post-incident analysis
            this.stats.criticalErrors++;

            // Notify monitoring systems of critical error condition
            if (this.config.monitoringIntegration) {
                await this.notifyMonitoringSystems(error, context);
            }

            // Attempt graceful shutdown if error indicates system instability
            if (requiresShutdown && this.config.gracefulShutdown) {
                await this.initiateGracefulShutdown(error);
            }

        } catch (criticalHandlerError) {
            // Log failure in critical error handling
            console.error('FATAL: Critical error handler failed:', criticalHandlerError.message);
            console.error('Original critical error:', error.message);
            
            // Force exit if critical error handling fails
            process.exit(1);
        }
    }

    /**
     * Wraps async handler functions to ensure errors are properly caught and forwarded
     * to error middleware, preventing unhandled Promise rejections.
     * 
     * @param {Function} asyncHandler - Async handler function to wrap with error catching
     * @returns {Function} Wrapped handler function that forwards errors to middleware
     */
    wrapAsyncHandler(asyncHandler) {
        const self = this;
        
        // Return middleware function that wraps original handler
        return async function wrappedAsyncHandler(req, res, next) {
            try {
                // Execute original handler within try-catch block for error capture
                await asyncHandler(req, res, next);
            } catch (error) {
                // Handle both thrown errors and Promise rejections
                self.logger.error('Async error caught by ErrorMiddleware wrapper', {
                    error: {
                        message: error.message,
                        name: error.name,
                        stack: self.config.includeStack ? error.stack : undefined
                    },
                    handlerName: asyncHandler.name || 'anonymous',
                    url: req.url,
                    method: req.method
                });

                // Forward captured errors to error middleware through next() call
                next(error);
            }
        };
    }

    /**
     * Returns comprehensive error handling statistics for monitoring and performance analysis,
     * including error counts, timing metrics, and system health indicators.
     * 
     * @returns {Object} Error statistics with counts, timing, types, and trends
     */
    getStatistics() {
        try {
            // Collect error count statistics by type and severity
            const totalErrors = this.stats.errorsHandled;
            const uptime = (Date.now() - this.stats.startTime) / 1000; // seconds

            // Calculate error handling performance metrics and averages
            const averageHandlingTime = totalErrors > 0 ? 
                this.stats.totalHandlingTime / totalErrors : 0;

            // Include error rate trends and frequency analysis
            const errorRate = totalErrors > 0 ? (totalErrors / (uptime / 60)) : 0; // errors per minute

            // Add memory usage and resource consumption statistics
            const memoryUsage = process.memoryUsage();
            const systemStats = {
                uptime: uptime,
                processId: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                memoryUsage: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
                }
            };

            // Return formatted statistics object for monitoring integration
            const statisticsReport = {
                summary: {
                    totalErrors: totalErrors,
                    errorRate: Math.round(errorRate * 100) / 100,
                    averageHandlingTime: Math.round(averageHandlingTime * 100) / 100,
                    criticalErrors: this.stats.criticalErrors,
                    lastErrorTime: this.stats.lastErrorTime,
                    isShuttingDown: this.isShuttingDown
                },
                errorsByType: { ...this.stats.errorsByType },
                performance: {
                    totalHandlingTime: this.stats.totalHandlingTime,
                    averageHandlingTime: averageHandlingTime,
                    handlingTimeThreshold: 100,
                    peakHandlingTime: this.stats.peakHandlingTime || 0
                },
                configuration: {
                    enabled: this.config.enabled,
                    logLevel: this.config.logLevel,
                    includeStack: this.config.includeStack,
                    gracefulShutdown: this.config.gracefulShutdown,
                    sanitizeResponse: this.config.sanitizeResponse
                },
                system: systemStats,
                timestamp: new Date().toISOString()
            };

            return statisticsReport;

        } catch (statsError) {
            this.logger.error('Failed to compile error statistics', {
                error: statsError.message
            });

            return {
                error: true,
                errorMessage: statsError.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Private helper methods

    /**
     * Extracts or generates correlation ID for request tracking
     * @private
     * @param {Object} req - HTTP request object
     * @returns {string} Correlation ID for request tracking
     */
    getCorrelationId(req) {
        return getCurrentContext() || 
               req.correlationId || 
               req.headers['x-correlation-id'] || 
               `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Classifies error using error handler with fallback classification
     * @private
     * @param {Error} error - Error object to classify
     * @returns {Object} Error classification with type and severity
     */
    async classifyError(error) {
        try {
            return await classifyError(error);
        } catch (classificationError) {
            this.logger.warn('Error classification failed, using default', {
                error: classificationError.message
            });
            return {
                type: 'SERVER_ERROR',
                severity: 'MEDIUM',
                category: 'UNKNOWN'
            };
        }
    }

    /**
     * Sanitizes error for safe response generation
     * @private
     * @param {Error} error - Error object to sanitize
     * @param {Object} options - Sanitization options
     * @returns {Object} Sanitized error information
     */
    async sanitizeError(error, options = {}) {
        try {
            return await sanitizeError(error, options);
        } catch (sanitizationError) {
            this.logger.warn('Error sanitization failed, using minimal safe response', {
                error: sanitizationError.message
            });
            return {
                message: 'Internal Server Error',
                statusCode: 500
            };
        }
    }

    /**
     * Generates appropriate error response based on classification
     * @private
     * @param {Object} res - HTTP response object
     * @param {Error} error - Original error object
     * @param {Object} sanitizedError - Sanitized error information
     * @param {Object} classification - Error classification
     */
    async generateErrorResponse(res, error, sanitizedError, classification) {
        try {
            let statusCode = 500;
            let message = this.responseTemplates.generic;

            switch (classification.type) {
                case 'CLIENT_ERROR':
                    statusCode = error.statusCode || 400;
                    message = this.responseTemplates.badRequest;
                    break;
                case 'SYSTEM_ERROR':
                    statusCode = 503;
                    message = this.responseTemplates.unavailable;
                    break;
                case 'FATAL_ERROR':
                    statusCode = 500;
                    message = this.responseTemplates.generic;
                    break;
                default:
                    statusCode = 500;
                    message = this.responseTemplates.generic;
            }

            if (statusCode === 500) {
                await sendInternalError(res, sanitizedError);
            } else {
                await generateErrorResponse(res, statusCode, message);
            }

        } catch (responseError) {
            this.logger.error('Failed to generate error response', {
                error: responseError.message
            });

            // Final fallback
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error');
            }
        }
    }

    /**
     * Updates internal error statistics
     * @private
     * @param {string} errorType - Type of error for statistics
     * @param {number} handlingTime - Time taken to handle error
     */
    updateStatistics(errorType, handlingTime) {
        this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
        this.stats.totalHandlingTime += handlingTime;
        
        if (!this.stats.peakHandlingTime || handlingTime > this.stats.peakHandlingTime) {
            this.stats.peakHandlingTime = handlingTime;
        }
    }

    /**
     * Sets up global error handlers for the instance
     * @private
     */
    setupGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            this.handleCriticalError(error, { source: 'uncaughtException' });
        });

        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.handleCriticalError(error, { source: 'unhandledRejection', promise });
        });
    }

    /**
     * Evaluates whether an error requires application shutdown
     * @private
     * @param {Error} error - Error to evaluate
     * @returns {boolean} True if shutdown is required
     */
    evaluateShutdownNecessity(error) {
        const criticalErrorPatterns = [
            /EADDRINUSE/,
            /ENOENT.*package\.json/,
            /Cannot read property.*of undefined/,
            /ReferenceError/,
            /SyntaxError/
        ];

        return criticalErrorPatterns.some(pattern => pattern.test(error.message)) ||
               error.name === 'FatalError' ||
               error.severity === 'CRITICAL';
    }

    /**
     * Initiates graceful application shutdown
     * @private
     * @param {Error} error - Error that triggered shutdown
     */
    async initiateGracefulShutdown(error) {
        if (this.isShuttingDown) {
            return; // Already shutting down
        }

        this.isShuttingDown = true;
        this.stats.gracefulShutdowns++;

        this.logger.error('Initiating graceful shutdown due to critical error', {
            error: error.message,
            shutdownTimeout: this.config.shutdownTimeout
        });

        // Set shutdown timeout
        this.shutdownTimer = setTimeout(() => {
            this.logger.error('Graceful shutdown timeout, forcing exit');
            process.exit(1);
        }, this.config.shutdownTimeout);

        try {
            // Execute shutdown handlers
            for (const handler of this.shutdownHandlers) {
                await handler();
            }

            clearTimeout(this.shutdownTimer);
            process.exit(1);
        } catch (shutdownError) {
            this.logger.error('Error during graceful shutdown', {
                error: shutdownError.message
            });
            clearTimeout(this.shutdownTimer);
            process.exit(1);
        }
    }

    /**
     * Notifies monitoring systems of critical errors
     * @private
     * @param {Error} error - Critical error
     * @param {Object} context - Error context
     */
    async notifyMonitoringSystems(error, context) {
        // This would integrate with external monitoring services
        // For the tutorial, we'll just log the notification
        this.logger.error('MONITORING ALERT: Critical error detected', {
            error: error.message,
            context,
            severity: 'CRITICAL',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Updates internal error statistics with new error data for performance tracking
 * @private
 * @param {string} errorType - Type of error processed
 * @param {number} handlingTime - Time taken to handle error in milliseconds
 * @param {string} severity - Error severity level
 */
function updateErrorStatistics(errorType, handlingTime, severity = 'MEDIUM') {
    try {
        MIDDLEWARE_STATS.errorsHandled++;
        MIDDLEWARE_STATS.totalHandlingTime += handlingTime;
        MIDDLEWARE_STATS.averageHandlingTime = MIDDLEWARE_STATS.totalHandlingTime / MIDDLEWARE_STATS.errorsHandled;
        MIDDLEWARE_STATS.lastErrorTime = new Date().toISOString();

        // Update error type counters
        if (MIDDLEWARE_STATS.errorsByType[errorType] !== undefined) {
            MIDDLEWARE_STATS.errorsByType[errorType]++;
        } else {
            MIDDLEWARE_STATS.errorsByType[errorType] = 1;
        }

        // Track critical errors separately
        if (severity === 'CRITICAL' || severity === 'HIGH') {
            MIDDLEWARE_STATS.criticalErrors++;
        }

        // Track peak handling time
        if (!MIDDLEWARE_STATS.peakHandlingTime || handlingTime > MIDDLEWARE_STATS.peakHandlingTime) {
            MIDDLEWARE_STATS.peakHandlingTime = handlingTime;
        }

    } catch (statsError) {
        logError('Failed to update error statistics', {
            error: statsError.message,
            errorType,
            handlingTime
        });
    }
}

/**
 * Handles critical errors that may compromise system stability
 * @private
 * @param {Error} error - Critical error object
 * @param {Object} context - Error context and metadata
 */
async function handleCriticalError(error, context) {
    try {
        logError('CRITICAL SYSTEM ERROR: Immediate attention required', {
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack
            },
            context,
            processInfo: {
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            timestamp: new Date().toISOString()
        });

        // Update critical error statistics
        MIDDLEWARE_STATS.criticalErrors++;

        // In a production environment, this would trigger alerts to monitoring systems
        // For the tutorial, we'll demonstrate proper logging and graceful handling

    } catch (criticalError) {
        console.error('FATAL: Failed to handle critical error:', criticalError.message);
        console.error('Original critical error:', error.message);
    }
}

// Create and export default error middleware instance configured with environment settings
const errorMiddlewareInstance = new ErrorMiddleware({
    enabled: true,
    logLevel: 'error',
    includeStack: isDevelopment,
    sanitizeResponse: true,
    gracefulShutdown: isProduction,
    setupGlobalHandlers: true,
    environment: environment
});

// Export main error middleware function for Express-style error handling
export { errorMiddleware };

// Export ErrorMiddleware class for creating custom error middleware instances
export { ErrorMiddleware };

// Export utility functions for async error handling and global error setup
export { handleAsyncError, setupErrorHandlers };

// Export statistics and monitoring functions
export { getErrorStats };

// Export error configuration and templates for testing and customization
export { ERROR_MIDDLEWARE_CONFIG, ERROR_RESPONSE_TEMPLATES, MIDDLEWARE_STATS };

// Export default error middleware instance configured with environment settings for immediate use
export { errorMiddlewareInstance };

// Export the default configured error middleware instance as default export
export default errorMiddlewareInstance;