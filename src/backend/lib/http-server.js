/**
 * Node.js Tutorial HTTP Server - Core HTTP Server Component
 * 
 * Comprehensive HTTP server implementation that provides the foundational HTTP server functionality
 * for the Node.js tutorial application. Creates and manages HTTP server instances, coordinates request
 * processing through routing and middleware, handles server lifecycle events, and integrates with
 * logging, error handling, and performance monitoring while demonstrating fundamental Node.js HTTP
 * server patterns with zero external dependencies.
 * 
 * This component demonstrates enterprise-grade HTTP server architecture including server lifecycle
 * management, request processing coordination, comprehensive error handling, performance monitoring,
 * graceful shutdown procedures, and integration patterns with routing, middleware, and logging systems.
 * 
 * Educational Features:
 * - Complete HTTP server lifecycle management from startup through graceful shutdown
 * - Request processing pipeline with routing, middleware, and error handling integration
 * - Performance monitoring and statistics collection for operational visibility
 * - Correlation tracking and structured logging for debugging and monitoring
 * - Security-focused error handling that prevents information disclosure
 * - Graceful shutdown with connection draining and resource cleanup
 * 
 * Dependencies: Node.js built-in modules only (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import Node.js built-in modules for HTTP server functionality and system integration
import http from 'node:http'; // Node.js built-in HTTP module for creating HTTP servers and handling requests/responses
import { performance } from 'node:perf_hooks'; // Node.js built-in performance API for high-resolution timing and server performance monitoring
import { EventEmitter } from 'node:events'; // Node.js built-in events module for server event handling and lifecycle management

// Import internal components for request processing, error handling, and system integration
import { RequestRouter } from './request-router.js';
import { ErrorHandler } from './error-handler.js';
import { logger } from './logger.js';
import { config } from '../config/environment.js';
import { serverConfig } from '../config/server-config.js';
import { requestLogger } from '../middleware/request-logger.js';

// Global server configuration constants for consistent server behavior across environments
const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = '127.0.0.1';
const SERVER_NAME = 'Node.js Tutorial HTTP Server';
const CONNECTION_TIMEOUT = 120000; // 2 minutes connection timeout

// Server state constants for lifecycle management and status tracking
const SERVER_STATES = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
    ERROR: 'error'
};

// Performance monitoring thresholds for server health assessment
const PERFORMANCE_THRESHOLDS = {
    RESPONSE_TIME_MS: serverConfig?.performance?.thresholds?.responseTime || 100,
    MEMORY_USAGE_PERCENT: serverConfig?.performance?.thresholds?.memoryUsage || 80,
    ERROR_RATE_PERCENT: serverConfig?.performance?.thresholds?.errorRate || 5
};

// Request processing statistics for monitoring and performance analysis
let serverStats = {
    totalRequests: 0,
    requestsByMethod: {},
    requestsByStatus: {},
    responseTimes: [],
    errors: {
        total: 0,
        byType: {}
    },
    connections: {
        current: 0,
        total: 0,
        rejected: 0
    },
    startTime: null,
    uptime: 0
};

/**
 * Creates and configures HTTP server instance with request handling, middleware integration, 
 * error handling, and performance monitoring for the Node.js tutorial application
 * @param {object} options - Server configuration options including port, hostname, timeout settings, and middleware configuration
 * @returns {object} Configured HTTP server instance ready for listening and request processing
 */
