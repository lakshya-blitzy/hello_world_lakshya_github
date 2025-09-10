/**
 * Mock HTTP Request Object Factory and Utilities for Node.js Tutorial HTTP Server Testing
 * 
 * This file provides comprehensive mock HTTP request object creation capabilities using only
 * Node.js built-in modules. It demonstrates educational testing patterns for HTTP server
 * applications without requiring external mocking libraries.
 * 
 * Educational Purpose:
 * - Demonstrates mock object creation patterns using Node.js EventEmitter and streams
 * - Shows realistic HTTP request simulation for comprehensive server testing
 * - Provides examples of zero-dependency testing utilities for Node.js applications
 * - Illustrates proper request object structure and event-driven request processing
 * 
 * Features:
 * - Realistic mock IncomingMessage objects with full HTTP properties
 * - Event-driven request simulation with data, end, and error events
 * - Comprehensive test scenario support (valid, invalid, error, edge cases)
 * - Performance testing capabilities with timing and correlation tracking
 * - Educational examples of HTTP request structure and processing patterns
 * - Zero external dependencies using only Node.js built-in modules
 */

// Node.js built-in module imports for mock object creation and HTTP simulation
import { EventEmitter } from 'node:events'; // node:events@built-in - Event emitter for realistic HTTP request event simulation
import { Readable } from 'node:stream'; // node:stream@built-in - Readable stream for HTTP request body streaming simulation
import { URL } from 'node:url'; // node:url@built-in - URL parsing and construction for request URL handling
import { performance } from 'node:perf_hooks'; // node:perf_hooks@built-in - Performance measurement for request timing and testing scenarios

// Import test data configurations for creating realistic mock request objects
import { 
    validRequests, 
    invalidRequests, 
    httpHeaders, 
    endpoints 
} from './test-data.js';

// Global constants for consistent mock request configuration
const DEFAULT_HTTP_VERSION = '1.1';
const DEFAULT_USER_AGENT = 'Node.js Test Client/1.0.0';
const DEFAULT_HOST = 'localhost:3000';
const CORRELATION_ID_PREFIX = 'mock-req-';
const MOCK_CLIENT_IP = '127.0.0.1';

/**
 * Comprehensive Mock HTTP Request Class
 * 
 * Creates realistic mock HTTP request objects that extend EventEmitter to simulate 
 * Node.js IncomingMessage objects with complete properties, methods, and event behavior 
 * for thorough HTTP server testing scenarios.
 */
class MockHttpRequest extends EventEmitter {
    /**
     * Initialize mock HTTP request with configuration, properties, and event handling
     * for realistic HTTP request simulation
     * 
     * @param {Object} config - Configuration object with HTTP method, URL, headers, and connection details
     */
    constructor(config = {}) {
        // Call EventEmitter constructor to enable event emission capabilities for request simulation
        super();
        
        // Set HTTP request properties from configuration including method, URL, and HTTP version
        this.method = config.method || 'GET';
        this.url = config.url || config.path || '/';
        this.httpVersion = config.httpVersion || DEFAULT_HTTP_VERSION;
        
        // Initialize headers object with provided headers and default headers for realistic simulation
        this.headers = this._initializeHeaders(config.headers);
        
        // Create connection object with client IP address, port, and socket information
        this.connection = this._createConnectionObject(config.connection);
        
        // Generate unique correlation ID for request tracking and debugging purposes
        this.correlationId = generateCorrelationId();
        
        // Record request start time for performance measurement and testing scenarios
        this.startTime = performance.now();
        
        // Initialize request completion state and body processing flags
        this.complete = false;
        this.readable = true;
        this.destroyed = false;
        
        // Set up request validation properties for testing security and routing functionality
        this._setupValidationProperties(config);
        
        // Initialize request body handling properties
        this._body = config.body || null;
        this._bodyProcessed = false;
    }

    /**
     * Initialize headers object with default headers and configuration overrides
     * @private
     */
    _initializeHeaders(configHeaders = {}) {
        const defaultHeaders = {
            'host': DEFAULT_HOST,
            'user-agent': DEFAULT_USER_AGENT,
            'connection': 'keep-alive',
            'accept': 'text/plain'
        };
        
        return { ...defaultHeaders, ...this._normalizeHeaders(configHeaders) };
    }

