/**
 * Node.js Tutorial HTTP Server - Main Application Entry Point
 * 
 * Main application entry point for the Node.js tutorial HTTP server that demonstrates fundamental 
 * web server capabilities through a simple /hello endpoint implementation. Orchestrates server 
 * initialization, configuration management, request processing, and graceful shutdown while 
 * integrating HTTP server components, logging, security, and health monitoring to provide a 
 * comprehensive educational example of Node.js server-side development.
 * 
 * This component serves as the primary orchestration layer that coordinates all application 
 * components including HTTP server management, environment configuration, centralized logging, 
 * security header application, health monitoring, and graceful lifecycle management to demonstrate 
 * enterprise-grade Node.js server architecture and best practices.
 * 
 * Educational Features:
 * - Complete application lifecycle management from startup through graceful shutdown procedures
 * - Environment-based configuration loading with validation and error handling
 * - Centralized logging integration with correlation tracking and structured output
 * - Security header application and health monitoring endpoint integration
 * - Signal-based graceful shutdown with connection draining and resource cleanup
 * - Comprehensive error handling with operational visibility and recovery procedures
 * 
 * Dependencies: Node.js built-in modules and internal application components only
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import Node.js built-in modules for process management, performance monitoring, and system integration
import process from 'node:process'; // Node.js built-in process module v22.x - Process environment, signals, and lifecycle management
import { performance } from 'node:perf_hooks'; // Node.js built-in performance API v22.x - High-resolution timing for application startup monitoring

// Import internal application components for server orchestration and system integration
import { HttpServer } from './lib/http-server.js';
import { config } from './config/environment.js';
import { logger } from './lib/logger.js';
import { handleHealthRequest } from './monitoring/health-endpoint.js';
import { applySecurityHeaders } from './security/security-headers.js';

// Global application constants for consistent identification and behavior across environments
const APP_NAME = 'Node.js Tutorial HTTP Server';
const VERSION = '1.0.0';
const DEFAULT_SHUTDOWN_TIMEOUT = 30000;

// Application lifecycle state tracking for monitoring and debugging
let applicationState = {
    isStarting: false,
    isRunning: false,
    isShuttingDown: false,
    startupTime: null,
    serverInstance: null,
    shutdownTimeout: null
};

/**
 * Main application entry point that orchestrates server initialization, configuration loading, 
 * and application startup with comprehensive error handling and logging
 * @returns {Promise<void>} Promise resolving when server is successfully started and ready for requests
 */