export function createServer(options = {}) {
    try {
        logger.info('Creating HTTP server instance', { options });

        // Step 1: Load server configuration from environment and server config with validation
        const serverConfiguration = {
            port: options.port || config.server?.port || DEFAULT_PORT,
            hostname: options.hostname || config.server?.hostname || DEFAULT_HOSTNAME,
            timeout: options.timeout || serverConfig?.http?.timeouts?.server || CONNECTION_TIMEOUT,
            keepAliveTimeout: serverConfig?.http?.timeouts?.keepAlive || 5000,
            headersTimeout: serverConfig?.http?.timeouts?.headers || 60000,
            requestTimeout: serverConfig?.http?.timeouts?.request || 300000,
            maxConnections: serverConfig?.http?.connections?.maxConcurrent || 100,
            ...options
        };

        // Step 2: Initialize request router for URL path matching and handler delegation
        const router = new RequestRouter({
            routes: serverConfig?.routing?.routes || { '/hello': { methods: ['GET'], handler: 'helloHandler' } },
            enableLogging: true,
            enableCorrelation: true
        });

        // Step 3: Set up error handler for centralized error processing and response generation
        const errorHandler = new ErrorHandler({
            environment: config.environment,
            securityEnabled: config.isProduction,
            includeStackTraces: config.isDevelopment
        });

        // Step 4: Configure request logging middleware for performance tracking and correlation
        const middleware = [requestLogger]; // Request logging middleware with correlation tracking

        // Step 5: Create HTTP server instance using Node.js built-in http.createServer method
        const server = http.createServer(async (req, res) => {
            await handleRequest(req, res, { router, errorHandler, middleware, serverConfiguration });
        });

        // Step 6: Set server timeout configurations including request and keep-alive timeouts
        server.timeout = serverConfiguration.timeout;
        server.keepAliveTimeout = serverConfiguration.keepAliveTimeout;
        server.headersTimeout = serverConfiguration.headersTimeout;
        server.requestTimeout = serverConfiguration.requestTimeout;
        server.maxConnections = serverConfiguration.maxConnections;

        // Step 7: Configure server event handlers for connection, error, and lifecycle events
        setupServerEventHandlers(server, serverConfiguration);

        // Step 8: Set up graceful shutdown handling for clean server termination
        setupGracefulShutdown(server);

        // Step 9: Apply security configurations and connection limits from server config
        configureServerSecurity(server, serverConfiguration);

        // Step 10: Initialize performance monitoring for server metrics collection
        initializePerformanceMonitoring(server);

        // Step 11: Store configuration and components on server instance for access
        server._serverConfig = serverConfiguration;
        server._router = router;
        server._errorHandler = errorHandler;
        server._middleware = middleware;

        logger.info('HTTP server instance created successfully', {
            port: serverConfiguration.port,
            hostname: serverConfiguration.hostname,
            timeout: serverConfiguration.timeout,
            maxConnections: serverConfiguration.maxConnections
        });

        // Step 12: Return configured server instance ready for port binding and listening
        return server;

    } catch (error) {
        logger.error('Failed to create HTTP server instance', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            options
        });
        throw error;
    }
}

/**
 * Main request handler function that processes all incoming HTTP requests through routing, 
 * middleware, and error handling pipeline
 * @param {object} req - HTTP IncomingMessage object containing request details, headers, and client information
 * @param {object} res - HTTP ServerResponse object for generating responses and managing connection lifecycle
 * @param {object} context - Request processing context including router, error handler, and middleware
 * @returns {Promise<void>} Promise that resolves when request processing is complete
 */
export async function handleRequest(req, res, context = {}) {
    // Step 1: Start request processing timer for performance measurement and monitoring
    const startTime = performance.now();
    let correlationId = null;

    try {
        // Step 2: Extract client information including IP address, user agent, and request timestamp
        const clientIp = req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const requestTimestamp = new Date().toISOString();

        // Step 3: Apply request logging middleware for request tracking and correlation ID generation
        if (context.middleware && Array.isArray(context.middleware)) {
            for (const middleware of context.middleware) {
                if (typeof middleware === 'function') {
                    // Execute middleware without blocking request processing
                    middleware(req, res, () => {});
                }
            }
        }

        // Step 4: Extract correlation ID from request after middleware processing
        correlationId = req.correlationId || req.headers['x-correlation-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Step 5: Log incoming request with correlation ID and client details for monitoring
        logger.info('Processing incoming HTTP request', {
            method: req.method,
            url: req.url,
            correlationId,
            clientIp,
            userAgent,
            timestamp: requestTimestamp,
            httpVersion: req.httpVersion
        });

        // Step 6: Update server statistics for request tracking and performance monitoring
        updateRequestStats(req.method, startTime);

        // Step 7: Delegate request to router for URL path analysis and handler selection
        const { router, errorHandler } = context;
        
        if (router && typeof router.route === 'function') {
            // Route request through request router with error handling
            await router.route(req, res);
        } else {
            // Fallback if router is not available
            logger.warn('Request router not available, using fallback handling', { correlationId });
            
            // Simple routing fallback for /hello endpoint
            if (req.url === '/hello' && req.method === 'GET') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Length', Buffer.byteLength('Hello world'));
                res.end('Hello world');
            } else {
                // Handle 404 Not Found for unknown paths
                if (errorHandler && typeof errorHandler.handleNotFound === 'function') {
                    await errorHandler.handleNotFound(req, res);
                } else {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.end('Not Found');
                }
            }
        }

        // Step 8: Measure request processing time and update performance statistics
        const processingTime = performance.now() - startTime;
        updateResponseTimeStats(processingTime);

        // Step 9: Log completed request with response status code and timing information
        logger.info('HTTP request processing completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            processingTime: `${processingTime.toFixed(2)}ms`,
            correlationId,
            clientIp
        });

    } catch (requestError) {
        // Step 8: Handle routing errors with centralized error handler integration
        const processingTime = performance.now() - startTime;
        
        logger.error('Error processing HTTP request', {
            error: {
                name: requestError.name,
                message: requestError.message,
                stack: requestError.stack
            },
            method: req.method,
            url: req.url,
            correlationId,
            processingTime: `${processingTime.toFixed(2)}ms`
        });

        // Update error statistics
        updateErrorStats(requestError);

        // Use error handler if available, otherwise send generic error response
        if (context.errorHandler && typeof context.errorHandler.handle === 'function') {
            await context.errorHandler.handle(requestError, req, res, { correlationId });
        } else {
            // Fallback error response
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Internal Server Error');
            }
        }
    }
}

