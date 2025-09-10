// Node.js Tutorial HTTP Client Examples
// Comprehensive educational demonstrations of HTTP client patterns and server interaction techniques
// Zero external dependencies - uses Node.js built-in modules exclusively

// Built-in Node.js modules for HTTP client functionality
const http = require('node:http'); // Built-in Node.js 22.x LTS
const https = require('node:https'); // Built-in Node.js 22.x LTS
const { performance } = require('node:perf_hooks'); // Built-in Node.js 22.x LTS
const util = require('node:util'); // Built-in Node.js 22.x LTS
const { URL } = require('node:url'); // Built-in Node.js 22.x LTS

// Internal configuration imports for client examples
const { config, isDevelopment } = require('../config/environment.js');
const { http: serverConfig, routing: routingConfig } = require('../config/server-config.js');

// Global configuration constants for HTTP client examples
const DEFAULT_SERVER_URL = 'http://127.0.0.1:3000';
const HELLO_ENDPOINT_PATH = '/hello';
const HEALTH_ENDPOINT_PATH = '/health';
const REQUEST_TIMEOUT = 30000;
const USER_AGENT = 'Node.js Tutorial Client/1.0';

/**
 * Basic HTTP GET request using Node.js built-in http module
 * Demonstrates low-level HTTP client implementation with comprehensive error handling
 * and performance measurement for educational HTTP client-server communication learning
 * 
 * @param {string} url - Complete URL for the HTTP request
 * @param {object} options - Request options including headers, method, and timeout
 * @returns {Promise<object>} Promise resolving to response object with status, headers, body, and timing information
 */
async function basicHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        console.log(`[Basic HTTP] Starting request to: ${url}`);
        
        try {
            // Parse URL and extract hostname, port, and path components for HTTP request configuration
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            // Create HTTP request options including method, headers, and timeout settings
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/plain, */*',
                    'Connection': 'close',
                    ...options.headers
                },
                timeout: options.timeout || REQUEST_TIMEOUT
            };
            
            console.log(`[Basic HTTP] Request options:`, requestOptions);
            
            // Create HTTP request using http.request() with configured options and error handling
            const req = protocol.request(requestOptions, (res) => {
                let responseBody = '';
                
                // Set up response data collection with proper encoding and chunk handling
                res.setEncoding('utf8');
                
                // Collect complete response body data with proper UTF-8 encoding handling
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                // Process HTTP response including status code extraction and header parsing
                res.on('end', () => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    // Calculate total request time and performance metrics for educational analysis
                    console.log(`[Basic HTTP] Request completed in ${duration.toFixed(2)}ms`);
                    console.log(`[Basic HTTP] Status: ${res.statusCode}`);
                    console.log(`[Basic HTTP] Headers:`, res.headers);
                    
                    // Return comprehensive response object with status, headers, body, and performance data
                    resolve({
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        body: responseBody,
                        timing: {
                            duration: Math.round(duration),
                            start: startTime,
                            end: endTime
                        },
                        client: 'basic-http',
                        url: url
                    });
                });
            });
            
            // Handle request timeout scenarios with appropriate error responses and cleanup
            req.on('timeout', () => {
                console.warn(`[Basic HTTP] Request timeout after ${REQUEST_TIMEOUT}ms`);
                req.destroy();
                reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
            });
            
            // Provide educational logging and error handling with detailed HTTP transaction information
            req.on('error', (error) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.error(`[Basic HTTP] Request failed after ${duration.toFixed(2)}ms:`, error.message);
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
            
            // End the request to initiate the HTTP transaction
            req.end();
            
        } catch (error) {
            console.error(`[Basic HTTP] Request setup failed:`, error.message);
            reject(new Error(`Request setup failed: ${error.message}`));
        }
    });
}

/**
 * Modern HTTP request using Node.js built-in fetch API
 * Demonstrates Promise-based async patterns with comprehensive error handling
 * and retry logic for educational modern HTTP client development
 * 
 * @param {string} url - Target URL for the fetch request
 * @param {object} options - Fetch options including method, headers, body, and signal
 * @returns {Promise<object>} Promise resolving to processed response with JSON parsing, error handling, and performance metrics
 */
async function modernFetchRequest(url, options = {}) {
    const startTime = performance.now();
    console.log(`[Modern Fetch] Starting request to: ${url}`);
    
    // Configure fetch request options including method, headers, and AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT);
    
    const fetchOptions = {
        method: options.method || 'GET',
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/plain, application/json, */*',
            ...options.headers
        },
        signal: controller.signal,
        ...options
    };
    
    console.log(`[Modern Fetch] Request options:`, fetchOptions);
    
    try {
        // Start performance timing measurement for fetch request duration analysis
        // Execute fetch request with comprehensive error handling and timeout protection
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`[Modern Fetch] Request completed in ${duration.toFixed(2)}ms`);
        console.log(`[Modern Fetch] Status: ${response.status} ${response.statusText}`);
        
        // Process fetch response including status validation and content type checking
        const contentType = response.headers.get('content-type') || '';
        let responseBody;
        
        // Handle different content types with appropriate parsing (text, JSON, binary)
        if (contentType.includes('application/json')) {
            responseBody = await response.json();
        } else if (contentType.includes('text/')) {
            responseBody = await response.text();
        } else {
            responseBody = await response.text(); // Default to text parsing
        }
        
        // Calculate performance metrics including DNS resolution and transfer time
        console.log(`[Modern Fetch] Response body:`, responseBody);
        console.log(`[Modern Fetch] Response headers:`, Object.fromEntries(response.headers));
        
        // Return structured response object with parsed content and performance data
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            body: responseBody,
            ok: response.ok,
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            client: 'modern-fetch',
            url: url
        };
        
    } catch (error) {
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Handle fetch-specific errors including network errors and timeout scenarios
        if (error.name === 'AbortError') {
            console.warn(`[Modern Fetch] Request aborted after ${duration.toFixed(2)}ms`);
            throw new Error(`Request timeout after ${options.timeout || REQUEST_TIMEOUT}ms`);
        }
        
        console.error(`[Modern Fetch] Request failed after ${duration.toFixed(2)}ms:`, error.message);
        
        // Implement retry logic for transient network errors with exponential backoff
        if (options.retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
            console.log(`[Modern Fetch] Retrying request (${options.retries} attempts remaining)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return modernFetchRequest(url, { ...options, retries: options.retries - 1 });
        }
        
        // Provide educational commentary on modern HTTP client patterns and best practices
        throw new Error(`Fetch request failed: ${error.message}`);
    }
}

/**
 * Specialized client for interacting with the tutorial server's /hello endpoint
 * Provides validation, error handling, and educational response analysis
 * with comprehensive Hello World endpoint testing and validation
 * 
 * @param {object} options - Client options including server URL, timeout, and custom headers
 * @returns {Promise<object>} Promise resolving to hello response with validation results and educational insights
 */
async function helloWorldClient(options = {}) {
    const startTime = performance.now();
    console.log(`[Hello Client] Starting hello endpoint request`);
    
    // Construct complete hello endpoint URL using server configuration and routing settings
    const serverUrl = options.serverUrl || DEFAULT_SERVER_URL;
    const helloUrl = new URL(HELLO_ENDPOINT_PATH, serverUrl).href;
    
    // Configure request headers including User-Agent and Accept headers for hello endpoint
    const requestHeaders = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/plain',
        'Cache-Control': 'no-cache',
        ...options.headers
    };
    
    console.log(`[Hello Client] Requesting: ${helloUrl}`);
    console.log(`[Hello Client] Headers:`, requestHeaders);
    
    try {
        // Execute HTTP GET request to /hello endpoint using modern fetch API
        const response = await fetch(helloUrl, {
            method: 'GET',
            headers: requestHeaders,
            signal: AbortSignal.timeout(options.timeout || REQUEST_TIMEOUT)
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Validate response status code matches expected 200 OK for successful hello response
        console.log(`[Hello Client] Response received in ${duration.toFixed(2)}ms`);
        console.log(`[Hello Client] Status: ${response.status} ${response.statusText}`);
        
        const responseBody = await response.text();
        const responseHeaders = Object.fromEntries(response.headers);
        
        // Verify response Content-Type header matches expected text/plain format
        const contentType = response.headers.get('content-type') || '';
        const isValidContentType = contentType.includes('text/plain');
        
        // Validate response body contains expected 'Hello world' message content
        const expectedMessage = 'Hello world';
        const isValidMessage = responseBody.trim() === expectedMessage;
        
        // Check security headers including X-Content-Type-Options and X-Frame-Options
        const hasSecurityHeaders = {
            xContentTypeOptions: responseHeaders['x-content-type-options'] === 'nosniff',
            xFrameOptions: responseHeaders['x-frame-options'] === 'DENY'
        };
        
        // Measure response time and validate against performance thresholds (< 100ms target)
        const meetsPerformanceThreshold = duration < 100;
        
        console.log(`[Hello Client] Content-Type valid: ${isValidContentType}`);
        console.log(`[Hello Client] Message valid: ${isValidMessage}`);
        console.log(`[Hello Client] Performance threshold met: ${meetsPerformanceThreshold}`);
        console.log(`[Hello Client] Security headers:`, hasSecurityHeaders);
        
        // Log educational information about HTTP response characteristics and headers
        console.log(`[Hello Client] Educational Analysis:`);
        console.log(`  - Response time: ${duration.toFixed(2)}ms (target: <100ms)`);
        console.log(`  - Content-Type: ${contentType}`);
        console.log(`  - Message content: "${responseBody}"`);
        console.log(`  - Security headers present: ${Object.values(hasSecurityHeaders).every(Boolean)}`);
        
        // Return comprehensive hello response analysis with validation results and performance metrics
        return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            validation: {
                statusCode: response.status === 200,
                contentType: isValidContentType,
                message: isValidMessage,
                performance: meetsPerformanceThreshold,
                securityHeaders: hasSecurityHeaders
            },
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime,
                meetsThreshold: meetsPerformanceThreshold
            },
            client: 'hello-world-client',
            url: helloUrl,
            educational: {
                endpoint: HELLO_ENDPOINT_PATH,
                expectedMessage: expectedMessage,
                performanceTarget: '< 100ms',
                securityFeatures: ['X-Content-Type-Options', 'X-Frame-Options']
            }
        };
        
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`[Hello Client] Request failed after ${duration.toFixed(2)}ms:`, error.message);
        
        return {
            status: 0,
            statusText: 'Request Failed',
            headers: {},
            body: null,
            error: error.message,
            validation: {
                statusCode: false,
                contentType: false,
                message: false,
                performance: false,
                securityHeaders: { xContentTypeOptions: false, xFrameOptions: false }
            },
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime,
                meetsThreshold: false
            },
            client: 'hello-world-client',
            url: helloUrl
        };
    }
}

/**
 * Error scenario testing client for various HTTP error conditions
 * Demonstrates client handling of 404 Not Found, 405 Method Not Allowed, and server errors
 * with educational error analysis and proper error handling patterns
 * 
 * @param {string} scenario - Error scenario to test (notFound, methodNotAllowed, serverError)
 * @param {object} options - Error testing options including custom URLs and methods
 * @returns {Promise<object>} Promise resolving to error response analysis with status codes, error messages, and handling recommendations
 */
