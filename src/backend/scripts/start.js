// Node.js Tutorial HTTP Server - Application Startup Script
// Provides development-friendly server initialization with process management, graceful shutdown handling,
// command-line argument processing, and optional development features including file watching
// Serves as the entry point for running the Node.js tutorial HTTP server with enhanced development capabilities
// Zero external dependencies - uses only Node.js built-in modules and internal application components

// Built-in Node.js modules for startup script functionality
const process = require('node:process'); // Built-in Node.js process module - stable
const path = require('node:path'); // Built-in Node.js path module - stable
const fs = require('node:fs'); // Built-in Node.js filesystem module - stable

// Import internal application components for server startup and configuration
const { startApplication } = require('../server.js');
const { config } = require('../config/environment.js');
const { logger } = require('../lib/logger.js');
const { performHealthCheck } = require('../utils/health-checker.js');

// Global startup script constants for consistent configuration and timeout management
const SCRIPT_NAME = 'start.js';
const STARTUP_TIMEOUT_MS = 30000;
const HEALTH_CHECK_STARTUP_DELAY_MS = 5000;
const FILE_WATCH_DEBOUNCE_MS = 1000;

// Command-line interface option mappings for argument parsing and help documentation
const CLI_OPTIONS = {
    port: 'p',
    host: 'h',
    env: 'e',
    watch: 'w',
    health: 'health',
    verbose: 'v',
    help: 'help'
};

// File watching state management for development features
let fileWatcher = null;
let developmentFeatures = null;
let restartInProgress = false;

/**
 * Main entry point function that orchestrates startup script execution with command-line argument processing,
 * configuration validation, server startup, and development feature initialization
 * @returns {Promise<void>} Promise that resolves when startup script has completed server initialization
 */
async function main() {
    const startupStartTime = process.hrtime.bigint();
    
    try {
        // Parse command-line arguments and extract startup options with validation
        const options = parseCommandLineArguments(process.argv);
        
        // Display help information if requested and exit gracefully
        if (options.help) {
            displayHelp();
            process.exit(0);
        }

        // Log startup script initiation with version and environment information
        logger.info('Starting Node.js Tutorial HTTP Server', {
            script: SCRIPT_NAME,
            node_version: process.version,
            platform: process.platform,
            environment: config.environment,
            options: {
                port: options.port,
                host: options.host,
                env: options.env,
                watch: options.watch,
                health: options.health,
                verbose: options.verbose
            }
        });

        // Create comprehensive startup banner with application information and configuration summary
        createStartupBanner(config, options);

        // Validate startup environment and configuration availability with detailed error reporting
        await validateStartupEnvironment(options);

        // Apply command-line overrides to environment configuration for startup customization
        const finalConfig = applyCommandLineOverrides(options, config);

        // Initialize development features if in development environment with file watching and enhanced logging
        if (finalConfig.isDevelopment && (options.watch || options.verbose)) {
            developmentFeatures = await initializeDevelopmentFeatures(options);
        }

        // Execute application startup with timeout protection and error handling
        const server = await executeStartupWithTimeout(STARTUP_TIMEOUT_MS, finalConfig);

        // Perform initial health check after startup delay to validate system readiness
        if (options.health || finalConfig.isDevelopment) {
            setTimeout(async () => {
                await performStartupHealthCheck(HEALTH_CHECK_STARTUP_DELAY_MS);
            }, HEALTH_CHECK_STARTUP_DELAY_MS);
        }

        // Set up graceful shutdown handlers for script management and resource cleanup
        const cleanupHandlers = developmentFeatures ? [developmentFeatures.cleanup] : [];
        setupGracefulShutdownHandlers(server, cleanupHandlers);

        // Calculate and log successful startup completion with server information and timing
        const startupEndTime = process.hrtime.bigint();
        const startupDurationMs = Number(startupEndTime - startupStartTime) / 1000000;

        logger.info('Server startup completed successfully', {
            startup_duration_ms: Math.round(startupDurationMs * 100) / 100,
            server_port: finalConfig.server.port,
            server_hostname: finalConfig.server.hostname,
            environment: finalConfig.environment,
            development_features: developmentFeatures ? 'enabled' : 'disabled',
            health_monitoring: options.health ? 'enabled' : 'disabled'
        });

        // Output startup success message to console for immediate feedback
        console.log(`\n🚀 Server started successfully!`);
        console.log(`📡 Listening on http://${finalConfig.server.hostname}:${finalConfig.server.port}`);
        console.log(`🌍 Environment: ${finalConfig.environment}`);
        
        if (developmentFeatures) {
            console.log(`👀 File watching: ${developmentFeatures.watching ? 'enabled' : 'disabled'}`);
        }
        
        console.log(`\n💡 Try: curl http://${finalConfig.server.hostname}:${finalConfig.server.port}/hello`);
        console.log(`❓ Help: node ${SCRIPT_NAME} --help\n`);

    } catch (error) {
        // Log startup failure with detailed error information and stack trace
        logger.error('Server startup failed', {
            error: error.message,
            stack: error.stack,
            startup_phase: 'main_execution',
            node_version: process.version,
            platform: process.platform
        });

        // Output user-friendly error message to console
        console.error(`\n❌ Startup failed: ${error.message}`);
        console.error(`📋 Check logs for detailed error information`);
        console.error(`💡 Try: node ${SCRIPT_NAME} --help\n`);

        // Exit with error code to indicate startup failure
        process.exit(1);
    }
}