    /**
     * Normalize header names to lowercase for consistent handling
     * @private
     */
    _normalizeHeaders(headers) {
        const normalized = {};
        for (const [key, value] of Object.entries(headers)) {
            normalized[key.toLowerCase()] = value;
        }
        return normalized;
    }

    /**
     * Create connection object with client address and port information
     * @private
     */
    _createConnectionObject(connectionConfig = {}) {
        return {
            remoteAddress: connectionConfig.remoteAddress || MOCK_CLIENT_IP,
            remotePort: connectionConfig.remotePort || Math.floor(Math.random() * 50000) + 10000,
            localAddress: connectionConfig.localAddress || '127.0.0.1',
            localPort: connectionConfig.localPort || 3000,
            encrypted: connectionConfig.encrypted || false,
            authorized: connectionConfig.authorized !== false
        };
    }

    /**
     * Set up additional validation properties for testing
     * @private
     */
    _setupValidationProperties(config) {
        // Parse URL for path extraction and query parameter handling
        try {
            const parsedUrl = new URL(this.url, `http://${this.headers.host || DEFAULT_HOST}`);
            this.path = parsedUrl.pathname;
            this.search = parsedUrl.search;
            this.query = parsedUrl.searchParams;
        } catch (error) {
            this.path = this.url;
            this.search = '';
            this.query = new URLSearchParams();
        }

        // Set additional IncomingMessage properties
        this.httpVersionMajor = 1;
        this.httpVersionMinor = 1;
        this.rawHeaders = this._createRawHeaders();
        this.rawTrailers = [];
        this.trailers = {};
        
        // Set content-related properties
        if (this.headers['content-length']) {
            this.contentLength = parseInt(this.headers['content-length'], 10);
        }
    }

    /**
     * Create raw headers array as Node.js IncomingMessage would have
     * @private
     */
    _createRawHeaders() {
        const rawHeaders = [];
        for (const [key, value] of Object.entries(this.headers)) {
            rawHeaders.push(key, value);
        }
        return rawHeaders;
    }

    /**
     * Sets or updates HTTP request header with specified name and value for dynamic header manipulation in tests
     * 
     * @param {string} name - HTTP header name to set or update
     * @param {string} value - HTTP header value to assign
     */
    setHeader(name, value) {
        // Validate header name follows HTTP header naming conventions
        if (!name || typeof name !== 'string') {
            throw new Error('Header name must be a non-empty string');
        }

        // Normalize header name to lowercase for consistent header handling
        const normalizedName = name.toLowerCase();
        
        // Set header value in internal headers object for request simulation
        this.headers[normalizedName] = value;
        
        // Update Content-Length header automatically if content-related header is modified
        if (normalizedName === 'content-length') {
            this.contentLength = parseInt(value, 10);
        }

        // Update raw headers array for complete simulation
        this.rawHeaders = this._createRawHeaders();
    }

    /**
     * Retrieves HTTP request header value by name with case-insensitive header name lookup
     * 
     * @param {string} name - HTTP header name to retrieve value for
     * @returns {string} Header value if found, undefined if header does not exist
     */
    getHeader(name) {
        // Normalize header name to lowercase for case-insensitive lookup
        const normalizedName = name.toLowerCase();
        
        // Search headers object for matching header name
        // Return header value if found or undefined if header does not exist
        return this.headers[normalizedName];
    }

    /**
     * Simulates request body data by emitting data events with realistic chunk sizes and timing for body processing testing
     * 
     * @param {string} data - Request body data to simulate sending to server
     * @param {Object} options - Simulation options including chunk size and delay timing
     * @returns {Promise<void>} Promise resolving when data simulation is complete
     */
    async simulateData(data, options = {}) {
        const chunkSize = options.chunkSize || 1024;
        const delay = options.delay || 10;
        
        if (!data || this._bodyProcessed) {
            return;
        }

        // Split request body data into realistic chunk sizes for streaming simulation
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }

