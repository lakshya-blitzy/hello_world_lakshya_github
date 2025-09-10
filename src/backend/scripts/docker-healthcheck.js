/**
 * Docker Container Health Check Script for Node.js Tutorial HTTP Server
 * 
 * This script validates the health of the Node.js HTTP server application by performing
 * HTTP requests to verify server responsiveness, endpoint availability, and basic functionality.
 * It provides lightweight health validation for container orchestration systems with appropriate
 * exit codes for Docker health check integration while maintaining zero external dependencies
 * and educational simplicity.
 * 
 * Educational Features:
 * - Demonstrates Docker health check implementation patterns for Node.js applications
 * - Shows HTTP client request patterns using Node.js built-in http module
 * - Illustrates configuration loading and environment variable usage in container context
 * - Teaches robust error handling with timeouts, retries, and graceful failures
 * - Demonstrates proper process exit handling and status code management
 * 
 * Docker Integration:
 * - Compatible with Docker HEALTHCHECK instruction for container orchestration
 * - Returns appropriate exit codes: 0 (healthy), 1 (unhealthy), 2 (warning)
 * - Supports configurable health check intervals and timeout settings
 * - Provides concise logging suitable for container log aggregation
 * 
 * Container Lifecycle Support:
 * - Validates server availability during container startup phase
 * - Provides periodic health validation during container operation
 * - Identifies server failures and unresponsive states for container restart
 * - Compatible with Docker Compose, Kubernetes, and other orchestration tools
 * 
 * Dependencies: Node.js built-in modules only (http, url, process)
 * Node.js Version: 22.x LTS (Active)
 * JavaScript Standard: ES2023
 */

// Import configuration from environment and server config modules
const { config } = require('../config/environment.js'); // v1.0.0 - Environment configuration with server and logging settings
const { http: serverConfig, performance: performanceConfig } = require('../config/server-config.js'); // v1.0.0 - HTTP server and performance configuration

// Import Node.js built-in modules for HTTP client functionality
const http = require('node:http'); // Built-in Node.js HTTP client module for making health check requests
const { URL } = require('node:url'); // Built-in Node.js URL utilities for parsing and constructing health check URLs
const process = require('node:process'); // Built-in Node.js process utilities for exit codes and environment access

// Global health check configuration constants for timeout and retry management
const HEALTH_CHECK_TIMEOUT_MS = 5000; // Maximum time to wait for health check response before timing out

// Docker exit codes for container orchestration integration
const DOCKER_EXIT_CODES = {
    SUCCESS: 0,    // Container is healthy and responsive
    FAILURE: 1,    // Container is unhealthy and not responding properly
    WARNING: 2     // Container is in warning state with degraded performance
};

// Default health check endpoints for server responsiveness validation
const DEFAULT_HEALTH_ENDPOINTS = ['/health', '/hello'];

// Retry configuration for handling transient network issues and temporary server unavailability
const RETRY_ATTEMPTS = 3;           // Maximum number of health check retry attempts
const RETRY_DELAY_MS = 1000;        // Delay between retry attempts in milliseconds

/**
 * Main health check function that validates server responsiveness by making HTTP requests
 * to configured endpoints and returns appropriate Docker exit codes based on health status.
 * 
 * This function orchestrates the complete health check process including configuration loading,
 * endpoint validation, retry logic, and result aggregation. It handles all error conditions
 * gracefully and ensures proper Docker exit code reporting for container orchestration systems.
 * 
 * Process Flow:
 * 1. Load configuration from environment and server config modules
 * 2. Determine target server URL from configuration (hostname and port)
 * 3. Create list of health check endpoints to validate (/health, /hello)
 * 4. Execute health checks with timeout protection and retry logic
 * 5. Validate HTTP response status codes and content where applicable
 * 6. Aggregate health check results and determine overall health status
 * 7. Exit process with appropriate Docker health check status code
 * 8. Handle errors with informative logging and failure exit codes
 * 
 * @returns {Promise<void>} Promise that resolves after health check completion and process exit
 */
