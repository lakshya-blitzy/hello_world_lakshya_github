/**
 * Node.js Tutorial HTTP Server Configuration
 * 
 * Centralized server configuration module that defines HTTP server settings,
 * routing parameters, security configurations, and performance thresholds for
 * the Node.js tutorial application.
 * 
 * This module provides structured configuration objects for:
 * - HTTP server initialization and connection management
 * - Request routing patterns and handler mappings
 * - Security headers and validation settings
 * - Performance monitoring thresholds and metrics collection
 * 
 * Educational Features:
 * - Demonstrates centralized configuration organization
 * - Shows essential security header configuration
 * - Illustrates HTTP routing configuration patterns
 * - Teaches performance threshold management
 * - Demonstrates module export patterns
 * 
 * Dependencies: None (zero external dependencies by design)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Global HTTP methods constants for request validation
const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    HEAD: 'HEAD',
    OPTIONS: 'OPTIONS'
};

// Essential security headers for HTTP response protection
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0'
};

// Routing patterns for endpoint URL matching
const ROUTING_PATTERNS = {
    HELLO_ENDPOINT: '/hello',
    HEALTH_ENDPOINT: '/health',
    ROOT_ENDPOINT: '/'
};

// Performance monitoring thresholds for system health validation
const PERFORMANCE_THRESHOLDS = {
    RESPONSE_TIME_MS: 100,
    MEMORY_USAGE_PERCENT: 80,
    EVENT_LOOP_LAG_MS: 100
};

/**
 * HTTP Server Configuration
 * 
 * Defines HTTP server initialization parameters, timeout settings,
 * connection management, and default response headers.
 */
const http = {
    // Basic server identification and metadata
    server: {
        name: 'Node.js Tutorial HTTP Server',
        version: '1.0.0',
        description: 'Educational HTTP server demonstrating Node.js fundamentals with single /hello endpoint'
    },

    // Request and connection timeout configurations
    // Conservative timeout values suitable for educational and development use
    timeouts: {
        request: 120000,        // 2 minutes - maximum time to wait for request completion
        keepAlive: 5000,        // 5 seconds - keep-alive timeout for persistent connections
        headers: 60000,         // 1 minute - timeout for receiving request headers
        server: 300000          // 5 minutes - overall server timeout for long operations
    },

    // Connection management and resource limits
    // Moderate connection limits appropriate for tutorial application scope
    connections: {
        maxConcurrent: 100,     // Maximum number of concurrent connections
        maxHeaderSize: 8192,    // 8KB - maximum size for request headers
        maxBodySize: 1048576,   // 1MB - maximum request body size
        backlog: 511            // Maximum number of pending connections in queue
    },

    // Default HTTP response headers for all responses
    // Essential headers for basic HTTP response functionality
    headers: {
        'Server': 'Node.js Tutorial Server/1.0.0',
        'Connection': 'keep-alive',
        'Date': 'auto-generated',                    // Generated automatically per request
        'Content-Type': 'text/plain; charset=utf-8' // Default content type for tutorial responses
    }
};

/**
 * Request Routing Configuration
 * 
 * Defines route patterns, HTTP method restrictions, handler mappings,
 * and error handling for the tutorial application endpoints.
 */
const routing = {
    // Route definitions with handler mappings and metadata
    // Simple routing setup focused on /hello endpoint demonstration
    routes: {
        '/hello': {
            methods: ['GET'],                   // Only GET requests allowed
            handler: 'helloHandler',           // Handler function name
            description: 'Primary tutorial endpoint returning Hello world response',
            responseType: 'text/plain',        // Response content type
            cached: false                      // No caching for dynamic content
        },
        '/health': {
            methods: ['GET', 'HEAD'],          // Health check supports GET and HEAD
            handler: 'healthHandler',          // Health check handler
            description: 'Health check endpoint for application monitoring',
            responseType: 'application/json',  // JSON response format
            cached: false                      // Health status not cached
        },
        '/': {
            methods: ['GET'],                  // Root endpoint for documentation
            handler: 'rootHandler',           // Root endpoint handler
            description: 'Root endpoint redirecting to documentation',
            responseType: 'text/plain',       // Plain text response
            cached: false                     // No caching for root endpoint
        }
    },

    // HTTP method configuration and validation rules
    methods: {
        allowed: ['GET', 'HEAD', 'OPTIONS'], // Supported HTTP methods
        default: 'GET',                      // Default method assumption
        caseSensitive: true                  // Case-sensitive method matching
    },

    // URL pattern matching configuration
    // Exact path matching with strict routing rules
    patterns: {
        exactMatch: true,        // Require exact path matching
        trailingSlash: false,    // Ignore trailing slashes
        queryString: 'ignore',   // Query parameters ignored for routing
        fragments: 'ignore'      // URL fragments ignored
    },

    // Error and special case handlers
    handlers: {
        notFound: 'notFoundHandler',           // 404 Not Found handler
        methodNotAllowed: 'methodNotAllowedHandler', // 405 Method Not Allowed handler
        error: 'errorHandler',                 // General error handler
        timeout: 'timeoutHandler'              // Request timeout handler
    }
};

