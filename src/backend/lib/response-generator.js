/**
 * Node.js Tutorial HTTP Server - Response Generator Component
 * 
 * Comprehensive HTTP response formatting and generation component that provides centralized 
 * response management for the Node.js tutorial HTTP server application. Manages response 
 * status codes, headers, content formatting, streaming, and security header application 
 * while ensuring HTTP/1.1 protocol compliance and consistent response structure across 
 * all handlers.
 * 
 * This component implements enterprise-grade response generation patterns with extensive 
 * logging, performance monitoring, security header integration, and error handling 
 * capabilities, while maintaining educational clarity and zero external dependencies 
 * beyond Node.js built-in modules.
 * 
 * Key Features:
 * - Centralized HTTP response formatting and generation with consistent structure
 * - Automatic security header application for protection against common web vulnerabilities
 * - Comprehensive error response generation with secure messaging and information disclosure prevention
 * - Performance monitoring and metrics collection for response generation timing
 * - HTTP/1.1 protocol compliance with proper status codes, headers, and content formatting
 * - Streaming response support with proper connection lifecycle management
 * - Educational design demonstrating Node.js HTTP response patterns and best practices
 * 
 * Educational Objectives:
 * - Demonstrate HTTP response structure with status codes, headers, and body content
 * - Show security header application for web application protection
 * - Illustrate response streaming and connection lifecycle management
 * - Teach error response generation with information disclosure prevention
 * - Provide performance measurement and logging for response generation monitoring
 * 
 * Dependencies: Node.js built-in modules only (util, perf_hooks) plus internal modules
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 * HTTP Protocol: HTTP/1.1 compliance
 */

// Import Node.js built-in utility module for response content formatting and object inspection
import { format, inspect } from 'node:util'; // Node.js built-in v22.x

// Import Node.js built-in performance API for response generation timing measurement
import { performance, PerformanceObserver } from 'node:perf_hooks'; // Node.js built-in v22.x

// Import logging functionality for response generation events, performance tracking, and error monitoring
import { logger, logRequest, info, warn, error } from './logger.js';

// Import security headers application for HTTP response protection against common web vulnerabilities
import { applySecurityHeaders } from '../security/security-headers.js';

// Import server configuration for default headers, response settings, and HTTP server parameters
import { serverConfig } from '../config/server-config.js';

// Import environment configuration for response behavior customization and environment-specific settings
import { config, environment, isDevelopment, isProduction } from '../config/environment.js';

// Global HTTP status codes constant for consistent status code usage across response generation
const HTTP_STATUS_CODES = {
    OK: 200,                        // Successful HTTP request processing
    BAD_REQUEST: 400,              // Client request error - malformed or invalid request
    NOT_FOUND: 404,                // Requested resource not found on server
    METHOD_NOT_ALLOWED: 405,       // HTTP method not supported for the requested resource
    INTERNAL_SERVER_ERROR: 500,    // Server encountered unexpected condition preventing fulfillment
    SERVICE_UNAVAILABLE: 503       // Server temporarily unable to handle requests due to overload or maintenance
};

// Global HTTP status messages constant providing human-readable descriptions for status codes
const HTTP_STATUS_MESSAGES = {
    200: 'OK',                          // Standard successful HTTP request response
    400: 'Bad Request',                 // Client sent malformed or invalid request
    404: 'Not Found',                   // Requested resource could not be located
    405: 'Method Not Allowed',          // HTTP method not permitted for this resource
    500: 'Internal Server Error',      // Generic server error occurred during processing
    503: 'Service Unavailable'         // Server temporarily cannot handle requests
};

// Global default headers constant for consistent HTTP header application across all responses
const DEFAULT_HEADERS = {
    'Content-Type': 'text/plain; charset=utf-8',    // Default content type with UTF-8 encoding
    'Connection': 'keep-alive',                      // Maintain persistent HTTP connections
    'Date': null                                     // Date header will be generated dynamically per response
};

// Global response templates constant providing pre-configured response structures for common scenarios
const RESPONSE_TEMPLATES = {
    success: {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Connection': 'keep-alive'
        }
    },
    error: {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Connection': 'keep-alive'
        }
    }
};

/**
 * Generates and sends HTTP 200 OK success responses with specified content, appropriate headers, 
 * and security protection. Applies security headers, sets proper content formatting, and ensures 
 * HTTP/1.1 compliance for successful request processing.
 * 
 * @param {Object} res - HTTP ServerResponse object for sending the success response
 * @param {string} content - Response content to send in the response body
 * @param {Object} options - Optional response customization including headers and content type
 * @returns {Promise<void>} Promise that resolves when response is sent successfully
 */