export async function main() {
    // Record application startup timestamp for performance monitoring and operational tracking
    const startupStartTime = performance.now();
    applicationState.startupTime = Date.now();
    applicationState.isStarting = true;

    try {
        // Step 1: Load environment configuration and validate required settings for server operation
        logger.info('Starting application initialization', {
            appName: APP_NAME,
            version: VERSION,
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            environment: process.env.NODE_ENV || 'development',
            processId: process.pid,
            startupTimestamp: new Date(applicationState.startupTime).toISOString()
        });

        // Step 2: Validate startup environment including Node.js version, port availability, and configuration
        const environmentValid = await validateStartupEnvironment();
        if (!environmentValid) {
            throw new Error('Startup environment validation failed - cannot continue application initialization');
        }

        // Step 3: Log comprehensive application startup information for operational visibility
        logStartupInfo(config);

        // Step 4: Create HttpServer instance with loaded configuration and health monitoring integration
        logger.info('Creating HTTP server instance', {
            serverConfig: {
                port: config.server.port,
                hostname: config.server.hostname,
                timeout: config.server.timeout,
                maxConnections: config.server.maxConnections,
                environment: config.environment
            }
        });

        const httpServer = new HttpServer({
            port: config.server.port,
            hostname: config.server.hostname,
            timeout: config.server.timeout,
            keepAliveTimeout: config.server.keepAliveTimeout,
            headersTimeout: config.server.headersTimeout,
            requestTimeout: config.server.requestTimeout,
            maxConnections: config.server.maxConnections,
            environment: config.environment,
            enableLogging: true,
            enableHealthEndpoint: true,
            enableSecurityHeaders: true
        });

        // Store server instance reference for shutdown procedures
        applicationState.serverInstance = httpServer;

        // Step 5: Set up graceful shutdown handlers for SIGTERM and SIGINT signals
        setupGracefulShutdown(httpServer);

        // Step 6: Start HTTP server and bind to configured port with comprehensive error handling
        logger.info('Starting HTTP server', {
            port: config.server.port,
            hostname: config.server.hostname,
            bindingAddress: `${config.server.hostname}:${config.server.port}`
        });

        await httpServer.start();

        // Step 7: Configure server state and log successful server startup with listening details
        applicationState.isStarting = false;
        applicationState.isRunning = true;

        const serverAddress = httpServer.getAddress();
        const startupDuration = performance.now() - startupStartTime;

        logger.info('Application startup completed successfully', {
            appName: APP_NAME,
            version: VERSION,
            serverStatus: 'listening',
            address: serverAddress,
            startupDuration: `${startupDuration.toFixed(2)}ms`,
            processId: process.pid,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            environment: config.environment,
            features: {
                healthEndpoint: '/health',
                securityHeaders: 'enabled',
                requestLogging: 'enabled',
                gracefulShutdown: 'configured'
            }
        });

        // Step 8: Set up health endpoint integration for monitoring and status checks
        if (config.server.enableHealthEndpoint !== false) {
            logger.info('Health endpoint configured and available', {
                healthEndpointPath: '/health',
                monitoringEnabled: true,
                healthCheckTimeout: config.server.healthCheckTimeout || 10000
            });
        }

        // Step 9: Log successful application initialization and operational readiness
        logger.info('Node.js Tutorial HTTP Server is ready for connections', {
            status: 'operational',
            readyForRequests: true,
            serverUptime: 0,
            totalStartupTime: `${startupDuration.toFixed(2)}ms`,
            timestamp: new Date().toISOString()
        });

    } catch (startupError) {
        // Step 10: Handle startup errors with appropriate logging and process termination
        applicationState.isStarting = false;
        applicationState.isRunning = false;

        logger.error('Application startup failed', {
            error: {
                name: startupError.name,
                message: startupError.message,
                stack: startupError.stack
            },
            appName: APP_NAME,
            version: VERSION,
            processId: process.pid,
            startupDuration: `${(performance.now() - startupStartTime).toFixed(2)}ms`,
            environment: config?.environment || 'unknown'
        });

        // Attempt graceful cleanup if server was partially initialized
        if (applicationState.serverInstance) {
            try {
                await applicationState.serverInstance.stop(5000);
                logger.info('Partial server cleanup completed during startup failure');
            } catch (cleanupError) {
                logger.error('Failed to cleanup server during startup failure', {
                    error: cleanupError.message
                });
            }
        }

        // Exit process with error code to indicate startup failure
        logger.error('Exiting process due to startup failure');
        process.exit(1);
    }
}

/**
 * Configures graceful shutdown signal handlers for clean server termination including active 
 * request completion and resource cleanup
 * @param {HttpServer} server - HttpServer instance to shutdown gracefully
 * @returns {void} No return value - configures signal handlers for process lifecycle management
 */
