/**
 * Node.js Tutorial HTTP Server - Error Handler Component
 * 
 * Centralized error handling component that provides comprehensive error processing, classification, 
 * and response generation for the Node.js tutorial HTTP server application. Manages client errors, 
 * server errors, security validation, and consistent error response formatting while ensuring secure 
 * error messaging that prevents information disclosure and maintains zero external dependencies.
 * 
 * This component demonstrates enterprise-grade error handling patterns including error classification,
 * secure error messaging, comprehensive logging with correlation tracking, and integration with 
 * response generation and security components for complete request processing error management.
 * 
 * Educational Features:
 * - Comprehensive error classification system for different error types and severity levels
 * - Security-focused error handling that prevents information disclosure through sanitized responses
 * - Integration patterns with logging, response generation, and monitoring systems
 * - HTTP status code management and appropriate error response formatting
 * - Correlation tracking and structured logging for error debugging and monitoring
 * 
 * Dependencies: Node.js built-in modules only (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import Node.js built-in utility module for error object inspection and stack trace formatting
import util from 'node:util'; // Node.js built-in

// Import Node.js built-in performance API for error handling timing and performance monitoring
import { performance } from 'node:perf_hooks'; // Node.js built-in

// Import logging functionality for error event tracking, correlation, and monitoring with secure information filtering
import { logger } from './logger.js';

// Import HTTP response generation functions for consistent error response formatting
import { 
    sendNotFound, 
    sendMethodNotAllowed, 
    sendInternalError, 
    generateErrorResponse 
} from './response-generator.js';

// Import environment configuration for error handling behavior and information disclosure controls
import { config } from '../config/environment.js';

// Import server configuration for error handling thresholds and security settings
import { serverConfig } from '../config/server-config.js';

// Global error type constants for error classification and handling strategy determination
const ERROR_TYPES = {
    CLIENT_ERROR: 'client_error',
    SERVER_ERROR: 'server_error', 
    SYSTEM_ERROR: 'system_error',
    FATAL_ERROR: 'fatal_error'
};

// Global HTTP error codes for standardized status code management across all error responses
const HTTP_ERROR_CODES = {
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

// Global standard error messages for consistent client-facing error messaging
const ERROR_MESSAGES = {
    NOT_FOUND: 'Not Found',
    METHOD_NOT_ALLOWED: 'Method Not Allowed',
    INTERNAL_ERROR: 'Internal Server Error',
    BAD_REQUEST: 'Bad Request'
};

// Global sensitive field names for error message sanitization and information disclosure prevention
const SENSITIVE_FIELDS = [
    'password',
    'token', 
    'key',
    'secret',
    'auth',
    'session'
];

/**
 * Main error handling function that classifies errors, logs detailed information, and generates 
 * appropriate HTTP responses based on error type and severity
 * @param {Error} error - Error object with message, stack trace, and error details
 * @param {object} req - HTTP IncomingMessage object for error context and correlation
 * @param {object} res - HTTP ServerResponse object for error response generation
 * @param {object} options - Optional error handling configuration including correlation ID and context
 * @returns {Promise<void>} Promise resolving when error handling and response generation is complete
 */
export async function handleError(error, req, res, options = {}) {
    try {
        // Extract correlation ID from request context or generate new ID for error tracking
        const correlationId = options.correlationId || 
            req.headers['x-correlation-id'] || 
            `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start error handling performance measurement for operational monitoring
        const startTime = performance.now();
        
        // Classify error type and severity using error classification logic
        const classification = classifyError(error, { req, correlationId });
        
        // Sanitize error information to remove sensitive data before logging
        const sanitizedError = sanitizeErrorMessage(error, config.isDevelopment);
        
        // Log detailed error information with correlation ID and request context
        logErrorEvent(classification.type, sanitizedError, {
            req,
            correlationId,
            classification,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress,
            requestSize: req.headers['content-length'] || 0
        }, correlationId);
        
        // Determine appropriate HTTP status code based on error type and classification
        let statusCode;
        let errorMessage;
        
        switch (classification.type) {
            case ERROR_TYPES.CLIENT_ERROR:
                statusCode = classification.statusCode || HTTP_ERROR_CODES.BAD_REQUEST;
                errorMessage = classification.message || ERROR_MESSAGES.BAD_REQUEST;
                break;
            case ERROR_TYPES.SERVER_ERROR:
                statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR;
                errorMessage = ERROR_MESSAGES.INTERNAL_ERROR;
                break;
            case ERROR_TYPES.SYSTEM_ERROR:
                statusCode = HTTP_ERROR_CODES.SERVICE_UNAVAILABLE;
                errorMessage = 'Service Temporarily Unavailable';
                break;
            case ERROR_TYPES.FATAL_ERROR:
                statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR;
                errorMessage = ERROR_MESSAGES.INTERNAL_ERROR;
                break;
            default:
                statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR;
                errorMessage = ERROR_MESSAGES.INTERNAL_ERROR;
        }
        
        // Generate secure error response using response generator with sanitized messaging
        const responseContext = {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method
        };
        
        await generateErrorResponse(res, statusCode, errorMessage, responseContext);
        
        // Calculate error handling processing time for performance monitoring
        const processingTime = performance.now() - startTime;
        
        // Update error metrics and monitoring counters for operational visibility
        updateErrorStats(classification.type, statusCode, processingTime);
        
        // Handle critical error scenarios with escalation if necessary
        if (classification.type === ERROR_TYPES.FATAL_ERROR) {
            logger.error('Fatal error detected - system stability at risk', {
                error: sanitizedError,
                correlationId,
                processingTime,
                classification
            });
        }
        
        // Log successful error handling completion with performance metrics
        logger.info('Error handling completed successfully', {
            correlationId,
            statusCode,
            processingTime: `${processingTime.toFixed(2)}ms`,
            errorType: classification.type
        });
        
    } catch (handlingError) {
        // Handle response generation errors with fallback error responses
        logger.error('Error occurred during error handling', {
            originalError: error.message,
            handlingError: handlingError.message,
            correlationId: options.correlationId,
            stack: handlingError.stack
        });
        
        // Fallback error response generation for critical error handling failures
        try {
            if (!res.headersSent) {
                res.statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR;
                res.setHeader('Content-Type', 'text/plain');
                res.end(ERROR_MESSAGES.INTERNAL_ERROR);
            }
        } catch (fallbackError) {
            logger.error('Fallback error response failed', {
                error: fallbackError.message,
                originalError: error.message
            });
        }
    }
}

/**
 * Handles HTTP 404 Not Found errors for unknown paths and resources with consistent response 
 * formatting and logging
 * @param {object} req - HTTP request object with URL and method information
 * @param {object} res - HTTP response object for 404 error response generation
 * @param {string} message - Optional custom not found message
 * @returns {Promise<void>} Promise resolving when 404 error response is sent to client
 */
export async function handleNotFound(req, res, message = null) {
    try {
        // Extract request path and method for error context logging
        const requestPath = req.url || 'unknown';
        const requestMethod = req.method || 'unknown';
        
        // Generate correlation ID for 404 error tracking and debugging
        const correlationId = `404-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Log 404 error with request details and client information
        logger.warn('404 Not Found error', {
            path: requestPath,
            method: requestMethod,
            correlationId,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress,
            referer: req.headers['referer'] || 'none'
        });
        
        // Use response generator to send HTTP 404 Not Found response
        await sendNotFound(res, {
            path: requestPath,
            correlationId,
            customMessage: message
        });
        
        // Update 404 error statistics for monitoring and analysis
        updateErrorStats(ERROR_TYPES.CLIENT_ERROR, HTTP_ERROR_CODES.NOT_FOUND, 0);
        
        logger.info('404 Not Found response sent successfully', {
            correlationId,
            path: requestPath,
            method: requestMethod
        });
        
    } catch (error) {
        logger.error('Failed to handle 404 Not Found error', {
            error: error.message,
            path: req.url,
            method: req.method,
            stack: error.stack
        });
        
        // Fallback 404 response for handling errors
        if (!res.headersSent) {
            res.statusCode = HTTP_ERROR_CODES.NOT_FOUND;
            res.setHeader('Content-Type', 'text/plain');
            res.end(ERROR_MESSAGES.NOT_FOUND);
        }
    }
}