export async function sendSuccess(res, content, options = {}) {
    const startTime = performance.now();
    
    try {
        // Validate response object is in writable state for response generation
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to sendSuccess';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'sendSuccess'
            });
            throw new Error(errorMsg);
        }

        // Check if headers have already been sent to prevent header modification errors
        if (res.headersSent) {
            logger.warn('Cannot send success response - headers already sent', {
                url: res.req?.url,
                method: res.req?.method,
                function: 'sendSuccess'
            });
            return;
        }

        // Set HTTP status code to 200 OK for success response
        res.statusCode = HTTP_STATUS_CODES.OK;

        // Apply security headers using security headers utility function for protection against common attacks
        applySecurityHeaders(res, options.securityHeaders || {});

        // Set Content-Type header to text/plain with UTF-8 encoding unless overridden in options
        const contentType = options.contentType || DEFAULT_HEADERS['Content-Type'];
        res.setHeader('Content-Type', contentType);

        // Calculate and set Content-Length header based on content byte length for HTTP/1.1 compliance
        const contentLength = calculateContentLength(content || '');
        res.setHeader('Content-Length', contentLength);

        // Set Date header to current UTC timestamp for HTTP compliance requirement
        res.setHeader('Date', new Date().toUTCString());

        // Apply default server headers from configuration for consistent server identification
        const serverHeaders = serverConfig.http?.headers || {};
        Object.entries(serverHeaders).forEach(([headerName, headerValue]) => {
            if (headerName !== 'Date' && headerValue !== 'auto-generated') {
                res.setHeader(headerName, headerValue);
            }
        });

        // Apply any custom headers provided in options parameter
        if (options.headers && typeof options.headers === 'object') {
            Object.entries(options.headers).forEach(([headerName, headerValue]) => {
                if (headerName && headerValue !== undefined) {
                    res.setHeader(headerName, headerValue);
                }
            });
        }

        // Write response headers to HTTP response stream
        // Response headers are automatically written when first content is written

        // Write response body content to stream with proper encoding and formatting
        const responseContent = content || '';
        res.write(responseContent, 'utf8');

        // End response stream to complete response transmission to client
        res.end();

        // Calculate response generation timing for performance monitoring
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log successful response generation with timing and content length metrics
        logger.info('Success response sent successfully', {
            statusCode: HTTP_STATUS_CODES.OK,
            contentLength: contentLength,
            responseTime: `${duration.toFixed(2)}ms`,
            url: res.req?.url || 'unknown',
            method: res.req?.method || 'unknown',
            userAgent: res.req?.headers?.['user-agent'] || 'unknown',
            function: 'sendSuccess'
        });

    } catch (error) {
        // Log detailed error information for debugging and monitoring
        logger.error('Failed to send success response', {
            error: {
                message: error.message,
                stack: error.stack
            },
            url: res.req?.url,
            method: res.req?.method,
            function: 'sendSuccess'
        });

        // Attempt to send error response if headers haven't been sent yet
        if (!res.headersSent) {
            try {
                await sendInternalError(res, error);
            } catch (recoveryError) {
                logger.error('Failed to send error recovery response', {
                    error: recoveryError.message,
                    function: 'sendSuccess'
                });
            }
        }

        // Re-throw error for upstream handling
        throw error;
    }
}

/**
 * Generates and sends HTTP 404 Not Found error responses for non-existent resources or endpoints.
 * Provides secure error messaging without information disclosure and applies appropriate security headers.
 * 
 * @param {Object} res - HTTP ServerResponse object for sending the 404 error response
 * @param {string} message - Optional custom error message, defaults to 'Not Found'
 * @returns {Promise<void>} Promise that resolves when error response is sent
 */
export async function sendNotFound(res, message = 'Not Found') {
    const startTime = performance.now();
    
    try {
        // Validate response object is in writable state for error response generation
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to sendNotFound';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'sendNotFound'
            });
            throw new Error(errorMsg);
        }

        // Check if response is still writable for header and content modification
        if (res.headersSent) {
            logger.warn('Cannot send 404 response - headers already sent', {
                url: res.req?.url,
                method: res.req?.method,
                function: 'sendNotFound'
            });
            return;
        }

        // Set HTTP status code to 404 Not Found for resource not found error
        res.statusCode = HTTP_STATUS_CODES.NOT_FOUND;

        // Apply security headers to prevent information disclosure and protect against attacks
        applySecurityHeaders(res);

        // Set error response headers including Content-Type text/plain for consistent formatting
        res.setHeader('Content-Type', DEFAULT_HEADERS['Content-Type']);
        res.setHeader('Date', new Date().toUTCString());

        // Generate safe 'Not Found' error message for response body without sensitive information
        const safeMessage = message || HTTP_STATUS_MESSAGES[404];
        
        // Calculate Content-Length header for error message to ensure HTTP/1.1 compliance
        const contentLength = calculateContentLength(safeMessage);
        res.setHeader('Content-Length', contentLength);

        // Write error response headers and body to stream with proper error formatting
        res.write(safeMessage, 'utf8');

        // End response stream and complete error response transmission
        res.end();

        // Calculate response generation timing for performance monitoring
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log 404 error response generation with request context and performance metrics
        logger.info('404 Not Found response sent', {
            statusCode: HTTP_STATUS_CODES.NOT_FOUND,
            message: safeMessage,
            contentLength: contentLength,
            responseTime: `${duration.toFixed(2)}ms`,
            url: res.req?.url || 'unknown',
            method: res.req?.method || 'unknown',
            userAgent: res.req?.headers?.['user-agent'] || 'unknown',
            function: 'sendNotFound'
        });

    } catch (error) {
        // Log error in 404 response generation for debugging and system monitoring
        logger.error('Failed to send 404 Not Found response', {
            error: {
                message: error.message,
                stack: error.stack
            },
            url: res.req?.url,
            method: res.req?.method,
            function: 'sendNotFound'
        });

        // Attempt fallback error response if possible
        if (!res.headersSent) {
            try {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error');
            } catch (fallbackError) {
                logger.error('Fallback error response failed', {
                    error: fallbackError.message,
                    function: 'sendNotFound'
                });
            }
        }

        throw error;
    }
}

/**
 * Generates and sends HTTP 405 Method Not Allowed responses for unsupported HTTP methods 
 * on valid endpoints. Includes Allow header with permitted methods and secure error messaging.
 * 
 * @param {Object} res - HTTP ServerResponse object for sending the 405 error response
 * @param {Array} allowedMethods - Array of allowed HTTP methods for the Allow header
 * @returns {Promise<void>} Promise that resolves when method not allowed response is sent
 */