/**
 * Starts HTTP server by binding to configured port and hostname with comprehensive error handling 
 * and lifecycle management
 * @param {object} server - HTTP server instance to start and bind to network interface
 * @param {object} options - Server startup options including port, hostname, and startup callbacks
 * @returns {Promise<void>} Promise that resolves when server is successfully listening and ready for connections
 */
export async function startServer(server, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            // Step 1: Validate server configuration parameters including port range and hostname format
            const config = server._serverConfig || options;
            const port = config.port || DEFAULT_PORT;
            const hostname = config.hostname || DEFAULT_HOSTNAME;

            // Validate port range (1024-65535 for non-privileged ports)
            if (port < 1024 || port > 65535) {
                throw new Error(`Invalid port number: ${port}. Must be between 1024-65535 for non-privileged ports.`);
            }

            // Step 2: Log server startup initiation with configuration details and environment information
            logger.info('Starting HTTP server', {
                port,
                hostname,
                environment: config.environment,
                nodeVersion: process.version,
                pid: process.pid
            });

            // Step 3: Set up server listening event handler for successful startup confirmation
            server.once('listening', () => {
                const address = server.address();
                
                // Update server statistics
                serverStats.startTime = Date.now();
                serverStats.uptime = 0;

                // Step 7: Log successful server startup with listening address and port information
                logger.info('HTTP server started successfully', {
                    address: address.address,
                    port: address.port,
                    family: address.family,
                    serverName: SERVER_NAME,
                    pid: process.pid,
                    timestamp: new Date().toISOString()
                });

                // Step 8: Initialize health check endpoint for server monitoring and status verification
                initializeHealthMonitoring(server);

                resolve();
            });

            // Step 4: Handle port binding errors including EADDRINUSE and permission errors
            server.once('error', (error) => {
                let errorMessage = 'Server startup failed';
                let suggestions = [];

                if (error.code === 'EADDRINUSE') {
                    errorMessage = `Port ${port} is already in use`;
                    suggestions = [
                        `Try using a different port`,
                        `Check for other processes using port ${port}`,
                        `Use 'lsof -i :${port}' to find the process using this port`
                    ];
                } else if (error.code === 'EACCES') {
                    errorMessage = `Permission denied to bind to port ${port}`;
                    suggestions = [
                        `Use a port number >= 1024`,
                        `Run with appropriate permissions for privileged ports`,
                        `Check system firewall settings`
                    ];
                } else if (error.code === 'ENOTFOUND') {
                    errorMessage = `Invalid hostname: ${hostname}`;
                    suggestions = [`Use a valid hostname or IP address`];
                }

                logger.error('HTTP server startup error', {
                    error: {
                        name: error.name,
                        message: error.message,
                        code: error.code,
                        stack: error.stack
                    },
                    port,
                    hostname,
                    suggestions
                });

                reject(error);
            });

            // Step 3: Bind server to configured port and hostname using server.listen method
            server.listen(port, hostname);

        } catch (setupError) {
            logger.error('Server startup setup failed', {
                error: {
                    name: setupError.name,
                    message: setupError.message,
                    stack: setupError.stack
                },
                options
            });
            reject(setupError);
        }
    });
}

/**
 * Gracefully stops HTTP server by closing active connections, completing pending requests, 
 * and cleaning up resources
 * @param {object} server - HTTP server instance to stop and clean up gracefully
 * @param {number} timeout - Optional timeout in milliseconds for graceful shutdown completion
 * @returns {Promise<void>} Promise that resolves when server shutdown is complete and resources are cleaned up
 */
export async function stopServer(server, timeout = 30000) {
    return new Promise((resolve, reject) => {
        try {
            // Step 1: Log server shutdown initiation with timestamp and active connection count
            const activeConnections = server._connections || 0;
            logger.info('Initiating HTTP server shutdown', {
                activeConnections,
                timeout,
                serverUptime: serverStats.uptime,
                timestamp: new Date().toISOString()
            });

            // Step 2: Set shutdown timeout to force close connections if graceful shutdown takes too long
            const shutdownTimeout = setTimeout(() => {
                logger.warn('Graceful shutdown timeout exceeded, forcing server termination', {
                    timeout,
                    activeConnections: server._connections || 0
                });
                server.close();
            }, timeout);

            // Step 3: Stop accepting new incoming connections while preserving active connections
            server.close((closeError) => {
                clearTimeout(shutdownTimeout);

                if (closeError) {
                    logger.error('Error during server shutdown', {
                        error: {
                            name: closeError.name,
                            message: closeError.message,
                            stack: closeError.stack
                        }
                    });
                    reject(closeError);
                    return;
                }

                // Step 5: Clean up server resources including event listeners and timers
                cleanupServerResources(server);

                // Step 6: Log successful server shutdown with timing and cleanup confirmation
                logger.info('HTTP server shutdown completed successfully', {
                    shutdownDuration: `${Date.now() - (Date.now() - timeout)}ms`,
                    totalRequestsServed: serverStats.totalRequests,
                    totalUptime: serverStats.uptime,
                    timestamp: new Date().toISOString()
                });

                resolve();
            });

        } catch (shutdownError) {
            // Step 7: Handle shutdown errors and force termination if graceful shutdown fails
            logger.error('Server shutdown setup failed', {
                error: {
                    name: shutdownError.name,
                    message: shutdownError.message,
                    stack: shutdownError.stack
                }
            });
            reject(shutdownError);
        }
    });
}

