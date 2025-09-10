// Node.js Tutorial HTTP Server - Centralized Logging Component
// Provides structured logging functionality with correlation tracking, security filtering,
// and configurable output formats using only Node.js built-in modules

// Node.js built-in module imports with version comments
const console = require('node:console'); // Built-in Node.js console module - stable
const util = require('node:util'); // Built-in Node.js utility module - stable  
const fs = require('node:fs'); // Built-in Node.js filesystem module - stable
const path = require('node:path'); // Built-in Node.js path module - stable
const { performance } = require('node:perf_hooks'); // Built-in Node.js performance API - stable

// Import environment configuration from centralized config
const { config, logging, environment, isDevelopment } = require('../config/environment.js');

// Global log level constants for structured logging
const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info', 
    WARN: 'warn',
    ERROR: 'error'
};

// Log level priority mapping for filtering decisions
const LOG_LEVEL_PRIORITIES = {
    debug: 0,
    info: 1,
    warn: 2, 
    error: 3
};

// ANSI color codes for console output formatting
const COLORS = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m'   // Reset to default
};

// Default log format for fallback configuration
const DEFAULT_LOG_FORMAT = 'text';

// Sensitive data patterns for security filtering
const SENSITIVE_PATTERNS = [
    /password/i,
    /passwd/i,
    /secret/i,
    /token/i,
    /key/i,
    /authorization/i,
    /cookie/i,
    /session/i,
    /credit/i,
    /card/i,
    /ssn/i,
    /social/i
];

// Maximum log message length to prevent log pollution
const MAX_LOG_MESSAGE_LENGTH = 5000;

// Maximum context object size for memory management
const MAX_CONTEXT_SIZE = 1000;

// Request context cleanup interval (15 minutes)
const CONTEXT_CLEANUP_INTERVAL = 15 * 60 * 1000;

/**
 * Generates unique correlation ID for request tracking using timestamp and random components
 * Ensures collision avoidance and chronological ordering for debugging purposes
 * @returns {string} Unique correlation ID in format: req_TIMESTAMP_RANDOM
 */
function generateCorrelationId() {
    const timestamp = Date.now().toString(36); // Base36 timestamp for compactness
    const random = Math.random().toString(36).substring(2, 8); // 6-character random string
    return `req_${timestamp}_${random}`;
}

/**
 * Determines whether a log message should be output based on configured log level and message priority
 * Implements level-based filtering to control logging verbosity across environments
 * @param {string} messageLevel - Level of the message to be logged (debug, info, warn, error)
 * @param {string} configuredLevel - Currently configured minimum log level from environment
 * @returns {boolean} True if message should be logged, false if filtered out by level
 */
function shouldLog(messageLevel, configuredLevel) {
    // Get priority values for both message and configured levels
    const messagePriority = LOG_LEVEL_PRIORITIES[messageLevel.toLowerCase()];
    const configuredPriority = LOG_LEVEL_PRIORITIES[configuredLevel.toLowerCase()];
    
    // Handle invalid log levels by defaulting to allow logging
    if (messagePriority === undefined || configuredPriority === undefined) {
        console.warn(`Invalid log level detected: message=${messageLevel}, configured=${configuredLevel}`);
        return true; // Allow logging when levels are invalid to avoid silent failures
    }
    
    // Message should be logged if its priority is >= configured minimum priority
    return messagePriority >= configuredPriority;
}

/**
 * Sanitizes log data to remove sensitive information while preserving useful debugging information
 * Implements comprehensive security filtering to prevent sensitive data exposure in logs
 * @param {any} data - Log data object that may contain sensitive information
 * @returns {any} Sanitized data object safe for logging without sensitive information
 */