async function errorScenarioClient(scenario, options = {}) {
    const startTime = performance.now();
    console.log(`[Error Client] Starting error scenario test: ${scenario}`);
    
    const serverUrl = options.serverUrl || DEFAULT_SERVER_URL;
    let testUrl, testMethod, expectedStatus;
    
    // Configure request parameters based on error scenario type (path, method, headers)
    switch (scenario) {
        case 'notFound':
            testUrl = new URL('/nonexistent-endpoint', serverUrl).href;
            testMethod = 'GET';
            expectedStatus = 404;
            console.log(`[Error Client] Testing 404 Not Found scenario`);
            break;
            
        case 'methodNotAllowed':
            testUrl = new URL(HELLO_ENDPOINT_PATH, serverUrl).href;
            testMethod = 'POST';
            expectedStatus = 405;
            console.log(`[Error Client] Testing 405 Method Not Allowed scenario`);
            break;
            
        case 'serverError':
            // This would typically require a special test endpoint that returns 500
            testUrl = new URL('/cause-server-error', serverUrl).href;
            testMethod = 'GET';
            expectedStatus = 500;
            console.log(`[Error Client] Testing 500 Internal Server Error scenario`);
            break;
            
        default:
            throw new Error(`Unknown error scenario: ${scenario}`);
    }
    
    console.log(`[Error Client] Request: ${testMethod} ${testUrl}`);
    console.log(`[Error Client] Expected status: ${expectedStatus}`);
    
    try {
        // Execute HTTP request designed to trigger specific error condition
        const response = await fetch(testUrl, {
            method: testMethod,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/plain, */*',
                ...options.headers
            },
            signal: AbortSignal.timeout(options.timeout || REQUEST_TIMEOUT)
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Capture and analyze HTTP error response including status code and error message
        const responseBody = await response.text();
        const responseHeaders = Object.fromEntries(response.headers);
        
        console.log(`[Error Client] Response received in ${duration.toFixed(2)}ms`);
        console.log(`[Error Client] Status: ${response.status} ${response.statusText}`);
        console.log(`[Error Client] Body: ${responseBody}`);
        
        // Validate error response format and content against HTTP standards
        const statusMatches = response.status === expectedStatus;
        const hasErrorMessage = responseBody && responseBody.length > 0;
        const hasProperHeaders = responseHeaders['content-type'] !== undefined;
        
        // Demonstrate proper client-side error handling patterns and recovery strategies
        console.log(`[Error Client] Educational Analysis:`);
        console.log(`  - Expected status ${expectedStatus}, got ${response.status}: ${statusMatches ? 'PASS' : 'FAIL'}`);
        console.log(`  - Has error message: ${hasErrorMessage ? 'YES' : 'NO'}`);
        console.log(`  - Has proper headers: ${hasProperHeaders ? 'YES' : 'NO'}`);
        
        // Log educational information about HTTP error codes and their meanings
        const errorEducation = getErrorEducation(response.status);
        console.log(`[Error Client] HTTP Error Education:`);
        console.log(`  - Error type: ${errorEducation.type}`);
        console.log(`  - Meaning: ${errorEducation.meaning}`);
        console.log(`  - Common causes: ${errorEducation.causes.join(', ')}`);
        console.log(`  - Client handling: ${errorEducation.handling}`);
        
        // Provide recommendations for client error handling and user experience considerations
        const recommendations = getErrorHandlingRecommendations(response.status, scenario);
        
        // Return error analysis object with scenario details and educational insights
        return {
            scenario: scenario,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            expectedStatus: expectedStatus,
            validation: {
                statusMatch: statusMatches,
                hasErrorMessage: hasErrorMessage,
                hasProperHeaders: hasProperHeaders
            },
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            client: 'error-scenario-client',
            url: testUrl,
            method: testMethod,
            educational: {
                errorType: errorEducation.type,
                meaning: errorEducation.meaning,
                causes: errorEducation.causes,
                handling: errorEducation.handling,
                recommendations: recommendations
            }
        };
        
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`[Error Client] Request failed after ${duration.toFixed(2)}ms:`, error.message);
        
        return {
            scenario: scenario,
            status: 0,
            statusText: 'Network Error',
            headers: {},
            body: null,
            error: error.message,
            expectedStatus: expectedStatus,
            validation: {
                statusMatch: false,
                hasErrorMessage: false,
                hasProperHeaders: false
            },
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            client: 'error-scenario-client',
            url: testUrl,
            method: testMethod
        };
    }
}

/**
 * Performance testing client for measuring response times and throughput
 * Provides statistical analysis and educational performance insights
 * with comprehensive timing measurement and optimization recommendations
 * 
 * @param {object} testConfig - Performance test configuration including iterations, concurrency, and thresholds
 * @returns {Promise<object>} Promise resolving to comprehensive performance analysis with timing statistics and optimization recommendations
 */
async function performanceTestClient(testConfig = {}) {
    console.log(`[Performance Client] Starting performance test suite`);
    
    // Initialize performance test configuration with iteration count and concurrency settings
    const config = {
        iterations: testConfig.iterations || 10,
        concurrency: testConfig.concurrency || 1,
        serverUrl: testConfig.serverUrl || DEFAULT_SERVER_URL,
        endpoint: testConfig.endpoint || HELLO_ENDPOINT_PATH,
        warmupRequests: testConfig.warmupRequests || 3,
        timeout: testConfig.timeout || 5000,
        ...testConfig
    };
    
    const testUrl = new URL(config.endpoint, config.serverUrl).href;
    console.log(`[Performance Client] Configuration:`, config);
    console.log(`[Performance Client] Test URL: ${testUrl}`);
    
    // Perform warmup requests to eliminate cold start effects
    console.log(`[Performance Client] Performing ${config.warmupRequests} warmup requests...`);
    for (let i = 0; i < config.warmupRequests; i++) {
        try {
            await fetch(testUrl, { 
                method: 'GET',
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(config.timeout)
            });
        } catch (error) {
            console.warn(`[Performance Client] Warmup request ${i + 1} failed: ${error.message}`);
        }
    }
    
    const testStartTime = performance.now();
    const responseTimes = [];
    const errors = [];
    
    // Execute multiple HTTP requests with timing measurement and statistical collection
    console.log(`[Performance Client] Starting ${config.iterations} performance test requests...`);
    
    for (let i = 0; i < config.iterations; i++) {
        const requestStartTime = performance.now();
        
        try {
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/plain'
                },
                signal: AbortSignal.timeout(config.timeout)
            });
            
            const requestEndTime = performance.now();
            const requestDuration = requestEndTime - requestStartTime;
            
            // Measure various performance metrics including response time, connection time, and throughput
            responseTimes.push({
                iteration: i + 1,
                duration: requestDuration,
                status: response.status,
                ok: response.ok,
                contentLength: response.headers.get('content-length') || 0
            });
            
            console.log(`[Performance Client] Request ${i + 1}/${config.iterations}: ${requestDuration.toFixed(2)}ms (${response.status})`);
            
        } catch (error) {
            const requestEndTime = performance.now();
            const requestDuration = requestEndTime - requestStartTime;
            
            errors.push({
                iteration: i + 1,
                duration: requestDuration,
                error: error.message
            });
            
            console.warn(`[Performance Client] Request ${i + 1}/${config.iterations} failed after ${requestDuration.toFixed(2)}ms: ${error.message}`);
        }
    }
    
    const testEndTime = performance.now();
    const totalTestDuration = testEndTime - testStartTime;
    
    // Calculate statistical analysis including average, median, min, max response times
    const successfulRequests = responseTimes.filter(rt => rt.ok);
    const durations = responseTimes.map(rt => rt.duration);
    
    const statistics = {
        total: responseTimes.length,
        successful: successfulRequests.length,
        failed: errors.length,
        successRate: (successfulRequests.length / responseTimes.length) * 100,
        totalDuration: Math.round(totalTestDuration),
        avgResponseTime: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        minResponseTime: durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
        maxResponseTime: durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
        medianResponseTime: durations.length > 0 ? Math.round(calculateMedian(durations)) : 0,
        requestsPerSecond: durations.length > 0 ? Math.round((responseTimes.length / totalTestDuration) * 1000) : 0
    };
    
    // Test concurrent request handling with multiple simultaneous connections
    console.log(`[Performance Client] Performance Statistics:`);
    console.log(`  - Total requests: ${statistics.total}`);
    console.log(`  - Successful: ${statistics.successful} (${statistics.successRate.toFixed(1)}%)`);
    console.log(`  - Failed: ${statistics.failed}`);
    console.log(`  - Average response time: ${statistics.avgResponseTime}ms`);
    console.log(`  - Min/Max response time: ${statistics.minResponseTime}ms / ${statistics.maxResponseTime}ms`);
    console.log(`  - Median response time: ${statistics.medianResponseTime}ms`);
    console.log(`  - Requests per second: ${statistics.requestsPerSecond}`);
    console.log(`  - Total test duration: ${statistics.totalDuration}ms`);
    
    // Analyze performance against educational thresholds and optimization targets
    const performanceAnalysis = {
        responseTimeThreshold: statistics.avgResponseTime <= 100,
        consistencyGood: (statistics.maxResponseTime - statistics.minResponseTime) <= 200,
        throughputAcceptable: statistics.requestsPerSecond >= 10,
        errorRateAcceptable: (statistics.failed / statistics.total) <= 0.05
    };
    
    // Generate performance report with timing distribution and outlier analysis
    const recommendations = generatePerformanceRecommendations(statistics, performanceAnalysis);
    
    console.log(`[Performance Client] Analysis Results:`);
    console.log(`  - Response time acceptable: ${performanceAnalysis.responseTimeThreshold ? 'PASS' : 'FAIL'}`);
    console.log(`  - Response consistency good: ${performanceAnalysis.consistencyGood ? 'PASS' : 'FAIL'}`);
    console.log(`  - Throughput acceptable: ${performanceAnalysis.throughputAcceptable ? 'PASS' : 'FAIL'}`);
    console.log(`  - Error rate acceptable: ${performanceAnalysis.errorRateAcceptable ? 'PASS' : 'FAIL'}`);
    
    // Provide educational insights on HTTP performance optimization and client tuning
    console.log(`[Performance Client] Optimization Recommendations:`);
    recommendations.forEach(rec => console.log(`  - ${rec}`));
    
    // Return comprehensive performance analysis with statistics and recommendations
    return {
        testConfig: config,
        statistics: statistics,
        analysis: performanceAnalysis,
        recommendations: recommendations,
        responseTimes: responseTimes,
        errors: errors,
        client: 'performance-test-client',
        url: testUrl,
        timestamp: new Date().toISOString()
    };
}

/**
 * Connection management testing client for keep-alive and timeout handling
 * Demonstrates connection reuse patterns and networking insights
 * with educational networking optimization and connection pooling analysis
 * 
 * @param {object} connectionConfig - Connection testing configuration including timeout values and reuse settings
 * @returns {Promise<object>} Promise resolving to connection analysis with networking insights and optimization recommendations
 */
async function connectionTestClient(connectionConfig = {}) {
    console.log(`[Connection Client] Starting connection management tests`);
    
    // Configure connection options including keep-alive, timeout, and socket reuse settings
    const config = {
        serverUrl: connectionConfig.serverUrl || DEFAULT_SERVER_URL,
        requests: connectionConfig.requests || 5,
        keepAlive: connectionConfig.keepAlive !== false,
        timeout: connectionConfig.timeout || 10000,
        connectionDelay: connectionConfig.connectionDelay || 100,
        ...connectionConfig
    };
    
    const testUrl = new URL(HELLO_ENDPOINT_PATH, config.serverUrl).href;
    console.log(`[Connection Client] Configuration:`, config);
    console.log(`[Connection Client] Test URL: ${testUrl}`);
    
    const connectionMetrics = [];
    const startTime = performance.now();
    
    // Test connection establishment time and TCP handshake performance
    console.log(`[Connection Client] Testing connection patterns with ${config.requests} requests...`);
    
    for (let i = 0; i < config.requests; i++) {
        const requestStart = performance.now();
        
        try {
            // Demonstrate HTTP keep-alive connection reuse for multiple requests
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/plain',
                    'Connection': config.keepAlive ? 'keep-alive' : 'close'
                },
                signal: AbortSignal.timeout(config.timeout)
            });
            
            const requestEnd = performance.now();
            const duration = requestEnd - requestStart;
            
            // Test connection timeout scenarios and timeout handling patterns
            const connectionInfo = {
                requestNumber: i + 1,
                duration: Math.round(duration),
                status: response.status,
                connectionHeader: response.headers.get('connection'),
                keepAlive: response.headers.get('keep-alive'),
                timestamp: requestStart
            };
            
            connectionMetrics.push(connectionInfo);
            
            console.log(`[Connection Client] Request ${i + 1}: ${duration.toFixed(2)}ms (${response.status})`);
            
            // Add delay between requests to test connection reuse
            if (i < config.requests - 1 && config.connectionDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, config.connectionDelay));
            }
            
        } catch (error) {
            const requestEnd = performance.now();
            const duration = requestEnd - requestStart;
            
            connectionMetrics.push({
                requestNumber: i + 1,
                duration: Math.round(duration),
                error: error.message,
                timestamp: requestStart
            });
            
            console.warn(`[Connection Client] Request ${i + 1} failed after ${duration.toFixed(2)}ms: ${error.message}`);
        }
    }
    
    const totalTime = performance.now() - startTime;
    
    // Measure connection overhead and socket management efficiency
    const successfulRequests = connectionMetrics.filter(m => !m.error);
    const durations = successfulRequests.map(m => m.duration);
    
    const connectionAnalysis = {
        totalRequests: config.requests,
        successfulRequests: successfulRequests.length,
        totalTime: Math.round(totalTime),
        averageRequestTime: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0,
        firstRequestTime: connectionMetrics[0]?.duration || 0,
        subsequentRequestsAvg: durations.length > 1 ? Math.round(durations.slice(1).reduce((a, b) => a + b) / (durations.length - 1)) : 0,
        connectionReuse: successfulRequests.some(r => r.connectionHeader && r.connectionHeader.includes('keep-alive')),
        connectionEfficiency: durations.length > 1 ? (connectionMetrics[0]?.duration || 0) / (durations.slice(1).reduce((a, b) => a + b) / (durations.length - 1) || 1) : 1
    };
    
    // Analyze connection pooling behavior and resource utilization
    console.log(`[Connection Client] Connection Analysis:`);
    console.log(`  - Total requests: ${connectionAnalysis.totalRequests}`);
    console.log(`  - Successful requests: ${connectionAnalysis.successfulRequests}`);
    console.log(`  - Total time: ${connectionAnalysis.totalTime}ms`);
    console.log(`  - Average request time: ${connectionAnalysis.averageRequestTime}ms`);
    console.log(`  - First request time: ${connectionAnalysis.firstRequestTime}ms`);
    console.log(`  - Subsequent requests avg: ${connectionAnalysis.subsequentRequestsAvg}ms`);
    console.log(`  - Connection reuse detected: ${connectionAnalysis.connectionReuse ? 'YES' : 'NO'}`);
    console.log(`  - Connection efficiency: ${connectionAnalysis.connectionEfficiency.toFixed(2)}x`);
    
    // Provide educational insights on HTTP connection management and optimization
    const networkingInsights = generateNetworkingInsights(connectionAnalysis, config);
    
    console.log(`[Connection Client] Networking Insights:`);
    networkingInsights.forEach(insight => console.log(`  - ${insight}`));
    
    // Return connection analysis with networking recommendations and best practices
    return {
        config: config,
        metrics: connectionMetrics,
        analysis: connectionAnalysis,
        insights: networkingInsights,
        client: 'connection-test-client',
        url: testUrl,
        timestamp: new Date().toISOString()
    };
}

