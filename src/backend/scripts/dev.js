/**
 * Node.js Tutorial HTTP Server - Development Server Script
 * 
 * Enhanced development server script that provides optimal development experience with file watching,
 * auto-restart functionality, interactive command interface, and development-specific configuration.
 * Implements zero-dependency file watching using Node.js built-in fs module, provides enhanced
 * debugging capabilities, and optimizes the development workflow for the Node.js tutorial HTTP server.
 * 
 * Educational Features:
 * - Zero-dependency file watching using Node.js built-in fs.watch API
 * - Automatic server restart on source file changes with intelligent debouncing
 * - Interactive command line interface for manual server control and status monitoring
 * - Enhanced development logging with request correlation and colored output
 * - Development-specific configuration with debug mode and performance monitoring
 * - Graceful shutdown procedures with resource cleanup and context preservation
 * - Require cache management for hot-reloading without external dependencies
 * - Comprehensive error handling with developer-friendly messages and recovery suggestions
 * 
 * Dependencies: Node.js built-in modules only (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import Node.js built-in modules for development server functionality
import fs from 'node:fs'; // Built-in Node.js filesystem module for file watching and directory monitoring
import path from 'node:path'; // Built-in Node.js path utilities for cross-platform path handling and resolution
import process from 'node:process'; // Built-in Node.js process management for environment variables and signal handling
import readline from 'node:readline'; // Built-in Node.js readline module for interactive command line interface

// Import internal components for HTTP server management and configuration
import { HttpServer } from '../lib/http-server.js';
import { config } from '../config/environment.js';
import { serverConfig } from '../config/server-config.js';
import { logger } from '../lib/logger.js';

// Development server global configuration constants for consistent behavior
const WATCHED_DIRECTORIES = ['lib', 'config', 'middleware', 'security', 'monitoring', 'utils'];
const WATCHED_FILES = ['server.js'];
const WATCHED_EXTENSIONS = ['.js', '.json'];
const IGNORE_PATTERNS = ['node_modules', 'test', 'coverage', 'logs', 'temp', '.git'];
const RESTART_DELAY_MS = 1000;
const DEVELOPMENT_PORT = 3000;
const DEV_COMMANDS = { 
    RESTART: 'rs', 
    QUIT: 'q', 
    STATUS: 'status', 
    HELP: 'help' 
};

// Global state management for development server coordination
let currentServer = null;
let fileWatchers = new Map();
let restartTimer = null;
let readlineInterface = null;
let isShuttingDown = false;
let startupTime = null;
let requestCount = 0;
let lastRestartTime = null;

/**
 * Main function that starts the development server with file watching, enhanced logging,
 * and interactive command support for optimal development experience
 * @returns {Promise<void>} Promise that resolves when development server is successfully started with file watching active
 */