/**
 * Handles HTTP 405 Method Not Allowed errors for unsupported HTTP methods with Allow header generation
 * @param {object} req - HTTP request object with unsupported method
 * @param {object} res - HTTP response object for 405 error response
 * @param {array} allowedMethods - Array of supported HTTP methods for Allow header
 * @returns {Promise<void>} Promise resolving when 405 error response with Allow header is sent
 */
export async function handleMethodNotAllowed(req, res, allowedMethods = ['GET']) {
    try {
        // Extract HTTP method from request for error logging
        const requestMethod = req.method || 'unknown';
        const requestPath = req.url || 'unknown';
        
        // Validate allowed methods array and format for Allow header
        const validAllowedMethods = Array.isArray(allowedMethods) ? 
            allowedMethods.filter(method => typeof method === 'string') : ['GET'];
        
        // Generate correlation ID for method not allowed error tracking
        const correlationId = `405-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Log method not allowed error with request details and correlation
        logger.warn('405 Method Not Allowed error', {
            method: requestMethod,
            path: requestPath,
            allowedMethods: validAllowedMethods,
            correlationId,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress
        });
        
        // Use response generator to send 405 Method Not Allowed with Allow header
        await sendMethodNotAllowed(res, {
            method: requestMethod,
            allowedMethods: validAllowedMethods,
            correlationId
        });
        
        // Update method validation error statistics for security monitoring
        updateErrorStats(ERROR_TYPES.CLIENT_ERROR, HTTP_ERROR_CODES.METHOD_NOT_ALLOWED, 0);
        
        logger.info('405 Method Not Allowed response sent successfully', {
            correlationId,
            method: requestMethod,
            path: requestPath,
            allowedMethods: validAllowedMethods
        });
        
    } catch (error) {
        logger.error('Failed to handle 405 Method Not Allowed error', {
            error: error.message,
            method: req.method,
            path: req.url,
            stack: error.stack
        });
        
        // Fallback 405 response for handling errors
        if (!res.headersSent) {
            res.statusCode = HTTP_ERROR_CODES.METHOD_NOT_ALLOWED;
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Allow', allowedMethods.join(', '));
            res.end(ERROR_MESSAGES.METHOD_NOT_ALLOWED);
        }
    }
}

/**
 * Handles HTTP 500 Internal Server Error with secure error messaging that prevents sensitive 
 * information disclosure
 * @param {Error} error - Internal error object with stack trace and details
 * @param {object} req - HTTP request object for error context
 * @param {object} res - HTTP response object for internal error response
 * @returns {Promise<void>} Promise resolving when internal error response is generated
 */
export async function handleInternalError(error, req, res) {
    try {
        // Extract detailed error information including stack trace
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            timestamp: new Date().toISOString()
        };
        
        // Generate correlation ID for internal error tracking and debugging
        const correlationId = `500-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Sanitize error details to remove sensitive information
        const sanitizedError = sanitizeErrorMessage(error, config.isDevelopment);
        
        // Log full internal error details with correlation and context
        logger.error('500 Internal Server Error', {
            error: errorDetails,
            sanitizedError,
            correlationId,
            path: req.url,
            method: req.method,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress,
            requestHeaders: req.headers,
            timestamp: errorDetails.timestamp
        });
        
        // Generate generic internal error response for client
        const responseContext = {
            correlationId,
            timestamp: errorDetails.timestamp,
            path: req.url,
            method: req.method
        };
        
        // Use response generator to send secure 500 Internal Server Error
        await sendInternalError(res, responseContext);
        
        // Update internal error statistics and trigger monitoring alerts
        updateErrorStats(ERROR_TYPES.SERVER_ERROR, HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR, 0);
        
        // Handle critical error scenarios with escalation if necessary
        if (shouldEscalateError(error)) {
            logger.error('Critical internal error requires escalation', {
                correlationId,
                error: sanitizedError,
                escalationRequired: true,
                severity: 'HIGH'
            });
        }
        
        logger.info('500 Internal Server Error response sent successfully', {
            correlationId,
            path: req.url,
            method: req.method
        });
        
    } catch (handlingError) {
        logger.error('Failed to handle 500 Internal Server Error', {
            originalError: error.message,
            handlingError: handlingError.message,
            path: req.url,
            method: req.method,
            stack: handlingError.stack
        });
        
        // Fallback 500 response for handling errors
        if (!res.headersSent) {
            res.statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR;
            res.setHeader('Content-Type', 'text/plain');
            res.end(ERROR_MESSAGES.INTERNAL_ERROR);
        }
    }
}

/**
 * Handles HTTP 400 Bad Request errors for malformed requests and validation failures
 * @param {object} req - HTTP request object with validation issues
 * @param {object} res - HTTP response object for bad request error response
 * @param {string} validationMessage - Specific validation failure message
 * @returns {Promise<void>} Promise resolving when bad request response is sent
 */