async function performDockerHealthCheck() {
    try {
        // Step 1: Load and validate configuration from environment and server config
        console.log('Docker health check starting...');
        console.log(`Environment: ${config.environment}`);
        console.log(`Server configuration: ${config.server.hostname}:${config.server.port}`);
        
        // Validate that essential configuration is available
        if (!config.server || !config.server.hostname || !config.server.port) {
            console.error('Invalid server configuration: missing hostname or port');
            exitWithDockerStatus(false, { error: 'Configuration validation failed' });
            return;
        }
        
        // Step 2: Construct base server URL for health check requests
        const serverUrl = `http://${config.server.hostname}:${config.server.port}`;
        console.log(`Health check target: ${serverUrl}`);
        
        // Step 3: Determine health check endpoints based on server configuration
        const healthEndpoints = [...DEFAULT_HEALTH_ENDPOINTS];
        console.log(`Health check endpoints: ${healthEndpoints.join(', ')}`);
        
        // Step 4: Execute health checks for all configured endpoints with retry logic
        const healthResults = [];
        let overallHealthy = true;
        
        for (const endpoint of healthEndpoints) {
            console.log(`Checking endpoint: ${endpoint}`);
            
            try {
                // Execute health check with retry logic for transient failures
                const result = await executeHealthCheckWithRetry(
                    () => checkEndpointHealth(endpoint, { 
                        timeout: HEALTH_CHECK_TIMEOUT_MS,
                        validateContent: endpoint === '/hello' // Content validation for hello endpoint
                    }),
                    RETRY_ATTEMPTS,
                    RETRY_DELAY_MS
                );
                
                healthResults.push({
                    endpoint,
                    ...result
                });
                
                // Track overall health status - any endpoint failure affects overall health
                if (!result.healthy) {
                    overallHealthy = false;
                    console.warn(`Endpoint ${endpoint} health check failed: ${result.error}`);
                } else {
                    console.log(`Endpoint ${endpoint} health check passed (${result.responseTime}ms)`);
                }
                
            } catch (error) {
                // Handle endpoint-specific errors and mark as unhealthy
                console.error(`Health check failed for endpoint ${endpoint}:`, error.message);
                healthResults.push({
                    endpoint,
                    healthy: false,
                    error: error.message,
                    responseTime: null
                });
                overallHealthy = false;
            }
        }
        
        // Step 5: Log comprehensive health check results
        logHealthCheckResult({
            overall: overallHealthy,
            endpoints: healthResults,
            server: serverUrl,
            timestamp: new Date().toISOString()
        }, config.logging.level === 'debug');
        
        // Step 6: Exit with appropriate Docker status code
        exitWithDockerStatus(overallHealthy, {
            endpoints: healthResults.length,
            successful: healthResults.filter(r => r.healthy).length,
            failed: healthResults.filter(r => !r.healthy).length
        });
        
    } catch (error) {
        // Handle top-level errors in health check orchestration
        console.error('Health check execution failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        logHealthCheckResult({
            overall: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, true);
        
        // Exit with failure status for critical health check errors
        exitWithDockerStatus(false, { 
            error: 'Health check execution failed',
            details: error.message 
        });
    }
}

/**
 * Performs HTTP request to specified endpoint and validates response to determine endpoint
 * health status with timeout protection and error handling.
 * 
 * This function creates and executes HTTP requests to individual health check endpoints,
 * measures response times, validates response content, and handles various error conditions
 * that may occur during health check execution.
 * 
 * Request Process:
 * 1. Construct complete URL for endpoint using server configuration
 * 2. Create HTTP request with configured timeout and headers
 * 3. Execute HTTP GET request to target endpoint
 * 4. Measure response time and validate against performance thresholds
 * 5. Check HTTP status code for success (200 OK) or acceptable responses
 * 6. Validate response content if specific content validation is required
 * 7. Return health check result with status, metrics, and error details
 * 8. Handle connection errors, timeouts, and HTTP error responses
 * 
 * @param {string} endpoint - URL path of endpoint to check (e.g., '/hello' or '/health')
 * @param {object} options - Health check options including timeout and validation criteria
 * @returns {Promise<object>} Health check result object with status, response time, and validation details
 */