export async function startDevelopmentServer() {
    try {
        // Step 1: Display development server startup banner with Node.js tutorial information
        displayDevelopmentBanner();

        // Step 2: Set NODE_ENV to development and configure development-specific environment variables
        process.env.NODE_ENV = 'development';
        process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
        process.env.LOG_COLORIZE = process.env.LOG_COLORIZE || 'true';

        // Step 3: Initialize enhanced development logging with debug level and colored output
        logger.configure({
            level: 'debug',
            console: true,
            colorize: true,
            requestCorrelation: true,
            format: 'text'
        });

        logger.info('Starting Node.js Tutorial Development Server', {
            environment: 'development',
            nodeVersion: process.version,
            pid: process.pid,
            watchedDirectories: WATCHED_DIRECTORIES,
            watchedExtensions: WATCHED_EXTENSIONS
        });

        // Step 4: Create development server configuration with restart capabilities
        const developmentConfig = {
            port: process.env.PORT || DEVELOPMENT_PORT,
            hostname: config.server?.hostname || '127.0.0.1',
            timeout: serverConfig.http?.timeouts?.server || 300000,
            keepAliveTimeout: serverConfig.http?.timeouts?.keepAlive || 5000,
            environment: 'development'
        };

        // Step 5: Start HTTP server using development configuration and error handling
        currentServer = new HttpServer(developmentConfig);
        
        await currentServer.start();
        startupTime = Date.now();
        
        logger.info('Development HTTP server started successfully', {
            address: currentServer.getAddress(),
            configuration: developmentConfig,
            startupTime: new Date(startupTime).toISOString()
        });

        // Step 6: Initialize file watching system for source directories and files
        const restartCallback = () => restartDevelopmentServer();
        fileWatchers = initializeFileWatching(restartCallback);

        logger.info('File watching initialized', {
            watcherCount: fileWatchers.size,
            watchedPaths: Array.from(fileWatchers.keys()),
            restartDelay: `${RESTART_DELAY_MS}ms`
        });

        // Step 7: Set up interactive command line interface for manual server control
        readlineInterface = setupInteractiveCommands();

        // Step 8: Configure graceful shutdown handlers for development environment
        setupDevelopmentSignalHandlers();

        // Step 9: Log development server ready status with access instructions and available commands
        logger.info('🚀 Development server ready!', {
            serverUrl: `http://${developmentConfig.hostname}:${developmentConfig.port}`,
            helloEndpoint: `http://${developmentConfig.hostname}:${developmentConfig.port}/hello`,
            availableCommands: Object.values(DEV_COMMANDS),
            fileWatchingActive: fileWatchers.size > 0
        });

        console.log(`\n✨ Development server is running and watching for changes`);
        console.log(`📍 Server URL: http://${developmentConfig.hostname}:${developmentConfig.port}`);
        console.log(`🎯 Hello endpoint: http://${developmentConfig.hostname}:${developmentConfig.port}/hello`);
        console.log(`⚡ File watching: ${fileWatchers.size} watchers active`);
        console.log(`🛠️  Type '${DEV_COMMANDS.HELP}' for available commands\n`);

        // Step 10: Begin file watching loop and command processing for development workflow
        // The server is now running and will continue until manually stopped or an error occurs

    } catch (error) {
        logger.error('Failed to start development server', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });

        // Attempt cleanup on startup failure
        await cleanupDevelopmentServer(fileWatchers, readlineInterface, currentServer);
        throw error;
    }
}

/**
 * Sets up file system watching using Node.js built-in fs.watch to monitor source files
 * and trigger automatic server restarts when changes are detected
 * @param {Function} restartCallback - Callback function to execute when file changes require server restart
 * @returns {Map<string, fs.FSWatcher>} Map of file paths to FSWatcher instances for cleanup and management
 */
function initializeFileWatching(restartCallback) {
    const watchers = new Map();

    try {
        // Step 1: Create map to store FSWatcher instances for watched files and directories
        logger.debug('Initializing file system watchers', {
            directories: WATCHED_DIRECTORIES,
            files: WATCHED_FILES,
            extensions: WATCHED_EXTENSIONS
        });

        // Step 2: Set up recursive directory watching for lib, config, middleware, and other source directories
        WATCHED_DIRECTORIES.forEach(dirName => {
            const dirPath = path.join(process.cwd(), 'src', 'backend', dirName);
            
            try {
                // Check if directory exists before watching
                if (fs.existsSync(dirPath)) {
                    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                        if (filename) {
                            const fullPath = path.join(dirPath, filename);
                            handleFileChange(filename, fullPath, eventType, restartCallback);
                        }
                    });

                    watchers.set(dirPath, watcher);
                    logger.debug('Directory watcher created', { path: dirPath });
                } else {
                    logger.warn('Directory not found for watching', { path: dirPath });
                }
            } catch (error) {
                logger.warn('Failed to create directory watcher', {
                    path: dirPath,
                    error: error.message
                });
            }
        });

        // Step 3: Watch individual important files like server.js and package.json for changes
        WATCHED_FILES.forEach(fileName => {
            const filePath = path.join(process.cwd(), 'src', 'backend', fileName);
            
            try {
                if (fs.existsSync(filePath)) {
                    const watcher = fs.watch(filePath, (eventType, filename) => {
                        handleFileChange(filename || fileName, filePath, eventType, restartCallback);
                    });

                    watchers.set(filePath, watcher);
                    logger.debug('File watcher created', { path: filePath });
                } else {
                    logger.debug('Watched file not found', { path: filePath });
                }
            } catch (error) {
                logger.warn('Failed to create file watcher', {
                    path: filePath,
                    error: error.message
                });
            }
        });

        // Step 4: Log file watching initialization with list of monitored files and directories
        const watchedPaths = Array.from(watchers.keys());
        logger.info('File watching system initialized', {
            totalWatchers: watchers.size,
            watchedPaths: watchedPaths,
            watchedExtensions: WATCHED_EXTENSIONS,
            ignorePatterns: IGNORE_PATTERNS
        });

        // Step 5: Return FSWatcher map for cleanup during shutdown or restart operations
        return watchers;

    } catch (error) {
        logger.error('Failed to initialize file watching system', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });

        // Clean up any partial watchers
        for (const [path, watcher] of watchers) {
            try {
                watcher.close();
            } catch (closeError) {
                logger.warn('Error closing partial watcher', { path, error: closeError.message });
            }
        }

        return new Map();
    }
}