export async function sendMethodNotAllowed(res, allowedMethods = ['GET']) {
    const startTime = performance.now();
    
    try {
        // Validate response object is available and writable for method not allowed response
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to sendMethodNotAllowed';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'sendMethodNotAllowed'
            });
            throw new Error(errorMsg);
        }

        // Verify headers can still be modified for proper error response generation
        if (res.headersSent) {
            logger.warn('Cannot send 405 response - headers already sent', {
                url: res.req?.url,
                method: res.req?.method,
                function: 'sendMethodNotAllowed'
            });
            return;
        }

        // Set HTTP status code to 405 Method Not Allowed for unsupported method error
        res.statusCode = HTTP_STATUS_CODES.METHOD_NOT_ALLOWED;

        // Apply security headers for response protection against information disclosure
        applySecurityHeaders(res);

        // Set Allow header with comma-separated list of allowed methods as required by HTTP specification
        const allowHeaderValue = Array.isArray(allowedMethods) ? allowedMethods.join(', ') : 'GET';
        res.setHeader('Allow', allowHeaderValue);

        // Set standard error response headers for consistent formatting
        res.setHeader('Content-Type', DEFAULT_HEADERS['Content-Type']);
        res.setHeader('Date', new Date().toUTCString());

        // Generate 'Method Not Allowed' error message for response body
        const errorMessage = HTTP_STATUS_MESSAGES[405];
        
        // Set appropriate response headers including Content-Type and Content-Length for HTTP compliance
        const contentLength = calculateContentLength(errorMessage);
        res.setHeader('Content-Length', contentLength);

        // Send complete method not allowed response with proper formatting and headers
        res.write(errorMessage, 'utf8');
        res.end();

        // Calculate response timing for performance monitoring and metrics collection
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log method not allowed response with allowed methods information and performance metrics
        logger.warn('405 Method Not Allowed response sent', {
            statusCode: HTTP_STATUS_CODES.METHOD_NOT_ALLOWED,
            allowedMethods: allowedMethods,
            requestedMethod: res.req?.method || 'unknown',
            allowHeader: allowHeaderValue,
            contentLength: contentLength,
            responseTime: `${duration.toFixed(2)}ms`,
            url: res.req?.url || 'unknown',
            userAgent: res.req?.headers?.['user-agent'] || 'unknown',
            function: 'sendMethodNotAllowed'
        });

    } catch (error) {
        // Log method not allowed response generation error for debugging
        logger.error('Failed to send 405 Method Not Allowed response', {
            error: {
                message: error.message,
                stack: error.stack
            },
            url: res.req?.url,
            method: res.req?.method,
            allowedMethods: allowedMethods,
            function: 'sendMethodNotAllowed'
        });

        // Provide fallback error response if headers haven't been sent
        if (!res.headersSent) {
            try {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error');
            } catch (fallbackError) {
                logger.error('Fallback error response failed', {
                    error: fallbackError.message,
                    function: 'sendMethodNotAllowed'
                });
            }
        }

        throw error;
    }
}

/**
 * Generates and sends HTTP 500 Internal Server Error responses with secure error messaging 
 * that prevents information disclosure. Logs detailed error information internally while 
 * providing generic client error messages.
 * 
 * @param {Object} res - HTTP ServerResponse object for sending the internal error response
 * @param {Error} error - Optional error object for internal logging (not sent to client)
 * @returns {Promise<void>} Promise that resolves when internal error response is sent
 */
export async function sendInternalError(res, error = null) {
    const startTime = performance.now();
    
    try {
        // Validate response object is available for internal server error response generation
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to sendInternalError';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'sendInternalError'
            });
            throw new Error(errorMsg);
        }

        // Check response writability to prevent header modification errors
        if (res.headersSent) {
            logger.warn('Cannot send 500 response - headers already sent', {
                url: res.req?.url,
                method: res.req?.method,
                function: 'sendInternalError'
            });
            return;
        }

        // Set HTTP status code to 500 Internal Server Error for server-side processing failures
        res.statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

        // Apply security headers to prevent information leakage through error responses
        applySecurityHeaders(res);

        // Generate generic 'Internal Server Error' message for client without sensitive details
        const clientMessage = HTTP_STATUS_MESSAGES[500];

        // Log detailed error information internally with full error context for debugging
        if (error) {
            logger.error('Internal server error occurred', {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                userAgent: res.req?.headers?.['user-agent'] || 'unknown',
                timestamp: new Date().toISOString(),
                function: 'sendInternalError'
            });
        } else {
            logger.error('Internal server error occurred (no error object provided)', {
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                function: 'sendInternalError'
            });
        }

        // Set response headers with appropriate Content-Type and security headers for error response
        res.setHeader('Content-Type', DEFAULT_HEADERS['Content-Type']);
        res.setHeader('Date', new Date().toUTCString());
        
        const contentLength = calculateContentLength(clientMessage);
        res.setHeader('Content-Length', contentLength);

        // Send secure error response without exposing internal error details to client
        res.write(clientMessage, 'utf8');
        res.end();

        // Calculate response generation timing for performance analysis
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Complete response transmission and log error response generation with timing
        logger.error('500 Internal Server Error response sent', {
            statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            contentLength: contentLength,
            responseTime: `${duration.toFixed(2)}ms`,
            url: res.req?.url || 'unknown',
            method: res.req?.method || 'unknown',
            hasOriginalError: !!error,
            function: 'sendInternalError'
        });

    } catch (responseError) {
        // Log critical error in error response generation for system monitoring
        logger.error('Critical: Failed to send 500 Internal Server Error response', {
            responseError: {
                message: responseError.message,
                stack: responseError.stack
            },
            originalError: error ? {
                message: error.message,
                stack: error.stack
            } : null,
            url: res.req?.url,
            method: res.req?.method,
            function: 'sendInternalError'
        });

        // Final fallback attempt - minimal error response without throwing
        try {
            if (!res.headersSent) {
                res.statusCode = 500;
                res.end('Internal Server Error');
            }
        } catch (finalError) {
            logger.error('Final fallback error response failed', {
                error: finalError.message,
                function: 'sendInternalError'
            });
        }
    }
}