async function checkEndpointHealth(endpoint, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || HEALTH_CHECK_TIMEOUT_MS;
    const validateContent = options.validateContent || false;
    
    try {
        // Create HTTP request configuration for health check
        const requestOptions = createHealthCheckRequest(endpoint, config.server);
        
        // Execute HTTP request with timeout protection
        const response = await new Promise((resolve, reject) => {
            const request = http.request(requestOptions, (res) => {
                let responseBody = '';
                
                // Collect response data
                res.on('data', (chunk) => {
                    responseBody += chunk.toString();
                });
                
                // Handle complete response
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: responseBody.trim()
                    });
                });
            });
            
            // Set request timeout to prevent hanging
            request.setTimeout(timeout, () => {
                request.destroy();
                reject(new Error(`Health check timeout after ${timeout}ms`));
            });
            
            // Handle request errors
            request.on('error', (error) => {
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
            
            // Send the request
            request.end();
        });
        
        // Calculate response time for performance validation
        const responseTime = Date.now() - startTime;
        
        // Validate server response including status code and content
        const isValid = validateServerResponse(response, endpoint, response.body);
        
        // Check performance thresholds if configured
        const performanceThreshold = performanceConfig.thresholds?.responseTime || HEALTH_CHECK_TIMEOUT_MS;
        const withinPerformanceThreshold = responseTime <= performanceThreshold;
        
        if (!withinPerformanceThreshold) {
            console.warn(`Response time ${responseTime}ms exceeds threshold ${performanceThreshold}ms for ${endpoint}`);
        }
        
        return {
            healthy: isValid && withinPerformanceThreshold,
            statusCode: response.statusCode,
            responseTime,
            contentValid: validateContent ? response.body === 'Hello world' : true,
            error: isValid && withinPerformanceThreshold ? null : 'Response validation failed'
        };
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        return {
            healthy: false,
            statusCode: null,
            responseTime,
            contentValid: false,
            error: error.message
        };
    }
}

/**
 * Validates HTTP response from server including status code verification, content validation
 * for known endpoints, and performance threshold checking.
 * 
 * This function performs comprehensive response validation to determine if the server response
 * indicates a healthy application state. It checks HTTP status codes, validates expected content
 * for specific endpoints, and ensures response format meets health check requirements.
 * 
 * Validation Process:
 * 1. Verify HTTP status code is 200 OK for successful health indication
 * 2. Check response headers for expected Content-Type and other required headers
 * 3. Validate response body content for known endpoints (/hello should return 'Hello world')
 * 4. Ensure response time meets performance thresholds for healthy operation
 * 5. Verify no error indicators in response headers or body content
 * 6. Return validation result indicating overall response health status
 * 
 * @param {object} response - HTTP response object from server request
 * @param {string} endpoint - Endpoint path that was requested for context-specific validation
 * @param {string} responseBody - Response body content for validation
 * @returns {boolean} True if response is valid and indicates healthy server, false otherwise
 */
function validateServerResponse(response, endpoint, responseBody) {
    // Step 1: Verify HTTP status code indicates success
    if (response.statusCode !== 200) {
        console.warn(`Invalid status code ${response.statusCode} for endpoint ${endpoint}`);
        return false;
    }
    
    // Step 2: Validate response headers for expected content type
    const contentType = response.headers['content-type'] || '';
    const expectedContentType = endpoint === '/health' ? 'application/json' : 'text/plain';
    
    if (!contentType.includes(expectedContentType.split('/')[1])) {
        console.warn(`Unexpected content type ${contentType} for endpoint ${endpoint}`);
        // Don't fail health check for content type mismatch, just log warning
    }
    
    // Step 3: Validate response body content for specific endpoints
    if (endpoint === '/hello') {
        if (responseBody !== 'Hello world') {
            console.warn(`Unexpected response content for /hello endpoint: "${responseBody}"`);
            return false;
        }
    }
    
    // Step 4: Check for health endpoint specific validation
    if (endpoint === '/health') {
        try {
            // Health endpoint should return JSON with status information
            const healthData = JSON.parse(responseBody);
            if (healthData.status !== 'ok' && healthData.status !== 'healthy') {
                console.warn(`Health endpoint reports unhealthy status: ${healthData.status}`);
                return false;
            }
        } catch (parseError) {
            // If health endpoint doesn't return valid JSON, still consider it healthy
            // if the HTTP response is successful (status 200)
            console.warn(`Health endpoint returned non-JSON response, treating as healthy`);
        }
    }
    
    // Step 5: Verify response body is not empty and contains expected content
    if (!responseBody || responseBody.length === 0) {
        console.warn(`Empty response body for endpoint ${endpoint}`);
        return false;
    }
    
    // Step 6: All validations passed - response indicates healthy server
    return true;
}