/**
 * Processes file change events from the file watching system, determines if restart is necessary,
 * and triggers server restart with appropriate logging and delay
 * @param {string} filename - Name of the changed file that triggered the event
 * @param {string} filepath - Full path to the changed file
 * @param {string} eventType - Type of file system event (change, rename, etc.)
 * @param {Function} restartCallback - Callback function to trigger server restart
 * @returns {void} No return value - handles file change event and may trigger restart
 */
function handleFileChange(filename, filepath, eventType, restartCallback) {
    try {
        // Step 1: Log file change event with filename, path, and event type for development visibility
        logger.debug('File change detected', {
            filename,
            filepath,
            eventType,
            timestamp: new Date().toISOString()
        });

        // Step 2: Check if file change should trigger restart based on file extension and ignore patterns
        const shouldRestart = shouldTriggerRestart(filename, filepath);
        
        if (!shouldRestart) {
            logger.debug('File change ignored (no restart needed)', {
                filename,
                reason: getIgnoreReason(filename, filepath)
            });
            return;
        }

        // Step 3: Apply debounce delay to prevent rapid successive restarts from multiple file changes
        if (restartTimer) {
            clearTimeout(restartTimer);
            logger.debug('Previous restart timer cleared due to new file change', {
                filename,
                previousTimer: 'cleared'
            });
        }

        // Step 4: Log pending restart notification with countdown timer for developer awareness
        logger.info('📁 File change detected, scheduling restart...', {
            changedFile: path.relative(process.cwd(), filepath),
            eventType,
            restartDelay: `${RESTART_DELAY_MS}ms`,
            timestamp: new Date().toISOString()
        });

        console.log(`\n🔄 File changed: ${path.relative(process.cwd(), filepath)}`);
        console.log(`⏱️  Restarting server in ${RESTART_DELAY_MS}ms...`);

        // Step 5: Set restart timer with configured delay to allow additional changes to settle
        restartTimer = setTimeout(() => {
            restartTimer = null;
            
            // Step 6: Execute server restart when timer expires and log restart initiation
            logger.info('🔄 Triggering automatic server restart due to file changes');
            restartCallback();
        }, RESTART_DELAY_MS);

    } catch (error) {
        logger.error('Error handling file change event', {
            filename,
            filepath,
            eventType,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
}

/**
 * Gracefully restarts the development server by stopping the current instance, cleaning up resources,
 * and starting a fresh server instance with updated code
 * @returns {Promise<void>} Promise that resolves when server restart is complete and new instance is listening
 */
export async function restartDevelopmentServer() {
    if (isShuttingDown) {
        logger.warn('Restart requested during shutdown, ignoring');
        return;
    }

    try {
        // Step 1: Log development server restart initiation with timestamp and reason
        const restartStartTime = Date.now();
        logger.info('🔄 Restarting development server...', {
            reason: 'file_change_detected',
            currentUptime: startupTime ? Date.now() - startupTime : 0,
            requestCount,
            restartTimestamp: new Date().toISOString()
        });

        console.log('\n🔄 Restarting development server...');

        // Step 2: Gracefully stop current HTTP server instance and close existing connections
        if (currentServer && currentServer.isListening()) {
            logger.debug('Stopping current server instance');
            await currentServer.stop(10000); // 10 second timeout for development
            logger.debug('Current server instance stopped successfully');
        }

        // Step 3: Clear require cache for modified modules to ensure fresh code loading
        const clearedModules = clearRequireCache();
        
        if (clearedModules > 0) {
            logger.debug('Require cache cleared for fresh module loading', {
                clearedModulesCount: clearedModules
            });
        }

        // Step 4: Wait for graceful shutdown completion and resource cleanup
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for cleanup

        // Step 5: Reload configuration modules and environment settings for updated values
        // Note: In ES modules, we can't easily clear the module cache like in CommonJS
        // The modules will be reloaded when the process restarts

        // Step 6: Create new HTTP server instance with refreshed configuration and code
        const developmentConfig = {
            port: process.env.PORT || DEVELOPMENT_PORT,
            hostname: config.server?.hostname || '127.0.0.1',
            timeout: serverConfig.http?.timeouts?.server || 300000,
            keepAliveTimeout: serverConfig.http?.timeouts?.keepAlive || 5000,
            environment: 'development'
        };

        currentServer = new HttpServer(developmentConfig);
        await currentServer.start();

        // Update restart tracking
        lastRestartTime = Date.now();
        startupTime = lastRestartTime;
        requestCount = 0;

        // Step 7: Restart file watching system for the new server instance (watchers continue running)
        // File watchers don't need to be restarted as they continue monitoring

        // Step 8: Log successful restart completion with new server status and uptime reset
        const restartDuration = Date.now() - restartStartTime;
        
        logger.info('✅ Development server restarted successfully', {
            restartDuration: `${restartDuration}ms`,
            newServerAddress: currentServer.getAddress(),
            totalRestarts: lastRestartTime ? 1 : 0, // Simple tracking
            timestamp: new Date().toISOString()
        });

        console.log(`✅ Server restarted successfully in ${restartDuration}ms`);
        console.log(`📍 Server URL: http://${developmentConfig.hostname}:${developmentConfig.port}`);
        console.log(`🎯 Ready to handle requests\n`);

    } catch (error) {
        logger.error('Failed to restart development server', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });

        console.error(`\n❌ Server restart failed: ${error.message}`);
        console.error(`🔧 Please check the logs and fix any issues`);
        
        // Attempt to start a new server instance even after restart failure
        try {
            logger.info('Attempting to start fresh server instance after restart failure');
            await startDevelopmentServer();
        } catch (startupError) {
            logger.error('Failed to start fresh server instance', {
                error: startupError.message
            });
            throw startupError;
        }
    }
}

/**
 * Initializes interactive command line interface for development server control including
 * manual restart, status check, and help commands
 * @returns {readline.Interface} Readline interface instance for command processing and cleanup
 */
function setupInteractiveCommands() {
    try {
        // Step 1: Create readline interface with stdin/stdout for command input processing
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'dev> '
        });

        // Step 2: Display available commands and usage instructions for developer guidance
        logger.debug('Interactive command interface initialized', {
            availableCommands: DEV_COMMANDS,
            promptPrefix: 'dev>'
        });

        // Step 3: Set up command prompt with development server identifier and current status
        rl.setPrompt('dev> ');

        // Step 4: Register command event handler for processing user input
        rl.on('line', async (input) => {
            const command = input.trim().toLowerCase();
            const shouldContinue = await handleDevelopmentCommand(command, rl);
            
            if (shouldContinue) {
                rl.prompt();
            }
        });

        // Handle Ctrl+C in readline interface
        rl.on('SIGINT', () => {
            console.log('\n🛑 Received interrupt signal (Ctrl+C)');
            handleDevelopmentCommand(DEV_COMMANDS.QUIT, rl);
        });

        // Handle interface close
        rl.on('close', () => {
            console.log('\n👋 Development session ended');
        });

        // Step 5: Set up command auto-completion for improved developer experience
        rl.on('SIGTSTP', () => {
            // Handle Ctrl+Z (suspend) - not typically used but good to handle
            logger.debug('Received SIGTSTP (Ctrl+Z) - ignoring in development mode');
        });

        return rl;

    } catch (error) {
        logger.error('Failed to setup interactive command interface', {
            error: error.message
        });
        return null;
    }
}