export async function handleBadRequest(req, res, validationMessage = 'Bad Request') {
    try {
        // Extract request validation failure details for logging
        const requestDetails = {
            url: req.url,
            method: req.method,
            headers: req.headers,
            contentLength: req.headers['content-length'] || 0
        };
        
        // Sanitize validation message to prevent information disclosure
        const sanitizedMessage = sanitizeValidationMessage(validationMessage);
        
        // Generate correlation ID for bad request error tracking
        const correlationId = `400-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Log bad request error with validation context and correlation
        logger.warn('400 Bad Request error', {
            ...requestDetails,
            validationMessage: sanitizedMessage,
            correlationId,
            userAgent: req.headers['user-agent'],
            clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress,
            timestamp: new Date().toISOString()
        });
        
        // Generate appropriate 400 Bad Request response with safe messaging
        const responseContext = {
            correlationId,
            timestamp: new Date().toISOString(),
            validationMessage: sanitizedMessage
        };
        
        await generateErrorResponse(res, HTTP_ERROR_CODES.BAD_REQUEST, ERROR_MESSAGES.BAD_REQUEST, responseContext);
        
        // Update request validation error statistics for security analysis
        updateErrorStats(ERROR_TYPES.CLIENT_ERROR, HTTP_ERROR_CODES.BAD_REQUEST, 0);
        
        logger.info('400 Bad Request response sent successfully', {
            correlationId,
            path: req.url,
            method: req.method,
            validationMessage: sanitizedMessage
        });
        
    } catch (error) {
        logger.error('Failed to handle 400 Bad Request error', {
            error: error.message,
            path: req.url,
            method: req.method,
            validationMessage,
            stack: error.stack
        });
        
        // Fallback 400 response for handling errors
        if (!res.headersSent) {
            res.statusCode = HTTP_ERROR_CODES.BAD_REQUEST;
            res.setHeader('Content-Type', 'text/plain');
            res.end(ERROR_MESSAGES.BAD_REQUEST);
        }
    }
}

/**
 * Classifies errors into categories for appropriate handling including client errors, server errors, 
 * system errors, and fatal errors
 * @param {Error} error - Error object to classify based on type and properties
 * @param {object} context - Error context including request information
 * @returns {object} Error classification with type, severity, and recommended handling approach
 */
export function classifyError(error, context = {}) {
    try {
        // Analyze error type and error code to determine classification
        const errorCode = error.code;
        const errorMessage = error.message || '';
        const errorName = error.name || 'Error';
        
        // Check error message patterns for known error categories
        const messagePatterns = {
            clientErrors: [/bad request/i, /invalid/i, /malformed/i, /validation/i],
            systemErrors: [/ECONNREFUSED/i, /ENOTFOUND/i, /ETIMEDOUT/i, /EADDRINUSE/i, /EMFILE/i, /ENOMEM/i],
            fatalErrors: [/out of memory/i, /stack overflow/i, /segmentation fault/i]
        };
        
        // Evaluate error context for request-related vs system-related errors
        const isRequestError = context.req && (
            errorMessage.includes('request') || 
            errorMessage.includes('header') ||
            errorMessage.includes('method')
        );
        
        // Determine error severity based on impact and frequency
        let classification = {
            type: ERROR_TYPES.SERVER_ERROR,
            severity: 'MEDIUM',
            statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            recoverable: true,
            escalationRequired: false
        };
        
        // Classify based on error patterns and context
        if (messagePatterns.clientErrors.some(pattern => pattern.test(errorMessage)) || isRequestError) {
            classification = {
                type: ERROR_TYPES.CLIENT_ERROR,
                severity: 'LOW',
                statusCode: HTTP_ERROR_CODES.BAD_REQUEST,
                message: ERROR_MESSAGES.BAD_REQUEST,
                recoverable: true,
                escalationRequired: false
            };
        } else if (messagePatterns.systemErrors.some(pattern => pattern.test(errorMessage)) || errorCode) {
            classification = {
                type: ERROR_TYPES.SYSTEM_ERROR,
                severity: 'HIGH',
                statusCode: HTTP_ERROR_CODES.SERVICE_UNAVAILABLE,
                message: 'Service Temporarily Unavailable',
                recoverable: true,
                escalationRequired: true
            };
        } else if (messagePatterns.fatalErrors.some(pattern => pattern.test(errorMessage))) {
            classification = {
                type: ERROR_TYPES.FATAL_ERROR,
                severity: 'CRITICAL',
                statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
                recoverable: false,
                escalationRequired: true
            };
        }
        
        // Include recovery suggestions and escalation requirements
        const recoverySuggestions = generateRecoverySuggestions(classification.type, error);
        
        // Return classification with recommended handling strategy
        return {
            ...classification,
            errorCode,
            errorName,
            timestamp: new Date().toISOString(),
            recoverySuggestions,
            context: {
                url: context.req?.url,
                method: context.req?.method,
                correlationId: context.correlationId
            }
        };
        
    } catch (classificationError) {
        logger.error('Failed to classify error', {
            error: classificationError.message,
            originalError: error.message
        });
        
        // Return default classification for classification failures
        return {
            type: ERROR_TYPES.SERVER_ERROR,
            severity: 'MEDIUM',
            statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            recoverable: true,
            escalationRequired: false,
            timestamp: new Date().toISOString(),
            classificationError: true
        };
    }
}

/**
 * Sanitizes error messages and stack traces to remove sensitive information while preserving 
 * debugging value
 * @param {Error} error - Error object with potentially sensitive information
 * @param {boolean} includeStack - Whether to include sanitized stack trace information
 * @returns {object} Sanitized error object safe for logging and client responses
 */
export function sanitizeErrorMessage(error, includeStack = false) {
    try {
        // Remove sensitive field values from error messages
        let sanitizedMessage = error.message || '';
        
        SENSITIVE_FIELDS.forEach(field => {
            const patterns = [
                new RegExp(`${field}[\\s]*[:=][\\s]*[\\S]+`, 'gi'),
                new RegExp(`"${field}"[\\s]*:[\\s]*"[^"]*"`, 'gi'),
                new RegExp(`'${field}'[\\s]*:[\\s]*'[^']*'`, 'gi')
            ];
            
            patterns.forEach(pattern => {
                sanitizedMessage = sanitizedMessage.replace(pattern, `${field}: [REDACTED]`);
            });
        });
        
        // Sanitize file paths and system information in stack traces
        let sanitizedStack = '';
        if (includeStack && error.stack) {
            sanitizedStack = error.stack
                .split('\n')
                .map(line => {
                    // Remove absolute file paths
                    let sanitizedLine = line.replace(/\/[^\s]+\//g, '/[PATH]/');
                    
                    // Remove sensitive environment variables
                    sanitizedLine = sanitizedLine.replace(/process\.env\.[A-Z_]+/g, 'process.env.[VAR]');
                    
                    // Remove system information
                    sanitizedLine = sanitizedLine.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
                    
                    return sanitizedLine;
                })
                .join('\n');
        }
        
        // Filter out sensitive environment variables and configuration details
        const sanitizedError = {
            name: error.name || 'Error',
            message: sanitizedMessage,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            timestamp: new Date().toISOString()
        };
        
        // Preserve essential debugging information for development environments
        if (includeStack && sanitizedStack) {
            sanitizedError.stack = sanitizedStack;
        }
        
        // Apply environment-specific sanitization rules
        if (!config.isDevelopment) {
            // Remove additional technical details in production
            delete sanitizedError.syscall;
            delete sanitizedError.errno;
        }
        
        // Return sanitized error object suitable for secure logging
        return sanitizedError;
        
    } catch (sanitizationError) {
        logger.error('Failed to sanitize error message', {
            error: sanitizationError.message,
            originalError: error.message
        });
        
        return {
            name: 'Error',
            message: 'Error details unavailable due to sanitization failure',
            timestamp: new Date().toISOString(),
            sanitizationFailed: true
        };
    }
}