/**
 * Creates HTTP request configuration for health check endpoint with appropriate timeout
 * settings, headers, and error handling setup.
 * 
 * This function constructs the HTTP request options object used by the Node.js HTTP client
 * to perform health check requests. It sets appropriate headers, timeout values, and
 * connection settings optimized for health checking scenarios.
 * 
 * Configuration Process:
 * 1. Extract server hostname and port from configuration
 * 2. Construct request options object with HTTP method, path, and headers
 * 3. Set appropriate timeout values for health check responsiveness
 * 4. Configure User-Agent header to identify health check requests
 * 5. Set connection settings to avoid keep-alive for health checks
 * 6. Return configured request options ready for HTTP client usage
 * 
 * @param {string} endpoint - Target endpoint path for health check request
 * @param {object} serverConfig - Server configuration including hostname and port
 * @returns {object} HTTP request options object configured for health checking
 */
function createHealthCheckRequest(endpoint, serverConfig) {
    // Extract server connection details from configuration
    const { hostname, port } = serverConfig;
    
    // Create HTTP request options with health check specific settings
    const requestOptions = {
        hostname: hostname,
        port: port,
        path: endpoint,
        method: 'GET',
        timeout: HEALTH_CHECK_TIMEOUT_MS,
        headers: {
            'User-Agent': 'Docker-Health-Check/1.0.0',
            'Accept': '*/*',
            'Connection': 'close', // Close connection after request to avoid keep-alive
            'Cache-Control': 'no-cache', // Disable caching for fresh health status
            'Pragma': 'no-cache'
        },
        // Disable connection reuse for health checks
        agent: false
    };
    
    return requestOptions;
}

/**
 * Executes health check with configurable retry logic to handle transient network issues
 * and temporary server unavailability during container startup.
 * 
 * This function implements robust retry logic for health check operations, handling transient
 * failures that may occur during container startup, network issues, or temporary server
 * unavailability. It provides exponential backoff and comprehensive error tracking.
 * 
 * Retry Process:
 * 1. Execute initial health check attempt with error handling
 * 2. If health check fails, wait for configured retry delay period
 * 3. Attempt health check again up to maximum retry count
 * 4. Track retry attempts and aggregate error information
 * 5. Return successful result if any attempt succeeds within retry limit
 * 6. Return final failure result if all retry attempts are exhausted
 * 7. Log retry attempts and final result for debugging purposes
 * 
 * @param {function} healthCheckFunction - Function to execute for health checking
 * @param {number} maxRetries - Maximum number of retry attempts for failed health checks
 * @param {number} retryDelay - Delay between retry attempts in milliseconds
 * @returns {Promise<object>} Final health check result after retry attempts
 */