        // Emit data events with appropriate delays between chunks
        for (const chunk of chunks) {
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Update request processing state during data simulation
            this.emit('data', Buffer.from(chunk));
        }

        // Mark data processing as complete
        this._bodyProcessed = true;
    }

    /**
     * Simulates request completion by emitting end event and finalizing request state for complete request lifecycle testing
     * 
     * @returns {Promise<void>} Promise resolving when request end simulation is complete
     */
    async simulateEnd() {
        if (this.complete) {
            return;
        }

        // Mark request as complete to indicate end of data reception
        this.complete = true;
        this.readable = false;
        
        // Record request completion time for performance measurement
        this.endTime = performance.now();
        
        // Emit end event to signal request completion to server components
        this.emit('end');
    }

    /**
     * Simulates request error conditions by emitting error events for testing error handling and recovery scenarios
     * 
     * @param {Error} error - Error object to simulate during request processing
     */
    simulateError(error) {
        // Mark request as errored to indicate error state
        this.destroyed = true;
        this.readable = false;
        
        // Emit error event with provided error object for error handling testing
        this.emit('error', error);
        
        // Stop any ongoing data simulation due to error condition
        this._bodyProcessed = true;
    }

    /**
     * Creates deep copy of mock request object with identical properties for test scenario variations and reuse
     * 
     * @param {Object} overrides - Optional property overrides for cloned request customization
     * @returns {Object} New MockHttpRequest instance with copied properties and applied overrides
     */
    clone(overrides = {}) {
        // Create new MockHttpRequest instance with current configuration
        const config = {
            method: this.method,
            url: this.url,
            httpVersion: this.httpVersion,
            headers: { ...this.headers },
            connection: { ...this.connection },
            body: this._body,
            ...overrides
        };

        // Deep copy all request properties including headers and connection details
        const cloned = new MockHttpRequest(config);
        
        // Generate new correlation ID for the cloned request
        cloned.correlationId = generateCorrelationId();
        
        // Return configured cloned request ready for independent testing
        return cloned;
    }

    /**
     * Returns comprehensive request information including headers, timing, and validation data for test debugging and analysis
     * 
     * @returns {Object} Request information object with properties, timing, and metadata
     */
    getRequestInfo() {
        // Collect current request properties including method, URL, and headers
        return {
            method: this.method,
            url: this.url,
            path: this.path,
            headers: { ...this.headers },
            connection: { ...this.connection },
            
            // Include timing information for performance analysis
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.endTime ? this.endTime - this.startTime : null,
            
            // Add correlation ID and connection details for request tracking
            correlationId: this.correlationId,
            
            // Include request state information for debugging purposes
            complete: this.complete,
            readable: this.readable,
            destroyed: this.destroyed,
            bodyProcessed: this._bodyProcessed
        };
    }
}

/**
 * Factory Class for Creating Different Types of Mock HTTP Requests
 * 
 * Provides predefined configurations for common testing scenarios including valid requests, 
 * error conditions, and edge cases with efficient mock request creation capabilities.
 */
class MockRequestFactory {
    /**
     * Initialize mock request factory with default configuration and request templates
     * for efficient mock request creation
     * 
     * @param {Object} defaultConfig - Default configuration including server host, timing, and headers
     */
    constructor(defaultConfig = {}) {
        // Store default configuration for applying to all created mock requests
        this.defaultConfig = {
            host: DEFAULT_HOST,
            userAgent: DEFAULT_USER_AGENT,
            httpVersion: DEFAULT_HTTP_VERSION,
            timeout: 10000,
            ...defaultConfig
        };

        // Initialize request counter for tracking factory usage statistics
        this.requestCounter = {
            total: 0,
            byType: {},
            byMethod: {}
        };

        // Load request templates from test data for common testing scenarios
        this.requestTemplates = this._initializeTemplates();
    }