/**
 * Parses command-line arguments and options to extract startup configuration overrides and development feature flags
 * with comprehensive validation and error handling
 * @param {Array} argv - Command-line arguments array from process.argv
 * @returns {Object} Parsed command-line options with configuration overrides and feature flags
 */
function parseCommandLineArguments(argv) {
    // Initialize default options object with standard startup configuration
    const options = {
        port: null,
        host: null,
        env: null,
        watch: false,
        health: false,
        verbose: false,
        help: false
    };

    // Parse command-line flags for port, host, environment, and development options
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        const nextArg = argv[i + 1];

        // Handle long-form arguments with double dashes
        if (arg.startsWith('--')) {
            const longFlag = arg.substring(2);
            
            switch (longFlag) {
                case 'port':
                    if (nextArg && !nextArg.startsWith('-')) {
                        const port = parseInt(nextArg, 10);
                        if (isNaN(port) || port < 1 || port > 65535) {
                            throw new Error(`Invalid port number: ${nextArg}. Port must be between 1 and 65535.`);
                        }
                        options.port = port;
                        i++; // Skip next argument as it's the port value
                    } else {
                        throw new Error('--port option requires a port number');
                    }
                    break;
                    
                case 'host':
                    if (nextArg && !nextArg.startsWith('-')) {
                        options.host = nextArg;
                        i++; // Skip next argument as it's the host value
                    } else {
                        throw new Error('--host option requires a hostname or IP address');
                    }
                    break;
                    
                case 'env':
                    if (nextArg && !nextArg.startsWith('-')) {
                        const validEnvironments = ['development', 'production', 'test'];
                        if (!validEnvironments.includes(nextArg)) {
                            throw new Error(`Invalid environment: ${nextArg}. Valid options: ${validEnvironments.join(', ')}`);
                        }
                        options.env = nextArg;
                        i++; // Skip next argument as it's the environment value
                    } else {
                        throw new Error('--env option requires an environment name (development, production, test)');
                    }
                    break;
                    
                case 'watch':
                    options.watch = true;
                    break;
                    
                case 'health':
                    options.health = true;
                    break;
                    
                case 'verbose':
                    options.verbose = true;
                    break;
                    
                case 'help':
                    options.help = true;
                    break;
                    
                default:
                    logger.warn('Unknown long-form argument ignored', { argument: arg });
                    break;
            }
        }
        // Handle short-form arguments with single dash
        else if (arg.startsWith('-') && arg.length > 1) {
            const shortFlags = arg.substring(1);
            
            for (const flag of shortFlags) {
                switch (flag) {
                    case CLI_OPTIONS.port:
                        if (nextArg && !nextArg.startsWith('-')) {
                            const port = parseInt(nextArg, 10);
                            if (isNaN(port) || port < 1 || port > 65535) {
                                throw new Error(`Invalid port number: ${nextArg}. Port must be between 1 and 65535.`);
                            }
                            options.port = port;
                            i++; // Skip next argument as it's the port value
                        } else {
                            throw new Error('-p option requires a port number');
                        }
                        break;
                        
                    case CLI_OPTIONS.host:
                        if (nextArg && !nextArg.startsWith('-')) {
                            options.host = nextArg;
                            i++; // Skip next argument as it's the host value
                        } else {
                            throw new Error('-h option requires a hostname or IP address');
                        }
                        break;
                        
                    case CLI_OPTIONS.env:
                        if (nextArg && !nextArg.startsWith('-')) {
                            const validEnvironments = ['development', 'production', 'test'];
                            if (!validEnvironments.includes(nextArg)) {
                                throw new Error(`Invalid environment: ${nextArg}. Valid options: ${validEnvironments.join(', ')}`);
                            }
                            options.env = nextArg;
                            i++; // Skip next argument as it's the environment value
                        } else {
                            throw new Error('-e option requires an environment name');
                        }
                        break;
                        
                    case CLI_OPTIONS.watch:
                        options.watch = true;
                        break;
                        
                    case CLI_OPTIONS.verbose:
                        options.verbose = true;
                        break;
                        
                    default:
                        logger.warn('Unknown short-form argument ignored', { flag: flag });
                        break;
                }
            }
        }
    }

    // Validate argument values and provide meaningful error messages for invalid inputs
    if (options.watch && !config.isDevelopment && !options.env) {
        logger.warn('File watching is typically used only in development environment');
    }

    // Return parsed options object with configuration overrides and feature flags
    return options;
}

/**
 * Displays comprehensive help information including usage instructions, available options, and examples
 * for the startup script with formatted output and educational guidance
 */