/**
 * Handles server-level errors including connection errors, port binding failures, and system errors 
 * with appropriate recovery actions
 * @param {Error} error - Server error object containing error details and stack trace
 * @param {object} server - HTTP server instance where error occurred for context
 * @returns {void} No return value - handles error with logging and recovery actions
 */
export function handleServerError(error, server) {
    try {
        // Step 1: Extract error information including type, message, and error code for classification
        const errorInfo = {
            name: error.name,
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        // Step 2: Log detailed server error information with timestamp and server context
        logger.error('Server-level error occurred', {
            error: errorInfo,
            serverState: server.listening ? 'listening' : 'not_listening',
            serverAddress: server.listening ? server.address() : null,
            uptime: serverStats.uptime,
            totalRequests: serverStats.totalRequests
        });

        // Step 3: Classify error type and determine appropriate recovery action based on error code
        let recoveryAction = 'log_only';
        let escalationRequired = false;

        if (error.code === 'EADDRINUSE') {
            recoveryAction = 'suggest_port_change';
        } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
            recoveryAction = 'resource_exhaustion';
            escalationRequired = true;
        } else if (error.code === 'ENOMEM') {
            recoveryAction = 'memory_exhaustion';
            escalationRequired = true;
        } else if (error.name === 'Error' && error.message.includes('listen')) {
            recoveryAction = 'connection_error';
        }

        // Step 4: Handle port binding errors with alternative port suggestions if applicable
        if (error.code === 'EADDRINUSE') {
            logger.warn('Port binding error - consider using alternative port', {
                currentPort: server._serverConfig?.port || DEFAULT_PORT,
                suggestions: ['Try ports 3001, 3002, 8000, or 8080', 'Use PORT=0 for automatic port assignment']
            });
        }

        // Step 5: Handle connection errors with connection cleanup and resource management
        if (recoveryAction === 'connection_error') {
            logger.warn('Connection error detected - cleaning up connections', {
                activeConnections: server._connections || 0
            });
            
            // Cleanup connections if possible
            if (server.listening) {
                server.close();
            }
        }

        // Step 6: Handle system errors with escalation to process management if critical
        if (escalationRequired) {
            logger.error('Critical server error requires escalation', {
                error: errorInfo,
                recoveryAction,
                escalationRequired,
                systemResources: {
                    memoryUsage: process.memoryUsage(),
                    uptime: process.uptime()
                }
            });
        }

        // Step 7: Update server error statistics for monitoring and alerting integration
        updateErrorStats(error, 'server_error');

    } catch (handlerError) {
        // Step 8: Prevent error handler from causing additional errors
        console.error('Error in server error handler:', handlerError.message);
        console.error('Original server error:', error.message);
    }
}

/**
 * Configures graceful shutdown handlers for process signals to ensure clean server termination 
 * and resource cleanup
 * @param {object} server - HTTP server instance to configure for graceful shutdown
 * @returns {void} No return value - configures shutdown signal handlers
 */
export function setupGracefulShutdown(server) {
    try {
        // Step 1: Register SIGTERM signal handler for graceful shutdown in production environments
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received - initiating graceful shutdown');
            stopServer(server, 30000)
                .then(() => {
                    logger.info('Graceful shutdown completed successfully');
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error('Graceful shutdown failed', { error: error.message });
                    process.exit(1);
                });
        });

        // Step 2: Register SIGINT signal handler for development environment shutdown (Ctrl+C)
        process.on('SIGINT', () => {
            logger.info('SIGINT received (Ctrl+C) - initiating graceful shutdown');
            stopServer(server, 10000)
                .then(() => {
                    logger.info('Development shutdown completed');
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error('Development shutdown failed', { error: error.message });
                    process.exit(1);
                });
        });

        // Step 3: Set up SIGQUIT handler for immediate shutdown with resource cleanup
        process.on('SIGQUIT', () => {
            logger.warn('SIGQUIT received - performing immediate shutdown');
            server.close(() => {
                process.exit(0);
            });
        });

        // Step 4: Configure uncaught exception handler to prevent process crashes
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception - shutting down server', {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                }
            });
            
            stopServer(server, 5000)
                .then(() => process.exit(1))
                .catch(() => process.exit(1));
        });

        // Step 5: Set up unhandled rejection handler for Promise error management
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined
            });
            
            // Don't exit immediately for unhandled rejections, just log them
        });

        // Step 6: Log signal handler setup completion for debugging and monitoring
        logger.info('Graceful shutdown handlers configured', {
            signals: ['SIGTERM', 'SIGINT', 'SIGQUIT'],
            exceptionHandlers: ['uncaughtException', 'unhandledRejection']
        });

    } catch (setupError) {
        logger.error('Failed to setup graceful shutdown handlers', {
            error: setupError.message
        });
    }
}