function sanitizeLogData(data) {
    // Return primitive values as-is after string length checking
    if (data === null || data === undefined) {
        return data;
    }
    
    if (typeof data === 'string') {
        // Truncate excessively long strings to prevent log pollution
        if (data.length > MAX_LOG_MESSAGE_LENGTH) {
            return data.substring(0, MAX_LOG_MESSAGE_LENGTH) + '... [truncated]';
        }
        return data;
    }
    
    if (typeof data === 'number' || typeof data === 'boolean') {
        return data;
    }
    
    // Handle arrays by recursively sanitizing each element
    if (Array.isArray(data)) {
        return data.map(item => sanitizeLogData(item));
    }
    
    // Handle objects with sensitive field filtering
    if (typeof data === 'object') {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            // Check if field name matches sensitive patterns
            const isSensitiveField = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
            
            if (isSensitiveField) {
                // Replace sensitive values with masked placeholder
                if (typeof value === 'string' && value.length > 0) {
                    sanitized[key] = '[REDACTED]';
                } else {
                    sanitized[key] = '[REDACTED]';
                }
            } else if (key === 'stack' && typeof value === 'string') {
                // Preserve error stack traces but sanitize file paths in production
                if (environment === 'production') {
                    // Remove absolute file paths while preserving stack structure
                    sanitized[key] = value.replace(/\/[^\/\s]+\//g, '/[path]/');
                } else {
                    sanitized[key] = value;
                }
            } else {
                // Recursively sanitize nested objects and arrays
                sanitized[key] = sanitizeLogData(value);
            }
        }
        
        return sanitized;
    }
    
    // For any other data types, convert to string and sanitize
    return sanitizeLogData(String(data));
}

/**
 * Formats log messages with timestamp, level, correlation ID, and structured content
 * Provides consistent log formatting across different output formats (text/JSON)
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Primary log message content
 * @param {object} context - Optional context object with additional data
 * @param {string} correlationId - Optional request correlation ID for tracking
 * @returns {string} Formatted log message string ready for output
 */
function formatLogMessage(level, message, context = null, correlationId = null) {
    // Create ISO timestamp for consistent log ordering and timezone handling
    const timestamp = new Date().toISOString();
    
    // Ensure level is uppercase for consistency
    const normalizedLevel = level.toUpperCase();
    
    // Sanitize message content to prevent sensitive data exposure
    const sanitizedMessage = sanitizeLogData(message);
    const sanitizedContext = context ? sanitizeLogData(context) : null;
    
    // Get current logging format from configuration
    const logFormat = config.logging?.format || DEFAULT_LOG_FORMAT;
    
    if (logFormat === 'json') {
        // Structured JSON format for production logging and log aggregation
        const logEntry = {
            timestamp,
            level: normalizedLevel,
            message: sanitizedMessage,
            ...(correlationId && { correlationId }),
            ...(sanitizedContext && { context: sanitizedContext }),
            pid: process.pid,
            hostname: require('node:os').hostname()
        };
        
        return JSON.stringify(logEntry);
    } else {
        // Human-readable text format for development and debugging
        const colorize = config.logging?.colorize && process.stdout.isTTY;
        const color = colorize ? COLORS[normalizedLevel] || '' : '';
        const reset = colorize ? COLORS.RESET : '';
        
        // Format level with consistent width for alignment
        const paddedLevel = normalizedLevel.padEnd(5);
        
        // Build formatted message components
        const components = [
            timestamp,
            `${color}[${paddedLevel}]${reset}`,
            sanitizedMessage
        ];
        
        // Add correlation ID if provided
        if (correlationId) {
            components.push(`[${correlationId}]`);
        }
        
        // Add context information if provided
        if (sanitizedContext) {
            if (typeof sanitizedContext === 'object') {
                components.push(util.inspect(sanitizedContext, { 
                    depth: 2, 
                    colors: colorize,
                    compact: true,
                    maxStringLength: 200
                }));
            } else {
                components.push(String(sanitizedContext));
            }
        }
        
        return components.join(' ');
    }
}

/**
 * Writes formatted log messages to configured log file with proper error handling
 * Handles file system operations asynchronously with graceful error recovery
 * @param {string} formattedMessage - Complete formatted log message
 * @param {string} logFilePath - Path to log file for writing
 * @returns {Promise<void>} Promise resolving when log write is complete
 */