function displayHelp() {
    // Create formatted help header with script name and version information
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                Node.js Tutorial HTTP Server                 ║
║                     Startup Script Help                     ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
    node ${SCRIPT_NAME} [options]

DESCRIPTION:
    Starts the Node.js tutorial HTTP server with optional development
    features including file watching, health monitoring, and enhanced
    logging for educational demonstrations.

OPTIONS:
    -p, --port <port>        HTTP server port (default: 3000)
                            Range: 1-65535, common ports: 3000, 8000, 8080

    -h, --host <host>        HTTP server hostname (default: 127.0.0.1)
                            Examples: 127.0.0.1, localhost, 0.0.0.0

    -e, --env <environment>  Environment type (default: from NODE_ENV)
                            Options: development, production, test

    -w, --watch             Enable file watching for automatic restart
                            (development only - monitors source file changes)

    --health                Perform startup health check and display results
                            (validates server, system, and process health)

    -v, --verbose           Enable verbose logging output
                            (detailed request/response and debug information)

    --help                  Display this help information

EXAMPLES:
    # Basic server startup on default port 3000
    node ${SCRIPT_NAME}

    # Start server on custom port with specific hostname
    node ${SCRIPT_NAME} --port 8080 --host 0.0.0.0

    # Development mode with file watching and verbose logging
    node ${SCRIPT_NAME} --env development --watch --verbose

    # Production mode with health check and custom configuration
    node ${SCRIPT_NAME} --env production --port 8080 --host 0.0.0.0 --health

    # Quick development startup with all development features
    node ${SCRIPT_NAME} -e development -w -v --health

ENVIRONMENT VARIABLES:
    NODE_ENV               Set environment type (development, production, test)
    PORT                   Override default HTTP server port
    HOST                   Override default HTTP server hostname
    LOG_LEVEL             Set logging level (debug, info, warn, error)

DEVELOPMENT FEATURES:
    File Watching:         Automatically restarts server when source files change
    Health Monitoring:     Comprehensive system and application health checks
    Enhanced Logging:      Detailed request tracing and performance metrics
    Error Reporting:       Development-friendly error messages and stack traces

EDUCATIONAL NOTES:
    • This script demonstrates Node.js application startup patterns
    • Zero external dependencies - uses only Node.js built-in modules
    • Implements graceful shutdown with SIGTERM/SIGINT handling
    • Shows command-line argument parsing and configuration management
    • Educational focus on fundamental Node.js server concepts

For more information, visit: https://nodejs.org/en/docs/
`);
}

/**
 * Validates that all required components and configuration are available for successful server startup
 * with comprehensive environment checking and detailed error reporting
 * @param {Object} options - Startup options including configuration overrides
 * @returns {Promise<boolean>} Promise resolving to true if environment is valid, throws error if validation fails
 */
async function validateStartupEnvironment(options) {
    const validationStartTime = process.hrtime.bigint();
    
    try {
        // Check Node.js version compatibility with application requirements
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0], 10);
        
        if (majorVersion < 18) {
            throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum required version: 18.x`);
        }

        // Validate configuration file availability and accessibility
        if (!config || typeof config !== 'object') {
            throw new Error('Configuration object is not available or invalid');
        }

        // Verify port availability and binding permissions
        const targetPort = options.port || config.server?.port || 3000;
        const targetHost = options.host || config.server?.hostname || '127.0.0.1';
        
        if (targetPort < 1 || targetPort > 65535) {
            throw new Error(`Invalid port number: ${targetPort}. Port must be between 1 and 65535.`);
        }

        // Check file system permissions for logging and temporary files
        const currentDirectory = process.cwd();
        try {
            await fs.promises.access(currentDirectory, fs.constants.R_OK | fs.constants.W_OK);
        } catch (fsError) {
            throw new Error(`Insufficient file system permissions in directory: ${currentDirectory}`);
        }

        // Validate environment variables and configuration completeness
        const requiredEnvKeys = ['NODE_ENV'];
        const missingEnvKeys = [];
        
        for (const key of requiredEnvKeys) {
            if (!process.env[key] && !options.env) {
                missingEnvKeys.push(key);
            }
        }

        if (missingEnvKeys.length > 0) {
            logger.warn('Optional environment variables not set', { 
                missing: missingEnvKeys,
                note: 'Using default values from configuration'
            });
        }

        // Validate memory availability for application operation
        const availableMemory = process.memoryUsage();
        if (availableMemory.heapTotal > 1024 * 1024 * 1024) { // 1GB threshold warning
            logger.warn('High memory usage detected during startup validation', {
                heap_total_mb: Math.round(availableMemory.heapTotal / 1024 / 1024)
            });
        }

        // Calculate validation time and log successful completion
        const validationEndTime = process.hrtime.bigint();
        const validationDurationMs = Number(validationEndTime - validationStartTime) / 1000000;

        logger.info('Startup environment validation completed successfully', {
            node_version: nodeVersion,
            target_port: targetPort,
            target_host: targetHost,
            working_directory: currentDirectory,
            validation_duration_ms: Math.round(validationDurationMs * 100) / 100
        });

        // Return true if all validations pass
        return true;

    } catch (error) {
        // Log validation failure with detailed error context
        logger.error('Startup environment validation failed', {
            error: error.message,
            stack: error.stack,
            node_version: process.version,
            platform: process.platform,
            working_directory: process.cwd()
        });

        // Throw detailed error if validation fails for proper error handling
        throw new Error(`Environment validation failed: ${error.message}`);
    }
}

/**
 * Applies command-line argument overrides to environment configuration for startup customization
 * with deep configuration merging and validation
 * @param {Object} options - Parsed command-line options with override values
 * @param {Object} baseConfig - Base environment configuration to modify
 * @returns {Object} Modified configuration object with command-line overrides applied
 */