    /**
     * Initialize predefined request templates for common scenarios
     * @private
     */
    _initializeTemplates() {
        const templates = new Map();
        
        // Hello request template
        templates.set('hello', {
            method: 'GET',
            path: '/hello',
            headers: {
                'accept': 'text/plain',
                'user-agent': this.defaultConfig.userAgent
            }
        });

        // Not found request template
        templates.set('notFound', {
            method: 'GET',
            path: '/nonexistent',
            headers: {
                'accept': 'text/plain'
            }
        });

        // Method not allowed template
        templates.set('methodNotAllowed', {
            method: 'POST',
            path: '/hello',
            headers: {
                'content-type': 'application/json'
            }
        });

        return templates;
    }

    /**
     * Creates mock GET request for /hello endpoint with proper headers and configuration for successful hello handler testing
     * 
     * @param {Object} overrides - Optional configuration overrides for hello request customization
     * @returns {Object} MockHttpRequest configured for hello endpoint testing with realistic properties
     */
    createHelloRequest(overrides = {}) {
        // Load hello request template from predefined templates
        const template = this.requestTemplates.get('hello');
        
        // Apply factory default configuration and hello-specific settings
        const config = {
            ...template,
            ...this.defaultConfig,
            headers: {
                ...template.headers,
                'host': this.defaultConfig.host
            },
            ...overrides
        };

        // Apply any overrides provided for test scenario customization
        const request = new MockHttpRequest(config);
        
        // Update factory statistics
        this._updateStats('hello', 'GET');
        
        // Return configured hello mock request ready for testing
        return request;
    }

    /**
     * Creates mock request for non-existent path to test 404 Not Found error handling with realistic invalid path simulation
     * 
     * @param {string} invalidPath - Invalid URL path to request for 404 testing
     * @param {Object} options - Additional configuration for not found request scenario
     * @returns {Object} MockHttpRequest configured to trigger 404 Not Found error response
     */
    createNotFoundRequest(invalidPath = '/nonexistent', options = {}) {
        // Load not found request template with invalid path configuration
        const config = {
            method: 'GET',
            path: invalidPath,
            url: invalidPath,
            headers: {
                'accept': 'text/plain',
                'user-agent': this.defaultConfig.userAgent,
                'host': this.defaultConfig.host
            },
            ...options
        };

        // Return mock request that will trigger 404 error handling
        const request = new MockHttpRequest(config);
        this._updateStats('notFound', 'GET');
        return request;
    }

    /**
     * Creates mock request with unsupported HTTP method to test 405 Method Not Allowed error handling
     * 
     * @param {string} method - Unsupported HTTP method (POST, PUT, DELETE) for testing
     * @param {string} path - Request path (typically /hello) for method testing
     * @param {Object} options - Additional configuration for method not allowed testing
     * @returns {Object} MockHttpRequest configured to trigger 405 Method Not Allowed error
     */
    createMethodNotAllowedRequest(method = 'POST', path = '/hello', options = {}) {
        // Set specified unsupported HTTP method and path for method validation failure
        const config = {
            method: method.toUpperCase(),
            path: path,
            url: path,
            headers: {
                'content-type': method === 'POST' ? 'application/json' : 'text/plain',
                'user-agent': this.defaultConfig.userAgent,
                'host': this.defaultConfig.host
            },
            ...options
        };

        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            config.headers['content-length'] = '0';
        }