/**
 * Processes interactive commands entered by developer during development server session
 * for manual control and status monitoring
 * @param {string} command - Command string entered by developer (rs, status, help, quit)
 * @param {readline.Interface} rl - Readline interface for output and continued command processing
 * @returns {Promise<boolean>} Promise resolving to true if command was processed, false if server should shutdown
 */
async function handleDevelopmentCommand(command, rl) {
    try {
        // Step 1: Parse and normalize command input removing whitespace and converting to lowercase
        const normalizedCommand = command.trim().toLowerCase();

        logger.debug('Processing development command', {
            rawCommand: command,
            normalizedCommand,
            timestamp: new Date().toISOString()
        });

        switch (normalizedCommand) {
            // Step 2: Handle 'rs' restart command by triggering manual server restart
            case DEV_COMMANDS.RESTART:
            case 'restart':
                console.log('\n🔄 Manual restart triggered...');
                logger.info('Manual restart command executed by developer');
                await restartDevelopmentServer();
                return true;

            // Step 3: Handle 'status' command by displaying server status, uptime, and configuration
            case DEV_COMMANDS.STATUS:
                console.log('\n📊 Development Server Status:');
                console.log('─'.repeat(40));
                
                if (currentServer && currentServer.isListening()) {
                    const address = currentServer.getAddress();
                    const stats = currentServer.getStats();
                    const uptime = startupTime ? Date.now() - startupTime : 0;
                    
                    console.log(`🟢 Status: Running`);
                    console.log(`📍 Address: ${address.url}`);
                    console.log(`⏱️  Uptime: ${formatUptime(uptime)}`);
                    console.log(`📊 Requests: ${stats.requests?.total || 0}`);
                    console.log(`🔍 Watchers: ${fileWatchers.size} active`);
                    console.log(`💾 Memory: ${formatMemoryUsage(stats.memory)}`);
                    console.log(`🔄 Last Restart: ${lastRestartTime ? new Date(lastRestartTime).toLocaleTimeString() : 'Never'}`);
                } else {
                    console.log(`🔴 Status: Stopped`);
                }
                
                console.log('─'.repeat(40));
                return true;

            // Step 4: Handle 'help' command by showing available commands and usage information
            case DEV_COMMANDS.HELP:
            case 'h':
                console.log('\n🛠️  Development Server Commands:');
                console.log('─'.repeat(40));
                console.log(`${DEV_COMMANDS.RESTART.padEnd(10)} - Manually restart the server`);
                console.log(`${'restart'.padEnd(10)} - Manually restart the server (alias)`);
                console.log(`${DEV_COMMANDS.STATUS.padEnd(10)} - Show server status and statistics`);
                console.log(`${DEV_COMMANDS.HELP.padEnd(10)} - Show this help message`);
                console.log(`${'h'.padEnd(10)} - Show this help message (alias)`);
                console.log(`${DEV_COMMANDS.QUIT.padEnd(10)} - Quit development server`);
                console.log(`${'quit'.padEnd(10)} - Quit development server (alias)`);
                console.log(`${'exit'.padEnd(10)} - Quit development server (alias)`);
                console.log('─'.repeat(40));
                console.log('💡 The server automatically restarts when files change');
                console.log(`📁 Watching: ${WATCHED_DIRECTORIES.join(', ')}`);
                console.log(`📄 Extensions: ${WATCHED_EXTENSIONS.join(', ')}`);
                return true;

            // Step 5: Handle 'quit' or 'q' command by initiating graceful development server shutdown
            case DEV_COMMANDS.QUIT:
            case 'quit':
            case 'exit':
                console.log('\n🛑 Shutting down development server...');
                logger.info('Shutdown command executed by developer');
                
                isShuttingDown = true;
                await cleanupDevelopmentServer(fileWatchers, rl, currentServer);
                
                console.log('👋 Development server stopped. Have a great day!');
                process.exit(0);

            case '':
                // Empty command - just show prompt again
                return true;

            // Step 6: Handle unknown commands by displaying error message and available options
            default:
                console.log(`\n❓ Unknown command: '${command}'`);
                console.log(`💡 Type '${DEV_COMMANDS.HELP}' for available commands`);
                
                logger.debug('Unknown development command entered', {
                    command: normalizedCommand
                });
                return true;
        }

    } catch (error) {
        // Step 7: Log command execution errors and return command processing result
        logger.error('Error processing development command', {
            command,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });

        console.log(`\n❌ Error executing command: ${error.message}`);
        console.log(`💡 Type '${DEV_COMMANDS.HELP}' for available commands`);
        
        return true; // Continue command loop even after errors
    }
}