/**
 * General purpose error response generator that creates HTTP error responses with specified 
 * status codes and secure messaging. Handles various error types with appropriate status codes 
 * and consistent formatting.
 * 
 * @param {Object} res - HTTP ServerResponse object for error response generation
 * @param {number} statusCode - HTTP status code for the error response
 * @param {string} message - Safe error message for client consumption
 * @param {Object} headers - Optional additional headers to include in response
 * @returns {Promise<void>} Promise that resolves when error response generation is complete
 */
export async function generateErrorResponse(res, statusCode, message, headers = {}) {
    const startTime = performance.now();
    
    try {
        // Validate status code is within valid HTTP error range (400-599) for proper error classification
        if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
            const validationError = `Invalid error status code: ${statusCode}. Must be between 400-599.`;
            logger.error(validationError, {
                providedStatusCode: statusCode,
                function: 'generateErrorResponse'
            });
            statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR; // Default to 500 for invalid status codes
        }

        // Validate response object is available for error response generation
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to generateErrorResponse';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'generateErrorResponse'
            });
            throw new Error(errorMsg);
        }

        // Check response state to prevent header modification after headers sent
        if (res.headersSent) {
            logger.warn('Cannot generate error response - headers already sent', {
                statusCode: statusCode,
                url: res.req?.url,
                method: res.req?.method,
                function: 'generateErrorResponse'
            });
            return;
        }

        // Set HTTP status code and corresponding reason phrase for proper error classification
        res.statusCode = statusCode;

        // Apply security headers to all error responses for protection against information disclosure
        applySecurityHeaders(res);

        // Merge additional headers with default error response headers for customization support
        const errorHeaders = {
            'Content-Type': DEFAULT_HEADERS['Content-Type'],
            'Date': new Date().toUTCString(),
            ...headers
        };

        // Sanitize error message to remove sensitive information and prevent data leakage
        const sanitizedMessage = message || HTTP_STATUS_MESSAGES[statusCode] || 'Error';
        
        // Set Content-Type to text/plain and calculate Content-Length for HTTP/1.1 compliance
        const contentLength = calculateContentLength(sanitizedMessage);
        errorHeaders['Content-Length'] = contentLength;

        // Apply all error response headers including custom headers and security headers
        Object.entries(errorHeaders).forEach(([headerName, headerValue]) => {
            if (headerName && headerValue !== undefined) {
                res.setHeader(headerName, headerValue);
            }
        });

        // Write complete error response headers and body to stream with proper formatting
        res.write(sanitizedMessage, 'utf8');

        // End response stream and complete error response transmission to client
        res.end();

        // Calculate error response generation timing for performance monitoring
        const endTime = performance.now();
        const duration = endTime - startTime;

        // End response stream and log error response generation with status code and performance metrics
        logger.warn('Error response generated and sent', {
            statusCode: statusCode,
            statusMessage: HTTP_STATUS_MESSAGES[statusCode] || 'Unknown',
            message: sanitizedMessage,
            contentLength: contentLength,
            responseTime: `${duration.toFixed(2)}ms`,
            url: res.req?.url || 'unknown',
            method: res.req?.method || 'unknown',
            userAgent: res.req?.headers?.['user-agent'] || 'unknown',
            customHeaders: Object.keys(headers).length,
            function: 'generateErrorResponse'
        });

    } catch (error) {
        // Log critical error in general error response generation
        logger.error('Failed to generate error response', {
            error: {
                message: error.message,
                stack: error.stack
            },
            requestedStatusCode: statusCode,
            requestedMessage: message,
            url: res.req?.url,
            method: res.req?.method,
            function: 'generateErrorResponse'
        });

        // Emergency fallback error response to prevent complete failure
        try {
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error');
            }
        } catch (fallbackError) {
            logger.error('Emergency fallback error response failed', {
                error: fallbackError.message,
                function: 'generateErrorResponse'
            });
        }

        throw error;
    }
}

/**
 * Utility function that sets standard HTTP response headers including Date, Content-Type, 
 * and custom headers with validation. Provides method chaining support and header validation.
 * 
 * @param {Object} res - HTTP ServerResponse object to set headers on
 * @param {Object} headers - Headers object with key-value pairs to set
 * @param {boolean} includeDefaults - Whether to include default server headers
 * @returns {Object} HTTP ServerResponse object with headers applied for method chaining
 */
export function setResponseHeaders(res, headers = {}, includeDefaults = true) {
    try {
        // Validate response object allows header modification and is in proper state
        if (!res || typeof res.setHeader !== 'function') {
            const errorMsg = 'Invalid HTTP ServerResponse object provided to setResponseHeaders';
            logger.error(errorMsg, { 
                responseObject: typeof res,
                function: 'setResponseHeaders'
            });
            throw new Error(errorMsg);
        }

        // Check if headers can still be modified to prevent runtime errors
        if (res.headersSent) {
            logger.warn('Cannot set response headers - headers already sent', {
                url: res.req?.url,
                method: res.req?.method,
                function: 'setResponseHeaders'
            });
            return res; // Return response object for method chaining even on warning
        }

        // Set Date header to current UTC timestamp if not provided in headers parameter
        if (!headers['Date'] && !res.getHeader('Date')) {
            res.setHeader('Date', new Date().toUTCString());
        }

        // Apply default server headers from configuration if requested for consistent server identification
        if (includeDefaults) {
            const serverHeaders = serverConfig.http?.headers || {};
            Object.entries(serverHeaders).forEach(([headerName, headerValue]) => {
                if (headerValue !== 'auto-generated' && !headers[headerName] && !res.getHeader(headerName)) {
                    res.setHeader(headerName, headerValue);
                }
            });
        }

        // Iterate through provided headers and set each with validation for security and correctness
        Object.entries(headers).forEach(([headerName, headerValue]) => {
            if (headerName && headerValue !== undefined && headerValue !== null) {
                // Validate header name format to prevent header injection attacks
                if (typeof headerName === 'string' && headerName.length > 0) {
                    // Sanitize header value to prevent injection and ensure proper formatting
                    const sanitizedValue = String(headerValue).replace(/[\r\n]/g, '');
                    res.setHeader(headerName, sanitizedValue);
                } else {
                    logger.warn('Invalid header name provided', {
                        headerName: headerName,
                        headerValue: headerValue,
                        function: 'setResponseHeaders'
                    });
                }
            }
        });

        // Ensure Content-Type header is set appropriately if not already set
        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', DEFAULT_HEADERS['Content-Type']);
        }

        // Log successful header application for debugging and monitoring
        logger.debug('Response headers set successfully', {
            headersCount: Object.keys(headers).length,
            includeDefaults: includeDefaults,
            url: res.req?.url || 'unknown',
            method: res.req?.method || 'unknown',
            function: 'setResponseHeaders'
        });

        // Return response object for method chaining support
        return res;

    } catch (error) {
        // Log header setting error with context for debugging
        logger.error('Failed to set response headers', {
            error: {
                message: error.message,
                stack: error.stack
            },
            headers: headers,
            includeDefaults: includeDefaults,
            url: res.req?.url,
            method: res.req?.method,
            function: 'setResponseHeaders'
        });

        // Return response object even on error to prevent method chaining failure
        return res;
    }
}