/**
 * Comprehensive HTTP server class that encapsulates server creation, configuration, lifecycle management, 
 * request processing coordination, and integration with routing, error handling, and monitoring components
 */
export class HttpServer extends EventEmitter {
    /**
     * Initializes HTTP server with configuration, routing, error handling, logging, and performance 
     * monitoring integration
     * @param {object} options - Configuration options for server initialization including networking, routing, and middleware settings
     */
    constructor(options = {}) {
        super();

        try {
            // Step 1: Load and validate server configuration from environment and options with defaults
            this.config = {
                port: options.port || config.server?.port || DEFAULT_PORT,
                hostname: options.hostname || config.server?.hostname || DEFAULT_HOSTNAME,
                timeout: options.timeout || serverConfig?.http?.timeouts?.server || CONNECTION_TIMEOUT,
                keepAliveTimeout: serverConfig?.http?.timeouts?.keepAlive || 5000,
                headersTimeout: serverConfig?.http?.timeouts?.headers || 60000,
                requestTimeout: serverConfig?.http?.timeouts?.request || 300000,
                maxConnections: serverConfig?.http?.connections?.maxConcurrent || 100,
                environment: config.environment,
                isDevelopment: config.isDevelopment,
                isProduction: config.isProduction,
                ...options
            };

            // Step 2: Initialize centralized logger instance for server event tracking and request correlation
            this.logger = logger;

            // Step 3: Create request router instance with route definitions and handler mappings
            this.router = new RequestRouter({
                routes: serverConfig?.routing?.routes || {
                    '/hello': { methods: ['GET'], handler: 'helloHandler', description: 'Hello world endpoint' }
                },
                enableLogging: true,
                enableCorrelation: true
            });

            // Step 4: Set up error handler for centralized error processing and secure response generation
            this.errorHandler = new ErrorHandler({
                environment: this.config.environment,
                securityEnabled: this.config.isProduction,
                includeStackTraces: this.config.isDevelopment
            });

            // Step 5: Create HTTP server instance with request handler integration and middleware pipeline
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });

            // Step 6: Configure server timeout settings including request, keep-alive, and header timeouts
            this.server.timeout = this.config.timeout;
            this.server.keepAliveTimeout = this.config.keepAliveTimeout;
            this.server.headersTimeout = this.config.headersTimeout;
            this.server.requestTimeout = this.config.requestTimeout;
            this.server.maxConnections = this.config.maxConnections;

            // Step 7: Set up server event handlers for connection management and error handling
            this.setupServerEvents();

            // Step 8: Initialize server statistics collection for monitoring and performance tracking
            this.stats = {
                totalRequests: 0,
                requestsByMethod: {},
                requestsByStatus: {},
                responseTimes: [],
                errors: { total: 0, byType: {} },
                connections: { current: 0, total: 0, rejected: 0 },
                startTime: null,
                uptime: 0,
                isRunning: false
            };

            // Step 9: Configure graceful shutdown handling for clean server termination procedures
            setupGracefulShutdown(this.server);