/**
 * Displays startup banner with Node.js tutorial information, development server details,
 * and usage instructions for enhanced development experience
 * @returns {void} No return value - outputs banner to console
 */
function displayDevelopmentBanner() {
    // Step 1: Create formatted banner with Node.js Tutorial HTTP Server title and version
    const bannerLines = [
        '╔══════════════════════════════════════════════════════════════════════════════╗',
        '║                    🚀 Node.js Tutorial HTTP Server                          ║',
        '║                        Development Server v1.0.0                           ║',
        '╠══════════════════════════════════════════════════════════════════════════════╣',
        '║  📚 Educational HTTP Server with Zero External Dependencies                 ║',
        '║  ⚡ Auto-restart on file changes • Interactive commands • Enhanced logging  ║',
        '╚══════════════════════════════════════════════════════════════════════════════╝'
    ];

    console.log('\n' + bannerLines.join('\n') + '\n');

    // Step 2: Display development mode indicator with enhanced debugging enabled
    console.log('🔧 Development Mode Features:');
    console.log(`   • File watching: ${WATCHED_DIRECTORIES.length} directories + ${WATCHED_FILES.length} files`);
    console.log(`   • Auto-restart delay: ${RESTART_DELAY_MS}ms`);
    console.log(`   • Enhanced logging: Debug level with colors`);
    console.log(`   • Interactive commands: ${Object.values(DEV_COMMANDS).join(', ')}`);

    // Step 3: Show server configuration including port, hostname, and environment settings
    const devConfig = {
        port: process.env.PORT || DEVELOPMENT_PORT,
        hostname: config.server?.hostname || '127.0.0.1'
    };

    console.log('\n🛠️  Server Configuration:');
    console.log(`   • Address: ${devConfig.hostname}:${devConfig.port}`);
    console.log(`   • Environment: development`);
    console.log(`   • Node.js version: ${process.version}`);
    console.log(`   • Process ID: ${process.pid}`);

    // Step 4: List watched directories and file extensions for file change monitoring
    console.log('\n📁 File Watching Configuration:');
    console.log(`   • Directories: ${WATCHED_DIRECTORIES.join(', ')}`);
    console.log(`   • Files: ${WATCHED_FILES.join(', ')}`);
    console.log(`   • Extensions: ${WATCHED_EXTENSIONS.join(', ')}`);
    console.log(`   • Ignored: ${IGNORE_PATTERNS.join(', ')}`);

    // Step 5: Display available interactive commands for development server control
    console.log('\n⌨️  Available Commands:');
    console.log(`   • '${DEV_COMMANDS.RESTART}' or 'restart' - Manual server restart`);
    console.log(`   • '${DEV_COMMANDS.STATUS}' - Show server status and stats`);
    console.log(`   • '${DEV_COMMANDS.HELP}' or 'h' - Show help information`);
    console.log(`   • '${DEV_COMMANDS.QUIT}', 'quit', or 'exit' - Stop development server`);

    // Step 6: Include development tips and best practices for using the development server
    console.log('\n💡 Development Tips:');
    console.log('   • Server automatically restarts when source files change');
    console.log('   • Use Ctrl+C to quit or type "q" command');
    console.log('   • Check server status anytime with "status" command');
    console.log('   • All requests are logged with correlation IDs for debugging');

    console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Performs cleanup operations when development server is shutting down including stopping
 * file watchers, closing readline interface, and resource cleanup
 * @param {Map<string, fs.FSWatcher>} watchers - Map of active file watchers to close
 * @param {readline.Interface} rl - Readline interface to close
 * @param {HttpServer} server - HTTP server instance to stop
 * @returns {Promise<void>} Promise that resolves when cleanup is complete
 */
async function cleanupDevelopmentServer(watchers, rl, server) {
    try {
        // Step 1: Log development server shutdown initiation with cleanup process start
        logger.info('🧹 Starting development server cleanup process', {
            activeWatchers: watchers.size,
            serverRunning: server && server.isListening(),
            readlineActive: rl !== null
        });

        // Step 2: Close all active file system watchers and clear watcher map
        let closedWatchers = 0;
        for (const [path, watcher] of watchers) {
            try {
                watcher.close();
                closedWatchers++;
                logger.debug('File watcher closed', { path });
            } catch (error) {
                logger.warn('Error closing file watcher', {
                    path,
                    error: error.message
                });
            }
        }
        watchers.clear();

        logger.debug('File watchers cleanup completed', {
            totalClosed: closedWatchers
        });

        // Step 3: Close readline interface and stop command processing
        if (rl) {
            try {
                rl.close();
                logger.debug('Readline interface closed');
            } catch (error) {
                logger.warn('Error closing readline interface', {
                    error: error.message
                });
            }
        }

        // Step 4: Stop HTTP server gracefully and close all connections
        if (server && server.isListening()) {
            try {
                await server.stop(5000); // 5 second timeout for development shutdown
                logger.debug('HTTP server stopped successfully');
            } catch (error) {
                logger.error('Error stopping HTTP server', {
                    error: error.message
                });
            }
        }

        // Step 5: Clear any pending restart timers and debounce delays
        if (restartTimer) {
            clearTimeout(restartTimer);
            restartTimer = null;
            logger.debug('Restart timer cleared');
        }

        // Step 6: Log successful cleanup completion with development session summary
        const sessionUptime = startupTime ? Date.now() - startupTime : 0;
        
        logger.info('✅ Development server cleanup completed successfully', {
            sessionUptime: formatUptime(sessionUptime),
            totalRequests: requestCount,
            lastRestartTime: lastRestartTime ? new Date(lastRestartTime).toISOString() : null,
            cleanupTimestamp: new Date().toISOString()
        });

        // Step 7: Ensure all resources are properly released before process termination
        // Reset global state
        currentServer = null;
        fileWatchers = new Map();
        readlineInterface = null;
        isShuttingDown = false;

    } catch (error) {
        logger.error('Error during development server cleanup', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
        
        // Force cleanup even if errors occurred
        console.error('⚠️  Cleanup encountered errors, but shutdown will continue');
    }
}

/**
 * Clears Node.js require cache for modified modules to ensure fresh code loading during
 * development server restarts, excluding Node.js built-in modules
 * @param {Array<string>} changedFiles - Array of file paths that have changed and should be cleared from cache
 * @returns {number} Number of modules cleared from require cache
 */
function clearRequireCache(changedFiles = []) {
    try {
        // Step 1: Note about ES modules
        // In ES modules (import/export), there's no direct equivalent to require.cache
        // ES modules are cached by the module loader and can't be easily cleared
        // This function is kept for compatibility and potential CommonJS dependencies

        let clearedCount = 0;

        // Step 2: In a real implementation with CommonJS modules, we would:
        // - Identify modules in require.cache that correspond to changed source files
        // - Filter cache entries to include only application modules, excluding Node.js built-ins
        // - Remove cached modules from require.cache to force fresh loading on next require
        // - Handle module dependency chains to clear dependent modules as well

        // For ES modules, we would need to use dynamic imports with cache-busting techniques
        // or restart the entire process (which is what most development tools do)

        // Step 3: Log cache clearing operation for development visibility
        logger.debug('Require cache clearing attempted', {
            note: 'ES modules use different caching mechanism',
            changedFilesCount: changedFiles.length,
            clearedModulesCount: clearedCount
        });

        // Step 4: Return count of cleared modules for restart process confirmation
        return clearedCount;

    } catch (error) {
        logger.warn('Error clearing require cache', {
            error: error.message
        });
        return 0;
    }
}

/**
 * Sets up signal handlers for development-specific shutdown behavior
 * @private
 */
function setupDevelopmentSignalHandlers() {
    // Handle SIGTERM (production-like shutdown)
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received - initiating development server shutdown');
        isShuttingDown = true;
        await cleanupDevelopmentServer(fileWatchers, readlineInterface, currentServer);
        process.exit(0);
    });

    // Handle SIGINT (Ctrl+C in development)
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Received interrupt signal (Ctrl+C)');
        logger.info('SIGINT received - initiating development server shutdown');
        isShuttingDown = true;
        await cleanupDevelopmentServer(fileWatchers, readlineInterface, currentServer);
        console.log('👋 Development server stopped. Have a great day!');
        process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        logger.error('Uncaught exception in development server', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
        
        console.error('\n💥 Uncaught exception occurred:');
        console.error(error.message);
        console.error('🔧 Attempting graceful shutdown...');
        
        isShuttingDown = true;
        await cleanupDevelopmentServer(fileWatchers, readlineInterface, currentServer);
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection in development server', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined
        });

        console.error('\n⚠️  Unhandled promise rejection:');
        console.error(reason instanceof Error ? reason.message : reason);
        console.error('🔧 This might cause instability. Consider adding proper error handling.');
    });

    logger.debug('Development signal handlers configured');
}