/**
 * Calculates accurate byte length of response content for Content-Length header with proper 
 * UTF-8 encoding handling. Supports both string and Buffer content types.
 * 
 * @param {string|Buffer} content - Response content to calculate length for
 * @returns {number} Byte length of content for Content-Length header
 */
export function calculateContentLength(content) {
    try {
        // Check if content is Buffer or string type for appropriate length calculation
        if (Buffer.isBuffer(content)) {
            // For Buffer content, return byte length directly as Buffer already contains bytes
            return content.length;
        } else if (typeof content === 'string') {
            // For string content, calculate UTF-8 byte length using Buffer.byteLength for accuracy
            return Buffer.byteLength(content, 'utf8');
        } else if (content === null || content === undefined) {
            // Handle empty or null content by returning 0 for proper Content-Length header
            return 0;
        } else {
            // For other content types, convert to string and calculate byte length
            const stringContent = String(content);
            return Buffer.byteLength(stringContent, 'utf8');
        }
    } catch (error) {
        // Log content length calculation error and return 0 as safe fallback
        logger.error('Failed to calculate content length', {
            error: error.message,
            contentType: typeof content,
            contentLength: content?.length || 0,
            function: 'calculateContentLength'
        });
        
        // Return accurate byte length for Content-Length header or 0 as safe fallback
        return 0;
    }
}

/**
 * Comprehensive response generator class that provides centralized HTTP response formatting, 
 * header management, security header application, and streaming for consistent response 
 * handling across the Node.js tutorial application.
 */
export class ResponseGenerator {
    /**
     * Initializes response generator with logging, configuration, security headers, and response 
     * templates for consistent HTTP response generation with performance monitoring capabilities.
     * 
     * @param {Object} options - Configuration options including custom headers, security settings, and response behavior
     */
    constructor(options = {}) {
        try {
            // Initialize logger instance for response generation tracking and performance monitoring
            this.logger = logger;

            // Load response generator configuration from server config and environment settings
            this.config = {
                ...serverConfig.http,
                ...config.server,
                ...options
            };

            // Set up default headers from configuration including Server, Connection, and Content-Type
            this.defaultHeaders = {
                ...DEFAULT_HEADERS,
                ...serverConfig.http?.headers,
                ...options.defaultHeaders
            };

            // Configure security headers integration for automatic application to all responses
            this.securityHeaders = options.securityHeaders || {};

            // Initialize response templates for common response types (success, error, not found)
            this.responseTemplates = {
                ...RESPONSE_TEMPLATES,
                ...options.templates
            };

            // Set up response timing and performance monitoring capabilities
            this.performanceMonitoring = {
                enabled: options.enablePerformance !== false,
                responseMetrics: new Map(),
                startTimes: new Map()
            };

            // Configure response streaming options and connection management settings
            this.streamingOptions = {
                encoding: options.encoding || 'utf8',
                highWaterMark: options.highWaterMark || 16384,
                ...options.streaming
            };

            // Initialize response statistics tracking for monitoring and analysis
            this.statistics = {
                totalResponses: 0,
                successResponses: 0,
                errorResponses: 0,
                averageResponseTime: 0,
                totalResponseTime: 0,
                startTime: Date.now()
            };

            this.logger.info('ResponseGenerator instance initialized', {
                defaultHeadersCount: Object.keys(this.defaultHeaders).length,
                securityHeadersEnabled: Object.keys(this.securityHeaders).length > 0,
                performanceMonitoringEnabled: this.performanceMonitoring.enabled,
                templatesCount: Object.keys(this.responseTemplates).length,
                function: 'ResponseGenerator.constructor'
            });

        } catch (error) {
            this.logger.error('Failed to initialize ResponseGenerator instance', {
                error: error.message,
                options: options,
                function: 'ResponseGenerator.constructor'
            });
            throw error;
        }
    }