        // Return mock request that will trigger 405 error handling with Allow header
        const request = new MockHttpRequest(config);
        this._updateStats('methodNotAllowed', method.toUpperCase());
        return request;
    }

    /**
     * Creates mock request with malformed properties to test 400 Bad Request error handling and input validation
     * 
     * @param {string} malformationType - Type of malformation (invalidUrl, invalidHeaders, oversized)
     * @param {Object} options - Configuration for specific malformation scenario
     * @returns {Object} MockHttpRequest with malformed properties to trigger validation errors
     */
    createBadRequest(malformationType = 'invalidUrl', options = {}) {
        let config = { ...this.defaultConfig, ...options };

        // Apply appropriate malformation including invalid URLs or headers
        switch (malformationType) {
            case 'invalidUrl':
                config.path = '/hello with spaces';
                config.url = '/hello with spaces';
                break;
            
            case 'invalidHeaders':
                config.headers = {
                    'accept': 'text/plain',
                    'invalid-header': 'value with \n newline character'
                };
                break;
            
            case 'oversized':
                config.headers = {
                    'accept': 'text/plain',
                    'x-large-header': 'x'.repeat(9000)
                };
                break;
            
            default:
                config.path = '/invalid-path';
        }

        // Return mock request designed to trigger 400 Bad Request error
        const request = new MockHttpRequest(config);
        this._updateStats('badRequest', config.method || 'GET');
        return request;
    }

    /**
     * Creates array of mock requests configured for load testing and performance validation scenarios
     * 
     * @param {number} count - Number of mock requests to create for load testing
     * @param {Object} options - Load test configuration including request variation and timing
     * @returns {Array} Array of MockHttpRequest objects configured for concurrent load testing
     */
    createLoadTestRequests(count = 10, options = {}) {
        const requests = [];
        
        // Generate specified number of mock requests with load test configuration
        for (let i = 0; i < count; i++) {
            // Apply variation in request properties for realistic load simulation
            const config = {
                method: 'GET',
                path: '/hello',
                headers: {
                    'accept': 'text/plain',
                    'user-agent': `Load Test Client ${i + 1}`,
                    'x-request-id': `load-test-${i + 1}`,
                    'host': this.defaultConfig.host
                },
                connection: {
                    remoteAddress: this._generateRandomIP(),
                    remotePort: 10000 + i
                },
                ...options
            };

            // Configure timing and correlation IDs for load test tracking
            const request = new MockHttpRequest(config);
            requests.push(request);
        }

        // Update factory statistics
        this._updateStats('loadTest', 'GET', count);
        
        // Return array of mock requests ready for concurrent execution
        return requests;
    }

    /**
     * Generate random IP address for load testing variation
     * @private
     */
    _generateRandomIP() {
        return `127.0.0.${Math.floor(Math.random() * 255) + 1}`;
    }

    /**
     * Update factory statistics
     * @private
     */
    _updateStats(type, method, count = 1) {
        this.requestCounter.total += count;
        this.requestCounter.byType[type] = (this.requestCounter.byType[type] || 0) + count;
        this.requestCounter.byMethod[method] = (this.requestCounter.byMethod[method] || 0) + count;
    }

    /**
     * Returns factory statistics including number of requests created, types created, and performance metrics
     * 
     * @returns {Object} Factory statistics with request counts, types, and creation metrics
     */
    getRequestStats() {
        // Return comprehensive factory usage statistics for analysis
        return {
            totalRequests: this.requestCounter.total,
            requestsByType: { ...this.requestCounter.byType },
            requestsByMethod: { ...this.requestCounter.byMethod },
            factoryConfig: { ...this.defaultConfig },
            templatesAvailable: Array.from(this.requestTemplates.keys())
        };
    }
}

/**
 * Factory function to create realistic mock HTTP IncomingMessage objects with configurable properties
 * for comprehensive HTTP server testing including headers, method, URL, and body simulation
 * 
 * @param {Object} options - Mock request configuration including method, path, headers, body, and connection details
 * @returns {Object} Mock IncomingMessage object with HTTP request properties and event simulation capabilities
 */
function createMockRequest(options = {}) {
    // Create base mock object extending EventEmitter for realistic HTTP request event simulation
    const mockRequest = new MockHttpRequest(options);
    
    // Return mock request object ready for use in HTTP server component testing
    return mockRequest;
}

/**
 * Creates mock HTTP GET request specifically for /hello endpoint testing with proper headers 
 * and client information simulation
 * 
 * @param {Object} overrides - Optional configuration overrides for customizing hello request properties
 * @returns {Object} Mock request object configured for hello endpoint testing with realistic HTTP properties
 */
