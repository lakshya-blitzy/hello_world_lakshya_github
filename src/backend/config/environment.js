// Node.js Tutorial HTTP Server - Environment Configuration Manager
// Centralized environment configuration with validation and defaults
// Zero external dependencies - uses Node.js built-in modules only

const process = require('node:process'); // Built-in Node.js process module
const path = require('node:path'); // Built-in Node.js path utilities  
const os = require('node:os'); // Built-in Node.js operating system utilities

// Global environment type constants for consistent environment detection
const ENVIRONMENT_TYPES = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production', 
    TEST: 'test'
};

// Default server port for HTTP server binding
const DEFAULT_PORT = 3000;

// Default hostname for server binding - localhost for security
const DEFAULT_HOSTNAME = '127.0.0.1';

// Log level constants for structured logging configuration
const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info', 
    WARN: 'warn',
    ERROR: 'error'
};

// Configuration validation rules for input validation
const CONFIG_VALIDATION_RULES = {
    port: {
        min: 1024, // Non-privileged port range
        max: 65535  // Maximum valid port number
    },
    hostname: /^[a-zA-Z0-9.-]+$/ // Basic hostname/IP format validation
};

/**
 * Safely parses environment variable values with type conversion and validation
 * Handles string, number, boolean, and array type conversions with fallbacks
 * @param {string} value - Raw environment variable value to parse
 * @param {string} type - Expected value type (string, number, boolean, array)
 * @param {any} defaultValue - Default value if parsing fails or value is empty
 * @returns {any} Parsed and validated value of specified type
 */
function parseEnvironmentValue(value, type, defaultValue) {
    // Return default if value is undefined, null, or empty string
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    
    try {
        switch (type) {
            case 'number':
                const parsed = parseInt(value, 10);
                if (isNaN(parsed)) {
                    console.warn(`Invalid number value: ${value}, using default: ${defaultValue}`);
                    return defaultValue;
                }
                return parsed;
                
            case 'boolean':
                const booleanValue = value.toLowerCase();
                if (booleanValue === 'true' || booleanValue === '1') return true;
                if (booleanValue === 'false' || booleanValue === '0') return false;
                console.warn(`Invalid boolean value: ${value}, using default: ${defaultValue}`);
                return defaultValue;
                
            case 'array':
                try {
                    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
                } catch (error) {
                    console.warn(`Invalid array value: ${value}, using default: ${defaultValue}`);
                    return defaultValue;
                }
                
            case 'string':
            default:
                return value.toString();
        }
    } catch (error) {
        console.warn(`Error parsing environment value ${value} as ${type}:`, error.message);
        return defaultValue;
    }
}

/**
 * Provides default configuration values for all environments with environment-specific overrides
 * Ensures consistent baseline configuration while allowing environment customization
 * @param {string} environment - Target environment type for default selection
 * @returns {object} Default configuration object tailored to specified environment
 */
function getConfigDefaults(environment) {
    // Base defaults applicable to all environments
    const baseDefaults = {
        server: {
            port: DEFAULT_PORT,
            hostname: DEFAULT_HOSTNAME,
            timeout: 120000, // 2 minutes
            keepAliveTimeout: 5000, // 5 seconds
            headersTimeout: 60000, // 1 minute
            requestTimeout: 300000, // 5 minutes
            maxConnections: 100,
            connectionTimeout: 30000 // 30 seconds
        },
        logging: {
            level: LOG_LEVELS.INFO,
            console: true,
            file: false,
            filePath: null,
            format: 'text',
            colorize: false,
            requestCorrelation: false
        }
    };
    
    // Environment-specific configuration overrides
    const environmentDefaults = {
        [ENVIRONMENT_TYPES.DEVELOPMENT]: {
            server: {
                hostname: '127.0.0.1', // Localhost only for development security
                maxConnections: 100,
                requestTimeout: 300000 // Longer timeout for debugging
            },
            logging: {
                level: LOG_LEVELS.DEBUG,
                console: true,
                file: false,
                format: 'text',
                colorize: true,
                requestCorrelation: true
            }
        },
        [ENVIRONMENT_TYPES.PRODUCTION]: {
            server: {
                hostname: '0.0.0.0', // All interfaces for production deployment
                maxConnections: 1000,
                requestTimeout: 300000
            },
            logging: {
                level: LOG_LEVELS.INFO,
                console: true,
                file: true,
                format: 'json', // Structured logging for production
                colorize: false, // No colors in production logs
                requestCorrelation: true
            }
        },
        [ENVIRONMENT_TYPES.TEST]: {
            server: {
                port: 0, // Random port assignment for parallel testing
                hostname: '127.0.0.1',
                timeout: 5000, // Fast timeouts for testing
                keepAliveTimeout: 1000,
                headersTimeout: 5000,
                requestTimeout: 10000,
                maxConnections: 50,
                connectionTimeout: 5000
            },
            logging: {
                level: LOG_LEVELS.WARN, // Minimal logging during tests
                console: false, // No console output during tests
                file: false,
                format: 'text',
                colorize: false,
                requestCorrelation: false
            }
        }
    };
    
    // Merge base defaults with environment-specific overrides
    const envDefaults = environmentDefaults[environment] || {};
    
    return {
        server: { ...baseDefaults.server, ...envDefaults.server },
        logging: { ...baseDefaults.logging, ...envDefaults.logging }
    };
}

