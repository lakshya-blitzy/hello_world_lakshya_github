/**
 * Centralized Test Data Fixture File for Node.js Tutorial HTTP Server
 * 
 * This file contains comprehensive test scenarios, expected responses, performance thresholds,
 * and configuration data for testing the Node.js tutorial HTTP server application.
 * 
 * Educational Purpose: Demonstrates test data organization patterns, HTTP testing scenarios,
 * and comprehensive test coverage strategies for Node.js applications.
 * 
 * Features:
 * - Static test data configurations aligned with tutorial objectives
 * - Comprehensive HTTP request/response test scenarios
 * - Performance testing thresholds and baseline measurements
 * - Error handling test cases for robust testing
 * - Educational examples of test data structure and organization
 */

// Global constants for consistent test data
const HELLO_WORLD_CONTENT = 'Hello world';
const HELLO_WORLD_BYTE_LENGTH = 11;
const DEFAULT_TEST_TIMEOUT = 10000;
const PERFORMANCE_BASELINE_MS = 50;
const MAX_RESPONSE_TIME_MS = 100;

// Valid HTTP request configurations for successful testing scenarios
const validRequests = {
    // Primary hello endpoint test configuration
    helloEndpoint: {
        method: 'GET',
        path: '/hello',
        url: 'http://localhost:3000/hello',
        headers: {
            'Accept': 'text/plain',
            'User-Agent': 'Node.js Test Client/1.0.0',
            'Host': 'localhost:3000',
            'Connection': 'keep-alive'
        },
        query: {},
        body: null,
        timeout: 5000,
        description: 'Valid GET request to hello endpoint for successful response testing',
        expected_status: 200,
        expected_content_type: 'text/plain'
    },

    // Standard GET request configuration for hello endpoint
    helloGetRequest: {
        method: 'GET',
        path: '/hello',
        headers: {
            'Accept': 'text/plain, application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; Node.js Test)'
        },
        httpVersion: '1.1',
        connection: {
            remoteAddress: '127.0.0.1',
            remotePort: 12345
        },
        description: 'Standard GET request configuration for hello endpoint testing'
    },

    // Root endpoint test configuration for informational responses
    rootEndpoint: {
        method: 'GET',
        path: '/',
        headers: {
            'Accept': 'text/html,text/plain',
            'User-Agent': 'Node.js Test Client/1.0.0'
        },
        description: 'GET request to root endpoint for redirect or informational response testing'
    },

    // Health check endpoint for monitoring and status testing
    healthEndpoint: {
        method: 'GET',
        path: '/health',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Health Check Client'
        },
        description: 'Health check endpoint request for server status monitoring testing'
    }
};

// Invalid HTTP request configurations for error handling testing
const invalidRequests = {
    // 404 Not Found error scenario
    notFoundRequest: {
        method: 'GET',
        path: '/nonexistent',
        headers: {
            'Accept': 'text/plain',
            'User-Agent': 'Node.js Test Client/1.0.0'
        },
        description: 'GET request to non-existent endpoint for 404 error testing',
        expected_status: 404,
        expected_error: 'Not Found'
    },

    // 405 Method Not Allowed error scenario
    methodNotAllowed: {
        method: 'POST',
        path: '/hello',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': '20'
        },
        body: '{"message": "test"}',
        description: 'POST request to hello endpoint for 405 method not allowed testing',
        expected_status: 405,
        expected_error: 'Method Not Allowed'
    },

    // Malformed request for error handling testing
    malformedRequest: {
        method: 'GET',
        path: '/hello with spaces',
        headers: {
            'Invalid-Header': 'value with \n newline'
        },
        description: 'Malformed request with invalid URL and headers for error handling testing',
        expected_status: 400,
        expected_error: 'Bad Request'
    },

    // Oversized request for size limit testing
    oversizedRequest: {
        method: 'GET',
        path: '/hello',
        headers: {
            'Accept': 'text/plain',
            'X-Large-Header': 'x'.repeat(9000)
        },
        description: 'Request with oversized headers for request size limit testing',
        expected_status: 431,
        expected_error: 'Request Header Fields Too Large'
    }
};

// Expected HTTP response configurations for validation testing
const expectedResponses = {
    // Successful response for hello endpoint
    successResponse: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': '11',
            'Date': 'auto-generated',
            'Connection': 'keep-alive',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '0'
        },
        body: HELLO_WORLD_CONTENT,
        encoding: 'utf8',
        description: 'Expected response for successful GET request to /hello endpoint'
    },

    // 404 Not Found response configuration
    notFoundResponse: {
        statusCode: 404,
        statusMessage: 'Not Found',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': '9',
            'Date': 'auto-generated',
            'Connection': 'keep-alive',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        },
        body: 'Not Found',
        description: 'Expected response for requests to non-existent endpoints'
    },

    // 405 Method Not Allowed response configuration
    methodNotAllowedResponse: {
        statusCode: 405,
        statusMessage: 'Method Not Allowed',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': '18',
            'Allow': 'GET',
            'Date': 'auto-generated',
            'Connection': 'keep-alive',
            'X-Content-Type-Options': 'nosniff'
        },
        body: 'Method Not Allowed',
        description: 'Expected response for unsupported HTTP methods'
    },

    // 500 Internal Server Error response configuration
    serverErrorResponse: {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': '21',
            'Date': 'auto-generated',
            'Connection': 'close'
        },
        body: 'Internal Server Error',
        description: 'Expected response for internal server errors'
    }
};