function setupGracefulShutdown(server) {
    try {
        // Step 1: Register SIGTERM signal handler for production deployment shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM signal received - initiating graceful shutdown', {
                signal: 'SIGTERM',
                processId: process.pid,
                appName: APP_NAME,
                serverUptime: server.getUptime ? server.getUptime() : process.uptime() * 1000,
                activeConnections: server.isListening ? server.getStats().connections.current : 0
            });

            handleShutdownSignal('SIGTERM', server);
        });

        // Step 2: Register SIGINT signal handler for development environment shutdown (Ctrl+C)
        process.on('SIGINT', () => {
            logger.info('SIGINT signal received (Ctrl+C) - initiating graceful shutdown', {
                signal: 'SIGINT',
                processId: process.pid,
                appName: APP_NAME,
                serverUptime: server.getUptime ? server.getUptime() : process.uptime() * 1000,
                activeConnections: server.isListening ? server.getStats().connections.current : 0,
                developmentMode: config.isDevelopment
            });

            handleShutdownSignal('SIGINT', server);
        });

        // Step 3: Set up uncaught exception handler to prevent process crashes
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception detected - initiating emergency shutdown', {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                processId: process.pid,
                appName: APP_NAME,
                serverUptime: server.getUptime ? server.getUptime() : process.uptime() * 1000
            });

            // Attempt graceful shutdown with reduced timeout for uncaught exceptions
            handleShutdownSignal('UNCAUGHT_EXCEPTION', server, 5000);
        });

        // Step 4: Configure unhandled promise rejection handler for Promise error management
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection detected', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined,
                promise: String(promise),
                processId: process.pid,
                appName: APP_NAME,
                serverUptime: server.getUptime ? server.getUptime() : process.uptime() * 1000
            });

            // Log unhandled rejections but don't exit immediately - monitor for patterns
            logger.warn('Unhandled promise rejection logged - monitoring for additional occurrences');
        });

        // Step 5: Set up SIGQUIT handler for immediate shutdown with minimal cleanup
        process.on('SIGQUIT', () => {
            logger.warn('SIGQUIT signal received - performing immediate shutdown', {
                signal: 'SIGQUIT',
                processId: process.pid,
                immediateShutdown: true
            });

            // Force immediate shutdown with minimal cleanup
            if (server && typeof server.stop === 'function') {
                server.stop(1000).finally(() => {
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });

        // Step 6: Log signal handler registration completion for monitoring and debugging
        logger.info('Graceful shutdown handlers configured successfully', {
            signals: ['SIGTERM', 'SIGINT', 'SIGQUIT'],
            exceptionHandlers: ['uncaughtException', 'unhandledRejection'],
            shutdownTimeout: DEFAULT_SHUTDOWN_TIMEOUT,
            processId: process.pid,
            appName: APP_NAME
        });

    } catch (setupError) {
        logger.error('Failed to setup graceful shutdown handlers', {
            error: {
                name: setupError.name,
                message: setupError.message,
                stack: setupError.stack
            },
            processId: process.pid,
            appName: APP_NAME
        });

        // This is a critical failure - exit immediately
        process.exit(1);
    }
}

/**
 * Handles shutdown signals by gracefully stopping the server, completing active requests, 
 * and cleaning up resources before process termination
 * @param {string} signal - Process signal received (SIGTERM, SIGINT, etc.)
 * @param {HttpServer} server - HttpServer instance to shutdown gracefully
 * @param {number} timeout - Optional shutdown timeout override in milliseconds
 * @returns {Promise<void>} Promise resolving when shutdown is complete
 */
async function handleShutdownSignal(signal, server, timeout = DEFAULT_SHUTDOWN_TIMEOUT) {
    // Prevent multiple shutdown procedures from running simultaneously
    if (applicationState.isShuttingDown) {
        logger.warn('Shutdown already in progress - ignoring duplicate signal', {
            signal: signal,
            currentShutdownInProgress: true
        });
        return;
    }

    applicationState.isShuttingDown = true;
    const shutdownStartTime = performance.now();

    try {
        // Step 1: Log shutdown signal received with timestamp and server context
        logger.info('Processing shutdown signal', {
            signal: signal,
            processId: process.pid,
            appName: APP_NAME,
            version: VERSION,
            shutdownTimeout: timeout,
            serverRuntime: applicationState.isRunning,
            serverUptime: server.getUptime ? server.getUptime() : process.uptime() * 1000,
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });

        // Step 2: Set shutdown timeout to force exit if graceful shutdown takes too long
        applicationState.shutdownTimeout = setTimeout(() => {
            logger.error('Graceful shutdown timeout exceeded - forcing process termination', {
                timeoutMs: timeout,
                signal: signal,
                forcedExit: true,
                processId: process.pid
            });
            
            process.exit(1);
        }, timeout);

        // Step 3: Stop HTTP server instance and release port binding
        if (server && typeof server.stop === 'function' && server.isListening()) {
            logger.info('Stopping HTTP server and releasing port binding', {
                serverAddress: server.getAddress(),
                activeConnections: server.getStats ? server.getStats().connections.current : 'unknown'
            });

            await server.stop(timeout - 5000); // Reserve 5 seconds for final cleanup

            logger.info('HTTP server stopped successfully', {
                serverStopped: true,
                portReleased: true
            });
        } else {
            logger.info('HTTP server was not running or already stopped');
        }

        // Step 4: Clean up application resources including timers and event listeners
        if (applicationState.shutdownTimeout) {
            clearTimeout(applicationState.shutdownTimeout);
            applicationState.shutdownTimeout = null;
        }

        // Update application state
        applicationState.isRunning = false;

        // Step 5: Calculate shutdown duration and log successful shutdown completion
        const shutdownDuration = performance.now() - shutdownStartTime;
        
        logger.info('Graceful shutdown completed successfully', {
            signal: signal,
            processId: process.pid,
            appName: APP_NAME,
            version: VERSION,
            shutdownDuration: `${shutdownDuration.toFixed(2)}ms`,
            totalUptime: process.uptime(),
            finalMemoryUsage: process.memoryUsage(),
            exitCode: 0,
            timestamp: new Date().toISOString()
        });

        // Step 6: Exit process with appropriate exit code (0 for success, 1 for error)
        const exitCode = signal === 'UNCAUGHT_EXCEPTION' ? 1 : 0;
        process.exit(exitCode);

    } catch (shutdownError) {
        // Step 7: Handle shutdown errors and force termination if graceful shutdown fails
        const shutdownDuration = performance.now() - shutdownStartTime;

        logger.error('Graceful shutdown failed - forcing process termination', {
            error: {
                name: shutdownError.name,
                message: shutdownError.message,
                stack: shutdownError.stack
            },
            signal: signal,
            processId: process.pid,
            shutdownDuration: `${shutdownDuration.toFixed(2)}ms`,
            forcedExit: true
        });

        // Clear shutdown timeout if set
        if (applicationState.shutdownTimeout) {
            clearTimeout(applicationState.shutdownTimeout);
        }

        // Force exit with error code
        process.exit(1);
    }
}

/**
 * Validates startup environment including Node.js version, port availability, and required 
 * configuration to ensure proper server initialization
 * @returns {boolean} True if environment is valid for startup, throws error if invalid
 */
async function validateStartupEnvironment() {
    try {
        logger.info('Validating startup environment', {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            environment: config.environment
        });

        // Step 1: Check Node.js version meets minimum requirements (18.x or higher)
        const nodeVersionMatch = process.version.match(/^v(\d+)\.(\d+)\.(\d+)/);
        if (!nodeVersionMatch) {
            throw new Error('Cannot parse Node.js version - invalid version format');
        }

        const majorVersion = parseInt(nodeVersionMatch[1], 10);
        if (majorVersion < 18) {
            throw new Error(`Node.js version ${process.version} is not supported. Minimum required version is 18.x`);
        }

        logger.info('Node.js version validation passed', {
            currentVersion: process.version,
            majorVersion: majorVersion,
            minimumRequired: '18.x',
            supported: true
        });

        // Step 2: Validate port configuration is within valid range and available
        const port = config.server.port;
        if (typeof port !== 'number' || port < 1024 || port > 65535) {
            throw new Error(`Invalid port configuration: ${port}. Port must be between 1024-65535 for non-privileged operation`);
        }

        logger.info('Port configuration validation passed', {
            configuredPort: port,
            portRange: '1024-65535',
            privileged: port < 1024,
            valid: true
        });

        // Step 3: Verify required environment variables are present and valid
        const requiredEnvVars = [];
        const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }

        // Step 4: Validate network interface availability for server binding
        const hostname = config.server.hostname;
        if (!hostname || typeof hostname !== 'string' || hostname.trim() === '') {
            throw new Error('Invalid hostname configuration - must be non-empty string');
        }

        logger.info('Network interface validation passed', {
            hostname: hostname,
            bindingAddress: `${hostname}:${port}`,
            valid: true
        });

        // Step 5: Check memory and system resources for adequate capacity
        const memoryUsage = process.memoryUsage();
        const totalMemoryMB = memoryUsage.rss / 1024 / 1024;
        
        if (totalMemoryMB > 1000) { // Warn if using more than 1GB at startup
            logger.warn('High memory usage detected at startup', {
                memoryUsageMB: Math.round(totalMemoryMB),
                threshold: 1000,
                recommendation: 'Monitor memory usage during operation'
            });
        }

        // Step 6: Validate configuration object completeness and consistency
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration object - configuration is required');
        }

        if (!config.server || typeof config.server !== 'object') {
            throw new Error('Invalid server configuration - server configuration section is required');
        }

        if (!config.logging || typeof config.logging !== 'object') {
            throw new Error('Invalid logging configuration - logging configuration section is required');
        }

        logger.info('Startup environment validation completed successfully', {
            nodeVersionValid: true,
            portConfigurationValid: true,
            networkInterfaceValid: true,
            configurationValid: true,
            memoryUsageMB: Math.round(totalMemoryMB),
            environmentReady: true
        });

        return true;

    } catch (validationError) {
        logger.error('Startup environment validation failed', {
            error: {
                name: validationError.name,
                message: validationError.message,
                stack: validationError.stack
            },
            nodeVersion: process.version,
            platform: process.platform,
            configuredPort: config?.server?.port,
            configuredHostname: config?.server?.hostname,
            validationFailed: true
        });

        return false;
    }
}