function createHelloRequest(overrides = {}) {
    // Load hello endpoint configuration from test data including path, method, and expected headers
    const helloConfig = validRequests.helloEndpoint;
    
    // Create base mock request using createMockRequest with hello-specific configuration
    const config = {
        method: 'GET',
        path: '/hello',
        url: helloConfig.url || 'http://localhost:3000/hello',
        headers: {
            ...helloConfig.headers,
            ...httpHeaders.standardRequestHeaders
        },
        // Set realistic User-Agent and connection details for client simulation
        connection: {
            remoteAddress: MOCK_CLIENT_IP,
            remotePort: 54321
        },
        // Apply any configuration overrides provided in options parameter
        ...overrides
    };

    // Return configured hello request mock ready for handler and routing testing
    return new MockHttpRequest(config);
}

/**
 * Creates mock HTTP request objects for testing error handling scenarios including 404, 405, 
 * and validation errors with configurable invalid properties
 * 
 * @param {string} errorType - Type of error to simulate (notFound, methodNotAllowed, badRequest, oversized)
 * @param {Object} options - Additional configuration for specific error scenario simulation
 * @returns {Object} Mock request object configured to trigger specific error conditions for error handling testing
 */
function createInvalidRequest(errorType = 'notFound', options = {}) {
    let config = { ...options };

    // Load invalid request configuration from test data based on specified error type
    switch (errorType) {
        case 'notFound':
            const notFoundConfig = invalidRequests.notFoundRequest;
            config = {
                method: notFoundConfig.method,
                path: notFoundConfig.path,
                headers: { ...notFoundConfig.headers },
                ...options
            };
            break;

        case 'methodNotAllowed':
            const methodConfig = invalidRequests.methodNotAllowed;
            config = {
                method: methodConfig.method,
                path: methodConfig.path,
                headers: { ...methodConfig.headers },
                body: methodConfig.body,
                ...options
            };
            break;

        case 'badRequest':
            const malformedConfig = invalidRequests.malformedRequest;
            config = {
                method: malformedConfig.method,
                path: malformedConfig.path,
                headers: { ...malformedConfig.headers },
                ...options
            };
            break;

        case 'oversized':
            const oversizedConfig = invalidRequests.oversizedRequest;
            config = {
                method: oversizedConfig.method,
                path: oversizedConfig.path,
                headers: { ...oversizedConfig.headers },
                ...options
            };
            break;

        default:
            config = {
                method: 'GET',
                path: '/nonexistent',
                headers: { 'accept': 'text/plain' },
                ...options
            };
    }

    // Return mock request configured to trigger specific error handling pathways
    return new MockHttpRequest(config);
}

/**
 * Creates mock HTTP request with request body simulation for testing POST, PUT requests 
 * and body processing scenarios
 * 
 * @param {string} method - HTTP method for request (POST, PUT, PATCH)
 * @param {string} path - Request URL path
 * @param {string} body - Request body content
 * @param {Object} options - Additional request configuration including headers and content type
 * @returns {Object} Mock request object with body simulation capabilities for comprehensive request testing
 */
function createRequestWithBody(method = 'POST', path = '/hello', body = '', options = {}) {
    // Set up request body properties including Content-Length and Content-Type headers
    const bodyBuffer = Buffer.from(body, 'utf8');
    const contentLength = bodyBuffer.length;

    // Create base mock request with specified method and path configuration
    const config = {
        method: method.toUpperCase(),
        path: path,
        url: path,
        headers: {
            'content-type': options.contentType || 'application/json',
            'content-length': contentLength.toString(),
            'host': DEFAULT_HOST,
            'user-agent': DEFAULT_USER_AGENT,
            'accept': 'application/json, text/plain',
            ...options.headers
        },
        body: body,
        connection: {
            remoteAddress: MOCK_CLIENT_IP,
            remotePort: Math.floor(Math.random() * 50000) + 10000
        },
        ...options
    };

    // Return mock request with complete body simulation for handler testing
    return new MockHttpRequest(config);
}

/**
 * Simulates HTTP request data flow including headers, body chunks, and completion events 
 * for realistic request processing testing
 * 
 * @param {Object} mockRequest - Mock request object to simulate data flow for
 * @param {string} data - Optional request body data to simulate
 * @param {number} delay - Optional delay in milliseconds between data chunks
 * @returns {Promise<void>} Promise resolving when request data simulation is complete
 */