async function executeHealthCheckWithRetry(healthCheckFunction, maxRetries, retryDelay) {
    let lastError = null;
    let attempts = 0;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;
        
        try {
            console.log(`Health check attempt ${attempts}/${maxRetries + 1}`);
            
            // Execute health check function
            const result = await healthCheckFunction();
            
            // If health check succeeded, return immediately
            if (result.healthy) {
                if (attempt > 0) {
                    console.log(`Health check succeeded on attempt ${attempts} after ${attempt} retries`);
                }
                return result;
            }
            
            // Health check failed but no exception - continue with retries
            lastError = new Error(result.error || 'Health check failed');
            console.warn(`Health check attempt ${attempts} failed: ${result.error}`);
            
        } catch (error) {
            // Health check threw exception
            lastError = error;
            console.warn(`Health check attempt ${attempts} threw error: ${error.message}`);
        }
        
        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
            console.log(`Waiting ${retryDelay}ms before retry attempt ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    // All retry attempts exhausted - return failure result
    console.error(`All ${attempts} health check attempts failed`);
    return {
        healthy: false,
        error: lastError ? lastError.message : 'All retry attempts failed',
        attempts: attempts,
        retryExhausted: true
    };
}

/**
 * Logs health check results with appropriate detail level for Docker container logs
 * and debugging while maintaining concise output for production environments.
 * 
 * This function formats and outputs health check results in a structured format suitable
 * for container log collection and monitoring systems. It provides different levels of
 * detail based on the verbose flag and health check outcomes.
 * 
 * Logging Process:
 * 1. Format health check result for appropriate logging level
 * 2. Include health status, response time, and endpoint information
 * 3. Add error details and retry information if health check failed
 * 4. Log to console using appropriate level (info for success, error for failure)
 * 5. Include timestamp and container identification if available
 * 6. Ensure log format is compatible with Docker log collection
 * 
 * @param {object} healthResult - Complete health check result object with status and metrics
 * @param {boolean} verbose - Whether to include verbose logging details
 * @returns {void} No return value, performs logging side effects
 */
function logHealthCheckResult(healthResult, verbose = false) {
    const timestamp = healthResult.timestamp || new Date().toISOString();
    const logLevel = healthResult.overall ? 'INFO' : 'ERROR';
    const status = healthResult.overall ? 'HEALTHY' : 'UNHEALTHY';
    
    // Basic health check result logging
    console.log(`[${timestamp}] [${logLevel}] Docker Health Check: ${status}`);
    
    // Log endpoint-specific results if available
    if (healthResult.endpoints && Array.isArray(healthResult.endpoints)) {
        healthResult.endpoints.forEach(endpoint => {
            const endpointStatus = endpoint.healthy ? 'PASS' : 'FAIL';
            const responseTime = endpoint.responseTime ? `${endpoint.responseTime}ms` : 'N/A';
            
            console.log(`  - ${endpoint.endpoint}: ${endpointStatus} (${responseTime})`);
            
            // Include error details for failed endpoints
            if (!endpoint.healthy && endpoint.error) {
                console.log(`    Error: ${endpoint.error}`);
            }
        });
    }
    
    // Verbose logging includes additional diagnostic information
    if (verbose) {
        if (healthResult.server) {
            console.log(`  Server: ${healthResult.server}`);
        }
        
        if (healthResult.error) {
            console.log(`  Error Details: ${healthResult.error}`);
        }
        
        // Log performance information if available
        const healthyEndpoints = healthResult.endpoints?.filter(e => e.healthy).length || 0;
        const totalEndpoints = healthResult.endpoints?.length || 0;
        console.log(`  Endpoints: ${healthyEndpoints}/${totalEndpoints} healthy`);
    }
    
    // Log final health check summary
    console.log(`Docker Health Check Complete: ${status}`);
}

/**
 * Exits Node.js process with appropriate Docker health check status code based on
 * aggregated health check results and error conditions.
 * 
 * This function provides clean process termination with standardized Docker health check
 * exit codes that integrate properly with container orchestration systems. It logs final
 * status information and ensures graceful process shutdown.
 * 
 * Exit Process:
 * 1. Evaluate overall health status from aggregated health check results
 * 2. Log final health check summary with status and key metrics
 * 3. Determine appropriate Docker exit code (0 for healthy, 1 for unhealthy)
 * 4. Exit Node.js process with determined status code for Docker integration
 * 5. Ensure clean process termination without hanging resources
 * 
 * @param {boolean} isHealthy - Overall health status from health check execution
 * @param {object} healthResults - Detailed health check results for logging
 * @returns {void} No return value, exits process with status code
 */
function exitWithDockerStatus(isHealthy, healthResults = {}) {
    // Determine appropriate Docker exit code based on health status
    const exitCode = isHealthy ? DOCKER_EXIT_CODES.SUCCESS : DOCKER_EXIT_CODES.FAILURE;
    const statusMessage = isHealthy ? 'Container is healthy and responsive' : 'Container is unhealthy and not responding properly';
    
    // Log final health check summary before process exit
    console.log(`Final Health Status: ${statusMessage}`);
    
    if (healthResults.endpoints !== undefined) {
        console.log(`Endpoints Checked: ${healthResults.endpoints}`);
        console.log(`Successful: ${healthResults.successful || 0}`);
        console.log(`Failed: ${healthResults.failed || 0}`);
    }
    
    if (healthResults.error) {
        console.error(`Health Check Error: ${healthResults.error}`);
        if (healthResults.details) {
            console.error(`Error Details: ${healthResults.details}`);
        }
    }
    
    // Log exit code for debugging and monitoring
    console.log(`Exiting with Docker health check code: ${exitCode}`);
    
    // Exit process with appropriate status code for Docker integration
    // Exit code 0 = healthy, 1 = unhealthy, 2 = warning (currently not used)
    process.exit(exitCode);
}

// Execute main health check function when script is run directly
// This allows the script to be executed as a Docker health check command
if (require.main === module) {
    performDockerHealthCheck().catch(error => {
        console.error('Unhandled error in Docker health check:', error);
        process.exit(DOCKER_EXIT_CODES.FAILURE);
    });
}

// Export functions for testing and module integration if needed
module.exports = {
    performDockerHealthCheck,
    checkEndpointHealth,
    validateServerResponse,
    createHealthCheckRequest,
    executeHealthCheckWithRetry,
    logHealthCheckResult,
    exitWithDockerStatus,
    DOCKER_EXIT_CODES,
    DEFAULT_HEALTH_ENDPOINTS,
    HEALTH_CHECK_TIMEOUT_MS,
    RETRY_ATTEMPTS,
    RETRY_DELAY_MS
};