/**
 * Logs comprehensive application startup information including version, environment, 
 * configuration, and system details for monitoring and debugging
 * @param {Object} config - Application configuration object with server and environment settings
 * @returns {void} No return value - logs startup information for operational tracking
 */
function logStartupInfo(config) {
    try {
        // Step 1: Log application name, version, and build information
        logger.info('Application startup information', {
            application: {
                name: APP_NAME,
                version: VERSION,
                description: 'Educational Node.js HTTP server demonstrating fundamental web server capabilities',
                startupTimestamp: new Date().toISOString(),
                processId: process.pid
            }
        });

        // Step 2: Include Node.js version and runtime environment details
        logger.info('Runtime environment information', {
            runtime: {
                nodeVersion: process.version,
                v8Version: process.versions.v8,
                platform: process.platform,
                architecture: process.arch,
                userAgent: `Node.js/${process.version}`,
                executablePath: process.execPath
            }
        });

        // Step 3: Log server configuration including port, hostname, and timeouts
        logger.info('Server configuration details', {
            server: {
                port: config.server.port,
                hostname: config.server.hostname,
                bindingAddress: `${config.server.hostname}:${config.server.port}`,
                timeout: config.server.timeout,
                keepAliveTimeout: config.server.keepAliveTimeout,
                headersTimeout: config.server.headersTimeout,
                requestTimeout: config.server.requestTimeout,
                maxConnections: config.server.maxConnections,
                connectionTimeout: config.server.connectionTimeout
            }
        });

        // Step 4: Include environment type and development mode status
        logger.info('Environment configuration', {
            environment: {
                type: config.environment,
                isProduction: config.isProduction,
                isDevelopment: config.isDevelopment,
                isTest: config.isTest,
                nodeEnv: process.env.NODE_ENV || 'not-set'
            }
        });

        // Step 5: Log logging configuration and output settings
        logger.info('Logging configuration', {
            logging: {
                level: config.logging.level,
                console: config.logging.console,
                file: config.logging.file,
                format: config.logging.format,
                colorize: config.logging.colorize,
                requestCorrelation: config.logging.requestCorrelation,
                filePath: config.logging.filePath || 'not-configured'
            }
        });

        // Step 6: Include process ID and startup timestamp for operational tracking
        logger.info('Process and system information', {
            process: {
                processId: process.pid,
                parentProcessId: process.ppid,
                workingDirectory: process.cwd(),
                uptime: process.uptime(),
                memoryUsage: {
                    rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
                    heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
                    external: `${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`
                }
            }
        });

        // Step 7: Log feature configuration and capabilities
        logger.info('Application features and capabilities', {
            features: {
                httpServer: 'Node.js built-in HTTP server',
                helloEndpoint: '/hello endpoint with static response',
                healthMonitoring: '/health endpoint with system metrics',
                securityHeaders: 'HTTP security headers application',
                requestLogging: 'Structured request logging with correlation',
                gracefulShutdown: 'Signal-based graceful shutdown procedures',
                zeroExternalDependencies: 'Pure Node.js implementation'
            }
        });

        logger.info('Startup information logging completed successfully', {
            informationLogged: true,
            readyForServerInitialization: true
        });

    } catch (loggingError) {
        // Use console.log as fallback if logger fails during startup info logging
        console.error('Failed to log startup information:', loggingError.message);
        console.log('Application:', APP_NAME, 'Version:', VERSION);
        console.log('Node.js:', process.version, 'Platform:', process.platform);
        console.log('Process ID:', process.pid);
        console.log('Server will bind to:', `${config?.server?.hostname}:${config?.server?.port}`);
    }
}

// Execute main application entry point if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal application error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });
}

// Export main function for programmatic usage and testing
export { main };

// Export additional utility functions for advanced usage and testing scenarios  
export { setupGracefulShutdown, handleShutdownSignal, validateStartupEnvironment, logStartupInfo };

// Export application constants for external usage and configuration
export { APP_NAME, VERSION, DEFAULT_SHUTDOWN_TIMEOUT };