/**
 * Node.js Tutorial HTTP Server - Hello Endpoint Handler Component
 * 
 * Hello endpoint handler component that implements the primary `/hello` endpoint functionality for 
 * the Node.js tutorial HTTP server application. Generates standardized 'Hello world' responses with 
 * appropriate HTTP headers, status codes, and security protection while demonstrating fundamental 
 * Node.js HTTP endpoint implementation patterns.
 * 
 * This component provides comprehensive hello endpoint handling with performance tracking, structured 
 * logging, request validation, and response generation capabilities. Integrates with response generator, 
 * logger, and configuration systems for consistent HTTP response delivery and monitoring.
 * 
 * Educational Features:
 * - Demonstrates Node.js HTTP endpoint implementation with request/response processing
 * - Shows structured logging integration with correlation IDs for request tracking
 * - Illustrates performance measurement using Node.js built-in performance APIs
 * - Teaches configuration management and environment-dependent behavior patterns
 * - Demonstrates HTTP response generation with proper status codes and headers
 * 
 * Dependencies:
 * - response-generator.js: HTTP response formatting and standardization
 * - logger.js: Centralized logging with correlation tracking and structured output
 * - environment.js: Environment configuration for customizable behavior
 * - server-config.js: Server configuration for routing and HTTP settings
 * - Node.js built-in modules: performance hooks and utilities
 * 
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Internal imports - response generation utility for creating HTTP 200 success responses
const { sendSuccess } = require('./response-generator.js');

// Internal imports - centralized logging functionality for hello handler events and performance tracking
const { logger } = require('./logger.js');

// Internal imports - environment configuration for hello handler behavior customization
const { config } = require('../config/environment.js');

// Internal imports - server configuration for hello endpoint routing parameters and HTTP response settings
const { serverConfig } = require('../config/server-config.js');

// Node.js built-in performance API for measuring hello handler response generation timing
const { performance } = require('node:perf_hooks'); // Node.js built-in v22.x

// Node.js built-in utility module for content formatting and debugging information
const util = require('node:util'); // Node.js built-in v22.x

// Global constants for hello endpoint configuration and response content
const HELLO_MESSAGE = 'Hello world';
const ENDPOINT_PATH = '/hello';
const SUCCESS_STATUS_CODE = 200;
const CONTENT_TYPE = 'text/plain; charset=utf-8';

/**
 * Primary hello endpoint handler function that processes GET requests to /hello and generates 
 * 'Hello world' responses with appropriate HTTP status codes and headers
 * @param {Object} req - HTTP IncomingMessage object containing request details including method, URL, and headers
 * @param {Object} res - HTTP ServerResponse object for generating and sending the hello world response to client
 * @returns {Promise<void>} Promise that resolves when hello response is successfully sent to client
 */