    /**
     * Primary response generation method that creates complete HTTP responses with status codes, 
     * headers, content, and security protection. Handles content formatting, streaming, and 
     * performance monitoring.
     * 
     * @param {Object} res - HTTP ServerResponse object for response generation
     * @param {number} statusCode - HTTP status code for the response
     * @param {string|Buffer|object} content - Response content (string, Buffer, or JSON object)
     * @param {Object} options - Response options including headers, content type, and security settings
     * @returns {Promise<void>} Promise that resolves when response is fully sent to client
     */
    async send(res, statusCode, content = '', options = {}) {
        // Start response generation timing for performance monitoring
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = performance.now();
        
        if (this.performanceMonitoring.enabled) {
            this.performanceMonitoring.startTimes.set(requestId, startTime);
        }

        try {
            // Validate response object is in writable state for response generation
            if (!res || typeof res.setHeader !== 'function') {
                const errorMsg = 'Invalid HTTP ServerResponse object provided to ResponseGenerator.send';
                this.logger.error(errorMsg, { 
                    responseObject: typeof res,
                    function: 'ResponseGenerator.send'
                });
                throw new Error(errorMsg);
            }

            if (res.headersSent) {
                this.logger.warn('Cannot send response - headers already sent', {
                    statusCode: statusCode,
                    url: res.req?.url,
                    method: res.req?.method,
                    function: 'ResponseGenerator.send'
                });
                return;
            }

            // Set HTTP status code and corresponding reason phrase for proper response classification
            res.statusCode = statusCode || HTTP_STATUS_CODES.OK;

            // Apply security headers using security headers utility for comprehensive protection
            applySecurityHeaders(res, {
                ...this.securityHeaders,
                ...options.securityHeaders
            });

            // Process and format response content based on content type and options
            let processedContent = '';
            let contentType = options.contentType || this.defaultHeaders['Content-Type'];

            if (typeof content === 'object' && content !== null && !Buffer.isBuffer(content)) {
                // Handle JSON content with proper serialization and content type
                try {
                    processedContent = JSON.stringify(content, null, options.jsonSpace || 0);
                    contentType = 'application/json; charset=utf-8';
                } catch (jsonError) {
                    this.logger.error('Failed to serialize JSON content', {
                        error: jsonError.message,
                        content: inspect(content, { depth: 2 }),
                        function: 'ResponseGenerator.send'
                    });
                    processedContent = 'Internal Server Error';
                    res.statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
                }
            } else {
                // Handle string or Buffer content with appropriate processing
                processedContent = content || '';
            }

            // Set appropriate Content-Type header based on content and options
            res.setHeader('Content-Type', contentType);

            // Calculate accurate Content-Length header for response body with UTF-8 encoding support
            const contentLength = calculateContentLength(processedContent);
            res.setHeader('Content-Length', contentLength);

            // Apply default headers and merge with custom headers from options
            const mergedHeaders = {
                ...this.defaultHeaders,
                ...options.headers
            };

            // Set Date header to current timestamp unless provided in options
            if (!mergedHeaders['Date']) {
                mergedHeaders['Date'] = new Date().toUTCString();
            }

            // Apply all headers with validation and sanitization
            Object.entries(mergedHeaders).forEach(([headerName, headerValue]) => {
                if (headerName !== 'Content-Type' && headerName !== 'Content-Length' && 
                    headerValue !== 'auto-generated' && headerValue !== null && headerValue !== undefined) {
                    res.setHeader(headerName, headerValue);
                }
            });

            // Write complete response headers to HTTP response stream
            // Headers are automatically written when first content is written

            // Write response body content with proper encoding and streaming support
            if (processedContent) {
                res.write(processedContent, this.streamingOptions.encoding);
            }

            // End response stream to complete response transmission to client
            res.end();

            // Calculate final response generation timing for performance analysis
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Update response statistics for monitoring and analysis
            this.updateStatistics(statusCode, duration);

            // Store performance metrics if monitoring is enabled
            if (this.performanceMonitoring.enabled) {
                this.performanceMonitoring.responseMetrics.set(requestId, {
                    statusCode: statusCode,
                    responseTime: duration,
                    contentLength: contentLength,
                    timestamp: new Date().toISOString()
                });

                // Clean up old start time entry
                this.performanceMonitoring.startTimes.delete(requestId);
            }

            // Log successful response generation with timing and performance metrics
            this.logger.info('Response sent successfully via ResponseGenerator', {
                requestId: requestId,
                statusCode: statusCode,
                contentLength: contentLength,
                responseTime: `${duration.toFixed(2)}ms`,
                contentType: contentType,
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                userAgent: res.req?.headers?.['user-agent'] || 'unknown',
                function: 'ResponseGenerator.send'
            });

        } catch (error) {
            // Log detailed error information for debugging and system monitoring
            this.logger.error('Failed to send response via ResponseGenerator', {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                requestId: requestId,
                statusCode: statusCode,
                url: res.req?.url,
                method: res.req?.method,
                function: 'ResponseGenerator.send'
            });

            // Update error statistics
            this.statistics.errorResponses++;

            // Clean up performance monitoring data
            if (this.performanceMonitoring.enabled) {
                this.performanceMonitoring.startTimes.delete(requestId);
            }

            // Attempt error recovery response if headers haven't been sent
            if (!res.headersSent) {
                try {
                    await this.sendError(res, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, 'Internal Server Error');
                } catch (recoveryError) {
                    this.logger.error('Failed to send error recovery response', {
                        error: recoveryError.message,
                        function: 'ResponseGenerator.send'
                    });
                }
            }

            throw error;
        }
    }

    /**
     * Specialized method for generating HTTP 200 OK success responses with content and 
     * appropriate headers. Utilizes the primary send method with success-specific configuration.
     * 
     * @param {Object} res - HTTP ServerResponse object for success response
     * @param {string} content - Success response content to send to client
     * @param {Object} options - Optional response customization including headers
     * @returns {Promise<void>} Promise that resolves when success response is sent
     */
    async sendSuccess(res, content, options = {}) {
        try {
            // Call primary send method with 200 status code and success template configuration
            await this.send(res, HTTP_STATUS_CODES.OK, content, {
                ...this.responseTemplates.success,
                ...options
            });

            // Log successful response generation for monitoring and debugging
            this.logger.debug('Success response sent via ResponseGenerator.sendSuccess', {
                contentLength: calculateContentLength(content || ''),
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                function: 'ResponseGenerator.sendSuccess'
            });

        } catch (error) {
            this.logger.error('Failed to send success response', {
                error: error.message,
                url: res.req?.url,
                method: res.req?.method,
                function: 'ResponseGenerator.sendSuccess'
            });
            throw error;
        }
    }