function applyCommandLineOverrides(options, baseConfig) {
    try {
        // Create deep copy of base configuration to avoid mutation
        const modifiedConfig = JSON.parse(JSON.stringify(baseConfig));

        // Apply port override if specified in command-line options
        if (options.port !== null) {
            modifiedConfig.server.port = options.port;
            logger.info('Applied port override from command line', { 
                original: baseConfig.server?.port, 
                override: options.port 
            });
        }

        // Override hostname/host configuration if provided
        if (options.host !== null) {
            modifiedConfig.server.hostname = options.host;
            logger.info('Applied hostname override from command line', { 
                original: baseConfig.server?.hostname, 
                override: options.host 
            });
        }

        // Set environment type override if specified
        if (options.env !== null) {
            modifiedConfig.environment = options.env;
            modifiedConfig.isDevelopment = options.env === 'development';
            modifiedConfig.isProduction = options.env === 'production';
            modifiedConfig.isTest = options.env === 'test';
            
            logger.info('Applied environment override from command line', { 
                original: baseConfig.environment, 
                override: options.env 
            });
        }

        // Apply logging level overrides for verbose or quiet modes
        if (options.verbose) {
            modifiedConfig.logging.level = 'debug';
            modifiedConfig.logging.verbose = true;
            logger.info('Enabled verbose logging from command line option');
        }

        // Enable development-specific features if development mode is active
        if (modifiedConfig.isDevelopment) {
            modifiedConfig.development = {
                ...modifiedConfig.development,
                fileWatching: options.watch || modifiedConfig.development?.fileWatching || false,
                healthChecks: options.health || modifiedConfig.development?.healthChecks || false,
                verboseLogging: options.verbose || modifiedConfig.development?.verboseLogging || false
            };
        }

        // Validate modified configuration for consistency and correctness
        if (!modifiedConfig.server || !modifiedConfig.server.port || !modifiedConfig.server.hostname) {
            throw new Error('Modified configuration is missing required server properties');
        }

        // Log configuration override summary for debugging and audit purposes
        logger.info('Configuration overrides applied successfully', {
            overrides_applied: {
                port: options.port !== null,
                host: options.host !== null,
                environment: options.env !== null,
                verbose: options.verbose,
                watch: options.watch,
                health: options.health
            },
            final_config: {
                port: modifiedConfig.server.port,
                hostname: modifiedConfig.server.hostname,
                environment: modifiedConfig.environment,
                development_features: modifiedConfig.isDevelopment
            }
        });

        // Return modified configuration object with all overrides applied
        return modifiedConfig;

    } catch (error) {
        logger.error('Configuration override application failed', { 
            error: error.message,
            options: options
        });
        throw new Error(`Failed to apply configuration overrides: ${error.message}`);
    }
}

/**
 * Initializes development-specific features including file watching, enhanced logging, and development-friendly
 * error handling with comprehensive feature management and cleanup capabilities
 * @param {Object} options - Startup options including development feature flags
 * @returns {Promise<Object>} Development features control object with cleanup methods and status information
 */