/**
 * Security Configuration
 * 
 * Defines security headers, request validation rules, rate limiting,
 * and CORS policies for HTTP response protection.
 */
const security = {
    // HTTP security headers for response protection
    // Essential security headers for basic HTTP response protection
    headers: {
        'X-Content-Type-Options': 'nosniff',           // Prevent MIME type sniffing
        'X-Frame-Options': 'DENY',                     // Prevent clickjacking attacks
        'X-XSS-Protection': '0',                       // Disable legacy XSS protection (modern approach)
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
        'Pragma': 'no-cache',                         // HTTP/1.0 cache prevention
        'Expires': '0'                                 // Immediate expiration
    },

    // Request validation and size limits
    // Input validation rules for security and stability
    validation: {
        maxUrlLength: 2048,              // Maximum URL length in characters
        maxHeaderCount: 100,             // Maximum number of headers per request
        maxHeaderSize: 8192,             // Maximum total header size in bytes
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'], // Permitted HTTP methods
        validateContentType: true,       // Validate Content-Type header
        sanitizeHeaders: true            // Sanitize header values
    },

    // Rate limiting configuration (disabled for tutorial)
    // Basic rate limiting setup for future extension
    rateLimiting: {
        enabled: false,              // Rate limiting disabled for educational use
        windowMs: 60000,             // 1 minute time window
        maxRequests: 100,            // Maximum requests per window
        skipSuccessfulRequests: false, // Count all requests
        skipFailedRequests: false    // Count failed requests too
    },

    // Cross-Origin Resource Sharing (CORS) settings
    // CORS configuration for cross-origin requests
    cors: {
        enabled: false,              // CORS disabled for simple tutorial
        origin: false,               // No specific origin restrictions
        credentials: false,          // No credential support
        optionsSuccessStatus: 200    // Success status for OPTIONS preflight
    }
};

/**
 * Performance Monitoring Configuration
 * 
 * Defines performance thresholds, monitoring parameters, and metrics
 * collection settings for system health and performance tracking.
 */
const performance = {
    // Performance threshold limits for monitoring
    // Reasonable performance expectations for single-endpoint application
    thresholds: {
        responseTime: 100,      // Maximum acceptable response time in milliseconds
        memoryUsage: 80,        // Maximum memory usage percentage
        eventLoopLag: 100,      // Maximum event loop lag in milliseconds
        cpuUsage: 70,           // Maximum CPU usage percentage
        errorRate: 5            // Maximum error rate percentage
    },

    // System monitoring configuration
    // Basic monitoring setup for development and learning
    monitoring: {
        enabled: true,                              // Enable performance monitoring
        interval: 30000,                           // Monitoring interval in milliseconds (30 seconds)
        metrics: ['responseTime', 'memoryUsage', 'requestCount', 'errorRate'], // Metrics to collect
        alerting: false                            // Alerting disabled for tutorial
    },

    // Metrics collection settings
    // Performance metrics tracking configuration
    metrics: {
        collectResponseTimes: true,     // Track request response times
        collectMemoryUsage: true,       // Monitor memory consumption
        collectRequestCount: true,      // Count incoming requests
        collectErrorRates: true,        // Track error occurrence rates
        retentionPeriod: 3600000       // Metric retention period in milliseconds (1 hour)
    }
};

/**
 * Complete Server Configuration Object
 * 
 * Aggregates all configuration sections into a single exportable object
 * for centralized configuration management and easy import by other modules.
 */
const serverConfig = {
    http,           // HTTP server configuration
    routing,        // Request routing configuration
    security,       // Security and validation configuration
    performance     // Performance monitoring configuration
};

// Export individual configuration objects for selective importing
export { http };
export { routing };
export { security };  
export { performance };

// Export complete server configuration as default export
export default serverConfig;

/**
 * Configuration Validation Notes:
 * 
 * Timeout Ranges: All timeout values are positive integers with reasonable
 * upper bounds suitable for educational and development environments.
 * 
 * Connection Limits: Connection parameters are within typical system resource
 * constraints and appropriate for single-machine tutorial deployments.
 * 
 * Security Headers: Security header values comply with HTTP specification
 * standards and represent current best practices for basic protection.
 * 
 * Route Patterns: Route patterns are valid URL paths with proper HTTP method
 * associations following REST API conventions.
 * 
 * Performance Thresholds: Threshold values are within practical operational
 * ranges for a single-endpoint tutorial application.
 * 
 * Extensibility Design:
 * 
 * Additional Routes: Configuration structure supports easy addition of new
 * routes and handlers through the routing.routes object.
 * 
 * Security Enhancements: Security section can be extended with additional
 * protection mechanisms like rate limiting and advanced CORS policies.
 * 
 * Performance Metrics: Monitoring configuration allows expansion of tracked
 * performance indicators and custom metrics collection.
 * 
 * Environment Overrides: Configuration values can be overridden through
 * environment variables for deployment flexibility.
 */