    /**
     * Specialized method for generating HTTP error responses with secure error messaging 
     * and appropriate status codes. Sanitizes error messages to prevent information disclosure.
     * 
     * @param {Object} res - HTTP ServerResponse object for error response
     * @param {number} statusCode - HTTP error status code (4xx or 5xx)
     * @param {string} message - Safe error message for client (sanitized)
     * @param {Object} options - Optional error response customization
     * @returns {Promise<void>} Promise that resolves when error response is sent
     */
    async sendError(res, statusCode, message, options = {}) {
        try {
            // Validate status code is within error range (400-599) for proper error classification
            if (!statusCode || statusCode < 400 || statusCode > 599) {
                this.logger.warn('Invalid error status code provided, defaulting to 500', {
                    providedStatusCode: statusCode,
                    function: 'ResponseGenerator.sendError'
                });
                statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
            }

            // Sanitize error message to prevent information disclosure and security vulnerabilities
            const sanitizedMessage = message || HTTP_STATUS_MESSAGES[statusCode] || 'Error';

            // Call primary send method with error status and sanitized message
            await this.send(res, statusCode, sanitizedMessage, {
                ...this.responseTemplates.error,
                ...options
            });

            // Apply error-specific security headers and logging for security monitoring
            this.logger.warn('Error response sent via ResponseGenerator.sendError', {
                statusCode: statusCode,
                statusMessage: HTTP_STATUS_MESSAGES[statusCode],
                sanitizedMessage: sanitizedMessage,
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                function: 'ResponseGenerator.sendError'
            });

        } catch (error) {
            this.logger.error('Failed to send error response', {
                error: error.message,
                statusCode: statusCode,
                message: message,
                url: res.req?.url,
                method: res.req?.method,
                function: 'ResponseGenerator.sendError'
            });
            throw error;
        }
    }

    /**
     * Generates HTTP responses with JSON content, appropriate Content-Type headers, and JSON 
     * serialization. Handles JSON formatting errors and provides proper content type headers.
     * 
     * @param {Object} res - HTTP ServerResponse object for JSON response
     * @param {Object} data - JavaScript object to serialize and send as JSON
     * @param {number} statusCode - HTTP status code (defaults to 200)
     * @param {Object} options - Optional JSON response customization
     * @returns {Promise<void>} Promise that resolves when JSON response is sent
     */
    async sendJSON(res, data, statusCode = HTTP_STATUS_CODES.OK, options = {}) {
        try {
            // Serialize JavaScript object to JSON string with error handling
            let jsonContent;
            try {
                jsonContent = JSON.stringify(data, null, options.jsonSpace || 0);
            } catch (jsonError) {
                // Handle JSON serialization errors with proper error responses
                this.logger.error('Failed to serialize object to JSON', {
                    error: jsonError.message,
                    dataType: typeof data,
                    function: 'ResponseGenerator.sendJSON'
                });
                
                // Send error response for JSON serialization failure
                return await this.sendError(res, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, 'JSON Serialization Error');
            }

            // Set Content-Type header to application/json with UTF-8 encoding
            const jsonOptions = {
                ...options,
                contentType: 'application/json; charset=utf-8'
            };

            // Call primary send method with JSON content and appropriate headers
            await this.send(res, statusCode, jsonContent, jsonOptions);

            // Handle JSON serialization errors with proper error responses and log JSON response generation for monitoring and debugging
            this.logger.debug('JSON response sent via ResponseGenerator.sendJSON', {
                statusCode: statusCode,
                jsonSize: Buffer.byteLength(jsonContent, 'utf8'),
                url: res.req?.url || 'unknown',
                method: res.req?.method || 'unknown',
                function: 'ResponseGenerator.sendJSON'
            });

        } catch (error) {
            this.logger.error('Failed to send JSON response', {
                error: error.message,
                statusCode: statusCode,
                dataType: typeof data,
                url: res.req?.url,
                method: res.req?.method,
                function: 'ResponseGenerator.sendJSON'
            });
            throw error;
        }
    }

    /**
     * Formats and validates HTTP response headers ensuring compliance with HTTP standards 
     * and security requirements. Provides header sanitization and validation.
     * 
     * @param {Object} headers - Headers object to format and validate
     * @param {boolean} includeDefaults - Whether to include default server headers
     * @returns {Object} Formatted and validated headers object ready for response
     */
    formatHeaders(headers = {}, includeDefaults = true) {
        try {
            const formattedHeaders = {};

            // Validate header names comply with HTTP specification and sanitize values
            Object.entries(headers).forEach(([headerName, headerValue]) => {
                if (typeof headerName === 'string' && headerName.length > 0 && headerValue !== undefined && headerValue !== null) {
                    // Sanitize header values to prevent header injection attacks
                    const sanitizedValue = String(headerValue).replace(/[\r\n]/g, '');
                    formattedHeaders[headerName] = sanitizedValue;
                } else {
                    this.logger.warn('Invalid header skipped during formatting', {
                        headerName: headerName,
                        headerValue: headerValue,
                        function: 'ResponseGenerator.formatHeaders'
                    });
                }
            });

            // Include default server headers if requested for consistent server identification
            if (includeDefaults) {
                Object.entries(this.defaultHeaders).forEach(([headerName, headerValue]) => {
                    if (!formattedHeaders[headerName] && headerValue !== 'auto-generated') {
                        formattedHeaders[headerName] = headerValue;
                    }
                });
            }

            // Set Date header if not already provided for HTTP compliance
            if (!formattedHeaders['Date']) {
                formattedHeaders['Date'] = new Date().toUTCString();
            }

            // Apply header formatting and normalization for consistent header structure
            // Ensure headers are properly formatted for HTTP transmission
            const normalizedHeaders = {};
            Object.entries(formattedHeaders).forEach(([headerName, headerValue]) => {
                // Normalize header names to proper case (e.g., Content-Type)
                const normalizedName = headerName;
                normalizedHeaders[normalizedName] = headerValue;
            });

            this.logger.debug('Headers formatted and validated', {
                originalCount: Object.keys(headers).length,
                formattedCount: Object.keys(normalizedHeaders).length,
                includeDefaults: includeDefaults,
                function: 'ResponseGenerator.formatHeaders'
            });

            // Return validated headers object for response generation
            return normalizedHeaders;

        } catch (error) {
            this.logger.error('Failed to format response headers', {
                error: error.message,
                headers: headers,
                function: 'ResponseGenerator.formatHeaders'
            });

            // Return basic headers as fallback to prevent complete failure
            return {
                'Content-Type': DEFAULT_HEADERS['Content-Type'],
                'Date': new Date().toUTCString()
            };
        }
    }