/**
 * Determines the current environment type from NODE_ENV with validation and defaults
 * Normalizes environment string and provides fallback to development environment
 * @returns {string} Environment type (development, production, or test)
 */
function getEnvironmentType() {
    // Read NODE_ENV environment variable with fallback
    const nodeEnv = process.env.NODE_ENV || ENVIRONMENT_TYPES.DEVELOPMENT;
    
    // Normalize environment string to lowercase for consistent comparison
    const normalizedEnv = nodeEnv.toLowerCase().trim();
    
    // Validate against known environment types
    const validEnvironments = Object.values(ENVIRONMENT_TYPES);
    if (validEnvironments.includes(normalizedEnv)) {
        console.log(`Environment detected: ${normalizedEnv}`);
        return normalizedEnv;
    }
    
    // Log warning for invalid environment and use development as fallback
    console.warn(`Invalid NODE_ENV value: ${nodeEnv}, falling back to: ${ENVIRONMENT_TYPES.DEVELOPMENT}`);
    return ENVIRONMENT_TYPES.DEVELOPMENT;
}

/**
 * Extracts and validates server configuration from environment variables with sensible defaults
 * Handles port binding, hostname configuration, timeouts, and connection management
 * @returns {object} Server configuration object with port, hostname, timeouts, and connection settings
 */
function getServerConfig() {
    // Parse port with validation for numeric range (non-privileged ports)
    const port = parseEnvironmentValue(
        process.env.PORT, 
        'number', 
        DEFAULT_PORT
    );
    
    // Validate port range for security (non-privileged ports)
    if (port < CONFIG_VALIDATION_RULES.port.min || port > CONFIG_VALIDATION_RULES.port.max) {
        console.warn(`Port ${port} outside valid range (${CONFIG_VALIDATION_RULES.port.min}-${CONFIG_VALIDATION_RULES.port.max}), using default: ${DEFAULT_PORT}`);
        // Use default port if validation fails
        const validatedPort = DEFAULT_PORT;
        return buildServerConfig(validatedPort);
    }
    
    return buildServerConfig(port);
}

/**
 * Builds complete server configuration object with validated parameters
 * @param {number} port - Validated port number for server binding
 * @returns {object} Complete server configuration object
 */
function buildServerConfig(port) {
    // Extract hostname with format validation
    const hostname = parseEnvironmentValue(
        process.env.HOST || process.env.HOSTNAME,
        'string',
        DEFAULT_HOSTNAME
    );
    
    // Basic hostname/IP format validation
    if (!CONFIG_VALIDATION_RULES.hostname.test(hostname)) {
        console.warn(`Invalid hostname format: ${hostname}, using default: ${DEFAULT_HOSTNAME}`);
        return {
            port,
            hostname: DEFAULT_HOSTNAME,
            ...getTimeoutConfiguration(),
            ...getConnectionConfiguration()
        };
    }
    
    return {
        port,
        hostname,
        ...getTimeoutConfiguration(),
        ...getConnectionConfiguration()
    };
}

/**
 * Configures timeout values from environment variables with validation
 * @returns {object} Timeout configuration object
 */