async function handleHello(req, res) {
    // Start performance timing measurement for hello handler response generation
    const performanceStart = performance.now();
    
    // Extract correlation ID from request context for logging and tracing
    const correlationId = req.headers['x-correlation-id'] || 
                          req.headers['x-request-id'] || 
                          generateCorrelationId();
    
    try {
        // Validate HTTP request method is GET for hello endpoint processing
        if (req.method !== 'GET') {
            logger.warn('Invalid HTTP method for hello endpoint', {
                correlationId,
                method: req.method,
                url: req.url,
                expectedMethod: 'GET'
            });
            
            // Send 405 Method Not Allowed response
            res.writeHead(405, { 'Allow': 'GET', 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }

        // Validate request URL path matches exactly '/hello' for proper routing
        if (req.url !== ENDPOINT_PATH) {
            logger.warn('Invalid URL path for hello endpoint', {
                correlationId,
                requestedPath: req.url,
                expectedPath: ENDPOINT_PATH
            });
            
            // Send 404 Not Found response
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        // Log incoming hello request with correlation ID and client information
        logger.info('Hello request received', {
            correlationId,
            method: req.method,
            url: req.url,
            clientIP: req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        // Generate 'Hello world' response content using configured hello message
        const responseContent = generateHelloContent(req, {
            customMessage: config.server?.customHelloMessage,
            includeTimestamp: config.isDevelopment,
            correlationId: correlationId
        });

        // Set appropriate HTTP headers including Content-Type text/plain and security headers
        const responseHeaders = {
            'Content-Type': CONTENT_TYPE,
            'X-Correlation-ID': correlationId,
            'X-Powered-By': 'Node.js Tutorial Server',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        // Use response generator to send HTTP 200 success response with hello content
        await sendSuccess(res, responseContent, responseHeaders);

        // Measure and record hello handler response generation timing
        const performanceEnd = performance.now();
        const responseTime = performanceEnd - performanceStart;

        // Log successful hello response generation with performance metrics
        logger.info('Hello response sent successfully', {
            correlationId,
            responseTime: `${responseTime.toFixed(2)}ms`,
            contentLength: Buffer.byteLength(responseContent, 'utf8'),
            statusCode: SUCCESS_STATUS_CODE,
            timestamp: new Date().toISOString()
        });

        // Update performance statistics if available
        if (global.helloHandlerStats) {
            global.helloHandlerStats.requestCount++;
            global.helloHandlerStats.totalResponseTime += responseTime;
            global.helloHandlerStats.avgResponseTime = 
                global.helloHandlerStats.totalResponseTime / global.helloHandlerStats.requestCount;
        }

    } catch (error) {
        // Handle any errors during hello response generation with proper error logging
        const performanceEnd = performance.now();
        const errorTime = performanceEnd - performanceStart;

        logger.error('Hello handler error occurred', {
            correlationId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            processingTime: `${errorTime.toFixed(2)}ms`,
            requestUrl: req.url,
            requestMethod: req.method,
            timestamp: new Date().toISOString()
        });

        // Send 500 Internal Server Error response if headers not already sent
        if (!res.headersSent) {
            res.writeHead(500, { 
                'Content-Type': 'text/plain',
                'X-Correlation-ID': correlationId 
            });
            res.end('Internal Server Error');
        }

        // Update error statistics if available
        if (global.helloHandlerStats) {
            global.helloHandlerStats.errorCount++;
        }
    }
}

/**
 * Validates incoming HTTP requests for hello endpoint to ensure proper method, path, and request 
 * format before processing
 * @param {Object} req - HTTP request object to validate for hello endpoint processing
 * @returns {Object} Validation result object with isValid boolean and error message if invalid
 */
function validateHelloRequest(req) {
    try {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            details: {}
        };

        // Check HTTP method is GET as required for hello endpoint
        if (!req.method || req.method !== 'GET') {
            validation.isValid = false;
            validation.errors.push({
                field: 'method',
                message: 'HTTP method must be GET for hello endpoint',
                expected: 'GET',
                actual: req.method
            });
        }

        // Validate request URL path matches exactly '/hello' pattern
        if (!req.url || req.url !== ENDPOINT_PATH) {
            validation.isValid = false;
            validation.errors.push({
                field: 'url',
                message: 'Request URL must exactly match hello endpoint path',
                expected: ENDPOINT_PATH,
                actual: req.url
            });
        }

        // Verify request headers do not contain malicious or invalid content
        if (req.headers) {
            const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
            const headerCount = Object.keys(req.headers).length;
            
            if (headerCount > 50) {
                validation.warnings.push({
                    field: 'headers',
                    message: 'High number of request headers detected',
                    count: headerCount,
                    limit: 50
                });
            }

            // Check for potentially dangerous headers
            for (const [headerName, headerValue] of Object.entries(req.headers)) {
                if (typeof headerValue === 'string' && headerValue.length > 1000) {
                    validation.warnings.push({
                        field: 'headers',
                        message: `Header value exceeds recommended length: ${headerName}`,
                        headerName,
                        length: headerValue.length,
                        limit: 1000
                    });
                }
            }
        }

        // Check request body is empty or minimal for GET request requirements
        if (req.method === 'GET' && req.headers['content-length']) {
            const contentLength = parseInt(req.headers['content-length'], 10);
            if (contentLength > 0) {
                validation.warnings.push({
                    field: 'body',
                    message: 'GET request should not contain request body',
                    contentLength: contentLength
                });
            }
        }

        // Validate Content-Length header if present for security constraints
        if (req.headers['content-length']) {
            const contentLength = parseInt(req.headers['content-length'], 10);
            if (isNaN(contentLength) || contentLength < 0) {
                validation.isValid = false;
                validation.errors.push({
                    field: 'content-length',
                    message: 'Invalid Content-Length header value',
                    value: req.headers['content-length']
                });
            }
        }

        // Add validation details for monitoring and debugging
        validation.details = {
            method: req.method,
            url: req.url,
            headerCount: req.headers ? Object.keys(req.headers).length : 0,
            userAgent: req.headers ? req.headers['user-agent'] : null,
            contentLength: req.headers ? req.headers['content-length'] : null,
            validatedAt: new Date().toISOString()
        };

        return validation;

    } catch (error) {
        logger.error('Request validation error', {
            error: error.message,
            stack: error.stack
        });

        return {
            isValid: false,
            errors: [{
                field: 'validation',
                message: 'Request validation failed due to processing error',
                error: error.message
            }],
            warnings: [],
            details: {
                validationError: true,
                validatedAt: new Date().toISOString()
            }
        };
    }
}

/**
 * Generates the hello world message content with optional customization based on environment 
 * configuration and request context
 * @param {Object} req - HTTP request object for context-aware content generation
 * @param {Object} options - Optional content generation options including custom messages
 * @returns {string} Generated hello world message content for HTTP response body
 */
function generateHelloContent(req, options = {}) {
    try {
        // Load hello message configuration from server config and environment
        const baseMessage = options.customMessage || 
                           serverConfig.routing?.routes?.['/hello']?.defaultMessage || 
                           HELLO_MESSAGE;

        let content = baseMessage;

        // Apply environment-specific message customization if configured
        if (config.isDevelopment && options.includeTimestamp) {
            const timestamp = new Date().toISOString();
            content += `\nGenerated at: ${timestamp}`;
        }

        // Add optional correlation ID for development mode
        if (options.correlationId && config.isDevelopment) {
            content += `\nCorrelation ID: ${options.correlationId}`;
        }

        // Include server information in development mode
        if (config.isDevelopment) {
            const serverInfo = serverConfig.http?.server;
            if (serverInfo) {
                content += `\nServer: ${serverInfo.name} v${serverInfo.version}`;
            }
        }

        // Add request context information if in debug mode
        if (config.logging?.level === 'debug' && req) {
            content += `\nRequest Method: ${req.method}`;
            content += `\nRequest URL: ${req.url}`;
            content += `\nNode.js Version: ${process.version}`;
        }

        // Validate generated content length and format for HTTP response
        if (typeof content !== 'string') {
            logger.warn('Generated content is not a string, converting', {
                contentType: typeof content,
                content: util.inspect(content)
            });
            content = String(content);
        }

        const contentLength = Buffer.byteLength(content, 'utf8');
        const maxContentLength = serverConfig.http?.connections?.maxBodySize || 1048576;
        
        if (contentLength > maxContentLength) {
            logger.warn('Generated content exceeds maximum length', {
                contentLength,
                maxLength: maxContentLength
            });
            content = baseMessage; // Fallback to base message
        }

        return content;

    } catch (error) {
        logger.error('Content generation error', {
            error: error.message,
            stack: error.stack,
            options: options
        });

        // Return default message on error
        return HELLO_MESSAGE;
    }
}

/**
 * Measures hello handler performance including response generation time, content processing, 
 * and overall handler execution duration
 * @param {Function} handlerFunction - Hello handler function to measure for performance analysis
 * @param {Object} req - HTTP request object for context
 * @param {Object} res - HTTP response object for measurement
 * @returns {Promise<Object>} Performance measurement results with timing, memory usage, and execution metrics
 */
async function measureHelloPerformance(handlerFunction, req, res) {
    try {
        // Record start time using high-resolution performance timer
        const startTime = performance.now();
        const startMark = `hello-handler-start-${Date.now()}`;
        performance.mark(startMark);

        // Measure initial memory usage before handler execution
        const initialMemory = process.memoryUsage();

        // Execute hello handler function with request and response objects
        const executionResult = await handlerFunction(req, res);

        // Record end time and calculate total execution duration
        const endTime = performance.now();
        const endMark = `hello-handler-end-${Date.now()}`;
        performance.mark(endMark);
        
        const executionDuration = endTime - startTime;

        // Measure memory usage after handler completion
        const finalMemory = process.memoryUsage();

        // Calculate performance metrics including response time and memory delta
        const memoryDelta = {
            rss: finalMemory.rss - initialMemory.rss,
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
            external: finalMemory.external - initialMemory.external,
            arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers
        };

        // Measure Node.js event loop lag for performance assessment
        const eventLoopLag = performance.eventLoopUtilization();

        // Create comprehensive performance measurement object
        const performanceMetrics = {
            timing: {
                startTime,
                endTime,
                executionDuration: `${executionDuration.toFixed(2)}ms`,
                startMark,
                endMark
            },
            memory: {
                initial: initialMemory,
                final: finalMemory,
                delta: memoryDelta,
                deltaFormatted: {
                    rss: `${(memoryDelta.rss / 1024 / 1024).toFixed(2)} MB`,
                    heapUsed: `${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                    heapTotal: `${(memoryDelta.heapTotal / 1024 / 1024).toFixed(2)} MB`
                }
            },
            eventLoop: {
                utilization: eventLoopLag,
                lag: eventLoopLag.utilization > 0.7 ? 'High' : 'Normal'
            },
            request: {
                method: req.method,
                url: req.url,
                userAgent: req.headers['user-agent'],
                correlationId: req.headers['x-correlation-id']
            },
            response: {
                headersSent: res.headersSent,
                statusCode: res.statusCode
            },
            performance: {
                withinTarget: executionDuration < (serverConfig.performance?.thresholds?.responseTime || 100),
                memoryEfficient: memoryDelta.heapUsed < 1024 * 1024, // Less than 1MB
                executionResult: executionResult !== undefined ? 'Success' : 'Unknown'
            },
            measurementTimestamp: new Date().toISOString()
        };

        // Log performance measurement results for monitoring
        logger.info('Hello handler performance measured', {
            executionDuration: performanceMetrics.timing.executionDuration,
            memoryDelta: performanceMetrics.memory.deltaFormatted,
            withinTarget: performanceMetrics.performance.withinTarget,
            correlationId: performanceMetrics.request.correlationId
        });

        // Clean up performance marks
        try {
            performance.clearMarks(startMark);
            performance.clearMarks(endMark);
        } catch (cleanupError) {
            logger.debug('Performance mark cleanup error', { error: cleanupError.message });
        }

        return performanceMetrics;

    } catch (error) {
        logger.error('Performance measurement failed', {
            error: error.message,
            stack: error.stack,
            handlerFunction: handlerFunction?.name
        });

        return {
            error: true,
            errorMessage: error.message,
            timing: {
                executionDuration: 'unknown',
                measurementFailed: true
            },
            memory: {
                measurementFailed: true
            },
            measurementTimestamp: new Date().toISOString()
        };
    }
}

/**
 * Hello endpoint handler class that encapsulates hello world response generation functionality 
 * with performance tracking, logging integration, and configurable response behavior for the 
 * Node.js tutorial application
 */
class HelloHandler {
    /**
     * Initializes hello handler with configuration, logging, performance tracking, and response 
     * generation capabilities
     * @param {Object} options - Configuration options including custom hello message, performance monitoring, and response settings
     */
    constructor(options = {}) {
        try {
            // Initialize logger instance for hello handler event tracking and debugging
            this.logger = logger;

            // Load hello handler configuration from environment and server config settings
            this.config = {
                ...config,
                ...serverConfig,
                ...options
            };

            // Set up hello world message content with configurable customization options
            this.helloMessage = options.helloMessage || 
                               this.config.routing?.routes?.['/hello']?.defaultMessage || 
                               HELLO_MESSAGE;

            // Initialize performance statistics collection for hello handler monitoring
            this.performanceStats = {
                requestCount: 0,
                successCount: 0,
                errorCount: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                lastRequestAt: null,
                createdAt: new Date().toISOString()
            };

            // Create response generator configuration for consistent HTTP response formatting
            this.responseOptions = {
                defaultHeaders: {
                    'Content-Type': CONTENT_TYPE,
                    'X-Powered-By': 'Node.js Tutorial Server',
                    ...options.defaultHeaders
                },
                correlationTracking: true,
                performanceTracking: options.performanceTracking !== false
            };

            // Configure error handling and recovery mechanisms for hello handler failures
            this.errorHandler = options.errorHandler || this.defaultErrorHandler.bind(this);

            // Set up correlation tracking integration for request tracing across components
            this.correlationTracking = options.correlationTracking !== false;

            this.logger.info('HelloHandler instance initialized', {
                helloMessage: this.helloMessage,
                correlationTracking: this.correlationTracking,
                performanceTracking: this.responseOptions.performanceTracking,
                configurationLoaded: true,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('HelloHandler initialization failed', {
                error: error.message,
                stack: error.stack,
                options: options
            });
            throw error;
        }
    }

    /**
     * Main hello handler method that processes HTTP requests and generates hello world responses 
     * with full performance tracking and error handling
     * @param {Object} req - HTTP IncomingMessage object with request details and context
     * @param {Object} res - HTTP ServerResponse object for response generation and client communication
     * @returns {Promise<void>} Promise that resolves when hello response is successfully processed and sent to client
     */
    async handle(req, res) {
        // Start request processing with performance measurement and correlation tracking
        const performanceStart = performance.now();
        const correlationId = this.generateCorrelationId(req);

        try {
            // Validate incoming request for hello endpoint compatibility and security requirements
            const validation = this.validateRequest(req);
            if (!validation.isValid) {
                this.logger.warn('Request validation failed', {
                    correlationId,
                    errors: validation.errors,
                    warnings: validation.warnings
                });

                // Send appropriate error response based on validation failure
                if (validation.errors.some(err => err.field === 'method')) {
                    res.writeHead(405, { 'Allow': 'GET', 'Content-Type': 'text/plain' });
                    res.end('Method Not Allowed');
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Bad Request');
                }
                
                this.updateStats('error');
                return;
            }

            // Extract request context including correlation ID and client information for logging
            const requestContext = {
                correlationId,
                method: req.method,
                url: req.url,
                clientIP: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                requestId: req.headers['x-request-id'],
                timestamp: new Date().toISOString()
            };

            // Log incoming hello request with structured information for monitoring and debugging
            this.logger.info('Hello request processing started', requestContext);

            // Generate hello world response content using configured message and formatting
            const responseData = this.generateResponse(req, {
                correlationId,
                includeMetadata: this.config.isDevelopment
            });

            // Apply security headers and HTTP response formatting using response generator
            const responseHeaders = {
                ...this.responseOptions.defaultHeaders,
                'X-Correlation-ID': correlationId,
                'X-Request-ID': correlationId,
                ...responseData.headers
            };

            // Send HTTP 200 success response with hello world content to client
            await sendSuccess(res, responseData.content, responseHeaders);

            // Record performance metrics including response time and processing duration
            const performanceEnd = performance.now();
            const responseTime = performanceEnd - performanceStart;

            // Log successful hello response completion with timing and correlation information
            this.logger.info('Hello request processed successfully', {
                correlationId,
                responseTime: `${responseTime.toFixed(2)}ms`,
                contentLength: Buffer.byteLength(responseData.content, 'utf8'),
                statusCode: SUCCESS_STATUS_CODE,
                requestContext
            });

            // Update handler performance statistics for monitoring and health checking
            this.updateStats('success', responseTime);

        } catch (error) {
            // Handle any processing errors with appropriate error responses and logging
            await this.errorHandler(error, req, res, {
                correlationId,
                performanceStart,
                context: 'handle'
            });
        }
    }

    /**
     * Returns hello handler performance statistics including request counts, response times, 
     * and success rates for monitoring purposes
     * @returns {Object} Hello handler statistics object with performance metrics, counts, and timing information
     */
    getStats() {
        try {
            // Collect current hello request count and success rate statistics
            const currentStats = { ...this.performanceStats };

            // Calculate average response time and performance distribution metrics
            if (currentStats.requestCount > 0) {
                currentStats.avgResponseTime = Number(currentStats.avgResponseTime.toFixed(2));
                currentStats.successRate = Number(((currentStats.successCount / currentStats.requestCount) * 100).toFixed(2));
                currentStats.errorRate = Number(((currentStats.errorCount / currentStats.requestCount) * 100).toFixed(2));
            } else {
                currentStats.successRate = 0;
                currentStats.errorRate = 0;
            }

            // Include error count and error rate information for health monitoring
            currentStats.uptime = Date.now() - new Date(currentStats.createdAt).getTime();
            currentStats.requestsPerSecond = currentStats.requestCount > 0 ? 
                Number((currentStats.requestCount / (currentStats.uptime / 1000)).toFixed(2)) : 0;

            // Add memory usage and resource consumption statistics
            const memoryUsage = process.memoryUsage();
            currentStats.memoryUsage = {
                rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
            };

            // Include configuration and operational information
            currentStats.configuration = {
                helloMessage: this.helloMessage,
                correlationTracking: this.correlationTracking,
                performanceTracking: this.responseOptions.performanceTracking,
                environment: this.config.environment
            };

            currentStats.health = {
                status: currentStats.errorRate < 5 ? 'healthy' : currentStats.errorRate < 15 ? 'warning' : 'critical',
                avgResponseTimeMs: currentStats.avgResponseTime,
                withinPerformanceTarget: currentStats.avgResponseTime < (this.config.performance?.thresholds?.responseTime || 100)
            };

            // Return comprehensive statistics object for monitoring integration
            return currentStats;

        } catch (error) {
            this.logger.error('Failed to generate handler statistics', {
                error: error.message,
                stack: error.stack
            });

            return {
                error: true,
                errorMessage: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validates HTTP requests for hello endpoint processing with security checks and request 
     * format validation
     * @param {Object} req - HTTP request object to validate for hello endpoint compatibility
     * @returns {Object} Request validation result with isValid status and detailed error information if validation fails
     */
    validateRequest(req) {
        return validateHelloRequest(req);
    }

    /**
     * Generates hello world HTTP response with appropriate headers, status code, and content 
     * formatting for client delivery
     * @param {Object} req - HTTP request object for context-aware response generation
     * @param {Object} options - Optional response generation settings including custom content
     * @returns {Object} Generated response object with status code, headers, and hello world content
     */
    generateResponse(req, options = {}) {
        try {
            // Generate hello world message content using configured template
            const content = generateHelloContent(req, {
                customMessage: this.helloMessage,
                includeTimestamp: this.config.isDevelopment,
                correlationId: options.correlationId,
                includeMetadata: options.includeMetadata
            });

            // Set HTTP status code to 200 OK for successful hello response
            const statusCode = SUCCESS_STATUS_CODE;

            // Apply security headers for response protection and compliance
            const securityHeaders = {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '0',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };

            // Set Content-Type header to text/plain with UTF-8 encoding
            const contentHeaders = {
                'Content-Type': CONTENT_TYPE,
                'Content-Length': Buffer.byteLength(content, 'utf8').toString()
            };

            // Calculate Content-Length header based on hello message byte length
            const responseHeaders = {
                ...securityHeaders,
                ...contentHeaders,
                ...options.customHeaders
            };

            // Return complete response object ready for HTTP transmission to client
            const response = {
                statusCode,
                headers: responseHeaders,
                content,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    correlationId: options.correlationId,
                    contentLength: Buffer.byteLength(content, 'utf8'),
                    responseType: 'hello-world'
                }
            };

            this.logger.debug('Response generated successfully', {
                correlationId: options.correlationId,
                contentLength: response.metadata.contentLength,
                statusCode: response.statusCode
            });

            return response;

        } catch (error) {
            this.logger.error('Response generation failed', {
                error: error.message,
                stack: error.stack,
                correlationId: options.correlationId
            });

            // Return minimal error response
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/plain' },
                content: 'Internal Server Error',
                metadata: {
                    error: true,
                    errorMessage: error.message,
                    generatedAt: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Updates hello handler configuration dynamically including custom messages, performance 
     * settings, and logging options
     * @param {Object} newConfig - New configuration object with updated hello handler settings
     * @returns {void} No return value - updates internal handler configuration
     */
    updateConfig(newConfig) {
        try {
            // Validate new configuration options for correctness and compatibility
            if (!newConfig || typeof newConfig !== 'object') {
                throw new Error('Invalid configuration object provided');
            }

            const previousConfig = { ...this.config };

            // Update hello message content with new configuration values
            if (newConfig.helloMessage) {
                this.helloMessage = newConfig.helloMessage;
            }

            // Reconfigure performance monitoring and logging settings
            if (newConfig.performanceTracking !== undefined) {
                this.responseOptions.performanceTracking = newConfig.performanceTracking;
            }

            if (newConfig.correlationTracking !== undefined) {
                this.correlationTracking = newConfig.correlationTracking;
            }

            // Apply new security and response formatting options
            if (newConfig.defaultHeaders) {
                this.responseOptions.defaultHeaders = {
                    ...this.responseOptions.defaultHeaders,
                    ...newConfig.defaultHeaders
                };
            }

            // Update internal configuration with new settings
            this.config = {
                ...this.config,
                ...newConfig
            };

            // Log configuration update event for audit and debugging purposes
            this.logger.info('HelloHandler configuration updated', {
                previousHelloMessage: previousConfig.helloMessage,
                newHelloMessage: this.helloMessage,
                updatedFields: Object.keys(newConfig),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Configuration update failed', {
                error: error.message,
                stack: error.stack,
                newConfig: newConfig
            });
            throw error;
        }
    }

    /**
     * Generates correlation ID for request tracking
     * @private
     * @param {Object} req - HTTP request object
     * @returns {string} Generated correlation ID
     */
    generateCorrelationId(req) {
        return req.headers['x-correlation-id'] || 
               req.headers['x-request-id'] || 
               generateCorrelationId();
    }

    /**
     * Updates performance statistics
     * @private
     * @param {string} type - Type of update ('success' or 'error')
     * @param {number} responseTime - Response time in milliseconds
     */
    updateStats(type, responseTime = 0) {
        this.performanceStats.requestCount++;
        this.performanceStats.lastRequestAt = new Date().toISOString();

        if (type === 'success') {
            this.performanceStats.successCount++;
            this.performanceStats.totalResponseTime += responseTime;
            this.performanceStats.avgResponseTime = 
                this.performanceStats.totalResponseTime / this.performanceStats.successCount;
            
            if (responseTime < this.performanceStats.minResponseTime) {
                this.performanceStats.minResponseTime = responseTime;
            }
            if (responseTime > this.performanceStats.maxResponseTime) {
                this.performanceStats.maxResponseTime = responseTime;
            }
        } else if (type === 'error') {
            this.performanceStats.errorCount++;
        }
    }

    /**
     * Default error handler for hello handler errors
     * @private
     * @param {Error} error - Error object
     * @param {Object} req - HTTP request object
     * @param {Object} res - HTTP response object
     * @param {Object} context - Error context information
     */
    async defaultErrorHandler(error, req, res, context = {}) {
        const { correlationId, performanceStart } = context;
        const errorTime = performanceStart ? performance.now() - performanceStart : 0;

        this.logger.error('HelloHandler error occurred', {
            correlationId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            processingTime: errorTime ? `${errorTime.toFixed(2)}ms` : 'unknown',
            context: context.context,
            requestUrl: req.url,
            requestMethod: req.method,
            timestamp: new Date().toISOString()
        });

        // Send error response if headers not already sent
        if (!res.headersSent) {
            res.writeHead(500, { 
                'Content-Type': 'text/plain',
                'X-Correlation-ID': correlationId || 'error-unknown'
            });
            res.end('Internal Server Error');
        }

        this.updateStats('error', errorTime);
    }
}

/**
 * Generates correlation ID for request tracking
 * @private
 * @returns {string} Generated correlation ID
 */
function generateCorrelationId() {
    return `hello-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize global performance statistics for hello handler monitoring
global.helloHandlerStats = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    avgResponseTime: 0,
    startTime: new Date().toISOString()
};

// Create and configure default hello handler instance for immediate use
const helloHandler = new HelloHandler({
    helloMessage: config.server?.customHelloMessage || HELLO_MESSAGE,
    performanceTracking: true,
    correlationTracking: true,
    defaultHeaders: {
        'Server': serverConfig.http?.server?.name || 'Node.js Tutorial Server',
        'X-Powered-By': 'Node.js Tutorial Server/1.0.0'
    }
});

// Export individual functions for granular usage and testing
module.exports = {
    // Primary hello endpoint handler function for processing /hello requests without class instantiation
    handleHello,
    
    // Utility function for validating hello endpoint requests with security and format checks
    validateHelloRequest,
    
    // Utility function for generating hello world message content with configuration support
    generateHelloContent,
    
    // Performance measurement utility for analyzing hello handler execution metrics
    measureHelloPerformance,
    
    // HelloHandler class for creating hello handler instances with full configuration and performance tracking capabilities
    HelloHandler,
    
    // Default hello handler instance configured with environment settings for immediate use in request routing
    helloHandler,
    
    // Global constants for use by other modules and testing
    HELLO_MESSAGE,
    ENDPOINT_PATH,
    SUCCESS_STATUS_CODE,
    CONTENT_TYPE
};