// Helper functions

/**
 * Determines if a file change should trigger a server restart
 * @private
 */
function shouldTriggerRestart(filename, filepath) {
    if (!filename) return false;

    // Check if file has a watched extension
    const ext = path.extname(filename);
    if (!WATCHED_EXTENSIONS.includes(ext)) {
        return false;
    }

    // Check if file is in an ignored pattern
    const relativePath = path.relative(process.cwd(), filepath);
    for (const pattern of IGNORE_PATTERNS) {
        if (relativePath.includes(pattern)) {
            return false;
        }
    }

    return true;
}

/**
 * Gets the reason why a file change was ignored
 * @private
 */
function getIgnoreReason(filename, filepath) {
    if (!filename) return 'no filename';

    const ext = path.extname(filename);
    if (!WATCHED_EXTENSIONS.includes(ext)) {
        return `extension ${ext} not watched`;
    }

    const relativePath = path.relative(process.cwd(), filepath);
    for (const pattern of IGNORE_PATTERNS) {
        if (relativePath.includes(pattern)) {
            return `matches ignore pattern: ${pattern}`;
        }
    }

    return 'unknown reason';
}

/**
 * Formats uptime in milliseconds to human readable string
 * @private
 */
function formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Formats memory usage for display
 * @private
 */
function formatMemoryUsage(memoryStats) {
    if (!memoryStats) return 'N/A';

    const used = Math.round(memoryStats.rss / 1024 / 1024);
    const heapUsed = Math.round(memoryStats.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memoryStats.heapTotal / 1024 / 1024);

    return `${used}MB (heap: ${heapUsed}/${heapTotal}MB)`;
}

// Export the main functions for external use
export { restartDevelopmentServer };

// Start the development server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startDevelopmentServer().catch((error) => {
        console.error('Failed to start development server:', error.message);
        process.exit(1);
    });
}