async function simulateRequestData(mockRequest, data = null, delay = 10) {
    // Start request data simulation by emitting appropriate HTTP request events
    if (!mockRequest || typeof mockRequest.emit !== 'function') {
        throw new Error('Invalid mock request object provided');
    }

    try {
        // Simulate request body data chunks if body data is provided
        if (data) {
            await mockRequest.simulateData(data, { delay });
        }

        // Complete request simulation by emitting end event when all data is sent
        await mockRequest.simulateEnd();
        
        // Return promise that resolves when complete request simulation is finished
    } catch (error) {
        // Handle any simulation errors and emit appropriate error events
        mockRequest.simulateError(error);
        throw error;
    }
}

/**
 * Validates mock request objects to ensure they properly simulate Node.js IncomingMessage behavior 
 * and contain required properties for testing
 * 
 * @param {Object} mockRequest - Mock request object to validate for testing compatibility
 * @returns {Object} Validation result with isValid boolean and detailed validation information
 */
function validateMockRequest(mockRequest) {
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        properties: {}
    };

    // Check that mock request has all required IncomingMessage properties and methods
    const requiredProperties = ['method', 'url', 'headers', 'httpVersion', 'connection'];
    const requiredMethods = ['setHeader', 'getHeader', 'emit', 'on'];

    requiredProperties.forEach(prop => {
        if (mockRequest[prop] === undefined) {
            validation.errors.push(`Missing required property: ${prop}`);
            validation.isValid = false;
        } else {
            validation.properties[prop] = 'present';
        }
    });

    requiredMethods.forEach(method => {
        if (typeof mockRequest[method] !== 'function') {
            validation.errors.push(`Missing required method: ${method}`);
            validation.isValid = false;
        }
    });

    // Validate HTTP method is properly set and matches expected HTTP method format
    if (mockRequest.method && !/^[A-Z]+$/.test(mockRequest.method)) {
        validation.warnings.push('HTTP method should be uppercase');
    }

    // Verify URL and path properties are correctly formatted for routing testing
    if (mockRequest.url && !mockRequest.url.startsWith('/')) {
        validation.warnings.push('URL should start with forward slash');
    }

    // Validate headers object contains proper HTTP header format and values
    if (mockRequest.headers && typeof mockRequest.headers !== 'object') {
        validation.errors.push('Headers should be an object');
        validation.isValid = false;
    }

    // Check connection properties simulate realistic client connection information
    if (mockRequest.connection) {
        if (!mockRequest.connection.remoteAddress) {
            validation.warnings.push('Connection should have remoteAddress');
        }
    } else {
        validation.warnings.push('Missing connection object');
    }

    // Verify event emitter functionality is properly configured for request simulation
    if (!(mockRequest instanceof EventEmitter)) {
        validation.errors.push('Mock request should extend EventEmitter');
        validation.isValid = false;
    }

    // Return comprehensive validation result with pass/fail status and detailed feedback
    return validation;
}

/**
 * Generates unique correlation ID for mock requests to enable request tracking and debugging across test scenarios
 * 
 * @returns {string} Unique correlation ID with mock request prefix for test request tracking
 */
function generateCorrelationId() {
    // Generate timestamp component using high-resolution timer for uniqueness
    const timestamp = Date.now();
    const performanceNow = Math.floor(performance.now() * 1000);
    
    // Create random component using Math.random for additional uniqueness
    const random = Math.random().toString(36).substr(2, 9);
    
    // Combine timestamp and random components with mock request prefix
    // Format correlation ID according to correlation ID standards for consistency
    return `${CORRELATION_ID_PREFIX}${timestamp}-${performanceNow}-${random}`;
}

// Create default mock request factory instance configured with environment settings for immediate use in tests
const mockRequestFactory = new MockRequestFactory({
    host: DEFAULT_HOST,
    userAgent: DEFAULT_USER_AGENT,
    httpVersion: DEFAULT_HTTP_VERSION
});

// Export comprehensive mock request utilities and classes for testing integration
export {
    MockHttpRequest,
    MockRequestFactory,
    createMockRequest,
    createHelloRequest,
    createInvalidRequest,
    simulateRequestData,
    mockRequestFactory
};