async function writeLogToFile(formattedMessage, logFilePath) {
    try {
        // Ensure log directory exists before writing
        const logDir = path.dirname(logFilePath);
        
        try {
            await fs.promises.access(logDir);
        } catch (accessError) {
            // Create directory if it doesn't exist
            await fs.promises.mkdir(logDir, { recursive: true });
        }
        
        // Append log message with newline terminator
        await fs.promises.appendFile(logFilePath, formattedMessage + '\n', 'utf8');
        
    } catch (error) {
        // Handle file writing errors gracefully without affecting application
        console.error('Failed to write log to file:', error.message);
        
        // Attempt to write to console as fallback
        console.log('[FILE-LOG-ERROR]', formattedMessage);
    }
}

/**
 * Logger class that provides comprehensive logging functionality with level-based filtering,
 * request context management, structured output formatting, and optional file logging support
 */
class Logger {
    /**
     * Initializes logger with configuration, context storage, and output formatting setup
     * @param {object} options - Configuration options for logger behavior and output
     */
    constructor(options = {}) {
        // Load logger configuration from environment and merge with provided options
        this.config = {
            level: config.logging?.level || LOG_LEVELS.INFO,
            console: config.logging?.console !== false, // Default to true
            file: config.logging?.file || false,
            filePath: config.logging?.filePath || null,
            format: config.logging?.format || DEFAULT_LOG_FORMAT,
            colorize: config.logging?.colorize !== false && isDevelopment,
            requestCorrelation: config.logging?.requestCorrelation !== false,
            ...options
        };
        
        // Set minimum log level for filtering
        this.level = this.config.level;
        
        // Configure console color support based on environment and TTY detection
        this.colorize = this.config.colorize && process.stdout.isTTY;
        
        // Initialize request context storage for correlation tracking
        this.requestContexts = new Map();
        
        // Initialize logging statistics for monitoring and debugging
        this.stats = {
            messageCount: {
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
                total: 0
            },
            fileWriteErrors: 0,
            contextCount: 0,
            startTime: Date.now()
        };
        
        // Set up periodic context cleanup to prevent memory leaks
        if (this.config.requestCorrelation) {
            this.contextCleanupTimer = setInterval(() => {
                this.cleanupExpiredContexts();
            }, CONTEXT_CLEANUP_INTERVAL);
        }
        
        // Configure file logging if enabled
        if (this.config.file && this.config.filePath) {
            // Validate file path and ensure directory exists
            try {
                const logDir = path.dirname(this.config.filePath);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                this.info('File logging initialized', { filePath: this.config.filePath });
            } catch (error) {
                this.error('Failed to initialize file logging', { error: error.message });
                this.config.file = false; // Disable file logging on setup failure
            }
        }
        
        // Log successful logger initialization
        this.info('Logger initialized successfully', {
            level: this.level,
            format: this.config.format,
            console: this.config.console,
            file: this.config.file
        });
    }
    
    /**
     * Logs debug-level messages for detailed application flow tracing and development debugging
     * @param {string} message - Debug message content
     * @param {object} context - Optional context object with additional debug information
     */
    debug(message, context = null) {
        if (!shouldLog(LOG_LEVELS.DEBUG, this.level)) return;
        
        const correlationId = this.getCurrentCorrelationId();
        const formattedMessage = formatLogMessage(LOG_LEVELS.DEBUG, message, context, correlationId);
        
        this.outputLog(formattedMessage);
        this.updateStats(LOG_LEVELS.DEBUG);
    }
    
    /**
     * Logs informational messages for normal application operation and request processing events
     * @param {string} message - Informational message content  
     * @param {object} context - Optional context object with request or operation details
     */
    info(message, context = null) {
        if (!shouldLog(LOG_LEVELS.INFO, this.level)) return;
        
        const correlationId = this.getCurrentCorrelationId();
        const formattedMessage = formatLogMessage(LOG_LEVELS.INFO, message, context, correlationId);
        
        this.outputLog(formattedMessage);
        this.updateStats(LOG_LEVELS.INFO);
    }
    