function getTimeoutConfiguration() {
    return {
        timeout: parseEnvironmentValue(process.env.TIMEOUT, 'number', 120000),
        keepAliveTimeout: parseEnvironmentValue(process.env.KEEP_ALIVE_TIMEOUT, 'number', 5000),
        headersTimeout: parseEnvironmentValue(process.env.HEADERS_TIMEOUT, 'number', 60000),
        requestTimeout: parseEnvironmentValue(process.env.REQUEST_TIMEOUT, 'number', 300000)
    };
}

/**
 * Configures connection limits and performance settings
 * @returns {object} Connection configuration object
 */
function getConnectionConfiguration() {
    return {
        maxConnections: parseEnvironmentValue(process.env.MAX_CONNECTIONS, 'number', 100),
        connectionTimeout: parseEnvironmentValue(process.env.CONNECTION_TIMEOUT, 'number', 30000)
    };
}

/**
 * Configures logging settings based on environment type and LOG_LEVEL environment variable
 * Handles console/file logging, formatting, and correlation tracking configuration
 * @returns {object} Logging configuration with level, format, and output settings
 */
function getLoggingConfig() {
    // Parse LOG_LEVEL with validation against known log levels
    const logLevel = parseEnvironmentValue(
        process.env.LOG_LEVEL,
        'string',
        LOG_LEVELS.INFO
    ).toLowerCase();
    
    // Validate log level against known values
    const validLogLevels = Object.values(LOG_LEVELS);
    const validatedLogLevel = validLogLevels.includes(logLevel) ? logLevel : LOG_LEVELS.INFO;
    
    if (!validLogLevels.includes(logLevel)) {
        console.warn(`Invalid LOG_LEVEL: ${logLevel}, using default: ${LOG_LEVELS.INFO}`);
    }
    
    // Configure console logging with color support detection
    const consoleLogging = parseEnvironmentValue(process.env.LOG_CONSOLE, 'boolean', true);
    const colorizeOutput = parseEnvironmentValue(process.env.LOG_COLORIZE, 'boolean', 
        process.stdout.isTTY && getEnvironmentType() === ENVIRONMENT_TYPES.DEVELOPMENT
    );
    
    // Configure optional file logging
    const fileLogging = parseEnvironmentValue(process.env.LOG_FILE_ENABLED, 'boolean', false);
    const logFilePath = process.env.LOG_FILE ? 
        path.resolve(process.env.LOG_FILE) : 
        null;
    
    // Set log format based on environment
    const environment = getEnvironmentType();
    const logFormat = parseEnvironmentValue(
        process.env.LOG_FORMAT,
        'string',
        environment === ENVIRONMENT_TYPES.PRODUCTION ? 'json' : 'text'
    );
    
    return {
        level: validatedLogLevel,
        console: consoleLogging,
        file: fileLogging,
        filePath: logFilePath,
        format: logFormat,
        colorize: colorizeOutput,
        requestCorrelation: parseEnvironmentValue(process.env.LOG_REQUEST_CORRELATION, 'boolean', 
            environment !== ENVIRONMENT_TYPES.TEST
        )
    };
}

/**
 * Validates complete configuration object to ensure all required settings are present and valid
 * Performs comprehensive validation of server, logging, and environment configuration
 * @param {object} config - Configuration object to validate
 * @returns {boolean} True if configuration is valid, throws error with details if invalid
 */
function validateConfiguration(config) {
    // Validate configuration object structure
    if (!config || typeof config !== 'object') {
        throw new Error('Configuration object is required and must be an object');
    }
    
    // Validate server configuration section
    if (!config.server || typeof config.server !== 'object') {
        throw new Error('Server configuration is required');
    }
    
    // Validate server port configuration
    const { port, hostname, timeout, keepAliveTimeout } = config.server;
    
    if (typeof port !== 'number' || port < 1 || port > 65535) {
        throw new Error(`Invalid port configuration: ${port}. Must be number between 1-65535`);
    }
    
    if (!hostname || typeof hostname !== 'string' || hostname.trim() === '') {
        throw new Error('Invalid hostname configuration: must be non-empty string');
    }
    
    // Validate timeout values are positive integers
    const timeoutValues = { timeout, keepAliveTimeout };
    for (const [key, value] of Object.entries(timeoutValues)) {
        if (typeof value !== 'number' || value <= 0) {
            throw new Error(`Invalid ${key}: must be positive number`);
        }
    }
    
    // Validate logging configuration section
    if (!config.logging || typeof config.logging !== 'object') {
        throw new Error('Logging configuration is required');
    }
    
    // Validate log level
    const { level } = config.logging;
    const validLogLevels = Object.values(LOG_LEVELS);
    if (!validLogLevels.includes(level)) {
        throw new Error(`Invalid log level: ${level}. Must be one of: ${validLogLevels.join(', ')}`);
    }
    
    // Validate environment type
    if (!config.environment || typeof config.environment !== 'string') {
        throw new Error('Environment type is required');
    }
    
    const validEnvironments = Object.values(ENVIRONMENT_TYPES);
    if (!validEnvironments.includes(config.environment)) {
        throw new Error(`Invalid environment: ${config.environment}. Must be one of: ${validEnvironments.join(', ')}`);
    }
    
    console.log('Configuration validation successful');
    return true;
}