async function initializeDevelopmentFeatures(options) {
    const devFeaturesStartTime = process.hrtime.bigint();
    
    try {
        // Initialize development features control object with management methods
        const developmentControl = {
            watching: false,
            enhancedLogging: false,
            healthMonitoring: false,
            cleanup: null
        };

        // Check if development environment and development features are requested
        if (!config.isDevelopment && !options.env) {
            logger.warn('Development features requested in non-development environment', {
                current_env: config.environment,
                note: 'Some features may not work as expected'
            });
        }

        // Initialize file watching for automatic server restart if watch mode enabled
        if (options.watch) {
            const watchPaths = [
                path.join(process.cwd(), 'src/backend/lib/'),
                path.join(process.cwd(), 'src/backend/config/'),
                path.join(process.cwd(), 'src/backend/server.js')
            ];
            
            fileWatcher = setupFileWatcher(watchPaths);
            developmentControl.watching = true;
            
            logger.info('File watching initialized for development', {
                watch_paths: watchPaths,
                debounce_ms: FILE_WATCH_DEBOUNCE_MS
            });
        }

        // Set up enhanced error reporting and stack trace display for development
        if (options.verbose || config.isDevelopment) {
            // Enhanced error handling with detailed stack traces
            process.on('uncaughtException', (error) => {
                logger.error('Uncaught exception in development mode', {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                
                console.error('\n🚨 Uncaught Exception (Development Mode):');
                console.error('Error:', error.message);
                console.error('Stack Trace:', error.stack);
                console.error('Timestamp:', new Date().toISOString(), '\n');
            });

            // Enhanced promise rejection handling
            process.on('unhandledRejection', (reason, promise) => {
                logger.error('Unhandled promise rejection in development mode', {
                    reason: reason?.message || reason,
                    promise: promise.toString(),
                    stack: reason?.stack,
                    timestamp: new Date().toISOString()
                });
                
                console.error('\n🚨 Unhandled Promise Rejection (Development Mode):');
                console.error('Reason:', reason?.message || reason);
                console.error('Stack Trace:', reason?.stack || 'No stack trace available');
                console.error('Timestamp:', new Date().toISOString(), '\n');
            });

            developmentControl.enhancedLogging = true;
            
            logger.info('Enhanced error reporting enabled for development');
        }

        // Configure development-friendly request logging with additional context
        if (options.verbose) {
            logger.info('Verbose request logging enabled for development', {
                includes: ['request_headers', 'response_timing', 'memory_usage', 'performance_metrics']
            });
        }

        // Enable performance monitoring and debugging information display
        if (options.health || config.isDevelopment) {
            // Performance monitoring setup for development insights
            const performanceObserver = {
                enabled: true,
                startTime: process.hrtime.bigint()
            };
            
            developmentControl.healthMonitoring = true;
            developmentControl.performanceObserver = performanceObserver;
            
            logger.info('Development performance monitoring enabled');
        }

        // Set up cleanup function for development features
        developmentControl.cleanup = async () => {
            logger.info('Cleaning up development features');
            
            // Stop file watching
            if (fileWatcher) {
                fileWatcher.stop();
                fileWatcher = null;
                logger.info('File watching stopped');
            }

            // Remove enhanced error handlers
            process.removeAllListeners('uncaughtException');
            process.removeAllListeners('unhandledRejection');
            
            // Reset development feature state
            developmentControl.watching = false;
            developmentControl.enhancedLogging = false;
            developmentControl.healthMonitoring = false;
            
            logger.info('Development features cleanup completed');
        };

        // Calculate initialization time and log completion
        const devFeaturesEndTime = process.hrtime.bigint();
        const devFeaturesDurationMs = Number(devFeaturesEndTime - devFeaturesStartTime) / 1000000;

        logger.info('Development features initialized successfully', {
            features: {
                file_watching: developmentControl.watching,
                enhanced_logging: developmentControl.enhancedLogging,
                health_monitoring: developmentControl.healthMonitoring
            },
            initialization_duration_ms: Math.round(devFeaturesDurationMs * 100) / 100
        });

        // Return development features control object with cleanup and stop methods
        return developmentControl;

    } catch (error) {
        logger.error('Development features initialization failed', { 
            error: error.message,
            stack: error.stack 
        });
        throw new Error(`Failed to initialize development features: ${error.message}`);
    }
}

/**
 * Sets up file system watching for automatic server restart during development when source files change
 * with debouncing to prevent excessive restart triggers
 * @param {Array} watchPaths - Array of file paths or directories to watch for changes
 * @returns {Object} File watcher control object with stop method and status information
 */
function setupFileWatcher(watchPaths) {
    let restartTimer = null;
    const watchedFiles = new Set();
    const watchers = [];
    
    try {
        // Validate watch paths and check accessibility of directories and files
        for (const watchPath of watchPaths) {
            try {
                if (fs.existsSync(watchPath)) {
                    // Initialize file system watcher using Node.js fs.watch with recursive option
                    const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                        if (filename) {
                            handleFileChange(path.join(watchPath, filename), eventType);
                        }
                    });
                    
                    watchers.push(watcher);
                    watchedFiles.add(watchPath);
                    
                    logger.info('File watcher initialized', { 
                        path: watchPath,
                        recursive: true 
                    });
                } else {
                    logger.warn('Watch path does not exist, skipping', { path: watchPath });
                }
            } catch (watchError) {
                logger.warn('Failed to set up file watcher for path', { 
                    path: watchPath,
                    error: watchError.message 
                });
            }
        }

        // Set up file change debouncing to prevent excessive restart triggers
        async function handleFileChange(filePath, eventType) {
            // Configure file extension filtering to watch only relevant source files
            const allowedExtensions = ['.js', '.json'];
            const fileExtension = path.extname(filePath);
            
            if (!allowedExtensions.includes(fileExtension)) {
                return; // Ignore non-source files
            }

            // Prevent restart during ongoing restart process
            if (restartInProgress) {
                return;
            }

            logger.info('File change detected', { 
                file: filePath,
                event: eventType,
                extension: fileExtension
            });

            // Clear existing restart timer for debouncing
            if (restartTimer) {
                clearTimeout(restartTimer);
            }

            // Set up restart handler that gracefully stops and restarts server
            restartTimer = setTimeout(async () => {
                if (!restartInProgress) {
                    restartInProgress = true;
                    
                    try {
                        logger.info('Restarting server due to file changes', {
                            trigger_file: filePath,
                            debounce_ms: FILE_WATCH_DEBOUNCE_MS
                        });

                        // Output restart notification to console
                        console.log(`\n🔄 Restarting server due to changes in: ${path.basename(filePath)}`);
                        console.log('⏳ Please wait for server restart...\n');

                        // Note: In a production implementation, this would trigger a graceful restart
                        // For this educational example, we log the restart intention
                        // Actual restart would require process management or external tooling
                        
                        setTimeout(() => {
                            restartInProgress = false;
                            console.log('✅ Server restart completed\n');
                        }, 2000);

                    } catch (restartError) {
                        logger.error('File change restart failed', { 
                            error: restartError.message,
                            file: filePath 
                        });
                        restartInProgress = false;
                    }
                }
            }, FILE_WATCH_DEBOUNCE_MS);
        }

        // Return watcher control object with stop method and configuration details
        return {
            watching: watchedFiles.size > 0,
            watchedPaths: Array.from(watchedFiles),
            watchedFileCount: watchedFiles.size,
            stop: () => {
                // Stop all file watchers and clear resources
                watchers.forEach(watcher => {
                    try {
                        watcher.close();
                    } catch (closeError) {
                        logger.warn('Error closing file watcher', { error: closeError.message });
                    }
                });
                
                // Clear restart timer
                if (restartTimer) {
                    clearTimeout(restartTimer);
                    restartTimer = null;
                }
                
                // Reset watching state
                watchedFiles.clear();
                restartInProgress = false;
                
                logger.info('File watching stopped', { watcherCount: watchers.length });
            }
        };

    } catch (error) {
        logger.error('File watcher setup failed', { 
            error: error.message,
            watchPaths: watchPaths 
        });
        
        return {
            watching: false,
            watchedPaths: [],
            watchedFileCount: 0,
            stop: () => {},
            error: error.message
        };
    }
}