// Performance testing thresholds and parameters
const performanceData = {
    // Response time performance thresholds in milliseconds
    responseTimeThresholds: {
        target: PERFORMANCE_BASELINE_MS,
        warning: 75,
        critical: MAX_RESPONSE_TIME_MS,
        unit: 'milliseconds',
        description: 'Response time performance thresholds for hello endpoint'
    },

    // Memory usage thresholds in bytes
    memoryUsageThresholds: {
        baseline: 20 * 1024 * 1024, // 20MB baseline
        warning: 50 * 1024 * 1024,  // 50MB warning threshold
        critical: 100 * 1024 * 1024, // 100MB critical threshold
        unit: 'bytes',
        description: 'Memory usage thresholds during request processing'
    },

    // Concurrency testing limits
    concurrencyLimits: {
        low_load: 10,
        medium_load: 50,
        high_load: 100,
        stress_load: 500,
        description: 'Concurrent request limits for different load testing scenarios'
    },

    // Load testing parameters
    loadTestingParameters: {
        duration: 30000, // 30 seconds
        warmup_period: 5000, // 5 seconds
        cooldown_period: 5000, // 5 seconds
        request_interval: 100, // 100ms between requests
        timeout: DEFAULT_TEST_TIMEOUT,
        description: 'Parameters for load testing and performance validation'
    }
};

// HTTP header configurations for request and response testing
const httpHeaders = {
    // Standard HTTP request headers
    standardRequestHeaders: {
        'Accept': 'text/plain',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Host': 'localhost:3000',
        'User-Agent': 'Node.js Test Client/1.0.0'
    },

    // Security response headers for testing
    securityResponseHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    },

    // Content-type specific headers
    contentHeaders: {
        text_plain: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Encoding': 'identity'
        },
        application_json: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Encoding': 'identity'
        }
    },

    // Custom test headers for debugging and tracing
    customTestHeaders: {
        'X-Test-Case': 'hello-endpoint-test',
        'X-Test-Environment': 'development',
        'X-Correlation-ID': 'test-correlation-id-12345'
    }
};

// Test environment configuration settings
const testConfiguration = {
    // HTTP server configuration for testing
    server: {
        host: '127.0.0.1',
        port: 0, // Use dynamic port allocation for testing
        timeout: DEFAULT_TEST_TIMEOUT,
        keepAliveTimeout: 5000,
        maxConnections: 100
    },

    // Test execution configuration
    testing: {
        timeout: DEFAULT_TEST_TIMEOUT,
        retries: 3,
        delay: 1000,
        parallel: false,
        verbose: true
    },

    // Test environment variables
    environment: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        TEST_PORT: 0, // Dynamic port allocation
        TEST_HOST: '127.0.0.1'
    },

    // Response validation configuration
    validation: {
        strict_headers: true,
        validate_content_length: true,
        validate_status_codes: true,
        validate_response_time: true
    }
};

// Endpoint definitions for comprehensive API testing
const endpoints = {
    // Hello endpoint configuration
    hello: {
        path: '/hello',
        methods: ['GET'],
        handler: 'helloHandler',
        response_type: 'text/plain',
        response_content: HELLO_WORLD_CONTENT,
        cache_control: 'no-cache'
    },

    // Health check endpoint configuration
    health: {
        path: '/health',
        methods: ['GET', 'HEAD'],
        handler: 'healthHandler',
        response_type: 'application/json',
        response_content: '{"status": "healthy", "timestamp": "auto-generated"}',
        cache_control: 'no-cache'
    },

    // 404 Not Found handler configuration
    notFound: {
        path: '*',
        methods: ['*'],
        handler: 'notFoundHandler',
        response_type: 'text/plain',
        response_content: 'Not Found',
        status_code: 404
    },

    // Root endpoint configuration
    root: {
        path: '/',
        methods: ['GET'],
        handler: 'rootHandler',
        response_type: 'text/plain',
        response_content: 'Node.js Tutorial Server - Visit /hello',
        cache_control: 'no-cache'
    }
};

// Main test data aggregation object for comprehensive testing support
const testData = {
    validRequests,
    invalidRequests,
    expectedResponses,
    performanceData,
    httpHeaders,
    testConfiguration,
    endpoints,
    constants: {
        HELLO_WORLD_CONTENT,
        HELLO_WORLD_BYTE_LENGTH,
        DEFAULT_TEST_TIMEOUT,
        PERFORMANCE_BASELINE_MS,
        MAX_RESPONSE_TIME_MS
    }
};

// Named exports for modular test data access
export {
    validRequests,
    invalidRequests,
    expectedResponses,
    performanceData,
    httpHeaders,
    testConfiguration,
    endpoints,
    testData
};

// Default export for comprehensive test data access
export default testData;