    /**
     * Logs warning messages for non-critical issues, performance concerns, and security events
     * @param {string} message - Warning message content
     * @param {object} context - Optional context object with warning details
     */
    warn(message, context = null) {
        if (!shouldLog(LOG_LEVELS.WARN, this.level)) return;
        
        const correlationId = this.getCurrentCorrelationId();
        const formattedMessage = formatLogMessage(LOG_LEVELS.WARN, message, context, correlationId);
        
        this.outputLog(formattedMessage);
        this.updateStats(LOG_LEVELS.WARN);
    }
    
    /**
     * Logs error messages for application failures, exceptions, and critical system issues with full context
     * @param {string} message - Error message content
     * @param {Error|object} error - Error object or additional error context
     */
    error(message, error = null) {
        const correlationId = this.getCurrentCorrelationId();
        
        // Process error object to extract useful information
        let errorContext = null;
        if (error) {
            if (error instanceof Error) {
                errorContext = {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    code: error.code,
                    errno: error.errno,
                    syscall: error.syscall,
                    path: error.path
                };
            } else if (typeof error === 'object') {
                errorContext = error;
            } else {
                errorContext = { details: String(error) };
            }
        }
        
        const formattedMessage = formatLogMessage(LOG_LEVELS.ERROR, message, errorContext, correlationId);
        
        this.outputLog(formattedMessage);
        this.updateStats(LOG_LEVELS.ERROR);
    }
    
    /**
     * Specialized logging method for HTTP request events with timing, status, and correlation information
     * @param {object} requestInfo - HTTP request information object
     * @param {number} statusCode - HTTP response status code
     * @param {number} duration - Request processing duration in milliseconds
     * @param {string} correlationId - Request correlation identifier
     */
    logRequest(requestInfo, statusCode, duration, correlationId) {
        // Determine appropriate log level based on status code and duration
        let logLevel;
        if (statusCode >= 500) {
            logLevel = LOG_LEVELS.ERROR;
        } else if (statusCode >= 400) {
            logLevel = LOG_LEVELS.WARN;
        } else if (duration > 1000) { // Slow requests over 1 second
            logLevel = LOG_LEVELS.WARN;
        } else {
            logLevel = LOG_LEVELS.INFO;
        }
        
        // Format request information with structured data
        const requestContext = {
            method: requestInfo.method,
            path: requestInfo.path,
            statusCode,
            duration: `${duration.toFixed(2)}ms`,
            userAgent: requestInfo.userAgent,
            clientIp: requestInfo.clientIp,
            contentLength: requestInfo.contentLength
        };
        
        const message = `${requestInfo.method} ${requestInfo.path} - ${statusCode} - ${duration.toFixed(2)}ms`;
        
        if (logLevel === LOG_LEVELS.ERROR) {
            this.error(message, requestContext);
        } else if (logLevel === LOG_LEVELS.WARN) {
            this.warn(message, requestContext);
        } else {
            this.info(message, requestContext);
        }
    }
    
    /**
     * Specialized error logging method with security filtering, context correlation, and monitoring integration
     * @param {Error} error - Error object with stack trace and details
     * @param {object} context - Error context including request information
     * @param {string} correlationId - Request correlation identifier for error tracking
     */
    logError(error, context = null, correlationId = null) {
        // Extract comprehensive error information
        const errorInfo = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            path: error.path,
            timestamp: new Date().toISOString()
        };
        
        // Merge with additional context if provided
        const fullContext = context ? { ...context, error: errorInfo } : { error: errorInfo };
        
        // Use provided correlation ID or attempt to get current one
        const finalCorrelationId = correlationId || this.getCurrentCorrelationId();
        
        const formattedMessage = formatLogMessage(
            LOG_LEVELS.ERROR,
            `Unhandled error: ${error.message}`,
            fullContext,
            finalCorrelationId
        );
        