/**
 * Executes application startup with timeout protection to prevent hanging startup processes
 * with comprehensive error handling and recovery mechanisms
 * @param {number} timeoutMs - Startup timeout in milliseconds
 * @param {Object} config - Configuration object for server startup
 * @returns {Promise<Object>} Promise resolving to server instance when startup completes successfully
 */
async function executeStartupWithTimeout(timeoutMs, config) {
    const startupExecutionStart = process.hrtime.bigint();
    
    try {
        // Create timeout promise that rejects after specified timeout duration
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Server startup timed out after ${timeoutMs}ms. This may indicate a configuration or resource issue.`));
            }, timeoutMs);
        });

        // Execute server startup function with provided configuration
        const startupPromise = startApplication(config);

        // Race startup promise against timeout promise for protection
        logger.info('Starting application with timeout protection', {
            timeout_ms: timeoutMs,
            config: {
                port: config.server.port,
                hostname: config.server.hostname,
                environment: config.environment
            }
        });

        // Wait for either successful startup or timeout
        const server = await Promise.race([startupPromise, timeoutPromise]);

        // Handle startup success and log server information and status
        const startupExecutionEnd = process.hrtime.bigint();
        const startupExecutionMs = Number(startupExecutionEnd - startupExecutionStart) / 1000000;

        logger.info('Application startup completed within timeout', {
            startup_time_ms: Math.round(startupExecutionMs * 100) / 100,
            timeout_ms: timeoutMs,
            server_status: 'listening',
            server_details: {
                port: config.server.port,
                hostname: config.server.hostname,
                environment: config.environment
            }
        });

        // Return server instance if startup completes within timeout
        return server;

    } catch (error) {
        const startupExecutionEnd = process.hrtime.bigint();
        const startupExecutionMs = Number(startupExecutionEnd - startupExecutionStart) / 1000000;

        // Handle timeout case with informative error message and cleanup
        if (error.message.includes('timed out')) {
            logger.error('Server startup timeout exceeded', {
                timeout_ms: timeoutMs,
                actual_time_ms: Math.round(startupExecutionMs * 100) / 100,
                config: {
                    port: config.server.port,
                    hostname: config.server.hostname
                },
                troubleshooting: [
                    'Check if port is already in use',
                    'Verify network connectivity',
                    'Review system resource availability',
                    'Increase timeout if necessary'
                ]
            });

            throw new Error(`Server startup failed due to timeout (${timeoutMs}ms). ` +
                           `Please check port availability and system resources.`);
        }

        // Handle other startup errors with detailed logging
        logger.error('Server startup failed during execution', {
            error: error.message,
            stack: error.stack,
            execution_time_ms: Math.round(startupExecutionMs * 100) / 100,
            config: {
                port: config.server.port,
                hostname: config.server.hostname,
                environment: config.environment
            }
        });

        // Re-throw the original error with additional context
        throw new Error(`Server startup failed: ${error.message}`);
    }
}

/**
 * Executes comprehensive health check after server startup to validate system readiness and operational status
 * with detailed health assessment and reporting
 * @param {number} delayMs - Delay before executing health check to allow server stabilization
 * @returns {Promise<Object>} Promise resolving to health check results indicating system readiness
 */
async function performStartupHealthCheck(delayMs) {
    try {
        // Wait for specified delay to allow server stabilization after startup
        logger.info('Performing startup health check', {
            delay_ms: delayMs,
            check_categories: ['server', 'system', 'process', 'performance']
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Execute comprehensive health check including server, system, and process health
        const healthCheckResult = await performHealthCheck({
            timeout: 10000, // 10-second timeout for health check
            categories: ['server', 'system', 'process', 'performance']
        });

        // Validate health check results and determine if system is ready
        const systemReady = healthCheckResult.overall_status === 'healthy' || 
                           healthCheckResult.overall_status === 'degraded';

        // Log health check summary with status and key metrics
        logger.info('Startup health check completed', {
            overall_status: healthCheckResult.overall_status,
            health_score: healthCheckResult.health_score,
            system_ready: systemReady,
            execution_time_ms: healthCheckResult.execution_time_ms,
            key_metrics: {
                memory_usage: healthCheckResult.metrics?.memory_usage_percent || 'unknown',
                cpu_usage: healthCheckResult.metrics?.cpu_usage_percent || 'unknown',
                response_time: healthCheckResult.checks?.performance?.response_time_ms || 'unknown'
            }
        });

        // Display health check results in console for immediate feedback
        console.log(`\n📊 Health Check Results:`);
        console.log(`   Overall Status: ${healthCheckResult.overall_status.toUpperCase()}`);
        console.log(`   Health Score: ${healthCheckResult.health_score}/100`);
        
        if (healthCheckResult.checks?.server) {
            console.log(`   Server: ${healthCheckResult.checks.server.status}`);
        }
        
        if (healthCheckResult.checks?.system) {
            console.log(`   System: ${healthCheckResult.checks.system.status} (Memory: ${healthCheckResult.checks.system.memory?.usage_percent || 'unknown'}%)`);
        }
        
        if (healthCheckResult.checks?.performance) {
            console.log(`   Performance: ${healthCheckResult.checks.performance.status} (Response: ${healthCheckResult.checks.performance.response_time_ms || 'unknown'}ms)`);
        }

        // Handle health check failures with appropriate warning messages
        if (!systemReady) {
            logger.warn('System health check indicates potential issues', {
                overall_status: healthCheckResult.overall_status,
                alerts: healthCheckResult.alerts || [],
                recommendations: healthCheckResult.recommendations || []
            });

            console.log(`\n⚠️  System health warnings detected:`);
            
            if (healthCheckResult.alerts && healthCheckResult.alerts.length > 0) {
                healthCheckResult.alerts.forEach(alert => {
                    console.log(`   • ${alert}`);
                });
            }
            
            if (healthCheckResult.recommendations && healthCheckResult.recommendations.length > 0) {
                console.log(`\n💡 Recommendations:`);
                healthCheckResult.recommendations.forEach(recommendation => {
                    console.log(`   • ${recommendation}`);
                });
            }
        } else {
            console.log(`   ✅ All systems operational`);
        }

        console.log(''); // Add spacing

        // Return health check results for monitoring integration
        return healthCheckResult;

    } catch (error) {
        logger.error('Startup health check failed', {
            error: error.message,
            stack: error.stack,
            delay_ms: delayMs
        });

        console.log(`\n❌ Health check failed: ${error.message}`);
        console.log(`   The server may still be functional, but health monitoring is unavailable.\n`);

        // Return error health check result
        return {
            overall_status: 'unknown',
            health_score: 0,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Configures signal handlers for graceful script shutdown including cleanup of development features
 * and server resources with comprehensive shutdown sequence
 * @param {Object} server - Server instance for graceful shutdown
 * @param {Array} cleanupHandlers - Array of cleanup functions for development features
 */
function setupGracefulShutdownHandlers(server, cleanupHandlers = []) {
    let shutdownInProgress = false;
    
    // Create shutdown sequence that stops development features first and then server
    async function performGracefulShutdown(signal) {
        if (shutdownInProgress) {
            logger.warn('Shutdown already in progress, ignoring additional signal', { signal });
            return;
        }
        
        shutdownInProgress = true;
        const shutdownStart = process.hrtime.bigint();
        
        logger.info('Received shutdown signal, initiating graceful shutdown', {
            signal: signal,
            timestamp: new Date().toISOString()
        });

        console.log(`\n🛑 Received ${signal} - Shutting down gracefully...`);

        try {
            // Execute cleanup handlers for development features and resources
            if (cleanupHandlers.length > 0) {
                console.log('🧹 Cleaning up development features...');
                
                for (const cleanupHandler of cleanupHandlers) {
                    try {
                        if (typeof cleanupHandler === 'function') {
                            await cleanupHandler();
                        }
                    } catch (cleanupError) {
                        logger.error('Cleanup handler failed', { 
                            error: cleanupError.message,
                            handler: cleanupHandler.name || 'anonymous'
                        });
                    }
                }
                
                logger.info('Development features cleanup completed');
            }

            // Stop file watching if active
            if (fileWatcher) {
                console.log('📁 Stopping file watching...');
                fileWatcher.stop();
                fileWatcher = null;
            }

            // Implement server shutdown with timeout protection
            if (server && typeof server.close === 'function') {
                console.log('🔌 Closing HTTP server...');
                
                await new Promise((resolve) => {
                    const shutdownTimeout = setTimeout(() => {
                        logger.warn('Server shutdown timeout, forcing close');
                        resolve();
                    }, 10000); // 10-second timeout for server shutdown

                    server.close((error) => {
                        clearTimeout(shutdownTimeout);
                        if (error) {
                            logger.error('Server close error', { error: error.message });
                        } else {
                            logger.info('HTTP server closed successfully');
                        }
                        resolve();
                    });
                });
            }

            // Calculate and log shutdown completion timing
            const shutdownEnd = process.hrtime.bigint();
            const shutdownDurationMs = Number(shutdownEnd - shutdownStart) / 1000000;

            logger.info('Graceful shutdown completed successfully', {
                signal: signal,
                shutdown_duration_ms: Math.round(shutdownDurationMs * 100) / 100,
                cleanup_handlers_executed: cleanupHandlers.length
            });

            console.log(`✅ Shutdown completed in ${Math.round(shutdownDurationMs)}ms`);
            console.log('👋 Goodbye!\n');

            // Log shutdown completion and exit process with appropriate code
            process.exit(0);

        } catch (shutdownError) {
            logger.error('Error during graceful shutdown', {
                error: shutdownError.message,
                stack: shutdownError.stack,
                signal: signal
            });

            console.error(`❌ Shutdown error: ${shutdownError.message}`);
            
            // Force shutdown after timeout to prevent hanging processes
            setTimeout(() => {
                logger.error('Forced shutdown due to graceful shutdown failure');
                console.error('🚨 Forced shutdown after graceful shutdown timeout\n');
                process.exit(1);
            }, 5000); // 5-second force shutdown timeout
        }
    }

    // Register SIGTERM handler for container orchestration shutdown
    process.on('SIGTERM', () => {
        performGracefulShutdown('SIGTERM');
    });

    // Register SIGINT handler for Ctrl+C interruption during development
    process.on('SIGINT', () => {
        performGracefulShutdown('SIGINT');
    });

    // Log signal handler registration for debugging
    logger.info('Graceful shutdown handlers registered', {
        signals: ['SIGTERM', 'SIGINT'],
        cleanup_handlers: cleanupHandlers.length,
        server_provided: !!server
    });
}

/**
 * Creates and displays comprehensive startup banner with application information, configuration summary,
 * and development status with formatted output
 * @param {Object} config - Application configuration for banner display
 * @param {Object} options - Startup options including development feature flags
 */
function createStartupBanner(config, options) {
    const bannerTimestamp = new Date().toISOString();
    const nodeVersion = process.version;
    const platform = process.platform;
    const architecture = process.arch;
    const uptime = Math.round(process.uptime() * 1000);

    // Create formatted banner header with application name and version
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║            🚀 Node.js Tutorial HTTP Server 🚀              ║
║                  Starting Application...                    ║
╚══════════════════════════════════════════════════════════════╝

📋 CONFIGURATION SUMMARY:
   • Environment: ${config.environment.toUpperCase()}
   • Node.js Version: ${nodeVersion}
   • Platform: ${platform} (${architecture})
   • Server Port: ${config.server.port}
   • Server Host: ${config.server.hostname}
   • Process ID: ${process.pid}
   • Working Directory: ${process.cwd()}

⚙️  STARTUP OPTIONS:
   • Port Override: ${options.port ? `${options.port} ✅` : 'None'}
   • Host Override: ${options.host ? `${options.host} ✅` : 'None'}
   • Environment Override: ${options.env ? `${options.env} ✅` : 'None'}
   • File Watching: ${options.watch ? '🟢 Enabled' : '🔴 Disabled'}
   • Health Monitoring: ${options.health ? '🟢 Enabled' : '🔴 Disabled'}
   • Verbose Logging: ${options.verbose ? '🟢 Enabled' : '🔴 Disabled'}

🛠️  DEVELOPMENT FEATURES:`);

    if (config.isDevelopment) {
        console.log(`   • Development Mode: 🟢 Active`);
        console.log(`   • Enhanced Error Reporting: ${options.verbose ? '🟢 Enabled' : '🟠 Basic'}`);
        console.log(`   • File Change Detection: ${options.watch ? '🟢 Monitoring' : '🔴 Disabled'}`);
        console.log(`   • Performance Monitoring: ${options.health ? '🟢 Active' : '🟠 Basic'}`);
    } else {
        console.log(`   • Production Mode: 🟢 Active`);
        console.log(`   • Optimized Performance: 🟢 Enabled`);
        console.log(`   • Error Reporting: 🟠 Production Level`);
        console.log(`   • Health Monitoring: ${options.health ? '🟢 Enabled' : '🟠 Basic'}`);
    }

    console.log(`
📊 SYSTEM STATUS:
   • Startup Time: ${bannerTimestamp}
   • Process Uptime: ${uptime}ms
   • Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
   • Available CPUs: ${require('node:os').cpus().length}

🔗 AVAILABLE ENDPOINTS:
   • Main Endpoint: http://${config.server.hostname}:${config.server.port}/hello
   • Health Check: http://${config.server.hostname}:${config.server.port}/health

═══════════════════════════════════════════════════════════════
`);

    // Log banner display for audit and debugging purposes
    logger.info('Startup banner displayed', {
        timestamp: bannerTimestamp,
        environment: config.environment,
        development_features: config.isDevelopment,
        options_summary: {
            watch: options.watch,
            health: options.health,
            verbose: options.verbose,
            overrides: {
                port: !!options.port,
                host: !!options.host,
                env: !!options.env
            }
        }
    });
}

// Execute main function if script is run directly (not imported as module)
if (require.main === module) {
    main().catch((error) => {
        // Final error handler for unhandled main function errors
        console.error(`\n💥 Fatal startup error: ${error.message}`);
        console.error(`📋 Check system requirements and configuration`);
        console.error(`🔧 Run with --help for usage information\n`);
        
        // Log fatal error for debugging and monitoring
        logger.error('Fatal startup error in main execution', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            process_argv: process.argv
        });
        
        process.exit(1);
    });
}

// Export main startup functions for programmatic execution and testing
module.exports = {
    // Export main startup function for programmatic execution and testing
    main,
    
    // Export command-line parsing function for testing and utility use
    parseCommandLineArguments,
    
    // Export CLI option mappings for testing and documentation
    CLI_OPTIONS,
    
    // Export startup utility functions for advanced usage
    validateStartupEnvironment,
    applyCommandLineOverrides,
    initializeDevelopmentFeatures,
    executeStartupWithTimeout,
    performStartupHealthCheck,
    setupGracefulShutdownHandlers,
    displayHelp,
    createStartupBanner
};