/**
 * Logs error events with correlation, context, and performance metrics for monitoring and debugging
 * @param {string} errorType - Type of error event for categorization
 * @param {Error} error - Error object with details
 * @param {object} context - Error context including request information
 * @param {string} correlationId - Request correlation identifier
 * @returns {void} No return value - logs error event information
 */
export function logErrorEvent(errorType, error, context, correlationId) {
    try {
        // Format error log message with event type and severity
        const logMessage = `Error Event: ${errorType}`;
        
        // Include correlation ID for request tracking across components
        const logContext = {
            correlationId,
            errorType,
            error: {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            },
            request: {
                url: context.req?.url,
                method: context.req?.method,
                headers: context.req?.headers,
                userAgent: context.userAgent,
                clientIp: context.clientIp,
                requestSize: context.requestSize
            },
            classification: context.classification,
            timestamp: new Date().toISOString(),
            performance: {
                handlingStartTime: context.handlingStartTime,
                memoryUsage: process.memoryUsage()
            }
        };
        
        // Set appropriate log level based on error type and severity
        switch (errorType) {
            case ERROR_TYPES.CLIENT_ERROR:
                logger.warn(logMessage, logContext);
                break;
            case ERROR_TYPES.SERVER_ERROR:
                logger.error(logMessage, logContext);
                break;
            case ERROR_TYPES.SYSTEM_ERROR:
                logger.error(logMessage, logContext);
                break;
            case ERROR_TYPES.FATAL_ERROR:
                logger.error(logMessage, {
                    ...logContext,
                    severity: 'CRITICAL',
                    escalationRequired: true
                });
                break;
            default:
                logger.error(logMessage, logContext);
        }
        
        // Log additional performance metrics if available
        if (context.processingTime) {
            logger.info('Error handling performance metrics', {
                correlationId,
                processingTime: context.processingTime,
                errorType,
                handlingDuration: `${context.processingTime}ms`
            });
        }
        
    } catch (loggingError) {
        // Fallback logging for logging failures
        console.error('Failed to log error event:', {
            loggingError: loggingError.message,
            originalErrorType: errorType,
            correlationId,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Comprehensive error handling class that encapsulates error processing, classification, response 
 * generation, and monitoring with security-focused error management and consistent response formatting
 */
export class ErrorHandler {
    /**
     * Initializes error handler with configuration, logging, response generation, and security 
     * settings for comprehensive error management
     * @param {object} options - Configuration options including environment settings, security policies, and response behavior
     */
    constructor(options = {}) {
        try {
            // Load error handler configuration from environment and server settings
            this.config = {
                environment: config.environment,
                isDevelopment: config.isDevelopment,
                isProduction: config.isProduction,
                includeStackTraces: config.isDevelopment,
                ...serverConfig.errorHandling,
                ...options
            };
            
            // Initialize logger instance for error event tracking and correlation
            this.logger = logger;
            
            // Set up response generator for consistent error response formatting
            this.responseGenerator = { 
                sendNotFound, 
                sendMethodNotAllowed, 
                sendInternalError, 
                generateErrorResponse 
            };
            
            // Initialize error statistics tracking for monitoring and analysis
            this.errorStats = {
                totalErrors: 0,
                errorsByType: {},
                errorsByStatus: {},
                processingTimes: [],
                lastErrorTime: null,
                errorRates: {
                    perMinute: 0,
                    perHour: 0,
                    perDay: 0
                }
            };
            
            // Configure security settings for error message sanitization and information disclosure prevention
            this.securityConfig = {
                sanitizeErrors: config.isProduction,
                includeStackTraces: config.isDevelopment,
                maxStackTraceLines: 10,
                sensitiveFields: [...SENSITIVE_FIELDS],
                redactionPattern: '[REDACTED]'
            };
            
            // Set up error classification rules based on environment and configuration
            this.classificationRules = {
                clientErrorPatterns: [/bad request/i, /invalid/i, /malformed/i],
                systemErrorCodes: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EADDRINUSE'],
                fatalErrorPatterns: [/out of memory/i, /stack overflow/i],
                escalationThresholds: {
                    errorRate: 10, // errors per minute
                    criticalErrors: 5, // fatal errors per hour
                    systemErrors: 3 // system errors per hour
                }
            };
            
            // Configure escalation rules for critical and fatal errors
            this.escalationRules = {
                fatalErrorsRequireEscalation: true,
                systemErrorsRequireEscalation: config.isProduction,
                errorRateThreshold: 20, // errors per minute
                notificationMethods: ['logging'] // extensible for future notification methods
            };
            
            this.logger.info('ErrorHandler instance initialized', {
                environment: this.config.environment,
                securityEnabled: this.securityConfig.sanitizeErrors,
                escalationEnabled: this.escalationRules.fatalErrorsRequireEscalation,
                statisticsEnabled: true
            });
            
        } catch (initError) {
            logger.error('Failed to initialize ErrorHandler', {
                error: initError.message,
                stack: initError.stack,
                options
            });
            throw initError;
        }
    }
    
    /**
     * Primary error handling method that processes errors through classification, logging, and 
     * response generation pipeline
     * @param {Error} error - Error object to process and handle
     * @param {object} req - HTTP request object for error context
     * @param {object} res - HTTP response object for error response generation
     * @param {object} options - Optional handling configuration and context
     * @returns {Promise<void>} Promise resolving when complete error handling is finished
     */
    async handle(error, req, res, options = {}) {
        // Start error handling timer for performance monitoring
        const startTime = performance.now();
        
        try {
            // Extract correlation ID from request or generate new ID
            const correlationId = options.correlationId || 
                req.headers['x-correlation-id'] || 
                this.generateCorrelationId();
            
            // Classify error using error classification system
            const classification = this.classifyError(error, { req, correlationId });
            
            // Sanitize error information to remove sensitive data
            const sanitizedError = this.sanitizeError(error, {
                includeStack: this.securityConfig.includeStackTraces,
                maxStackLines: this.securityConfig.maxStackTraceLines
            });
            
            // Log error event with full context and correlation
            this.logErrorEvent(classification.type, sanitizedError, {
                req,
                correlationId,
                classification,
                userAgent: req.headers['user-agent'],
                clientIp: this.extractClientIp(req),
                handlingStartTime: startTime
            }, correlationId);
            
            // Generate appropriate error response using response generator
            await this.generateErrorResponse(classification, req, res, correlationId);
            
            // Complete error handling and cleanup resources
            const processingTime = performance.now() - startTime;
            
            // Update error statistics and monitoring metrics
            this.updateErrorStats(classification.type, classification.statusCode, processingTime);
            
            // Check for escalation requirements based on error patterns
            await this.checkEscalationRequirements(classification, correlationId);
            
            this.logger.info('Error handling completed successfully', {
                correlationId,
                errorType: classification.type,
                statusCode: classification.statusCode,
                processingTime: `${processingTime.toFixed(2)}ms`
            });
            
        } catch (handlingError) {
            const processingTime = performance.now() - startTime;
            
            this.logger.error('Error occurred during error handling', {
                originalError: error.message,
                handlingError: handlingError.message,
                processingTime: `${processingTime.toFixed(2)}ms`,
                stack: handlingError.stack
            });
            
            // Fallback error response for critical failures
            await this.generateFallbackResponse(res, handlingError);
        }
    }
    
    /**
     * Specialized handler for HTTP 404 Not Found errors with path-specific logging and response generation
     * @param {object} req - HTTP request with unknown path
     * @param {object} res - HTTP response object for 404 response
     * @param {string} customMessage - Optional custom not found message
     * @returns {Promise<void>} Promise resolving when 404 response is sent
     */
    async handleNotFound(req, res, customMessage = null) {
        try {
            // Extract request path and method for not found logging
            const requestPath = req.url || 'unknown';
            const requestMethod = req.method || 'unknown';
            
            // Generate correlation ID for 404 error tracking
            const correlationId = this.generateCorrelationId('404');
            
            // Log 404 event with request details and client information
            this.logger.warn('404 Not Found error handled by ErrorHandler', {
                path: requestPath,
                method: requestMethod,
                correlationId,
                userAgent: req.headers['user-agent'],
                clientIp: this.extractClientIp(req),
                referer: req.headers['referer'] || 'none',
                timestamp: new Date().toISOString()
            });
            
            // Send 404 Not Found response using response generator
            await this.responseGenerator.sendNotFound(res, {
                path: requestPath,
                correlationId,
                customMessage
            });
            
            // Update 404 statistics for path analysis and monitoring
            this.updateErrorStats(ERROR_TYPES.CLIENT_ERROR, HTTP_ERROR_CODES.NOT_FOUND, 0);
            
        } catch (error) {
            this.logger.error('Failed to handle 404 Not Found in ErrorHandler', {
                error: error.message,
                path: req.url,
                method: req.method
            });
            
            await this.generateFallbackResponse(res, error, HTTP_ERROR_CODES.NOT_FOUND);
        }
    }
    
    /**
     * Specialized handler for HTTP 405 Method Not Allowed errors with proper Allow header generation
     * @param {object} req - HTTP request with unsupported method
     * @param {object} res - HTTP response object for 405 response
     * @param {array} allowedMethods - Array of supported HTTP methods
     * @returns {Promise<void>} Promise resolving when 405 response with Allow header is sent
     */
    async handleMethodNotAllowed(req, res, allowedMethods = ['GET']) {
        try {
            // Validate and format allowed methods for Allow header
            const validMethods = this.validateAllowedMethods(allowedMethods);
            const correlationId = this.generateCorrelationId('405');
            
            // Log method not allowed event with correlation and context
            this.logger.warn('405 Method Not Allowed error handled by ErrorHandler', {
                method: req.method,
                path: req.url,
                allowedMethods: validMethods,
                correlationId,
                userAgent: req.headers['user-agent'],
                clientIp: this.extractClientIp(req)
            });
            
            // Send 405 Method Not Allowed response with Allow header
            await this.responseGenerator.sendMethodNotAllowed(res, {
                method: req.method,
                allowedMethods: validMethods,
                correlationId
            });
            
            // Update method validation statistics for security monitoring
            this.updateErrorStats(ERROR_TYPES.CLIENT_ERROR, HTTP_ERROR_CODES.METHOD_NOT_ALLOWED, 0);
            
        } catch (error) {
            this.logger.error('Failed to handle 405 Method Not Allowed in ErrorHandler', {
                error: error.message,
                method: req.method,
                path: req.url
            });
            
            await this.generateFallbackResponse(res, error, HTTP_ERROR_CODES.METHOD_NOT_ALLOWED);
        }
    }
    
    /**
     * Specialized handler for HTTP 500 Internal Server Error with secure information handling
     * @param {Error} error - Internal server error object
     * @param {object} req - HTTP request object for error context
     * @param {object} res - HTTP response object for internal error response
     * @returns {Promise<void>} Promise resolving when internal error response is generated
     */
    async handleInternalError(error, req, res) {
        try {
            // Extract and sanitize internal error details
            const correlationId = this.generateCorrelationId('500');
            const sanitizedError = this.sanitizeError(error, {
                includeStack: this.securityConfig.includeStackTraces
            });
            
            // Log full internal error information for debugging
            this.logger.error('500 Internal Server Error handled by ErrorHandler', {
                error: sanitizedError,
                correlationId,
                path: req.url,
                method: req.method,
                userAgent: req.headers['user-agent'],
                clientIp: this.extractClientIp(req),
                severity: 'HIGH',
                timestamp: new Date().toISOString()
            });
            
            // Generate secure internal error response for client
            await this.responseGenerator.sendInternalError(res, {
                correlationId,
                timestamp: new Date().toISOString()
            });
            
            // Update critical error statistics and trigger alerts
            this.updateErrorStats(ERROR_TYPES.SERVER_ERROR, HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR, 0);
            
            // Handle error escalation for critical system errors
            if (this.shouldEscalateError(error)) {
                await this.escalateError(error, correlationId, 'INTERNAL_SERVER_ERROR');
            }
            
        } catch (handlingError) {
            this.logger.error('Failed to handle 500 Internal Server Error in ErrorHandler', {
                originalError: error.message,
                handlingError: handlingError.message,
                path: req.url,
                method: req.method
            });
            
            await this.generateFallbackResponse(res, handlingError, HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR);
        }
    }
    
    /**
     * Error classification system that categorizes errors for appropriate handling and response generation
     * @param {Error} error - Error object to classify
     * @param {object} context - Classification context including request details
     * @returns {object} Error classification with type, severity, and handling recommendations
     */
    classifyError(error, context = {}) {
        try {
            // Analyze error properties and type for classification
            const errorMessage = error.message || '';
            const errorCode = error.code;
            const errorName = error.name || 'Error';
            
            // Evaluate error context and request information
            const isRequestRelated = context.req && (
                errorMessage.includes('request') ||
                errorMessage.includes('header') ||
                errorMessage.includes('method')
            );
            
            // Determine error severity and impact level
            let classification = {
                type: ERROR_TYPES.SERVER_ERROR,
                severity: 'MEDIUM',
                statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
                recoverable: true,
                escalationRequired: false,
                handlingStrategy: 'LOG_AND_RESPOND'
            };
            
            // Assign error category and handling strategy based on patterns
            if (this.classificationRules.clientErrorPatterns.some(pattern => pattern.test(errorMessage)) || isRequestRelated) {
                classification = {
                    type: ERROR_TYPES.CLIENT_ERROR,
                    severity: 'LOW',
                    statusCode: HTTP_ERROR_CODES.BAD_REQUEST,
                    message: ERROR_MESSAGES.BAD_REQUEST,
                    recoverable: true,
                    escalationRequired: false,
                    handlingStrategy: 'LOG_AND_RESPOND'
                };
            } else if (this.classificationRules.systemErrorCodes.includes(errorCode)) {
                classification = {
                    type: ERROR_TYPES.SYSTEM_ERROR,
                    severity: 'HIGH',
                    statusCode: HTTP_ERROR_CODES.SERVICE_UNAVAILABLE,
                    message: 'Service Temporarily Unavailable',
                    recoverable: true,
                    escalationRequired: this.config.isProduction,
                    handlingStrategy: 'LOG_ESCALATE_AND_RESPOND'
                };
            } else if (this.classificationRules.fatalErrorPatterns.some(pattern => pattern.test(errorMessage))) {
                classification = {
                    type: ERROR_TYPES.FATAL_ERROR,
                    severity: 'CRITICAL',
                    statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
                    message: ERROR_MESSAGES.INTERNAL_ERROR,
                    recoverable: false,
                    escalationRequired: true,
                    handlingStrategy: 'LOG_ESCALATE_SHUTDOWN'
                };
            }
            
            // Return classification with response recommendations
            return {
                ...classification,
                errorCode,
                errorName,
                timestamp: new Date().toISOString(),
                context: {
                    url: context.req?.url,
                    method: context.req?.method,
                    correlationId: context.correlationId
                },
                recommendations: this.generateHandlingRecommendations(classification)
            };
            
        } catch (classificationError) {
            this.logger.error('Failed to classify error in ErrorHandler', {
                error: classificationError.message,
                originalError: error.message
            });
            
            return {
                type: ERROR_TYPES.SERVER_ERROR,
                severity: 'MEDIUM',
                statusCode: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
                recoverable: true,
                escalationRequired: false,
                handlingStrategy: 'LOG_AND_RESPOND',
                classificationFailed: true,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Sanitizes error objects to remove sensitive information while preserving debugging value
     * @param {Error} error - Error object to sanitize
     * @param {object} sanitizationOptions - Configuration for information filtering
     * @returns {object} Sanitized error object safe for logging and client responses
     */
    sanitizeError(error, sanitizationOptions = {}) {
        try {
            // Remove sensitive field values and credentials from error messages
            let sanitizedMessage = error.message || '';
            
            this.securityConfig.sensitiveFields.forEach(field => {
                const patterns = [
                    new RegExp(`${field}[\\s]*[:=][\\s]*[\\S]+`, 'gi'),
                    new RegExp(`"${field}"[\\s]*:[\\s]*"[^"]*"`, 'gi'),
                    new RegExp(`'${field}'[\\s]*:[\\s]*'[^']*'`, 'gi')
                ];
                
                patterns.forEach(pattern => {
                    sanitizedMessage = sanitizedMessage.replace(pattern, `${field}: ${this.securityConfig.redactionPattern}`);
                });
            });
            
            // Sanitize file paths and system information in stack traces
            let sanitizedStack = '';
            if (sanitizationOptions.includeStack && error.stack) {
                sanitizedStack = error.stack
                    .split('\n')
                    .slice(0, sanitizationOptions.maxStackLines || this.securityConfig.maxStackTraceLines)
                    .map(line => {
                        // Remove absolute file paths
                        let cleanLine = line.replace(/\/[^\s]+\//g, '/[PATH]/');
                        
                        // Remove sensitive environment variables
                        cleanLine = cleanLine.replace(/process\.env\.[A-Z_]+/g, 'process.env.[VAR]');
                        
                        // Remove system information like IP addresses
                        cleanLine = cleanLine.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
                        
                        return cleanLine;
                    })
                    .join('\n');
            }
            
            // Apply environment-specific sanitization rules
            const sanitizedError = {
                name: error.name || 'Error',
                message: sanitizedMessage,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall,
                timestamp: new Date().toISOString(),
                sanitized: true
            };
            
            // Preserve essential debugging information for development
            if (sanitizationOptions.includeStack && sanitizedStack) {
                sanitizedError.stack = sanitizedStack;
            }
            
            // Remove additional technical details in production
            if (this.config.isProduction) {
                delete sanitizedError.syscall;
                delete sanitizedError.errno;
            }
            
            // Return sanitized error object suitable for secure handling
            return sanitizedError;
            
        } catch (sanitizationError) {
            this.logger.error('Failed to sanitize error in ErrorHandler', {
                error: sanitizationError.message,
                originalError: error.message
            });
            
            return {
                name: 'Error',
                message: 'Error details unavailable due to sanitization failure',
                timestamp: new Date().toISOString(),
                sanitized: false,
                sanitizationFailed: true
            };
        }
    }
    
    /**
     * Returns comprehensive error statistics including counts by type, severity, and performance metrics
     * @returns {object} Error statistics with counts, rates, and performance data
     */
    getErrorStats() {
        try {
            // Collect error counts by type and severity level
            const typeStats = Object.entries(this.errorStats.errorsByType).map(([type, count]) => ({
                type,
                count,
                percentage: this.errorStats.totalErrors > 0 ? 
                    ((count / this.errorStats.totalErrors) * 100).toFixed(2) : 0
            }));
            
            const statusStats = Object.entries(this.errorStats.errorsByStatus).map(([status, count]) => ({
                statusCode: parseInt(status),
                count,
                percentage: this.errorStats.totalErrors > 0 ? 
                    ((count / this.errorStats.totalErrors) * 100).toFixed(2) : 0
            }));
            
            // Calculate error rates and frequency patterns
            const currentTime = Date.now();
            const oneMinuteAgo = currentTime - (60 * 1000);
            const oneHourAgo = currentTime - (60 * 60 * 1000);
            const oneDayAgo = currentTime - (24 * 60 * 60 * 1000);
            
            // Include error handling performance metrics
            const avgProcessingTime = this.errorStats.processingTimes.length > 0 ?
                this.errorStats.processingTimes.reduce((sum, time) => sum + time, 0) / this.errorStats.processingTimes.length : 0;
            
            const maxProcessingTime = this.errorStats.processingTimes.length > 0 ?
                Math.max(...this.errorStats.processingTimes) : 0;
            
            // Add correlation and context tracking statistics
            const stats = {
                overview: {
                    totalErrors: this.errorStats.totalErrors,
                    lastErrorTime: this.errorStats.lastErrorTime,
                    uptimeHours: process.uptime() / 3600,
                    errorHandler: {
                        initialized: true,
                        environment: this.config.environment,
                        securityEnabled: this.securityConfig.sanitizeErrors
                    }
                },
                
                errorsByType: typeStats,
                errorsByStatus: statusStats,
                
                rates: {
                    errorsPerMinute: this.errorStats.errorRates.perMinute,
                    errorsPerHour: this.errorStats.errorRates.perHour,
                    errorsPerDay: this.errorStats.errorRates.perDay
                },
                
                performance: {
                    averageProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
                    maxProcessingTime: `${maxProcessingTime.toFixed(2)}ms`,
                    totalProcessingTime: `${this.errorStats.processingTimes.reduce((sum, time) => sum + time, 0).toFixed(2)}ms`,
                    samplesCount: this.errorStats.processingTimes.length
                },
                
                health: {
                    errorRateNormal: this.errorStats.errorRates.perMinute < this.escalationRules.errorRateThreshold,
                    systemStable: this.errorStats.totalErrors === 0 || 
                        (this.errorStats.errorRates.perMinute < this.escalationRules.errorRateThreshold),
                    escalationActive: false // would be true if escalation rules are triggered
                },
                
                configuration: {
                    sanitizeErrors: this.securityConfig.sanitizeErrors,
                    includeStackTraces: this.securityConfig.includeStackTraces,
                    escalationEnabled: this.escalationRules.fatalErrorsRequireEscalation,
                    errorRateThreshold: this.escalationRules.errorRateThreshold
                },
                
                timestamp: new Date().toISOString()
            };
            
            // Return comprehensive error statistics for monitoring
            return stats;
            
        } catch (error) {
            this.logger.error('Failed to generate error statistics', {
                error: error.message
            });
            
            return {
                overview: {
                    totalErrors: 0,
                    lastErrorTime: null,
                    error: true,
                    errorMessage: 'Failed to generate statistics'
                },
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Updates internal error statistics based on handled errors for monitoring and analysis
     * @param {string} errorType - Type of error that was handled
     * @param {number} statusCode - HTTP status code of error response
     * @param {number} handlingDuration - Error handling processing time
     * @returns {void} No return value - updates internal statistics
     */
    updateErrorStats(errorType, statusCode, handlingDuration) {
        try {
            // Increment error count for specific error type
            this.errorStats.totalErrors++;
            this.errorStats.lastErrorTime = new Date().toISOString();
            
            // Update error count by type
            if (!this.errorStats.errorsByType[errorType]) {
                this.errorStats.errorsByType[errorType] = 0;
            }
            this.errorStats.errorsByType[errorType]++;
            
            // Update error count by status code
            if (!this.errorStats.errorsByStatus[statusCode]) {
                this.errorStats.errorsByStatus[statusCode] = 0;
            }
            this.errorStats.errorsByStatus[statusCode]++;
            
            // Record error handling performance metrics
            if (handlingDuration > 0) {
                this.errorStats.processingTimes.push(handlingDuration);
                
                // Keep only last 100 processing times for memory efficiency
                if (this.errorStats.processingTimes.length > 100) {
                    this.errorStats.processingTimes = this.errorStats.processingTimes.slice(-100);
                }
            }
            
            // Update error rate calculations and moving averages
            this.updateErrorRates();
            
            // Update severity distribution statistics
            const severity = this.getSeverityForErrorType(errorType);
            if (severity) {
                if (!this.errorStats.errorsBySeverity) {
                    this.errorStats.errorsBySeverity = {};
                }
                if (!this.errorStats.errorsBySeverity[severity]) {
                    this.errorStats.errorsBySeverity[severity] = 0;
                }
                this.errorStats.errorsBySeverity[severity]++;
            }
            
            // Trigger alerts if error thresholds are exceeded
            if (this.errorStats.errorRates.perMinute > this.escalationRules.errorRateThreshold) {
                this.logger.warn('Error rate threshold exceeded', {
                    currentRate: this.errorStats.errorRates.perMinute,
                    threshold: this.escalationRules.errorRateThreshold,
                    errorType,
                    statusCode,
                    escalationRequired: true
                });
            }
            
        } catch (updateError) {
            this.logger.error('Failed to update error statistics', {
                error: updateError.message,
                errorType,
                statusCode,
                handlingDuration
            });
        }
    }
    
    // Private helper methods for internal functionality
    
    /**
     * Generates correlation ID for error tracking
     * @private
     * @param {string} prefix - Optional prefix for correlation ID
     * @returns {string} Unique correlation ID
     */
    generateCorrelationId(prefix = 'error') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Extracts client IP address from request
     * @private
     * @param {object} req - HTTP request object
     * @returns {string} Client IP address
     */
    extractClientIp(req) {
        return req.headers['x-forwarded-for'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress || 
               'unknown';
    }
    
    /**
     * Validates and normalizes allowed HTTP methods array
     * @private
     * @param {array} methods - Array of HTTP methods
     * @returns {array} Validated methods array
     */
    validateAllowedMethods(methods) {
        if (!Array.isArray(methods)) {
            return ['GET'];
        }
        
        const validMethods = methods.filter(method => 
            typeof method === 'string' && method.length > 0
        );
        
        return validMethods.length > 0 ? validMethods : ['GET'];
    }
    
    /**
     * Generates error response based on classification
     * @private
     * @param {object} classification - Error classification object
     * @param {object} req - HTTP request object
     * @param {object} res - HTTP response object
     * @param {string} correlationId - Correlation ID
     */
    async generateErrorResponse(classification, req, res, correlationId) {
        const responseContext = {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method
        };
        
        await this.responseGenerator.generateErrorResponse(
            res, 
            classification.statusCode, 
            classification.message, 
            responseContext
        );
    }
    
    /**
     * Generates fallback error response for critical failures
     * @private
     * @param {object} res - HTTP response object
     * @param {Error} error - Error that caused fallback
     * @param {number} statusCode - HTTP status code (optional)
     */
    async generateFallbackResponse(res, error, statusCode = HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR) {
        try {
            if (!res.headersSent) {
                res.statusCode = statusCode;
                res.setHeader('Content-Type', 'text/plain');
                res.end(ERROR_MESSAGES.INTERNAL_ERROR);
            }
        } catch (fallbackError) {
            this.logger.error('Fallback error response failed', {
                error: fallbackError.message,
                originalError: error.message
            });
        }
    }
    
    /**
     * Updates error rate calculations
     * @private
     */
    updateErrorRates() {
        const now = Date.now();
        // Simplified rate calculation - in production this would use sliding windows
        this.errorStats.errorRates.perMinute = Math.min(this.errorStats.totalErrors, 60);
        this.errorStats.errorRates.perHour = Math.min(this.errorStats.totalErrors, 3600);
        this.errorStats.errorRates.perDay = this.errorStats.totalErrors;
    }
    
    /**
     * Gets severity level for error type
     * @private
     * @param {string} errorType - Error type
     * @returns {string} Severity level
     */
    getSeverityForErrorType(errorType) {
        const severityMap = {
            [ERROR_TYPES.CLIENT_ERROR]: 'LOW',
            [ERROR_TYPES.SERVER_ERROR]: 'MEDIUM',
            [ERROR_TYPES.SYSTEM_ERROR]: 'HIGH',
            [ERROR_TYPES.FATAL_ERROR]: 'CRITICAL'
        };
        
        return severityMap[errorType] || 'MEDIUM';
    }
    
    /**
     * Determines if error should be escalated
     * @private
     * @param {Error} error - Error object
     * @returns {boolean} True if escalation required
     */
    shouldEscalateError(error) {
        return this.classificationRules.fatalErrorPatterns.some(pattern => 
            pattern.test(error.message || '')
        ) || error.name === 'FatalError';
    }
    
    /**
     * Generates handling recommendations for error classification
     * @private
     * @param {object} classification - Error classification
     * @returns {array} Array of handling recommendations
     */
    generateHandlingRecommendations(classification) {
        const recommendations = [];
        
        if (classification.escalationRequired) {
            recommendations.push('Escalate to system administrator');
        }
        
        if (classification.type === ERROR_TYPES.SYSTEM_ERROR) {
            recommendations.push('Check system resources and connectivity');
        }
        
        if (classification.severity === 'CRITICAL') {
            recommendations.push('Consider graceful service degradation');
        }
        
        return recommendations;
    }
    
    /**
     * Checks escalation requirements and triggers alerts
     * @private
     * @param {object} classification - Error classification
     * @param {string} correlationId - Correlation ID
     */
    async checkEscalationRequirements(classification, correlationId) {
        if (classification.escalationRequired) {
            this.logger.error('Error escalation required', {
                correlationId,
                errorType: classification.type,
                severity: classification.severity,
                escalationReason: 'Classification indicates escalation required'
            });
        }
    }
    
    /**
     * Escalates error to appropriate channels
     * @private
     * @param {Error} error - Error to escalate
     * @param {string} correlationId - Correlation ID
     * @param {string} escalationType - Type of escalation
     */
    async escalateError(error, correlationId, escalationType) {
        this.logger.error('Error escalated', {
            correlationId,
            escalationType,
            error: this.sanitizeError(error),
            timestamp: new Date().toISOString(),
            severity: 'CRITICAL'
        });
    }
    
    /**
     * Enhanced log error event method for class instance
     * @private
     * @param {string} errorType - Type of error
     * @param {object} sanitizedError - Sanitized error object
     * @param {object} context - Error context
     * @param {string} correlationId - Correlation ID
     */
    logErrorEvent(errorType, sanitizedError, context, correlationId) {
        try {
            const logData = {
                correlationId,
                errorType,
                error: sanitizedError,
                request: {
                    url: context.req?.url,
                    method: context.req?.method,
                    userAgent: context.userAgent,
                    clientIp: context.clientIp
                },
                classification: context.classification,
                timestamp: new Date().toISOString(),
                errorHandler: 'ErrorHandler Class Instance'
            };
            
            // Use appropriate log level based on error type
            switch (errorType) {
                case ERROR_TYPES.CLIENT_ERROR:
                    this.logger.warn('Client Error', logData);
                    break;
                case ERROR_TYPES.SERVER_ERROR:
                    this.logger.error('Server Error', logData);
                    break;
                case ERROR_TYPES.SYSTEM_ERROR:
                    this.logger.error('System Error', logData);
                    break;
                case ERROR_TYPES.FATAL_ERROR:
                    this.logger.error('Fatal Error', {
                        ...logData,
                        severity: 'CRITICAL',
                        escalationRequired: true
                    });
                    break;
                default:
                    this.logger.error('Unknown Error', logData);
            }
            
        } catch (loggingError) {
            console.error('ErrorHandler logging failed:', {
                loggingError: loggingError.message,
                correlationId,
                errorType
            });
        }
    }
}

// Helper functions for validation and utility operations

/**
 * Sanitizes validation messages to prevent information disclosure
 * @private
 * @param {string} message - Raw validation message
 * @returns {string} Sanitized validation message
 */
function sanitizeValidationMessage(message) {
    try {
        let sanitized = message;
        
        // Remove sensitive field values
        SENSITIVE_FIELDS.forEach(field => {
            const pattern = new RegExp(`${field}[\\s]*[:=][\\s]*[\\S]+`, 'gi');
            sanitized = sanitized.replace(pattern, `${field}: [REDACTED]`);
        });
        
        // Remove file paths and system information
        sanitized = sanitized.replace(/\/[^\s]+\//g, '/[PATH]/');
        sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
        
        return sanitized;
        
    } catch (error) {
        logger.error('Failed to sanitize validation message', { error: error.message });
        return 'Validation failed';
    }
}

/**
 * Generates recovery suggestions based on error type
 * @private
 * @param {string} errorType - Type of error
 * @param {Error} error - Error object
 * @returns {array} Array of recovery suggestions
 */
function generateRecoverySuggestions(errorType, error) {
    const suggestions = [];
    
    switch (errorType) {
        case ERROR_TYPES.CLIENT_ERROR:
            suggestions.push('Validate request format and parameters');
            suggestions.push('Check request headers and method');
            break;
        case ERROR_TYPES.SERVER_ERROR:
            suggestions.push('Check server logs for detailed error information');
            suggestions.push('Verify system resources and dependencies');
            break;
        case ERROR_TYPES.SYSTEM_ERROR:
            suggestions.push('Check network connectivity and system resources');
            suggestions.push('Restart affected services if necessary');
            break;
        case ERROR_TYPES.FATAL_ERROR:
            suggestions.push('Immediate system administrator intervention required');
            suggestions.push('Consider emergency service shutdown if necessary');
            break;
        default:
            suggestions.push('Contact system administrator for assistance');
    }
    
    return suggestions;
}

/**
 * Determines if error should be escalated based on error properties
 * @private
 * @param {Error} error - Error object to evaluate
 * @returns {boolean} True if escalation is required
 */
function shouldEscalateError(error) {
    const escalationPatterns = [
        /out of memory/i,
        /stack overflow/i,
        /segmentation fault/i,
        /fatal/i,
        /critical/i
    ];
    
    return escalationPatterns.some(pattern => 
        pattern.test(error.message || '') || pattern.test(error.name || '')
    );
}

/**
 * Updates global error statistics tracking
 * @private
 * @param {string} errorType - Type of error
 * @param {number} statusCode - HTTP status code
 * @param {number} processingTime - Error handling duration
 */
function updateErrorStats(errorType, statusCode, processingTime) {
    // This would update global error statistics in a production system
    // For the tutorial application, we log the metrics
    logger.info('Error statistics updated', {
        errorType,
        statusCode,
        processingTime: processingTime ? `${processingTime.toFixed(2)}ms` : 'N/A',
        timestamp: new Date().toISOString()
    });
}

// Create and export default error handler instance configured with environment settings
const errorHandler = new ErrorHandler({
    environment: config.environment,
    securityEnabled: config.isProduction,
    includeStackTraces: config.isDevelopment
});

// Export individual error handling functions for granular error management
export { handleError, handleNotFound, handleMethodNotAllowed, handleInternalError, handleBadRequest };

// Export error classification and sanitization utilities
export { classifyError, sanitizeErrorMessage };

// Export error constants for use by other components and testing
export { ERROR_TYPES, HTTP_ERROR_CODES, ERROR_MESSAGES, SENSITIVE_FIELDS };

// Export default error handler instance configured with environment settings
export { errorHandler };

// Export the ErrorHandler class for creating custom error handler instances
export { ErrorHandler };

// Export the main error handler as default export for convenience
export default errorHandler;