            this.logger.info('HttpServer instance created successfully', {
                port: this.config.port,
                hostname: this.config.hostname,
                environment: this.config.environment,
                maxConnections: this.config.maxConnections
            });

        } catch (initError) {
            this.logger.error('Failed to initialize HttpServer', {
                error: {
                    name: initError.name,
                    message: initError.message,
                    stack: initError.stack
                },
                options
            });
            throw initError;
        }
    }

    /**
     * Starts the HTTP server by binding to configured port and hostname with full error handling 
     * and monitoring integration
     * @returns {Promise<void>} Promise that resolves when server is listening and ready for client connections
     */
    async start() {
        try {
            // Step 1: Validate server configuration and check if server is already running
            if (this.stats.isRunning) {
                throw new Error('Server is already running');
            }

            // Step 2: Log server startup initiation with configuration details and environment
            this.logger.info('Starting HttpServer instance', {
                port: this.config.port,
                hostname: this.config.hostname,
                environment: this.config.environment,
                pid: process.pid,
                nodeVersion: process.version
            });

            // Step 3: Bind server to configured port and hostname using async server.listen
            await new Promise((resolve, reject) => {
                this.server.once('listening', () => {
                    const address = this.server.address();
                    
                    // Step 5: Set server running state to true and log successful startup confirmation
                    this.stats.isRunning = true;
                    this.stats.startTime = Date.now();

                    // Step 6: Initialize health monitoring and performance metrics collection
                    this.initializeMonitoring();

                    this.logger.info('HttpServer started and listening', {
                        address: address.address,
                        port: address.port,
                        family: address.family,
                        serverName: SERVER_NAME,
                        timestamp: new Date().toISOString()
                    });

                    this.emit('started', address);
                    resolve();
                });

                // Step 4: Handle port binding errors including EADDRINUSE with helpful error messages
                this.server.once('error', (error) => {
                    this.handleStartupError(error);
                    reject(error);
                });

                this.server.listen(this.config.port, this.config.hostname);
            });

        } catch (startError) {
            this.logger.error('Failed to start HttpServer', {
                error: {
                    name: startError.name,
                    message: startError.message,
                    stack: startError.stack
                }
            });
            throw startError;
        }
    }

    /**
     * Gracefully stops the HTTP server by closing connections, completing requests, and cleaning up resources
     * @param {number} timeout - Optional graceful shutdown timeout in milliseconds, defaults to 30 seconds
     * @returns {Promise<void>} Promise that resolves when server shutdown is complete
     */
    async stop(timeout = 30000) {
        try {
            // Step 1: Check if server is running and log shutdown initiation
            if (!this.stats.isRunning) {
                this.logger.warn('Server is not running, shutdown skipped');
                return;
            }

            this.logger.info('Stopping HttpServer instance', {
                timeout,
                activeConnections: this.server._connections || 0,
                totalRequests: this.stats.totalRequests,
                uptime: this.getUptime()
            });

            // Step 2: Stop accepting new connections while maintaining active connections
            await new Promise((resolve, reject) => {
                // Step 3: Set graceful shutdown timeout to force close if necessary
                const shutdownTimeout = setTimeout(() => {
                    this.logger.warn('Shutdown timeout reached, forcing server close');
                    this.server.close();
                }, timeout);

                this.server.close((closeError) => {
                    clearTimeout(shutdownTimeout);

                    if (closeError) {
                        this.logger.error('Error during server close', { error: closeError.message });
                        reject(closeError);
                        return;
                    }

                    // Step 5: Clean up resources including event listeners, timers, and statistics
                    this.cleanup();

                    // Step 6: Set server running state to false and log shutdown completion
                    this.stats.isRunning = false;
                    
                    this.logger.info('HttpServer stopped successfully', {
                        totalRequestsServed: this.stats.totalRequests,
                        totalUptime: this.getUptime(),
                        timestamp: new Date().toISOString()
                    });

                    this.emit('stopped');
                    resolve();
                });
            });

        } catch (stopError) {
            this.logger.error('Failed to stop HttpServer', {
                error: stopError.message
            });
            throw stopError;
        }
    }

    /**
     * Processes individual HTTP requests through middleware pipeline, routing, and error handling 
     * with performance tracking
     * @param {object} req - HTTP IncomingMessage object with request details and headers
     * @param {object} res - HTTP ServerResponse object for response generation and client communication
     * @returns {Promise<void>} Promise that resolves when request processing is complete
     */
    async handleRequest(req, res) {
        // Step 1: Start request performance timer and generate correlation ID
        const startTime = performance.now();
        let correlationId = null;

        try {
            // Step 2: Apply request logging middleware for tracking and context management
            if (typeof requestLogger === 'function') {
                requestLogger(req, res, () => {});
            }

            correlationId = req.correlationId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            // Step 3: Log incoming request with client information and correlation ID
            this.logger.info('Processing HTTP request', {
                method: req.method,
                url: req.url,
                correlationId,
                clientIp: req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'Unknown'
            });

            // Step 4: Route request through router for path matching and handler delegation
            if (this.router && typeof this.router.route === 'function') {
                await this.router.route(req, res);
            } else {
                // Fallback routing for demonstration purposes
                if (req.url === '/hello' && req.method === 'GET') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.setHeader('Content-Length', Buffer.byteLength('Hello world'));
                    res.end('Hello world');
                } else {
                    await this.errorHandler.handleNotFound(req, res);
                }
            }

            // Step 6: Measure request processing time and update server statistics
            const processingTime = performance.now() - startTime;
            this.updateRequestStats(req.method, res.statusCode, processingTime);

            // Step 7: Log completed request with status code and performance metrics
            this.logger.info('HTTP request completed', {
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                processingTime: `${processingTime.toFixed(2)}ms`,
                correlationId
            });

        } catch (requestError) {
            // Step 5: Handle routing and processing errors with centralized error handler
            const processingTime = performance.now() - startTime;

            this.logger.error('Request processing error', {
                error: requestError.message,
                method: req.method,
                url: req.url,
                correlationId,
                processingTime: `${processingTime.toFixed(2)}ms`
            });

            this.updateErrorStats(requestError);

            if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
                await this.errorHandler.handle(requestError, req, res, { correlationId });
            } else {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.end('Internal Server Error');
                }
            }
        }
    }

    /**
     * Returns comprehensive server statistics including request counts, performance metrics, error rates, 
     * and system health indicators
     * @returns {object} Server statistics object with performance metrics, request counts, and health indicators
     */
    getStats() {
        try {
            const uptime = this.getUptime();
            const avgResponseTime = this.stats.responseTimes.length > 0 
                ? this.stats.responseTimes.reduce((sum, time) => sum + time, 0) / this.stats.responseTimes.length 
                : 0;

            return {
                server: {
                    isRunning: this.stats.isRunning,
                    uptime: uptime,
                    startTime: this.stats.startTime ? new Date(this.stats.startTime).toISOString() : null,
                    pid: process.pid,
                    nodeVersion: process.version,
                    environment: this.config.environment
                },
                requests: {
                    total: this.stats.totalRequests,
                    byMethod: { ...this.stats.requestsByMethod },
                    byStatus: { ...this.stats.requestsByStatus }
                },
                performance: {
                    averageResponseTime: parseFloat(avgResponseTime.toFixed(2)),
                    minResponseTime: Math.min(...this.stats.responseTimes),
                    maxResponseTime: Math.max(...this.stats.responseTimes),
                    responseTimeSamples: this.stats.responseTimes.length
                },
                errors: {
                    total: this.stats.errors.total,
                    byType: { ...this.stats.errors.byType },
                    rate: this.stats.totalRequests > 0 
                        ? parseFloat(((this.stats.errors.total / this.stats.totalRequests) * 100).toFixed(2))
                        : 0
                },
                connections: {
                    current: this.server._connections || 0,
                    total: this.stats.connections.total,
                    rejected: this.stats.connections.rejected,
                    maxConnections: this.config.maxConnections
                },
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            };
        } catch (statsError) {
            this.logger.error('Failed to generate server statistics', { error: statsError.message });
            return {
                error: 'Failed to generate statistics',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Checks if server is currently listening for connections and returns server status information
     * @returns {boolean} True if server is listening, false if stopped or in transition state
     */
    isListening() {
        return this.server && this.server.listening && this.stats.isRunning;
    }

    /**
     * Returns server address information including hostname, port, and protocol for client connection details
     * @returns {object} Server address object with hostname, port, protocol, and URL information
     */
    getAddress() {
        try {
            if (!this.isListening()) {
                return null;
            }

            const address = this.server.address();
            
            return {
                hostname: address.address,
                port: address.port,
                family: address.family,
                protocol: 'http',
                url: `http://${address.address}:${address.port}`,
                isListening: true
            };
        } catch (addressError) {
            this.logger.error('Failed to get server address', { error: addressError.message });
            return null;
        }
    }

    // Private helper methods for internal functionality

    /**
     * Sets up server event handlers for monitoring and lifecycle management
     * @private
     */
    setupServerEvents() {
        this.server.on('connection', (socket) => {
            this.stats.connections.current++;
            this.stats.connections.total++;

            socket.on('close', () => {
                this.stats.connections.current--;
            });
        });

        this.server.on('clientError', (error, socket) => {
            this.logger.warn('Client error', {
                error: error.message,
                clientAddress: socket.remoteAddress
            });
        });

        this.server.on('error', (error) => {
            handleServerError(error, this.server);
        });
    }

    /**
     * Handles startup errors with detailed error analysis
     * @private
     */
    handleStartupError(error) {
        let suggestions = [];

        if (error.code === 'EADDRINUSE') {
            suggestions = [
                `Port ${this.config.port} is already in use`,
                `Try using a different port or stop the process using this port`,
                `Use 'lsof -i :${this.config.port}' to find the process`
            ];
        } else if (error.code === 'EACCES') {
            suggestions = [
                `Permission denied to bind to port ${this.config.port}`,
                `Use a port >= 1024 or run with appropriate permissions`
            ];
        }

        this.logger.error('Server startup error', {
            error: {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            },
            config: {
                port: this.config.port,
                hostname: this.config.hostname
            },
            suggestions
        });
    }

    /**
     * Initializes monitoring and health checks
     * @private
     */
    initializeMonitoring() {
        // Set up periodic uptime calculation
        this.uptimeInterval = setInterval(() => {
            if (this.stats.startTime) {
                this.stats.uptime = Date.now() - this.stats.startTime;
            }
        }, 1000);

        this.logger.info('Server monitoring initialized', {
            uptimeTracking: true,
            statisticsCollection: true
        });
    }

    /**
     * Updates request statistics
     * @private
     */
    updateRequestStats(method, statusCode, processingTime) {
        this.stats.totalRequests++;
        
        // Update method statistics
        this.stats.requestsByMethod[method] = (this.stats.requestsByMethod[method] || 0) + 1;
        
        // Update status code statistics
        this.stats.requestsByStatus[statusCode] = (this.stats.requestsByStatus[statusCode] || 0) + 1;
        
        // Update response time statistics
        this.stats.responseTimes.push(processingTime);
        
        // Keep only last 100 response times for memory efficiency
        if (this.stats.responseTimes.length > 100) {
            this.stats.responseTimes = this.stats.responseTimes.slice(-100);
        }
    }

    /**
     * Updates error statistics
     * @private
     */
    updateErrorStats(error) {
        this.stats.errors.total++;
        const errorType = error.name || 'Unknown';
        this.stats.errors.byType[errorType] = (this.stats.errors.byType[errorType] || 0) + 1;
    }

    /**
     * Gets server uptime in milliseconds
     * @private
     */
    getUptime() {
        if (!this.stats.startTime) return 0;
        return Date.now() - this.stats.startTime;
    }

    /**
     * Cleanup resources on shutdown
     * @private
     */
    cleanup() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
        
        // Remove all event listeners
        this.server.removeAllListeners();
        
        this.logger.info('Server resources cleaned up');
    }
}

// Helper functions for server management and statistics

/**
 * Updates global request statistics
 * @private
 */
function updateRequestStats(method, startTime) {
    serverStats.totalRequests++;
    serverStats.requestsByMethod[method] = (serverStats.requestsByMethod[method] || 0) + 1;
}

/**
 * Updates global response time statistics
 * @private
 */
function updateResponseTimeStats(processingTime) {
    serverStats.responseTimes.push(processingTime);
    
    // Keep only last 100 response times
    if (serverStats.responseTimes.length > 100) {
        serverStats.responseTimes = serverStats.responseTimes.slice(-100);
    }
}

/**
 * Updates global error statistics
 * @private
 */
function updateErrorStats(error, errorType = 'request_error') {
    serverStats.errors.total++;
    serverStats.errors.byType[errorType] = (serverStats.errors.byType[errorType] || 0) + 1;
}

/**
 * Sets up server event handlers for lifecycle management
 * @private
 */
function setupServerEventHandlers(server, config) {
    server.on('connection', (socket) => {
        serverStats.connections.current++;
        serverStats.connections.total++;
        
        socket.setTimeout(config.connectionTimeout || CONNECTION_TIMEOUT);
        
        socket.on('timeout', () => {
            logger.warn('Socket timeout', { 
                remoteAddress: socket.remoteAddress 
            });
            socket.destroy();
        });
        
        socket.on('close', () => {
            serverStats.connections.current--;
        });
        
        socket.on('error', (socketError) => {
            logger.warn('Socket error', { 
                error: socketError.message,
                remoteAddress: socket.remoteAddress 
            });
        });
    });

    server.on('clientError', (error, socket) => {
        logger.warn('Client error', {
            error: error.message,
            remoteAddress: socket.remoteAddress
        });
    });

    server.on('error', (error) => {
        handleServerError(error, server);
    });
}

/**
 * Configures server security settings
 * @private
 */
function configureServerSecurity(server, config) {
    // Set security headers from server config
    if (serverConfig?.security?.headers) {
        server._securityHeaders = serverConfig.security.headers;
    }
    
    // Configure connection limits
    server.maxConnections = config.maxConnections;
    
    logger.info('Server security configured', {
        maxConnections: config.maxConnections,
        securityHeaders: !!server._securityHeaders
    });
}

/**
 * Initializes performance monitoring
 * @private
 */
function initializePerformanceMonitoring(server) {
    if (serverConfig?.performance?.monitoring?.enabled) {
        // Set up periodic performance monitoring
        const monitoringInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            
            logger.info('Performance metrics', {
                memory: {
                    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
                },
                uptime: `${Math.round(uptime)}s`,
                activeConnections: server._connections || 0,
                totalRequests: serverStats.totalRequests
            });
        }, serverConfig.performance.monitoring.interval || 30000);
        
        // Store interval for cleanup
        server._monitoringInterval = monitoringInterval;
    }
}

/**
 * Initializes health monitoring endpoints
 * @private
 */
function initializeHealthMonitoring(server) {
    // Health monitoring would be handled by the router
    // This is a placeholder for future health check implementation
    logger.info('Health monitoring initialized');
}

/**
 * Cleanup server resources
 * @private
 */
function cleanupServerResources(server) {
    if (server._monitoringInterval) {
        clearInterval(server._monitoringInterval);
    }
    
    server.removeAllListeners();
    
    logger.info('Server resources cleaned up');
}

// Export all HTTP server functionality
export { HttpServer, createServer, handleRequest, startServer, stopServer, handleServerError, setupGracefulShutdown };

// Export HttpServer as the default export
export default HttpServer;