/**
 * Loads and processes environment variables into structured configuration object with validation and defaults
 * Orchestrates the complete configuration loading process with error handling
 * @returns {object} Complete environment configuration object with server, logging, and environment settings
 */
function loadEnvironmentConfig() {
    try {
        console.log('Loading environment configuration...');
        
        // Step 1: Detect current environment from NODE_ENV with fallback to development
        const environment = getEnvironmentType();
        
        // Step 2: Load environment-specific defaults
        const defaults = getConfigDefaults(environment);
        
        // Step 3: Load server configuration from environment variables
        const serverConfig = getServerConfig();
        
        // Step 4: Configure logging settings based on environment and variables
        const loggingConfig = getLoggingConfig();
        
        // Step 5: Create structured configuration object with all settings
        const config = {
            server: { ...defaults.server, ...serverConfig },
            logging: { ...defaults.logging, ...loggingConfig },
            environment: environment,
            isProduction: environment === ENVIRONMENT_TYPES.PRODUCTION,
            isDevelopment: environment === ENVIRONMENT_TYPES.DEVELOPMENT,
            isTest: environment === ENVIRONMENT_TYPES.TEST
        };
        
        // Step 6: Validate configuration values and apply constraints
        validateConfiguration(config);
        
        console.log('Environment configuration loaded successfully');
        console.log(`Server will bind to: ${config.server.hostname}:${config.server.port}`);
        console.log(`Logging level: ${config.logging.level}`);
        
        // Step 7: Return complete configuration ready for application use
        return config;
        
    } catch (error) {
        console.error('Failed to load environment configuration:', error.message);
        console.error('Stack trace:', error.stack);
        
        // For critical configuration errors, exit the process
        if (error.message.includes('Configuration object is required') || 
            error.message.includes('Server configuration is required')) {
            console.error('Critical configuration error, exiting process');
            process.exit(1);
        }
        
        // For non-critical errors, return minimal safe configuration
        console.warn('Using minimal safe configuration due to errors');
        return {
            server: {
                port: DEFAULT_PORT,
                hostname: DEFAULT_HOSTNAME,
                timeout: 120000,
                keepAliveTimeout: 5000,
                headersTimeout: 60000,
                requestTimeout: 300000,
                maxConnections: 100,
                connectionTimeout: 30000
            },
            logging: {
                level: LOG_LEVELS.INFO,
                console: true,
                file: false,
                filePath: null,
                format: 'text',
                colorize: false,
                requestCorrelation: false
            },
            environment: ENVIRONMENT_TYPES.DEVELOPMENT,
            isProduction: false,
            isDevelopment: true,
            isTest: false
        };
    }
}

// Load the complete configuration on module initialization
const config = loadEnvironmentConfig();

// Export complete configuration object with all settings
module.exports = {
    // Main configuration object with server, logging, and environment settings
    config,
    
    // Individual configuration functions for advanced use cases
    loadEnvironmentConfig,
    getEnvironmentType,
    getServerConfig,
    getLoggingConfig,
    validateConfiguration,
    getConfigDefaults,
    parseEnvironmentValue,
    
    // Environment type constants for external use
    ENVIRONMENT_TYPES,
    DEFAULT_PORT,
    DEFAULT_HOSTNAME,
    LOG_LEVELS,
    CONFIG_VALIDATION_RULES
};