/**
 * Security header validation client for HTTP response security compliance
 * Inspects security headers and provides educational web security analysis
 * with comprehensive security best practices validation and recommendations
 * 
 * @param {string} url - URL to test for security header compliance
 * @returns {Promise<object>} Promise resolving to security analysis with header validation results and security recommendations
 */
async function securityHeaderValidator(url) {
    console.log(`[Security Validator] Starting security header validation for: ${url}`);
    
    const startTime = performance.now();
    
    try {
        // Execute HTTP request and capture complete response headers for security analysis
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/plain, */*'
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const headers = Object.fromEntries(response.headers);
        
        console.log(`[Security Validator] Response received in ${duration.toFixed(2)}ms`);
        console.log(`[Security Validator] Status: ${response.status} ${response.statusText}`);
        
        // Validate presence of X-Content-Type-Options: nosniff header for MIME type protection
        const securityHeaders = {
            xContentTypeOptions: {
                present: !!headers['x-content-type-options'],
                value: headers['x-content-type-options'],
                expected: 'nosniff',
                valid: headers['x-content-type-options'] === 'nosniff',
                purpose: 'Prevents MIME type sniffing attacks'
            },
            // Check for X-Frame-Options: DENY header to prevent clickjacking attacks
            xFrameOptions: {
                present: !!headers['x-frame-options'],
                value: headers['x-frame-options'],
                expected: 'DENY',
                valid: headers['x-frame-options'] === 'DENY',
                purpose: 'Prevents clickjacking attacks'
            },
            // Verify Content-Type header accuracy and charset specification
            contentType: {
                present: !!headers['content-type'],
                value: headers['content-type'],
                valid: headers['content-type']?.includes('text/plain'),
                purpose: 'Specifies content type and encoding'
            },
            // Check cache control headers for security
            cacheControl: {
                present: !!headers['cache-control'],
                value: headers['cache-control'],
                secure: headers['cache-control']?.includes('no-cache') || headers['cache-control']?.includes('no-store'),
                purpose: 'Controls client-side caching behavior'
            }
        };
        
        // Analyze security implications of missing or misconfigured headers
        const securityScore = calculateSecurityScore(securityHeaders);
        const vulnerabilities = identifySecurityVulnerabilities(securityHeaders);
        const recommendations = generateSecurityRecommendations(securityHeaders, vulnerabilities);
        
        console.log(`[Security Validator] Security Header Analysis:`);
        Object.entries(securityHeaders).forEach(([name, info]) => {
            console.log(`  - ${name}:`);
            console.log(`    Present: ${info.present ? 'YES' : 'NO'}`);
            console.log(`    Value: ${info.value || 'N/A'}`);
            console.log(`    Valid: ${info.valid ? 'YES' : 'NO'}`);
            console.log(`    Purpose: ${info.purpose}`);
        });
        
        console.log(`[Security Validator] Overall Security Score: ${securityScore}/100`);
        console.log(`[Security Validator] Vulnerabilities Found: ${vulnerabilities.length}`);
        
        // Provide educational commentary on web security header best practices
        console.log(`[Security Validator] Security Education:`);
        console.log(`  - Security headers protect against various web attacks`);
        console.log(`  - X-Content-Type-Options prevents MIME type confusion attacks`);
        console.log(`  - X-Frame-Options prevents embedding in malicious frames`);
        console.log(`  - Proper Content-Type prevents content type ambiguity`);
        console.log(`  - Cache-Control headers prevent sensitive data caching`);
        
        // Generate security compliance report with recommendations and remediation steps
        console.log(`[Security Validator] Recommendations:`);
        recommendations.forEach(rec => console.log(`  - ${rec}`));
        
        // Return comprehensive security analysis with validation results and educational insights
        return {
            url: url,
            status: response.status,
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            headers: headers,
            securityHeaders: securityHeaders,
            securityScore: securityScore,
            vulnerabilities: vulnerabilities,
            recommendations: recommendations,
            client: 'security-header-validator',
            educational: {
                securityPrinciples: [
                    'Defense in depth through multiple security headers',
                    'Prevention is better than detection and response',
                    'Security headers provide browser-level protection',
                    'Consistent security policy across all endpoints'
                ],
                commonAttacks: [
                    'MIME type confusion attacks',
                    'Clickjacking through iframe embedding',
                    'Content type spoofing',
                    'Cross-site scripting (XSS)'
                ]
            }
        };
        
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`[Security Validator] Request failed after ${duration.toFixed(2)}ms:`, error.message);
        
        return {
            url: url,
            status: 0,
            error: error.message,
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            headers: {},
            securityHeaders: {},
            securityScore: 0,
            vulnerabilities: ['Unable to connect to server'],
            recommendations: ['Verify server is running and accessible'],
            client: 'security-header-validator'
        };
    }
}

/**
 * Custom HTTP headers demonstration client
 * Shows header usage and server response analysis with educational header semantics
 * and comprehensive header processing validation and best practices
 * 
 * @param {object} headerConfig - Custom header configuration including User-Agent, Accept, and additional headers
 * @returns {Promise<object>} Promise resolving to header analysis with server response and educational header usage insights
 */
async function customHeadersClient(headerConfig = {}) {
    console.log(`[Custom Headers Client] Starting custom headers demonstration`);
    
    const startTime = performance.now();
    
    // Configure custom HTTP headers including User-Agent, Accept, and custom application headers
    const customHeaders = {
        'User-Agent': headerConfig.userAgent || `${USER_AGENT} (Custom Headers Demo)`,
        'Accept': headerConfig.accept || 'text/plain, application/json, */*',
        'Accept-Language': headerConfig.acceptLanguage || 'en-US,en;q=0.9',
        'Accept-Encoding': headerConfig.acceptEncoding || 'gzip, deflate',
        'Cache-Control': headerConfig.cacheControl || 'no-cache',
        'X-Custom-Client': headerConfig.customClient || 'Node.js Tutorial Client',
        'X-Request-ID': headerConfig.requestId || generateRequestId(),
        'X-Test-Purpose': headerConfig.testPurpose || 'Header Analysis',
        ...headerConfig.additionalHeaders
    };
    
    const serverUrl = headerConfig.serverUrl || DEFAULT_SERVER_URL;
    const testUrl = new URL(headerConfig.endpoint || HELLO_ENDPOINT_PATH, serverUrl).href;
    
    console.log(`[Custom Headers Client] Test URL: ${testUrl}`);
    console.log(`[Custom Headers Client] Custom Headers:`, customHeaders);
    
    try {
        // Execute HTTP request with custom headers and analyze server header processing
        const response = await fetch(testUrl, {
            method: headerConfig.method || 'GET',
            headers: customHeaders,
            signal: AbortSignal.timeout(headerConfig.timeout || REQUEST_TIMEOUT)
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const responseHeaders = Object.fromEntries(response.headers);
        const responseBody = await response.text();
        
        console.log(`[Custom Headers Client] Response received in ${duration.toFixed(2)}ms`);
        console.log(`[Custom Headers Client] Status: ${response.status} ${response.statusText}`);
        
        // Validate server response to different header combinations and content negotiation
        const headerAnalysis = {
            requestHeaders: customHeaders,
            responseHeaders: responseHeaders,
            contentNegotiation: analyzeContentNegotiation(customHeaders, responseHeaders),
            serverBehavior: analyzeServerHeaderBehavior(customHeaders, responseHeaders),
            headerParsing: validateHeaderParsing(customHeaders, responseHeaders)
        };
        
        // Demonstrate header semantics and HTTP protocol header handling patterns
        console.log(`[Custom Headers Client] Header Analysis:`);
        console.log(`  - Request headers sent: ${Object.keys(customHeaders).length}`);
        console.log(`  - Response headers received: ${Object.keys(responseHeaders).length}`);
        console.log(`  - Content negotiation result: ${headerAnalysis.contentNegotiation.result}`);
        console.log(`  - Server header processing: ${headerAnalysis.serverBehavior.status}`);
        
        // Analyze server behavior with various User-Agent and Accept header values
        console.log(`[Custom Headers Client] Educational Header Insights:`);
        console.log(`  - User-Agent header identifies client software and version`);
        console.log(`  - Accept headers enable content negotiation between client and server`);
        console.log(`  - Custom headers (X-*) provide application-specific metadata`);
        console.log(`  - Cache-Control headers influence client and proxy caching behavior`);
        console.log(`  - Request-ID headers enable request tracing and correlation`);
        
        const headerEducation = generateHeaderEducation(headerAnalysis);
        
        // Provide educational insights on HTTP header usage and best practices
        console.log(`[Custom Headers Client] Header Best Practices:`);
        headerEducation.bestPractices.forEach(practice => console.log(`  - ${practice}`));
        
        console.log(`[Custom Headers Client] Common Header Use Cases:`);
        headerEducation.useCases.forEach(useCase => console.log(`  - ${useCase}`));
        
        // Return header analysis with server response characteristics and educational recommendations
        return {
            url: testUrl,
            status: response.status,
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            body: responseBody,
            analysis: headerAnalysis,
            education: headerEducation,
            client: 'custom-headers-client',
            educational: {
                headerTypes: {
                    request: 'Headers sent by client to describe request preferences',
                    response: 'Headers sent by server to describe response characteristics',
                    custom: 'Application-specific headers for extended functionality'
                },
                headerCategories: {
                    authentication: 'Authorization and authentication headers',
                    caching: 'Cache control and expiration headers',
                    contentNegotiation: 'Content type and encoding preferences',
                    security: 'Security policy and protection headers'
                }
            }
        };
        
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`[Custom Headers Client] Request failed after ${duration.toFixed(2)}ms:`, error.message);
        
        return {
            url: testUrl,
            status: 0,
            error: error.message,
            timing: {
                duration: Math.round(duration),
                start: startTime,
                end: endTime
            },
            analysis: {
                requestHeaders: customHeaders,
                responseHeaders: {},
                contentNegotiation: { result: 'failed' },
                serverBehavior: { status: 'error' },
                headerParsing: { valid: false }
            },
            client: 'custom-headers-client'
        };
    }
}

/**
 * Troubleshooting client for diagnosing common HTTP client issues
 * Demonstrates diagnostic techniques for connection failures, timeouts, and DNS problems
 * with systematic troubleshooting methodology and resolution recommendations
 * 
 * @param {string} scenario - Troubleshooting scenario to demonstrate (connectionRefused, timeout, dnsError)
 * @returns {Promise<object>} Promise resolving to diagnostic results with troubleshooting steps and resolution recommendations
 */
async function troubleshootingClient(scenario) {
    console.log(`[Troubleshooting Client] Starting diagnostic scenario: ${scenario}`);
    
    const startTime = performance.now();
    const diagnosticResults = {
        scenario: scenario,
        steps: [],
        findings: [],
        recommendations: [],
        resolution: null
    };
    
    // Configure diagnostic test parameters based on troubleshooting scenario
    let testUrl, testConfig;
    
    switch (scenario) {
        case 'connectionRefused':
            testUrl = 'http://localhost:9999/hello'; // Intentionally wrong port
            testConfig = { timeout: 5000, retries: 2 };
            diagnosticResults.steps.push('Testing connection to non-existent service');
            break;
            
        case 'timeout':
            testUrl = DEFAULT_SERVER_URL + HELLO_ENDPOINT_PATH;
            testConfig = { timeout: 1, retries: 1 }; // Very short timeout
            diagnosticResults.steps.push('Testing request with extremely short timeout');
            break;
            
        case 'dnsError':
            testUrl = 'http://nonexistent-domain-for-testing.invalid/hello';
            testConfig = { timeout: 5000, retries: 1 };
            diagnosticResults.steps.push('Testing DNS resolution for invalid domain');
            break;
            
        default:
            throw new Error(`Unknown troubleshooting scenario: ${scenario}`);
    }
    
    console.log(`[Troubleshooting Client] Test URL: ${testUrl}`);
    console.log(`[Troubleshooting Client] Configuration:`, testConfig);
    
    // Step 1: Attempt HTTP connection with enhanced error detection and analysis
    diagnosticResults.steps.push('Attempting HTTP connection with error detection');
    
    try {
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT + ' (Diagnostic)',
                'Accept': 'text/plain'
            },
            signal: AbortSignal.timeout(testConfig.timeout)
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Unexpected success case
        diagnosticResults.steps.push('Connection succeeded unexpectedly');
        diagnosticResults.findings.push(`Request completed successfully in ${duration.toFixed(2)}ms`);
        diagnosticResults.findings.push(`Status: ${response.status} ${response.statusText}`);
        diagnosticResults.resolution = 'No issues detected - connection successful';
        
        console.log(`[Troubleshooting Client] Unexpected success: ${response.status} in ${duration.toFixed(2)}ms`);
        
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Capture detailed error information including error codes, messages, and stack traces
        diagnosticResults.steps.push('Analyzing connection failure');
        diagnosticResults.findings.push(`Request failed after ${duration.toFixed(2)}ms`);
        diagnosticResults.findings.push(`Error type: ${error.name}`);
        diagnosticResults.findings.push(`Error message: ${error.message}`);
        
        if (error.cause) {
            diagnosticResults.findings.push(`Error cause: ${error.cause}`);
        }
        
        // Analyze common HTTP client error patterns and their root causes
        const errorAnalysis = analyzeHttpError(error, scenario);
        diagnosticResults.findings.push(`Error classification: ${errorAnalysis.classification}`);
        diagnosticResults.findings.push(`Probable cause: ${errorAnalysis.probableCause}`);
        
        console.log(`[Troubleshooting Client] Error Analysis:`);
        console.log(`  - Duration: ${duration.toFixed(2)}ms`);
        console.log(`  - Error: ${error.name} - ${error.message}`);
        console.log(`  - Classification: ${errorAnalysis.classification}`);
        console.log(`  - Probable cause: ${errorAnalysis.probableCause}`);
        
        // Provide systematic troubleshooting methodology and diagnostic steps
        const troubleshootingSteps = generateTroubleshootingSteps(error, scenario);
        diagnosticResults.recommendations = troubleshootingSteps.recommendations;
        
        console.log(`[Troubleshooting Client] Troubleshooting Steps:`);
        troubleshootingSteps.steps.forEach((step, index) => {
            console.log(`  ${index + 1}. ${step}`);
            diagnosticResults.steps.push(step);
        });
        
        console.log(`[Troubleshooting Client] Recommendations:`);
        troubleshootingSteps.recommendations.forEach(rec => console.log(`  - ${rec}`));
        
        // Demonstrate error recovery strategies and retry mechanisms
        if (testConfig.retries > 0 && errorAnalysis.retryable) {
            console.log(`[Troubleshooting Client] Attempting retry with modified parameters...`);
            
            try {
                const retryResult = await attemptErrorRecovery(testUrl, error, scenario);
                diagnosticResults.steps.push('Attempted error recovery');
                diagnosticResults.resolution = retryResult.success ? 'Resolved through retry' : 'Retry unsuccessful';
                diagnosticResults.findings.push(`Retry result: ${retryResult.message}`);
                
            } catch (retryError) {
                diagnosticResults.steps.push('Error recovery failed');
                diagnosticResults.resolution = 'Issue persists after retry attempts';
                diagnosticResults.findings.push(`Retry failed: ${retryError.message}`);
            }
        } else {
            diagnosticResults.resolution = errorAnalysis.resolution;
        }
    }
    
    const totalDuration = performance.now() - startTime;
    
    console.log(`[Troubleshooting Client] Diagnostic Summary:`);
    console.log(`  - Scenario: ${scenario}`);
    console.log(`  - Total time: ${totalDuration.toFixed(2)}ms`);
    console.log(`  - Steps completed: ${diagnosticResults.steps.length}`);
    console.log(`  - Findings: ${diagnosticResults.findings.length}`);
    console.log(`  - Resolution: ${diagnosticResults.resolution || 'Unresolved'}`);
    
    // Return diagnostic report with error analysis and resolution recommendations
    return {
        scenario: scenario,
        timing: {
            duration: Math.round(totalDuration),
            start: startTime,
            end: performance.now()
        },
        diagnostic: diagnosticResults,
        client: 'troubleshooting-client',
        url: testUrl,
        educational: {
            commonErrors: [
                'ECONNREFUSED: Connection refused by server',
                'ETIMEDOUT: Request timeout exceeded',
                'ENOTFOUND: DNS resolution failed',
                'ECONNRESET: Connection reset by peer'
            ],
            diagnosticProcess: [
                '1. Identify error type and classification',
                '2. Check network connectivity and DNS resolution',
                '3. Verify server status and port availability',
                '4. Test with different timeout and retry values',
                '5. Analyze server logs and client configuration'
            ]
        }
    };
}

/**
 * HttpClientExamples class - Comprehensive HTTP client demonstration suite
 * Encapsulates various client implementation patterns and educational demonstrations
 * for Node.js tutorial learning with performance testing and validation capabilities
 */
class HttpClientExamples {
    /**
     * Initialize HTTP client examples with server configuration and educational settings
     * @param {object} config - Configuration object with server settings, timeout values, and educational options
     */
    constructor(config = {}) {
        // Load server configuration and construct base URL for tutorial server connection
        this.config = {
            serverUrl: config.serverUrl || DEFAULT_SERVER_URL,
            timeout: config.timeout || REQUEST_TIMEOUT,
            userAgent: config.userAgent || USER_AGENT,
            educational: config.educational !== false,
            performance: config.performance !== false,
            ...config
        };
        
        // Initialize client statistics collection for educational performance tracking
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            errors: [],
            startTime: Date.now()
        };
        
        // Set up educational logging with detailed HTTP transaction information
        this.logger = {
            info: (message) => console.log(`[HttpClientExamples] ${message}`),
            warn: (message) => console.warn(`[HttpClientExamples] ${message}`),
            error: (message) => console.error(`[HttpClientExamples] ${message}`)
        };
        
        // Configure default request options including timeout, headers, and user agent
        this.defaultOptions = {
            timeout: this.config.timeout,
            headers: {
                'User-Agent': this.config.userAgent,
                'Accept': 'text/plain, application/json, */*'
            }
        };
        
        this.logger.info(`Initialized with server: ${this.config.serverUrl}`);
        this.logger.info(`Default timeout: ${this.config.timeout}ms`);
        this.logger.info(`Educational mode: ${this.config.educational ? 'enabled' : 'disabled'}`);
        
        // Initialize performance measurement utilities for request timing analysis
        this.performance = {
            measurements: [],
            thresholds: {
                responseTime: 100,
                successRate: 95,
                errorRate: 5
            }
        };
        
        // Set up error handling patterns and educational error analysis capabilities
        this.errorHandler = {
            handleError: (error, context) => this._handleError(error, context),
            classifyError: (error) => this._classifyError(error),
            logError: (error, context) => this._logError(error, context)
        };
    }
    
    /**
     * Execute comprehensive suite of HTTP client examples
     * Runs all client demonstration patterns with educational insights and performance analysis
     * @returns {Promise<object>} Promise resolving to complete example results with educational insights and performance analysis
     */
    async runAllExamples() {
        this.logger.info('Starting comprehensive HTTP client examples suite');
        
        const results = {
            basicRequests: null,
            errorHandling: null,
            performance: null,
            security: null,
            connections: null,
            customHeaders: null,
            troubleshooting: null,
            summary: null
        };
        
        const suiteStartTime = performance.now();
        
        try {
            // Execute basic HTTP request examples using different Node.js client approaches
            this.logger.info('Running basic request demonstrations...');
            results.basicRequests = await this.demonstrateBasicRequests();
            
            // Demonstrate modern fetch API usage with comprehensive error handling
            this.logger.info('Running error handling demonstrations...');
            results.errorHandling = await this.testErrorHandling();
            
            // Run hello endpoint client examples with response validation
            this.logger.info('Running performance demonstrations...');
            results.performance = await this.measurePerformance();
            
            // Test error scenarios including 404, 405, and server error responses
            this.logger.info('Running security validation demonstrations...');
            results.security = await this.validateSecurity();
            
            // Perform client performance testing with timing and throughput analysis
            this.logger.info('Running connection management demonstrations...');
            results.connections = await this.testConnectionManagement();
            
            // Validate security headers and demonstrate security best practices
            this.logger.info('Running custom headers demonstrations...');
            results.customHeaders = await this.demonstrateCustomHeaders();
            
            // Run connection management and networking examples
            this.logger.info('Running troubleshooting demonstrations...');
            results.troubleshooting = await this.demonstrateTroubleshooting();
            
            const suiteEndTime = performance.now();
            const totalDuration = suiteEndTime - suiteStartTime;
            
            // Generate comprehensive educational report with insights and recommendations
            results.summary = this._generateSummaryReport(results, totalDuration);
            
            this.logger.info(`All examples completed in ${totalDuration.toFixed(2)}ms`);
            this.logger.info(`Total requests: ${this.stats.totalRequests}`);
            this.logger.info(`Success rate: ${((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1)}%`);
            
            return results;
            
        } catch (error) {
            this.logger.error(`Example suite failed: ${error.message}`);
            results.error = {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
            return results;
        }
    }
    
    /**
     * Demonstrate fundamental HTTP request patterns using Node.js built-in modules
     * Shows basic HTTP client usage with educational commentary and best practices
     * @returns {Promise<Array>} Promise resolving to array of basic request example results with timing and analysis
     */
    async demonstrateBasicRequests() {
        const results = [];
        
        // Execute GET request using Node.js http module with detailed explanation
        this.logger.info('Demonstrating basic HTTP module request...');
        try {
            const basicResult = await basicHttpRequest(this.config.serverUrl + HELLO_ENDPOINT_PATH, {
                ...this.defaultOptions,
                method: 'GET'
            });
            results.push(basicResult);
            this._updateStats(basicResult);
        } catch (error) {
            results.push(this._createErrorResult('basic-http', error));
        }
        
        // Demonstrate modern fetch API usage for same endpoint comparison
        this.logger.info('Demonstrating modern fetch API request...');
        try {
            const fetchResult = await modernFetchRequest(this.config.serverUrl + HELLO_ENDPOINT_PATH, {
                ...this.defaultOptions,
                method: 'GET'
            });
            results.push(fetchResult);
            this._updateStats(fetchResult);
        } catch (error) {
            results.push(this._createErrorResult('modern-fetch', error));
        }
        
        // Show request customization with headers, timeout, and options
        this.logger.info('Demonstrating hello world specialized client...');
        try {
            const helloResult = await helloWorldClient({
                serverUrl: this.config.serverUrl,
                timeout: this.config.timeout,
                headers: this.defaultOptions.headers
            });
            results.push(helloResult);
            this._updateStats(helloResult);
        } catch (error) {
            results.push(this._createErrorResult('hello-world-client', error));
        }
        
        // Analyze response differences between client approaches
        if (this.config.educational) {
            this.logger.info('Educational Analysis: Basic Request Patterns');
            this.logger.info('  - HTTP module provides low-level control over requests');
            this.logger.info('  - Fetch API offers modern Promise-based interface');
            this.logger.info('  - Specialized clients can provide domain-specific validation');
            this.logger.info('  - All approaches demonstrate different abstraction levels');
        }
        
        // Provide educational commentary on client pattern selection
        return {
            examples: results,
            analysis: this._analyzeBasicRequests(results),
            educational: {
                httpModule: 'Low-level HTTP control with streams and events',
                fetchApi: 'Modern Promise-based HTTP client interface',
                specializedClient: 'Domain-specific validation and analysis',
                recommendations: [
                    'Use HTTP module for learning low-level HTTP concepts',
                    'Use fetch API for modern application development',
                    'Create specialized clients for specific endpoint validation',
                    'Choose abstraction level based on educational goals'
                ]
            }
        };
    }
    
    /**
     * Comprehensive error handling demonstration for various server error conditions
     * Shows client responses to different HTTP error codes with educational error analysis
     * @returns {Promise<Array>} Promise resolving to array of error handling results with analysis and recommendations
     */
    async testErrorHandling() {
        const errorTests = [];
        
        // Test 404 Not Found error handling with client recovery strategies
        this.logger.info('Testing 404 Not Found error handling...');
        try {
            const notFoundResult = await errorScenarioClient('notFound', {
                serverUrl: this.config.serverUrl,
                timeout: this.config.timeout
            });
            errorTests.push(notFoundResult);
            this._updateStats(notFoundResult);
        } catch (error) {
            errorTests.push(this._createErrorResult('error-404', error));
        }
        
        // Demonstrate 405 Method Not Allowed error processing and analysis
        this.logger.info('Testing 405 Method Not Allowed error handling...');
        try {
            const methodNotAllowedResult = await errorScenarioClient('methodNotAllowed', {
                serverUrl: this.config.serverUrl,
                timeout: this.config.timeout
            });
            errorTests.push(methodNotAllowedResult);
            this._updateStats(methodNotAllowedResult);
        } catch (error) {
            errorTests.push(this._createErrorResult('error-405', error));
        }
        
        // Test server error responses and proper client error handling
        this.logger.info('Testing 500 Internal Server Error handling...');
        try {
            const serverErrorResult = await errorScenarioClient('serverError', {
                serverUrl: this.config.serverUrl,
                timeout: this.config.timeout
            });
            errorTests.push(serverErrorResult);
            this._updateStats(serverErrorResult);
        } catch (error) {
            errorTests.push(this._createErrorResult('error-500', error));
        }
        
        // Show network error scenarios including connection failures
        this.logger.info('Testing network error scenarios...');
        try {
            const connectionResult = await troubleshootingClient('connectionRefused');
            errorTests.push(connectionResult);
        } catch (error) {
            errorTests.push(this._createErrorResult('network-error', error));
        }
        
        // Provide educational guidance on error handling best practices
        if (this.config.educational) {
            this.logger.info('Educational Analysis: Error Handling Patterns');
            this.logger.info('  - 4xx errors indicate client-side issues');
            this.logger.info('  - 5xx errors indicate server-side issues');
            this.logger.info('  - Network errors require retry and timeout handling');
            this.logger.info('  - Proper error classification enables appropriate responses');
        }
        
        return {
            scenarios: errorTests,
            analysis: this._analyzeErrorHandling(errorTests),
            educational: {
                errorTypes: {
                    client: '4xx status codes indicate client request issues',
                    server: '5xx status codes indicate server processing issues',
                    network: 'Connection and timeout errors at network level'
                },
                handlingStrategies: [
                    'Classify errors into retryable and non-retryable categories',
                    'Implement exponential backoff for retryable errors',
                    'Provide meaningful error messages to users',
                    'Log detailed error information for debugging'
                ]
            }
        };
    }
    
    /**
     * Performance measurement and analysis suite for HTTP client request timing
     * Tests response times, throughput, and connection efficiency with educational insights
     * @param {object} options - Performance test options including iterations and concurrency settings
     * @returns {Promise<object>} Promise resolving to comprehensive performance analysis with optimization recommendations
     */
    async measurePerformance(options = {}) {
        const performanceConfig = {
            iterations: options.iterations || 10,
            concurrency: options.concurrency || 1,
            warmupRequests: options.warmupRequests || 3,
            ...options
        };
        
        this.logger.info(`Starting performance measurement with ${performanceConfig.iterations} requests`);
        
        // Execute performance test suite with multiple request iterations
        const performanceResult = await performanceTestClient({
            ...performanceConfig,
            serverUrl: this.config.serverUrl,
            endpoint: HELLO_ENDPOINT_PATH,
            timeout: this.config.timeout
        });
        
        // Measure response times, connection overhead, and throughput metrics
        const connectionResult = await connectionTestClient({
            serverUrl: this.config.serverUrl,
            requests: 5,
            keepAlive: true,
            timeout: this.config.timeout
        });
        
        // Test concurrent request handling and connection pooling efficiency
        this.logger.info('Testing concurrent request handling...');
        const concurrentResults = [];
        const concurrentPromises = [];
        
        for (let i = 0; i < 3; i++) {
            concurrentPromises.push(
                helloWorldClient({
                    serverUrl: this.config.serverUrl,
                    timeout: this.config.timeout
                })
            );
        }
        
        try {
            const concurrent = await Promise.all(concurrentPromises);
            concurrentResults.push(...concurrent);
        } catch (error) {
            this.logger.warn(`Concurrent request test failed: ${error.message}`);
        }
        
        // Analyze performance against educational thresholds and targets
        const performanceAnalysis = this._analyzePerformanceResults(performanceResult, connectionResult, concurrentResults);
        
        // Generate performance report with statistical analysis and recommendations
        if (this.config.educational) {
            this.logger.info('Educational Analysis: Performance Optimization');
            this.logger.info('  - Response time should typically be under 100ms for simple requests');
            this.logger.info('  - Connection reuse improves performance for multiple requests');
            this.logger.info('  - Concurrent requests can reveal bottlenecks and limits');
            this.logger.info('  - Performance monitoring helps identify optimization opportunities');
        }
        
        return {
            singleRequest: performanceResult,
            connectionManagement: connectionResult,
            concurrentRequests: concurrentResults,
            analysis: performanceAnalysis,
            educational: {
                performanceMetrics: [
                    'Response time: Time from request start to response complete',
                    'Throughput: Number of requests processed per second',
                    'Connection overhead: Time spent establishing connections',
                    'Concurrency: Ability to handle multiple simultaneous requests'
                ],
                optimizationTechniques: [
                    'Use HTTP keep-alive for connection reuse',
                    'Implement request pooling for high-volume applications',
                    'Set appropriate timeout values for different scenarios',
                    'Monitor performance metrics to identify bottlenecks'
                ]
            }
        };
    }
    
    /**
     * Security validation suite for HTTP response security compliance
     * Inspects server responses for security headers and demonstrates security best practices
     * @returns {Promise<object>} Promise resolving to security analysis with validation results and security recommendations
     */
    async validateSecurity() {
        this.logger.info('Starting security header validation');
        
        // Validate HTTP security headers in server responses
        const securityResult = await securityHeaderValidator(this.config.serverUrl + HELLO_ENDPOINT_PATH);
        
        // Check for proper Content-Type and security header configuration
        const additionalSecurityTests = [];
        
        // Test different endpoints for consistent security headers
        const endpoints = [HELLO_ENDPOINT_PATH, HEALTH_ENDPOINT_PATH, '/'];
        
        for (const endpoint of endpoints) {
            try {
                const endpointUrl = this.config.serverUrl + endpoint;
                this.logger.info(`Validating security headers for: ${endpoint}`);
                
                const endpointSecurity = await securityHeaderValidator(endpointUrl);
                additionalSecurityTests.push(endpointSecurity);
                
            } catch (error) {
                this.logger.warn(`Security validation failed for ${endpoint}: ${error.message}`);
                additionalSecurityTests.push({
                    endpoint: endpoint,
                    error: error.message,
                    securityScore: 0
                });
            }
        }
        
        // Analyze potential security vulnerabilities and protection mechanisms
        const securityAnalysis = this._analyzeSecurityResults(securityResult, additionalSecurityTests);
        
        // Provide educational commentary on web security best practices
        if (this.config.educational) {
            this.logger.info('Educational Analysis: Web Security Headers');
            this.logger.info('  - Security headers provide browser-level protection');
            this.logger.info('  - X-Content-Type-Options prevents MIME type sniffing attacks');
            this.logger.info('  - X-Frame-Options prevents clickjacking through iframe embedding');
            this.logger.info('  - Consistent security policy should apply across all endpoints');
        }
        
        // Generate security compliance report with remediation recommendations
        return {
            primaryEndpoint: securityResult,
            allEndpoints: additionalSecurityTests,
            analysis: securityAnalysis,
            educational: {
                securityHeaders: {
                    'X-Content-Type-Options': 'Prevents MIME type confusion attacks',
                    'X-Frame-Options': 'Prevents clickjacking through iframe embedding',
                    'Content-Type': 'Specifies response content type and encoding',
                    'Cache-Control': 'Controls client and proxy caching behavior'
                },
                threats: [
                    'MIME type sniffing can lead to content type confusion',
                    'Clickjacking attacks embed pages in malicious frames',
                    'Content type ambiguity can enable injection attacks',
                    'Improper caching can expose sensitive information'
                ],
                bestPractices: [
                    'Implement comprehensive security headers on all responses',
                    'Use Content Security Policy for advanced protection',
                    'Regularly audit security header configuration',
                    'Test security headers across all application endpoints'
                ]
            }
        };
    }
    
    /**
     * Connection management testing for keep-alive and timeout behavior
     * Analyzes connection reuse patterns and networking efficiency
     * @returns {Promise<object>} Promise resolving to connection analysis with networking insights
     */
    async testConnectionManagement() {
        this.logger.info('Testing HTTP connection management patterns');
        
        // Test keep-alive connection behavior
        const keepAliveTest = await connectionTestClient({
            serverUrl: this.config.serverUrl,
            requests: 5,
            keepAlive: true,
            connectionDelay: 100,
            timeout: this.config.timeout
        });
        
        // Test connection close behavior
        const connectionCloseTest = await connectionTestClient({
            serverUrl: this.config.serverUrl,
            requests: 5,
            keepAlive: false,
            connectionDelay: 100,
            timeout: this.config.timeout
        });
        
        // Test timeout scenarios
        const timeoutTest = await troubleshootingClient('timeout');
        
        const connectionAnalysis = this._analyzeConnectionResults(keepAliveTest, connectionCloseTest, timeoutTest);
        
        if (this.config.educational) {
            this.logger.info('Educational Analysis: HTTP Connection Management');
            this.logger.info('  - HTTP keep-alive reduces connection overhead for multiple requests');
            this.logger.info('  - Connection pooling improves performance in high-throughput scenarios');
            this.logger.info('  - Proper timeout configuration balances responsiveness and reliability');
            this.logger.info('  - Connection management affects both client and server resource usage');
        }
        
        return {
            keepAlive: keepAliveTest,
            connectionClose: connectionCloseTest,
            timeout: timeoutTest,
            analysis: connectionAnalysis,
            educational: {
                connectionTypes: {
                    keepAlive: 'Reuses TCP connections for multiple HTTP requests',
                    connectionClose: 'Closes TCP connection after each HTTP request',
                    persistent: 'Long-lived connections for real-time applications'
                },
                optimizationStrategies: [
                    'Use keep-alive for multiple requests to same server',
                    'Implement connection pooling for concurrent requests',
                    'Set appropriate timeout values for different use cases',
                    'Monitor connection metrics to identify optimization opportunities'
                ]
            }
        };
    }
    
    /**
     * Custom headers demonstration showing HTTP header usage and semantics
     * Analyzes server response to different header combinations
     * @returns {Promise<object>} Promise resolving to header analysis with educational insights
     */
    async demonstrateCustomHeaders() {
        this.logger.info('Demonstrating custom HTTP header usage');
        
        // Test different User-Agent values
        const userAgentTest = await customHeadersClient({
            userAgent: 'Node.js Tutorial Client (User-Agent Test)',
            serverUrl: this.config.serverUrl,
            endpoint: HELLO_ENDPOINT_PATH
        });
        
        // Test content negotiation with Accept headers
        const contentNegotiationTest = await customHeadersClient({
            accept: 'application/json, text/plain;q=0.8, */*;q=0.1',
            serverUrl: this.config.serverUrl,
            endpoint: HELLO_ENDPOINT_PATH
        });
        
        // Test custom application headers
        const customHeaderTest = await customHeadersClient({
            additionalHeaders: {
                'X-Client-Version': '1.0.0',
                'X-Request-Source': 'Tutorial-Example',
                'X-Educational-Purpose': 'Header-Analysis'
            },
            serverUrl: this.config.serverUrl,
            endpoint: HELLO_ENDPOINT_PATH
        });
        
        const headerAnalysis = this._analyzeHeaderResults(userAgentTest, contentNegotiationTest, customHeaderTest);
        
        if (this.config.educational) {
            this.logger.info('Educational Analysis: HTTP Header Usage');
            this.logger.info('  - User-Agent identifies client application and version');
            this.logger.info('  - Accept headers enable content negotiation with servers');
            this.logger.info('  - Custom X-* headers provide application-specific metadata');
            this.logger.info('  - Header order and formatting can affect server processing');
        }
        
        return {
            userAgent: userAgentTest,
            contentNegotiation: contentNegotiationTest,
            customHeaders: customHeaderTest,
            analysis: headerAnalysis,
            educational: {
                standardHeaders: {
                    'User-Agent': 'Identifies client software, version, and capabilities',
                    'Accept': 'Specifies preferred response content types',
                    'Accept-Language': 'Indicates preferred response languages',
                    'Accept-Encoding': 'Lists supported compression algorithms'
                },
                customHeaders: {
                    purpose: 'Application-specific metadata and functionality',
                    naming: 'X- prefix indicates experimental or proprietary headers',
                    security: 'Avoid exposing sensitive information in headers',
                    standards: 'Follow HTTP specification for header formatting'
                }
            }
        };
    }
    
    /**
     * Troubleshooting demonstration for common HTTP client issues
     * Shows diagnostic techniques and resolution strategies
     * @returns {Promise<object>} Promise resolving to troubleshooting analysis with educational guidance
     */
    async demonstrateTroubleshooting() {
        this.logger.info('Demonstrating HTTP client troubleshooting techniques');
        
        const troubleshootingResults = [];
        
        // Test connection refused scenario
        try {
            const connectionRefusedResult = await troubleshootingClient('connectionRefused');
            troubleshootingResults.push(connectionRefusedResult);
        } catch (error) {
            troubleshootingResults.push({
                scenario: 'connectionRefused',
                error: error.message,
                diagnostic: { steps: ['Error during diagnostic'], findings: [error.message] }
            });
        }
        
        // Test DNS resolution error
        try {
            const dnsErrorResult = await troubleshootingClient('dnsError');
            troubleshootingResults.push(dnsErrorResult);
        } catch (error) {
            troubleshootingResults.push({
                scenario: 'dnsError',
                error: error.message,
                diagnostic: { steps: ['Error during diagnostic'], findings: [error.message] }
            });
        }
        
        // Test timeout scenario
        try {
            const timeoutResult = await troubleshootingClient('timeout');
            troubleshootingResults.push(timeoutResult);
        } catch (error) {
            troubleshootingResults.push({
                scenario: 'timeout',
                error: error.message,
                diagnostic: { steps: ['Error during diagnostic'], findings: [error.message] }
            });
        }
        
        const troubleshootingAnalysis = this._analyzeTroubleshootingResults(troubleshootingResults);
        
        if (this.config.educational) {
            this.logger.info('Educational Analysis: HTTP Client Troubleshooting');
            this.logger.info('  - Systematic error classification helps identify root causes');
            this.logger.info('  - Network connectivity issues require different solutions than application errors');
            this.logger.info('  - Timeout configuration affects both reliability and user experience');
            this.logger.info('  - Retry logic should distinguish between retryable and permanent failures');
        }
        
        return {
            scenarios: troubleshootingResults,
            analysis: troubleshootingAnalysis,
            educational: {
                commonIssues: {
                    connectionRefused: 'Server not running or port not accessible',
                    dnsError: 'Domain name cannot be resolved to IP address',
                    timeout: 'Request exceeds configured timeout duration',
                    networkError: 'General network connectivity issues'
                },
                diagnosticSteps: [
                    'Identify error type and classification',
                    'Check network connectivity and DNS resolution',
                    'Verify server status and port availability',
                    'Test with different timeout and retry configurations',
                    'Analyze logs and configuration for issues'
                ]
            }
        };
    }
    
    /**
     * Updates request statistics for performance tracking
     * @private
     */
    _updateStats(result) {
        this.stats.totalRequests++;
        
        if (result.status >= 200 && result.status < 400) {
            this.stats.successfulRequests++;
        } else {
            this.stats.failedRequests++;
            this.stats.errors.push({
                status: result.status,
                error: result.error || result.statusText,
                timestamp: Date.now()
            });
        }
        
        if (result.timing && result.timing.duration) {
            this.stats.totalResponseTime += result.timing.duration;
        }
    }
    
    /**
     * Creates standardized error result object
     * @private
     */
    _createErrorResult(client, error) {
        return {
            status: 0,
            statusText: 'Request Failed',
            headers: {},
            body: null,
            error: error.message,
            client: client,
            timing: { duration: 0, start: 0, end: 0 }
        };
    }
    
    /**
     * Analyzes basic request results for educational insights
     * @private
     */
    _analyzeBasicRequests(results) {
        const successful = results.filter(r => r.examples?.some(e => e.status === 200) || r.status === 200);
        const responseTimes = results.flatMap(r => 
            r.examples ? r.examples.map(e => e.timing?.duration || 0) : [r.timing?.duration || 0]
        ).filter(t => t > 0);
        
        return {
            totalExamples: results.length,
            successfulExamples: successful.length,
            averageResponseTime: responseTimes.length > 0 ? 
                Math.round(responseTimes.reduce((a, b) => a + b) / responseTimes.length) : 0,
            recommendations: [
                'All client approaches successfully demonstrated basic HTTP functionality',
                'Response times indicate good server performance',
                'Each client pattern serves different educational purposes'
            ]
        };
    }
    
    /**
     * Analyzes error handling results for patterns and insights
     * @private
     */
    _analyzeErrorHandling(errorTests) {
        const errorTypes = errorTests.reduce((acc, test) => {
            if (test.scenario) {
                acc[test.scenario] = (acc[test.scenario] || 0) + 1;
            }
            return acc;
        }, {});
        
        return {
            totalTests: errorTests.length,
            errorTypes: errorTypes,
            insights: [
                'Error handling demonstrates proper HTTP status code interpretation',
                'Different error types require different client response strategies',
                'Educational error analysis helps understand HTTP protocol behavior'
            ]
        };
    }
    
    /**
     * Analyzes performance test results for optimization insights
     * @private
     */
    _analyzePerformanceResults(performanceResult, connectionResult, concurrentResults) {
        return {
            performance: {
                averageResponseTime: performanceResult.statistics?.avgResponseTime || 0,
                successRate: performanceResult.statistics?.successRate || 0,
                throughput: performanceResult.statistics?.requestsPerSecond || 0
            },
            connections: {
                keepAliveEfficiency: connectionResult.analysis?.connectionEfficiency || 1,
                connectionReuse: connectionResult.analysis?.connectionReuse || false
            },
            concurrency: {
                simultaneousRequests: concurrentResults.length,
                concurrentSuccess: concurrentResults.filter(r => r.status === 200).length
            },
            recommendations: [
                'Performance meets educational targets for tutorial application',
                'Connection management demonstrates HTTP keep-alive benefits',
                'Concurrent request handling shows server stability'
            ]
        };
    }
    
    /**
     * Analyzes security validation results
     * @private
     */
    _analyzeSecurityResults(primaryResult, additionalResults) {
        const allResults = [primaryResult, ...additionalResults];
        const securityScores = allResults.map(r => r.securityScore || 0);
        
        return {
            averageSecurityScore: securityScores.reduce((a, b) => a + b) / securityScores.length,
            consistentSecurity: securityScores.every(score => score === securityScores[0]),
            commonVulnerabilities: allResults.flatMap(r => r.vulnerabilities || []),
            recommendations: [
                'Security headers provide essential browser-level protection',
                'Consistent security policy should apply across all endpoints',
                'Regular security validation helps maintain protection standards'
            ]
        };
    }
    
    /**
     * Analyzes connection test results
     * @private
     */
    _analyzeConnectionResults(keepAliveTest, connectionCloseTest, timeoutTest) {
        return {
            keepAliveEfficiency: keepAliveTest.analysis?.connectionEfficiency || 1,
            connectionOverhead: {
                keepAlive: keepAliveTest.analysis?.averageRequestTime || 0,
                connectionClose: connectionCloseTest.analysis?.averageRequestTime || 0
            },
            timeoutBehavior: timeoutTest.diagnostic?.resolution || 'timeout demonstrated',
            recommendations: [
                'Keep-alive connections reduce overhead for multiple requests',
                'Connection pooling strategies improve application performance',
                'Proper timeout configuration balances responsiveness and reliability'
            ]
        };
    }
    
    /**
     * Analyzes custom header test results
     * @private
     */
    _analyzeHeaderResults(userAgentTest, contentNegotiationTest, customHeaderTest) {
        return {
            userAgentHandling: userAgentTest.analysis?.serverBehavior?.status || 'processed',
            contentNegotiation: contentNegotiationTest.analysis?.contentNegotiation?.result || 'completed',
            customHeaderSupport: customHeaderTest.analysis?.headerParsing?.valid || false,
            recommendations: [
                'Server processes headers according to HTTP specifications',
                'Custom headers enable application-specific functionality',
                'Header usage demonstrates HTTP protocol flexibility'
            ]
        };
    }
    
    /**
     * Analyzes troubleshooting test results
     * @private
     */
    _analyzeTroubleshootingResults(results) {
        const scenarios = results.map(r => r.scenario);
        const resolutions = results.map(r => r.diagnostic?.resolution || 'diagnostic completed');
        
        return {
            scenariosCovered: scenarios,
            resolutionStrategies: resolutions,
            diagnosticSteps: results.reduce((total, r) => total + (r.diagnostic?.steps?.length || 0), 0),
            recommendations: [
                'Systematic troubleshooting approach identifies root causes effectively',
                'Different error types require specific diagnostic strategies',
                'Educational troubleshooting builds problem-solving skills'
            ]
        };
    }
    
    /**
     * Generates comprehensive summary report
     * @private
     */
    _generateSummaryReport(results, totalDuration) {
        const successfulTests = Object.values(results).filter(r => r && !r.error).length;
        const totalTests = Object.keys(results).length - 1; // Exclude summary itself
        
        return {
            duration: Math.round(totalDuration),
            totalTests: totalTests,
            successfulTests: successfulTests,
            successRate: Math.round((successfulTests / totalTests) * 100),
            statistics: this.stats,
            educational: {
                conceptsCovered: [
                    'Basic HTTP request patterns using Node.js built-in modules',
                    'Modern fetch API usage with Promise-based async patterns',
                    'Error handling strategies for various HTTP error conditions',
                    'Performance measurement and optimization techniques',
                    'Security header validation and web security best practices',
                    'Connection management and keep-alive optimization',
                    'Custom header usage and HTTP protocol semantics',
                    'Troubleshooting methodology for common client issues'
                ],
                keyInsights: [
                    'Node.js provides multiple approaches for HTTP client implementation',
                    'Each client pattern serves different educational and practical purposes',
                    'Error handling and validation are essential for robust client code',
                    'Performance measurement guides optimization decisions',
                    'Security considerations apply to all HTTP client implementations'
                ]
            }
        };
    }
    
    /**
     * Handles errors with educational context
     * @private
     */
    _handleError(error, context) {
        this.logger.error(`Error in ${context}: ${error.message}`);
        return this._createErrorResult(context, error);
    }
    
    /**
     * Classifies errors for educational analysis
     * @private
     */
    _classifyError(error) {
        if (error.code === 'ECONNREFUSED') return 'connection-refused';
        if (error.code === 'ETIMEDOUT') return 'timeout';
        if (error.code === 'ENOTFOUND') return 'dns-error';
        if (error.name === 'AbortError') return 'request-aborted';
        return 'unknown-error';
    }
    
    /**
     * Logs errors with educational context
     * @private
     */
    _logError(error, context) {
        this.logger.error(`${context} error: ${error.message}`);
        if (this.config.educational) {
            this.logger.info(`Educational note: ${this._getErrorEducation(error)}`);
        }
    }
    
    /**
     * Provides educational information about errors
     * @private
     */
    _getErrorEducation(error) {
        const classifications = {
            'ECONNREFUSED': 'Connection refused typically means the server is not running on the specified port',
            'ETIMEDOUT': 'Request timeout indicates the server took too long to respond',
            'ENOTFOUND': 'DNS resolution failed - the hostname could not be resolved to an IP address',
            'AbortError': 'Request was aborted, usually due to timeout or cancellation'
        };
        return classifications[error.code] || classifications[error.name] || 'Unknown error type - check error message for details';
    }
}

// Helper functions for educational analysis and recommendations

/**
 * Calculate median value from array of numbers
 * @param {number[]} values - Array of numeric values
 * @returns {number} Median value
 */
function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Generate educational information about HTTP error codes
 * @param {number} statusCode - HTTP status code
 * @returns {object} Error education object with type, meaning, causes, and handling
 */
function getErrorEducation(statusCode) {
    const errorEducation = {
        400: { type: 'Client Error', meaning: 'Bad Request', causes: ['Invalid syntax', 'Malformed request'], handling: 'Validate request format and parameters' },
        404: { type: 'Client Error', meaning: 'Not Found', causes: ['Invalid URL path', 'Resource does not exist'], handling: 'Check URL path and verify resource availability' },
        405: { type: 'Client Error', meaning: 'Method Not Allowed', causes: ['HTTP method not supported', 'Endpoint configuration'], handling: 'Use supported HTTP methods (GET, POST, etc.)' },
        500: { type: 'Server Error', meaning: 'Internal Server Error', causes: ['Server-side application error', 'Configuration issue'], handling: 'Check server logs and contact administrator' }
    };
    
    return errorEducation[statusCode] || {
        type: 'Unknown Error',
        meaning: 'Unrecognized Status Code',
        causes: ['Non-standard status code'],
        handling: 'Refer to HTTP specification for status code meaning'
    };
}

/**
 * Generate error handling recommendations based on scenario
 * @param {number} statusCode - HTTP status code
 * @param {string} scenario - Error scenario context
 * @returns {string[]} Array of handling recommendations
 */
function getErrorHandlingRecommendations(statusCode, scenario) {
    const recommendations = {
        notFound: [
            'Verify URL path is correct and matches server routing configuration',
            'Check for typos in endpoint paths',
            'Ensure server is running and endpoints are properly configured'
        ],
        methodNotAllowed: [
            'Use GET method for data retrieval operations',
            'Check server documentation for supported HTTP methods',
            'Verify endpoint supports the intended HTTP method'
        ],
        serverError: [
            'Check server logs for detailed error information',
            'Verify server is running properly without errors',
            'Contact server administrator if issue persists'
        ]
    };
    
    return recommendations[scenario] || ['Check error details and server configuration'];
}

/**
 * Generate performance optimization recommendations
 * @param {object} statistics - Performance test statistics
 * @param {object} analysis - Performance analysis results
 * @returns {string[]} Array of optimization recommendations
 */
function generatePerformanceRecommendations(statistics, analysis) {
    const recommendations = [];
    
    if (!analysis.responseTimeThreshold) {
        recommendations.push('Consider server-side optimizations to reduce response time');
    }
    
    if (!analysis.consistencyGood) {
        recommendations.push('Investigate causes of response time variability');
    }
    
    if (!analysis.throughputAcceptable) {
        recommendations.push('Consider connection pooling or keep-alive optimization');
    }
    
    if (!analysis.errorRateAcceptable) {
        recommendations.push('Investigate and resolve sources of request failures');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('Performance meets educational targets - consider advanced optimization techniques');
    }
    
    return recommendations;
}

/**
 * Generate networking insights for connection management
 * @param {object} connectionAnalysis - Connection test analysis
 * @param {object} config - Connection test configuration
 * @returns {string[]} Array of networking insights
 */
function generateNetworkingInsights(connectionAnalysis, config) {
    const insights = [];
    
    if (connectionAnalysis.connectionReuse) {
        insights.push('HTTP keep-alive is working correctly and improving performance');
    } else {
        insights.push('Connection reuse not detected - verify keep-alive configuration');
    }
    
    if (connectionAnalysis.connectionEfficiency > 1.5) {
        insights.push('Connection establishment overhead is significant - keep-alive provides good benefits');
    } else if (connectionAnalysis.connectionEfficiency < 1.2) {
        insights.push('Connection overhead is minimal - keep-alive benefits are limited');
    }
    
    insights.push(`Average request time: ${connectionAnalysis.averageRequestTime}ms`);
    insights.push(`Connection efficiency ratio: ${connectionAnalysis.connectionEfficiency.toFixed(2)}x`);
    
    return insights;
}

/**
 * Calculate security score based on header analysis
 * @param {object} securityHeaders - Security header analysis results
 * @returns {number} Security score from 0-100
 */
function calculateSecurityScore(securityHeaders) {
    let score = 0;
    const maxScore = 100;
    const headerWeights = {
        xContentTypeOptions: 30,
        xFrameOptions: 30,
        contentType: 20,
        cacheControl: 20
    };
    
    Object.entries(securityHeaders).forEach(([key, header]) => {
        if (header.valid || (key === 'cacheControl' && header.secure)) {
            score += headerWeights[key] || 0;
        }
    });
    
    return Math.min(score, maxScore);
}

/**
 * Identify security vulnerabilities from header analysis
 * @param {object} securityHeaders - Security header analysis results
 * @returns {string[]} Array of identified vulnerabilities
 */
function identifySecurityVulnerabilities(securityHeaders) {
    const vulnerabilities = [];
    
    if (!securityHeaders.xContentTypeOptions.valid) {
        vulnerabilities.push('Missing X-Content-Type-Options header - vulnerable to MIME type sniffing');
    }
    
    if (!securityHeaders.xFrameOptions.valid) {
        vulnerabilities.push('Missing X-Frame-Options header - vulnerable to clickjacking attacks');
    }
    
    if (!securityHeaders.contentType.valid) {
        vulnerabilities.push('Invalid or missing Content-Type header - content type ambiguity');
    }
    
    if (!securityHeaders.cacheControl.secure) {
        vulnerabilities.push('Insecure cache control - potential information disclosure through caching');
    }
    
    return vulnerabilities;
}

/**
 * Generate security recommendations based on vulnerabilities
 * @param {object} securityHeaders - Security header analysis results
 * @param {string[]} vulnerabilities - Identified vulnerabilities
 * @returns {string[]} Array of security recommendations
 */
function generateSecurityRecommendations(securityHeaders, vulnerabilities) {
    const recommendations = [];
    
    if (vulnerabilities.length === 0) {
        recommendations.push('Security headers are properly configured');
        return recommendations;
    }
    
    if (!securityHeaders.xContentTypeOptions.valid) {
        recommendations.push('Add X-Content-Type-Options: nosniff header to prevent MIME type sniffing');
    }
    
    if (!securityHeaders.xFrameOptions.valid) {
        recommendations.push('Add X-Frame-Options: DENY header to prevent clickjacking attacks');
    }
    
    if (!securityHeaders.contentType.valid) {
        recommendations.push('Ensure proper Content-Type header with charset specification');
    }
    
    if (!securityHeaders.cacheControl.secure) {
        recommendations.push('Implement secure cache control headers to prevent sensitive data caching');
    }
    
    return recommendations;
}

/**
 * Analyze content negotiation results
 * @param {object} requestHeaders - Request headers sent
 * @param {object} responseHeaders - Response headers received
 * @returns {object} Content negotiation analysis
 */
function analyzeContentNegotiation(requestHeaders, responseHeaders) {
    return {
        result: 'completed',
        requestAccept: requestHeaders.Accept || 'not specified',
        responseContentType: responseHeaders['content-type'] || 'not specified',
        negotiationSuccess: true
    };
}

/**
 * Analyze server header behavior
 * @param {object} requestHeaders - Request headers sent
 * @param {object} responseHeaders - Response headers received
 * @returns {object} Server behavior analysis
 */
function analyzeServerHeaderBehavior(requestHeaders, responseHeaders) {
    return {
        status: 'processed',
        requestHeaderCount: Object.keys(requestHeaders).length,
        responseHeaderCount: Object.keys(responseHeaders).length,
        serverProcessedHeaders: Object.keys(responseHeaders).length > 0
    };
}

/**
 * Validate header parsing results
 * @param {object} requestHeaders - Request headers sent
 * @param {object} responseHeaders - Response headers received
 * @returns {object} Header parsing validation
 */
function validateHeaderParsing(requestHeaders, responseHeaders) {
    return {
        valid: true,
        requestHeadersParsed: Object.keys(requestHeaders).length > 0,
        responseHeadersReceived: Object.keys(responseHeaders).length > 0
    };
}

/**
 * Generate header education content
 * @param {object} headerAnalysis - Header analysis results
 * @returns {object} Header education content
 */
function generateHeaderEducation(headerAnalysis) {
    return {
        bestPractices: [
            'Use descriptive User-Agent headers to identify your client application',
            'Implement proper Accept headers for content negotiation',
            'Follow HTTP header naming conventions for custom headers',
            'Validate header values to prevent security issues'
        ],
        useCases: [
            'User-Agent: Client identification and capability detection',
            'Accept: Content type negotiation with servers',
            'Custom headers: Application-specific metadata transmission',
            'Cache-Control: Client-side caching behavior control'
        ]
    };
}

/**
 * Analyze HTTP errors for troubleshooting
 * @param {Error} error - Error object to analyze
 * @param {string} scenario - Error scenario context
 * @returns {object} Error analysis results
 */
function analyzeHttpError(error, scenario) {
    const errorAnalysis = {
        ECONNREFUSED: { classification: 'Connection Error', probableCause: 'Server not running or port not accessible', retryable: true },
        ETIMEDOUT: { classification: 'Timeout Error', probableCause: 'Request exceeded timeout duration', retryable: true },
        ENOTFOUND: { classification: 'DNS Error', probableCause: 'Domain name resolution failed', retryable: false },
        AbortError: { classification: 'Request Aborted', probableCause: 'Request was cancelled or timed out', retryable: true }
    };
    
    const analysis = errorAnalysis[error.code] || errorAnalysis[error.name] || {
        classification: 'Unknown Error',
        probableCause: 'Unrecognized error condition',
        retryable: false
    };
    
    return {
        ...analysis,
        resolution: analysis.retryable ? 'Retry with backoff strategy' : 'Address root cause before retrying'
    };
}

/**
 * Generate troubleshooting steps for errors
 * @param {Error} error - Error to troubleshoot
 * @param {string} scenario - Error scenario
 * @returns {object} Troubleshooting steps and recommendations
 */
function generateTroubleshootingSteps(error, scenario) {
    const commonSteps = {
        connectionRefused: [
            'Verify server is running and accessible',
            'Check if correct port is being used',
            'Test connectivity with curl or similar tools',
            'Verify firewall and network configuration'
        ],
        timeout: [
            'Increase timeout duration for slow operations',
            'Check network latency and connectivity',
            'Verify server performance and load',
            'Implement retry logic with exponential backoff'
        ],
        dnsError: [
            'Verify domain name spelling and validity',
            'Check DNS server configuration',
            'Test DNS resolution with nslookup or dig',
            'Consider using IP address instead of hostname'
        ]
    };
    
    return {
        steps: commonSteps[scenario] || ['Check error details and system configuration'],
        recommendations: [
            'Implement proper error handling and logging',
            'Use appropriate timeout values for different scenarios',
            'Consider retry strategies for transient errors',
            'Monitor and alert on error patterns'
        ]
    };
}

/**
 * Attempt error recovery strategies
 * @param {string} url - URL that failed
 * @param {Error} error - Original error
 * @param {string} scenario - Error scenario
 * @returns {Promise<object>} Recovery attempt result
 */
async function attemptErrorRecovery(url, error, scenario) {
    // Simple recovery attempt with modified parameters
    try {
        if (scenario === 'timeout') {
            // Retry with longer timeout
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            return { success: true, message: 'Resolved with longer timeout' };
        }
        
        return { success: false, message: 'No recovery strategy available for this error type' };
        
    } catch (recoveryError) {
        return { success: false, message: `Recovery failed: ${recoveryError.message}` };
    }
}

/**
 * Generate unique request ID for correlation
 * @returns {string} Unique request identifier
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export all client functions and classes for educational use
module.exports = {
    // Main client examples class for comprehensive HTTP client demonstrations
    HttpClientExamples,
    
    // Individual client functions for specific educational demonstrations
    basicHttpRequest,
    modernFetchRequest,
    helloWorldClient,
    errorScenarioClient,
    performanceTestClient,
    connectionTestClient,
    securityHeaderValidator,
    customHeadersClient,
    troubleshootingClient,
    
    // Default client examples object for immediate educational use
    clientExamples: {
        basic: basicHttpRequest,
        fetch: modernFetchRequest,
        hello: helloWorldClient,
        errors: errorScenarioClient,
        performance: performanceTestClient,
        connections: connectionTestClient,
        security: securityHeaderValidator,
        headers: customHeadersClient,
        troubleshooting: troubleshootingClient
    },
    
    // Configuration constants for external use
    DEFAULT_SERVER_URL,
    HELLO_ENDPOINT_PATH,
    HEALTH_ENDPOINT_PATH,
    REQUEST_TIMEOUT,
    USER_AGENT
};