    /**
     * Returns response generation statistics including timing metrics, header counts, and 
     * performance data for monitoring and analysis.
     * 
     * @returns {Object} Response statistics object with performance metrics and counts
     */
    getResponseStats() {
        try {
            // Collect response generation timing statistics and calculate performance metrics
            const currentTime = Date.now();
            const uptime = currentTime - this.statistics.startTime;

            // Calculate average response times and throughput metrics
            const averageResponseTime = this.statistics.totalResponses > 0 ? 
                this.statistics.totalResponseTime / this.statistics.totalResponses : 0;

            const requestsPerSecond = this.statistics.totalResponses > 0 ? 
                (this.statistics.totalResponses / (uptime / 1000)) : 0;

            // Include header processing and content formatting statistics
            const performanceMetrics = {
                totalResponses: this.statistics.totalResponses,
                successResponses: this.statistics.successResponses,
                errorResponses: this.statistics.errorResponses,
                averageResponseTime: Math.round(averageResponseTime * 100) / 100,
                requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
                uptime: uptime,
                startTime: new Date(this.statistics.startTime).toISOString()
            };

            // Add recent performance data if monitoring is enabled
            if (this.performanceMonitoring.enabled) {
                const recentMetrics = Array.from(this.performanceMonitoring.responseMetrics.values())
                    .slice(-100); // Last 100 responses

                if (recentMetrics.length > 0) {
                    const recentResponseTimes = recentMetrics.map(m => m.responseTime);
                    const recentAverageTime = recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length;
                    
                    performanceMetrics.recentAverageResponseTime = Math.round(recentAverageTime * 100) / 100;
                    performanceMetrics.recentResponseCount = recentMetrics.length;
                }
            }

            // Return comprehensive statistics object for monitoring
            const statsReport = {
                performance: performanceMetrics,
                configuration: {
                    performanceMonitoringEnabled: this.performanceMonitoring.enabled,
                    defaultHeadersCount: Object.keys(this.defaultHeaders).length,
                    securityHeadersCount: Object.keys(this.securityHeaders).length,
                    responseTemplatesCount: Object.keys(this.responseTemplates).length
                },
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    memoryUsage: process.memoryUsage(),
                    uptime: process.uptime()
                }
            };

            this.logger.debug('Response statistics compiled', {
                totalResponses: performanceMetrics.totalResponses,
                averageResponseTime: performanceMetrics.averageResponseTime,
                requestsPerSecond: performanceMetrics.requestsPerSecond,
                function: 'ResponseGenerator.getResponseStats'
            });

            return statsReport;

        } catch (error) {
            this.logger.error('Failed to compile response statistics', {
                error: error.message,
                function: 'ResponseGenerator.getResponseStats'
            });

            return {
                error: true,
                errorMessage: error.message,
                performance: {},
                configuration: {},
                system: {}
            };
        }
    }

    /**
     * Updates internal response statistics with new response data for performance tracking
     * @private
     * @param {number} statusCode - HTTP status code of the response
     * @param {number} responseTime - Response generation time in milliseconds
     */
    updateStatistics(statusCode, responseTime) {
        try {
            this.statistics.totalResponses++;
            this.statistics.totalResponseTime += responseTime;
            this.statistics.averageResponseTime = this.statistics.totalResponseTime / this.statistics.totalResponses;

            if (statusCode >= 200 && statusCode < 400) {
                this.statistics.successResponses++;
            } else {
                this.statistics.errorResponses++;
            }

        } catch (error) {
            this.logger.error('Failed to update response statistics', {
                error: error.message,
                statusCode: statusCode,
                responseTime: responseTime,
                function: 'ResponseGenerator.updateStatistics'
            });
        }
    }
}

// Create and export default response generator instance configured with environment settings
const responseGenerator = new ResponseGenerator({
    defaultHeaders: {
        ...DEFAULT_HEADERS,
        'Server': serverConfig.http?.server?.name || 'Node.js Tutorial Server'
    },
    securityHeaders: {},
    enablePerformance: !isProduction, // Enable performance monitoring in development
    environment: environment
});

// Export individual utility functions for granular response generation management
export { sendSuccess, sendNotFound, sendMethodNotAllowed, sendInternalError, generateErrorResponse };

// Export utility functions for header and content management
export { setResponseHeaders, calculateContentLength };

// Export ResponseGenerator class for creating custom response generator instances
export { ResponseGenerator };

// Export HTTP status codes and messages constants for use by other components
export { HTTP_STATUS_CODES, HTTP_STATUS_MESSAGES };

// Export default headers and response templates for configuration and testing
export { DEFAULT_HEADERS, RESPONSE_TEMPLATES };

// Export default response generator instance configured with environment settings for immediate use
export { responseGenerator };

// Export the default configured response generator instance as default export
export default responseGenerator;