        this.outputLog(formattedMessage);
        this.updateStats(LOG_LEVELS.ERROR);
        
        // Additional error tracking for monitoring integration
        this.stats.lastError = {
            timestamp: Date.now(),
            message: error.message,
            correlationId: finalCorrelationId
        };
    }
    
    /**
     * Sets request context for correlation tracking across middleware and handlers during request processing
     * @param {string} correlationId - Unique request correlation identifier
     * @param {object} context - Request context object with client and request details
     */
    setRequestContext(correlationId, context) {
        if (!this.config.requestCorrelation) return;
        
        // Validate correlation ID format and ensure it's not empty
        if (!correlationId || typeof correlationId !== 'string' || correlationId.trim() === '') {
            this.warn('Invalid correlation ID provided for request context', { correlationId });
            return;
        }
        
        // Limit context size to prevent memory issues
        let limitedContext = context;
        if (context && typeof context === 'object') {
            const contextString = JSON.stringify(context);
            if (contextString.length > MAX_CONTEXT_SIZE) {
                limitedContext = { ...context, _truncated: true };
                this.warn('Request context truncated due to size limit', { correlationId });
            }
        }
        
        // Store context with expiration timestamp to prevent memory leaks
        this.requestContexts.set(correlationId, {
            context: limitedContext,
            timestamp: Date.now(),
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes expiration
        });
        
        this.stats.contextCount = this.requestContexts.size;
        this.debug('Request context set', { correlationId, contextSize: this.requestContexts.size });
    }
    
    /**
     * Clears request context after request processing completion to prevent memory leaks
     * @param {string} correlationId - Request correlation identifier to clear
     */
    clearRequestContext(correlationId) {
        if (!this.config.requestCorrelation) return;
        
        if (!correlationId || typeof correlationId !== 'string') {
            this.warn('Invalid correlation ID provided for context clearing', { correlationId });
            return;
        }
        
        const deleted = this.requestContexts.delete(correlationId);
        this.stats.contextCount = this.requestContexts.size;
        
        if (deleted) {
            this.debug('Request context cleared', { correlationId, contextSize: this.requestContexts.size });
        } else {
            this.debug('Request context not found for clearing', { correlationId });
        }
    }
    
    /**
     * Retrieves current request context for correlation-aware logging within request processing pipeline
     * @returns {object|null} Current request context object or null if no active context
     */
    getCurrentContext() {
        if (!this.config.requestCorrelation || this.requestContexts.size === 0) {
            return null;
        }
        
        // For now, return the most recently added context
        // In a more sophisticated implementation, this would use async local storage
        const contexts = Array.from(this.requestContexts.values());
        if (contexts.length > 0) {
            return contexts[contexts.length - 1].context;
        }
        
        return null;
    }
    
    /**
     * Returns logging statistics including message counts by level, error rates, and context tracking metrics
     * @returns {object} Logging statistics object with counts, rates, and performance metrics
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const uptimeSeconds = Math.floor(uptime / 1000);
        
        return {
            messageCount: { ...this.stats.messageCount },
            errorRate: this.stats.messageCount.total > 0 ? 
                (this.stats.messageCount.error / this.stats.messageCount.total * 100).toFixed(2) + '%' : '0%',
            fileWriteErrors: this.stats.fileWriteErrors,
            activeContexts: this.stats.contextCount,
            uptime: uptimeSeconds,
            uptimeFormatted: this.formatUptime(uptimeSeconds),
            lastError: this.stats.lastError || null,
            configuration: {
                level: this.level,
                console: this.config.console,
                file: this.config.file,
                format: this.config.format,
                requestCorrelation: this.config.requestCorrelation
            }
        };
    }
    
    /**
     * Updates logger configuration dynamically including log level, output format, and file logging settings
     * @param {object} newConfig - New configuration options to apply
     */
    configure(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') {
            this.warn('Invalid configuration provided to configure method', { newConfig });
            return;
        }
        
        const oldConfig = { ...this.config };
        
        // Update configuration with validation
        if (newConfig.level && Object.values(LOG_LEVELS).includes(newConfig.level)) {
            this.level = newConfig.level;
            this.config.level = newConfig.level;
        }
        
        if (typeof newConfig.console === 'boolean') {
            this.config.console = newConfig.console;
        }
        
        if (typeof newConfig.file === 'boolean') {
            this.config.file = newConfig.file;
        }
        
        if (newConfig.filePath && typeof newConfig.filePath === 'string') {
            this.config.filePath = newConfig.filePath;
        }
        
        if (newConfig.format && ['text', 'json'].includes(newConfig.format)) {
            this.config.format = newConfig.format;
        }
        
        if (typeof newConfig.colorize === 'boolean') {
            this.config.colorize = newConfig.colorize;
            this.colorize = newConfig.colorize && process.stdout.isTTY;
        }
        
        this.info('Logger configuration updated', { 
            oldConfig: this.sanitizeConfig(oldConfig),
            newConfig: this.sanitizeConfig(this.config)
        });
    }
    
    // Private helper methods
    
    /**
     * Gets current correlation ID from request context
     * @private
     * @returns {string|null} Current correlation ID or null
     */
    getCurrentCorrelationId() {
        if (!this.config.requestCorrelation || this.requestContexts.size === 0) {
            return null;
        }
        
        // Return the most recently added correlation ID
        const correlationIds = Array.from(this.requestContexts.keys());
        return correlationIds.length > 0 ? correlationIds[correlationIds.length - 1] : null;
    }
    
    /**
     * Outputs formatted log message to configured destinations (console/file)
     * @private
     * @param {string} formattedMessage - Formatted log message
     */
    outputLog(formattedMessage) {
        // Output to console if enabled
        if (this.config.console) {
            console.log(formattedMessage);
        }
        
        // Output to file if enabled and configured
        if (this.config.file && this.config.filePath) {
            writeLogToFile(formattedMessage, this.config.filePath).catch(error => {
                this.stats.fileWriteErrors++;
                // Avoid recursion by using console directly for file write errors
                console.error('Log file write failed:', error.message);
            });
        }
    }
    
    /**
     * Updates logging statistics for monitoring and debugging
     * @private
     * @param {string} level - Log level that was used
     */
    updateStats(level) {
        this.stats.messageCount[level]++;
        this.stats.messageCount.total++;
    }
    
    /**
     * Cleans up expired request contexts to prevent memory leaks
     * @private
     */
    cleanupExpiredContexts() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [correlationId, contextData] of this.requestContexts.entries()) {
            if (contextData.expiresAt < now) {
                this.requestContexts.delete(correlationId);
                cleanedCount++;
            }
        }
        
        this.stats.contextCount = this.requestContexts.size;
        
        if (cleanedCount > 0) {
            this.debug('Cleaned up expired request contexts', { 
                cleanedCount, 
                activeContexts: this.stats.contextCount 
            });
        }
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
    
    /**
     * Sanitizes configuration for logging (removes sensitive information)
     * @private
     * @param {object} config - Configuration object to sanitize
     * @returns {object} Sanitized configuration
     */
    sanitizeConfig(config) {
        return sanitizeLogData(config);
    }
}

/**
 * Factory function that creates a logger instance with specified configuration
 * @param {object} options - Logger configuration options including level, format, console output, and file logging settings
 * @returns {Logger} Configured logger instance with all logging methods and context management
 */
function createLogger(options = {}) {
    return new Logger(options);
}

// Create default logger instance configured with environment settings for immediate use
const logger = createLogger();

// Export Logger class, factory function, default instance, utility functions, and constants
module.exports = {
    // Logger class for creating custom logging instances
    Logger,
    
    // Factory function to create logger instances with specific configuration
    createLogger,
    
    // Default logger instance configured with environment settings
    logger,
    
    // Log level constants for use throughout the application
    LOG_LEVELS,
    
    // Utility functions for message formatting and data sanitization
    formatLogMessage,
    sanitizeLogData
};