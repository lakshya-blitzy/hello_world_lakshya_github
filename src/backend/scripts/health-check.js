#!/usr/bin/env node

// Node.js Tutorial HTTP Server - Comprehensive Health Check Command-Line Script
// Provides command-line health checking functionality for Node.js HTTP server application
// Supports local health checks, remote HTTP endpoint validation, and CI/CD integration
// Zero external dependencies - uses only Node.js built-in modules for educational value

// Built-in Node.js modules for CLI functionality and HTTP client operations
const process = require('node:process'); // Built-in Node.js process module - stable
const http = require('node:http'); // Built-in Node.js HTTP client module - stable  
const { performance } = require('node:perf_hooks'); // Built-in Node.js performance API - stable
const { URL } = require('node:url'); // Built-in Node.js URL parsing module - stable

// Import internal application dependencies for health checking and configuration
const { HealthChecker, performHealthCheck, HEALTH_STATUS_TYPES, formatHealthSummary } = require('../utils/health-checker.js');
const { config } = require('../config/environment.js');
const { logger } = require('../lib/logger.js');

// Script identification and version information
const SCRIPT_NAME = 'health-check';
const VERSION = '1.0.0';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEALTH_ENDPOINT = '/health';

// Exit codes for CI/CD pipeline integration and automated health validation
const EXIT_CODES = {
    SUCCESS: 0,      // Health check passed - all systems healthy
    DEGRADED: 1,     // Health check shows degraded performance or warnings
    UNHEALTHY: 2,    // Health check failed - system unhealthy
    ERROR: 3         // Health check script error - execution failure
};

// Output format constants for different consumption scenarios
const OUTPUT_FORMATS = {
    JSON: 'json',     // Structured JSON output for programmatic consumption
    TEXT: 'text',     // Human-readable text output with color coding
    SUMMARY: 'summary' // Condensed summary output with key indicators
};

/**
 * Main entry point for health check script that parses command-line arguments, executes health checks,
 * formats output, and sets appropriate exit codes for CI/CD and monitoring integration
 * @returns {Promise<void>} Promise resolving when health check script execution is complete
 */
async function main() {
    let healthCheckResult = null;
    const scriptStartTime = performance.now();
    
    try {
        // Parse command-line arguments for health check mode, output format, and configuration options
        const options = parseCommandLineArguments(process.argv.slice(2));
        
        // Handle help request immediately without executing health checks
        if (options.help) {
            displayHelp();
            process.exit(EXIT_CODES.SUCCESS);
        }
        
        // Validate configuration to ensure proper script execution parameters
        validateConfiguration(options);
        
        // Display script banner with version and execution information if verbose output enabled
        if (options.verbose) {
            console.log(`\n=== ${SCRIPT_NAME.toUpperCase()} v${VERSION} ===`);
            console.log(`Mode: ${options.mode}`);
            console.log(`Output Format: ${options.format}`);
            console.log(`Timeout: ${options.timeout}ms`);
            if (options.mode !== 'local') {
                console.log(`Target URL: ${options.url}`);
            }
            console.log(`Started: ${new Date().toISOString()}\n`);
        }
        
        // Execute health check based on specified mode (local, remote, or combined)
        logger.info('Health check script execution started', {
            mode: options.mode,
            format: options.format,
            timeout: options.timeout,
            url: options.url
        });
        
        switch (options.mode) {
            case 'local':
                healthCheckResult = await executeLocalHealthCheck(options);
                break;
            case 'remote':
                healthCheckResult = await executeRemoteHealthCheck(options.url, options);
                break;
            case 'combined':
                healthCheckResult = await executeCombinedHealthCheck(options.url, options);
                break;
            default:
                throw new Error(`Invalid health check mode: ${options.mode}`);
        }
        
        // Format health check results according to requested output format (JSON, text, summary)
        const formattedOutput = formatHealthOutput(healthCheckResult, options.format, options);
        
        // Display formatted health results to console or specified output file
        if (options.output) {
            try {
                const fs = require('node:fs');
                await fs.promises.writeFile(options.output, formattedOutput, 'utf8');
                console.log(`Health check results written to: ${options.output}`);
            } catch (writeError) {
                logger.warn('Failed to write output file, displaying to console', { 
                    error: writeError.message,
                    outputPath: options.output 
                });
                console.log(formattedOutput);
            }
        } else {
            console.log(formattedOutput);
        }
        
        // Calculate total script execution time for performance monitoring
        const scriptExecutionTime = performance.now() - scriptStartTime;
        
        // Log successful completion with execution time and health status
        logger.info('Health check script completed successfully', {
            mode: options.mode,
            overallStatus: healthCheckResult.overall_status,
            healthScore: healthCheckResult.health_score,
            executionTime: Math.round(scriptExecutionTime),
            format: options.format
        });
        
        // Determine appropriate exit code based on health status and error conditions
        const exitCode = determineExitCode(healthCheckResult);
        
        // Display exit information if verbose mode is enabled
        if (options.verbose) {
            console.log(`\nExecution completed in ${Math.round(scriptExecutionTime)}ms`);
            console.log(`Exit code: ${exitCode} (${getExitCodeDescription(exitCode)})`);
        }
        
        // Exit process with status code for CI/CD pipeline and monitoring system integration
        process.exit(exitCode);
        
    } catch (error) {
        // Handle script execution errors with proper logging and exit code management
        handleScriptError(error, 'Main script execution');
    }
}

/**
 * Parses and validates command-line arguments to configure health check execution including mode,
 * timeout, output format, and target server settings
 * @param {Array} args - Command-line arguments array from process.argv
 * @returns {object} Parsed configuration object with health check settings and options
 */
function parseCommandLineArguments(args) {
    // Initialize default configuration options with sensible defaults
    const options = {
        mode: 'local',
        timeout: DEFAULT_TIMEOUT_MS,
        format: 'text',
        url: `http://${config.server?.hostname || '127.0.0.1'}:${config.server?.port || 3000}`,
        endpoint: DEFAULT_HEALTH_ENDPOINT,
        verbose: false,
        help: false,
        output: null
    };
    
    // Parse command-line arguments using built-in argument processing logic
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        
        switch (arg) {
            case '--mode':
            case '-m':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--mode requires a value (local, remote, combined)');
                }
                if (!['local', 'remote', 'combined'].includes(nextArg)) {
                    throw new Error(`Invalid mode: ${nextArg}. Must be local, remote, or combined`);
                }
                options.mode = nextArg;
                i++; // Skip next argument as it's the value
                break;
                
            case '--url':
            case '-u':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--url requires a URL value');
                }
                // Validate URL format and accessibility for remote health checks
                try {
                    new URL(nextArg);
                    options.url = nextArg;
                } catch (urlError) {
                    throw new Error(`Invalid URL format: ${nextArg}`);
                }
                i++;
                break;
                
            case '--timeout':
            case '-t':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--timeout requires a numeric value in milliseconds');
                }
                const timeout = parseInt(nextArg, 10);
                if (isNaN(timeout) || timeout <= 0) {
                    throw new Error(`Invalid timeout value: ${nextArg}. Must be positive integer`);
                }
                options.timeout = timeout;
                i++;
                break;
                
            case '--format':
            case '-f':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--format requires a value (json, text, summary)');
                }
                if (!Object.values(OUTPUT_FORMATS).includes(nextArg)) {
                    throw new Error(`Invalid format: ${nextArg}. Must be json, text, or summary`);
                }
                options.format = nextArg;
                i++;
                break;
                
            case '--output':
            case '-o':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--output requires a file path');
                }
                options.output = nextArg;
                i++;
                break;
                
            case '--endpoint':
            case '-e':
                if (!nextArg || nextArg.startsWith('-')) {
                    throw new Error('--endpoint requires a URL path');
                }
                if (!nextArg.startsWith('/')) {
                    throw new Error(`Invalid endpoint path: ${nextArg}. Must start with /`);
                }
                options.endpoint = nextArg;
                i++;
                break;
                
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
                
            case '--help':
            case '-h':
                options.help = true;
                break;
                
            default:
                if (arg.startsWith('-')) {
                    throw new Error(`Unknown option: ${arg}. Use --help for usage information`);
                }
                // Ignore non-option arguments
                break;
        }
    }
    
    // Validate argument combinations and detect conflicting options
    if (options.mode === 'local' && args.includes('--url')) {
        logger.warn('URL parameter ignored for local health check mode');
    }
    
    if ((options.mode === 'remote' || options.mode === 'combined') && !options.url) {
        throw new Error('Remote health check mode requires --url parameter');
    }
    
    // Return complete configuration object for health check execution
    return options;
}

/**
 * Executes comprehensive local health check by instantiating HealthChecker and performing system,
 * process, and application health assessment without network requests
 * @param {object} options - Health check configuration options including timeout and check categories
 * @returns {Promise<object>} Complete local health check results with status, metrics, and diagnostic information
 */
async function executeLocalHealthCheck(options) {
    const localHealthStart = performance.now();
    
    try {
        // Log health check initiation with correlation ID and execution timestamp
        logger.info('Executing local health check', {
            timeout: options.timeout,
            categories: ['server', 'system', 'process', 'performance']
        });
        
        // Initialize HealthChecker instance with configuration and timeout settings
        const healthCheckOptions = {
            timeout: options.timeout,
            categories: ['server', 'system', 'process', 'performance']
        };
        
        // Execute comprehensive health check covering server, system, process, and performance
        const healthResults = await performHealthCheck(healthCheckOptions);
        
        // Measure health check execution time using Node.js Performance API
        const executionTime = performance.now() - localHealthStart;
        
        // Add execution metadata including script version and check timestamp
        const enhancedResults = {
            ...healthResults,
            check_type: 'local',
            script_version: VERSION,
            execution_metadata: {
                script_execution_time_ms: Math.round(executionTime * 100) / 100,
                node_version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        // Log health check completion with execution time and overall status
        logger.info('Local health check completed', {
            overallStatus: healthResults.overall_status,
            healthScore: healthResults.health_score,
            executionTime: Math.round(executionTime)
        });
        
        // Return complete health check results with local system assessment
        return enhancedResults;
        
    } catch (error) {
        logger.error('Local health check execution failed', { error: error.message });
        throw new Error(`Local health check failed: ${error.message}`);
    }
}

/**
 * Executes remote health check by making HTTP request to server health endpoint and validating
 * response format, timing, and health status information
 * @param {string} serverUrl - Target server URL for health endpoint request
 * @param {object} options - Remote health check options including timeout and endpoint path
 * @returns {Promise<object>} Remote health check results with endpoint response and connectivity status
 */
async function executeRemoteHealthCheck(serverUrl, options) {
    const remoteHealthStart = performance.now();
    
    try {
        // Construct health endpoint URL using server base URL and configured health path
        const healthUrl = new URL(options.endpoint, serverUrl);
        
        // Log remote health check initiation with target URL and timeout
        logger.info('Executing remote health check', {
            url: healthUrl.toString(),
            timeout: options.timeout,
            endpoint: options.endpoint
        });
        
        // Record request start time for response time measurement
        const requestStartTime = performance.now();
        
        // Execute HTTP GET request to health endpoint with error handling
        const response = await makeHttpRequest(healthUrl.toString(), options.timeout);
        
        // Measure response time and validate HTTP status code (200 for healthy)
        const responseTime = performance.now() - requestStartTime;
        
        // Parse JSON response and validate health response schema
        let healthData = null;
        try {
            if (response.body) {
                healthData = JSON.parse(response.body);
            }
        } catch (parseError) {
            logger.warn('Failed to parse health endpoint response as JSON', {
                error: parseError.message,
                body: response.body.substring(0, 200)
            });
        }
        
        // Determine health status based on HTTP status code and response content
        let overallStatus = HEALTH_STATUS_TYPES.HEALTHY;
        if (response.statusCode !== 200) {
            overallStatus = response.statusCode >= 500 ? 
                HEALTH_STATUS_TYPES.UNHEALTHY : 
                HEALTH_STATUS_TYPES.DEGRADED;
        }
        
        // Calculate health score based on response time and status code
        let healthScore = 100;
        if (response.statusCode !== 200) {
            healthScore = response.statusCode >= 500 ? 20 : 60;
        } else if (responseTime > 1000) {
            healthScore = 70; // Degraded performance for slow responses
        }
        
        // Prepare remote health check results object
        const remoteResults = {
            overall_status: overallStatus,
            health_score: healthScore,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round((performance.now() - remoteHealthStart) * 100) / 100,
            check_type: 'remote',
            script_version: VERSION,
            remote_endpoint: {
                url: healthUrl.toString(),
                status_code: response.statusCode,
                response_time_ms: Math.round(responseTime * 100) / 100,
                content_length: response.body ? response.body.length : 0,
                health_data: healthData
            },
            connectivity: {
                reachable: response.statusCode !== null,
                dns_resolution: true, // Successfully resolved if we got a response
                http_connection: response.statusCode !== null
            },
            execution_metadata: {
                script_execution_time_ms: Math.round((performance.now() - remoteHealthStart) * 100) / 100,
                node_version: process.version,
                platform: process.platform
            }
        };
        
        // Log remote health check results including response time and status
        logger.info('Remote health check completed', {
            url: healthUrl.toString(),
            statusCode: response.statusCode,
            responseTime: Math.round(responseTime),
            overallStatus: overallStatus
        });
        
        // Return formatted remote health check results with connectivity and endpoint status
        return remoteResults;
        
    } catch (error) {
        logger.error('Remote health check execution failed', {
            url: serverUrl,
            error: error.message
        });
        
        // Return error health check result for remote connectivity failure
        return {
            overall_status: HEALTH_STATUS_TYPES.UNHEALTHY,
            health_score: 0,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round((performance.now() - remoteHealthStart) * 100) / 100,
            check_type: 'remote',
            script_version: VERSION,
            error: {
                message: error.message,
                type: 'connectivity_failure'
            },
            remote_endpoint: {
                url: serverUrl,
                status_code: null,
                response_time_ms: 0,
                reachable: false
            },
            connectivity: {
                reachable: false,
                dns_resolution: false,
                http_connection: false
            }
        };
    }
}

/**
 * Executes both local and remote health checks, correlates results, and provides comprehensive
 * health assessment combining system health and endpoint accessibility
 * @param {string} serverUrl - Target server URL for remote health endpoint request
 * @param {object} options - Combined health check configuration with local and remote options
 * @returns {Promise<object>} Combined health check results with local system health and remote endpoint status
 */
async function executeCombinedHealthCheck(serverUrl, options) {
    const combinedHealthStart = performance.now();
    
    try {
        // Log combined health check initiation with both local and remote components
        logger.info('Executing combined health check', {
            localComponents: ['server', 'system', 'process', 'performance'],
            remoteUrl: serverUrl,
            timeout: options.timeout
        });
        
        // Execute local health check to assess system and application health
        const localResults = await executeLocalHealthCheck(options);
        
        // Execute remote health check to validate endpoint accessibility and response
        const remoteResults = await executeRemoteHealthCheck(serverUrl, options);
        
        // Correlate local and remote health results to identify consistency issues
        const consistencyCheck = correlateHealthResults(localResults, remoteResults);
        
        // Determine overall health status based on both local and remote assessments
        const overallStatus = determineOverallHealthStatus(localResults, remoteResults);
        
        // Calculate combined health score considering local system and endpoint health
        const combinedHealthScore = calculateCombinedHealthScore(localResults, remoteResults);
        
        // Generate recommendations based on combined health analysis
        const recommendations = generateCombinedRecommendations(localResults, remoteResults, consistencyCheck);
        
        // Create comprehensive combined health assessment object
        const combinedResults = {
            overall_status: overallStatus,
            health_score: combinedHealthScore,
            timestamp: new Date().toISOString(),
            execution_time_ms: Math.round((performance.now() - combinedHealthStart) * 100) / 100,
            check_type: 'combined',
            script_version: VERSION,
            local_health: localResults,
            remote_health: remoteResults,
            consistency_analysis: consistencyCheck,
            combined_metrics: {
                local_vs_remote_correlation: consistencyCheck.correlation_score,
                system_endpoint_alignment: consistencyCheck.alignment,
                overall_reliability: calculateReliabilityScore(localResults, remoteResults)
            },
            alerts: generateCombinedAlerts(localResults, remoteResults, consistencyCheck),
            recommendations: recommendations,
            execution_metadata: {
                script_execution_time_ms: Math.round((performance.now() - combinedHealthStart) * 100) / 100,
                node_version: process.version,
                platform: process.platform
            }
        };
        
        // Log combined health check completion with correlation analysis
        logger.info('Combined health check completed', {
            overallStatus: overallStatus,
            combinedScore: combinedHealthScore,
            localScore: localResults.health_score,
            remoteScore: remoteResults.health_score,
            correlationScore: consistencyCheck.correlation_score
        });
        
        // Return comprehensive health assessment with local and remote results
        return combinedResults;
        
    } catch (error) {
        logger.error('Combined health check execution failed', { error: error.message });
        throw new Error(`Combined health check failed: ${error.message}`);
    }
}

/**
 * Formats health check results according to specified output format (JSON, text, summary) for console
 * display, file output, or monitoring system consumption
 * @param {object} healthResults - Complete health check results to format
 * @param {string} format - Output format (json, text, summary)
 * @param {object} options - Formatting options including verbosity and color settings
 * @returns {string} Formatted health output string ready for display or file writing
 */
function formatHealthOutput(healthResults, format, options = {}) {
    try {
        // Determine output format and apply format-specific processing
        switch (format) {
            case OUTPUT_FORMATS.JSON:
                // Format JSON output with proper indentation and schema compliance
                return JSON.stringify(healthResults, null, 2);
                
            case OUTPUT_FORMATS.TEXT:
                // Generate human-readable text output with color coding if terminal supports it
                return formatTextOutput(healthResults, options);
                
            case OUTPUT_FORMATS.SUMMARY:
                // Create summary output with key health indicators and status information
                return formatSummaryOutput(healthResults, options);
                
            default:
                throw new Error(`Invalid output format: ${format}`);
        }
    } catch (error) {
        logger.error('Health output formatting failed', { error: error.message, format });
        return `Error formatting health output: ${error.message}`;
    }
}

/**
 * Formats health results as human-readable text with colors and detailed information
 * @param {object} healthResults - Health check results to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted text output
 */
function formatTextOutput(healthResults, options) {
    const lines = [];
    const useColors = process.stdout.isTTY && !options.noColor;
    
    // Color codes for different health statuses
    const colors = {
        healthy: useColors ? '\x1b[32m' : '', // Green
        degraded: useColors ? '\x1b[33m' : '', // Yellow
        unhealthy: useColors ? '\x1b[31m' : '', // Red
        reset: useColors ? '\x1b[0m' : ''
    };
    
    // Health check header with overall status
    lines.push(`${'='.repeat(60)}`);
    lines.push(`HEALTH CHECK REPORT - ${healthResults.check_type?.toUpperCase() || 'UNKNOWN'}`);
    lines.push(`${'='.repeat(60)}`);
    
    // Overall health status with color coding
    const statusColor = colors[healthResults.overall_status] || colors.unhealthy;
    lines.push(`Overall Status: ${statusColor}${healthResults.overall_status?.toUpperCase() || 'UNKNOWN'}${colors.reset}`);
    lines.push(`Health Score: ${healthResults.health_score || 0}/100`);
    lines.push(`Timestamp: ${healthResults.timestamp || new Date().toISOString()}`);
    lines.push(`Execution Time: ${healthResults.execution_time_ms || 0}ms`);
    lines.push('');
    
    // Include health recommendations and alerts in formatted output
    if (healthResults.alerts && healthResults.alerts.length > 0) {
        lines.push('ALERTS:');
        healthResults.alerts.forEach(alert => {
            lines.push(`  ${colors.unhealthy}⚠${colors.reset} ${alert}`);
        });
        lines.push('');
    }
    
    // Add execution metadata and timestamp information
    if (healthResults.recommendations && healthResults.recommendations.length > 0) {
        lines.push('RECOMMENDATIONS:');
        healthResults.recommendations.forEach(recommendation => {
            lines.push(`  • ${recommendation}`);
        });
        lines.push('');
    }
    
    // Detailed health check results for verbose output
    if (options.verbose && healthResults.checks) {
        lines.push('DETAILED RESULTS:');
        Object.entries(healthResults.checks).forEach(([category, results]) => {
            const categoryStatus = results.status || 'unknown';
            const categoryColor = colors[categoryStatus] || '';
            lines.push(`  ${category.toUpperCase()}: ${categoryColor}${categoryStatus.toUpperCase()}${colors.reset}`);
        });
        lines.push('');
    }
    
    // Footer with script information
    lines.push(`Generated by ${SCRIPT_NAME} v${VERSION}`);
    lines.push(`${'='.repeat(60)}`);
    
    return lines.join('\n');
}

/**
 * Formats health results as condensed summary with key indicators
 * @param {object} healthResults - Health check results to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted summary output
 */
function formatSummaryOutput(healthResults, options) {
    const summary = formatHealthSummary(healthResults);
    const lines = [];
    
    // Summary header
    lines.push(`HEALTH SUMMARY - ${healthResults.check_type?.toUpperCase() || 'UNKNOWN'}`);
    lines.push(`Status: ${summary.status} (Score: ${summary.score}/100)`);
    lines.push(`Response Time: ${summary.performance?.response_time_ms || 0}ms`);
    
    // Key metrics
    if (summary.resource_usage) {
        lines.push(`Memory: ${summary.resource_usage.memory_percent || 0}%`);
        lines.push(`CPU: ${summary.resource_usage.cpu_percent || 0}%`);
    }
    
    // Critical alerts only
    if (summary.alerts && summary.alerts.length > 0) {
        lines.push(`Alerts: ${summary.alerts.length}`);
    }
    
    return lines.join(' | ');
}

/**
 * Determines appropriate process exit code based on health check results for CI/CD pipeline
 * integration and monitoring system compatibility
 * @param {object} healthResults - Health check results with overall status and component health
 * @returns {number} Process exit code (0 for healthy, 1 for degraded, 2 for unhealthy, 3 for error)
 */
function determineExitCode(healthResults) {
    // Handle missing or invalid health results
    if (!healthResults || !healthResults.overall_status) {
        logger.warn('Health results missing or invalid, returning error exit code');
        return EXIT_CODES.ERROR;
    }
    
    // Map health status to appropriate exit codes for CI/CD integration
    switch (healthResults.overall_status) {
        case HEALTH_STATUS_TYPES.HEALTHY:
            // Return exit code 0 for healthy status indicating successful health validation
            return EXIT_CODES.SUCCESS;
            
        case HEALTH_STATUS_TYPES.DEGRADED:
            // Return exit code 1 for degraded status indicating performance issues or warnings
            return EXIT_CODES.DEGRADED;
            
        case HEALTH_STATUS_TYPES.UNHEALTHY:
            // Return exit code 2 for unhealthy status indicating critical health failures
            return EXIT_CODES.UNHEALTHY;
            
        case HEALTH_STATUS_TYPES.UNKNOWN:
        default:
            // Return exit code 3 for error conditions including health check execution failures
            logger.warn('Unknown health status, returning error exit code', {
                status: healthResults.overall_status
            });
            return EXIT_CODES.ERROR;
    }
}

/**
 * Displays comprehensive help information including usage examples, command-line options, output
 * formats, and integration examples for CI/CD and monitoring
 * @returns {void} No return value - displays help information to console
 */
function displayHelp() {
    const helpText = `
${SCRIPT_NAME.toUpperCase()} v${VERSION} - Node.js HTTP Server Health Check Tool

DESCRIPTION:
    Comprehensive health checking script for Node.js HTTP server application.
    Supports local system health checks, remote endpoint validation, and combined
    assessment for monitoring integration and CI/CD pipeline health validation.

USAGE:
    node ${SCRIPT_NAME}.js [OPTIONS]

HEALTH CHECK MODES:
    local       Perform local system health check (default)
    remote      Check remote HTTP health endpoint
    combined    Execute both local and remote health checks

COMMAND-LINE OPTIONS:
    -m, --mode <mode>        Health check mode (local|remote|combined)
                            Default: local

    -u, --url <url>          Server URL for remote health checks
                            Default: http://127.0.0.1:3000
                            Example: --url http://localhost:3000

    -t, --timeout <ms>       Health check timeout in milliseconds
                            Default: 10000
                            Example: --timeout 5000

    -f, --format <format>    Output format (json|text|summary)
                            Default: text
                            Example: --format json

    -o, --output <file>      Output file path (defaults to console)
                            Example: --output health-report.json

    -e, --endpoint <path>    Health endpoint path
                            Default: /health
                            Example: --endpoint /api/health

    -v, --verbose           Enable verbose output with detailed information

    -h, --help              Display this help information

OUTPUT FORMATS:
    json      Structured JSON output for programmatic consumption
              - CI/CD pipeline integration
              - Monitoring system consumption
              - Log aggregation

    text      Human-readable text output with color coding
              - Manual health checking
              - Development debugging
              - Terminal-based monitoring

    summary   Condensed summary output with key indicators
              - Quick health status checks
              - Dashboard displays
              - Automated notifications

EXIT CODES:
    0         SUCCESS - Health check passed, all systems healthy
    1         DEGRADED - Performance issues or warnings detected
    2         UNHEALTHY - Critical health failures, system unhealthy
    3         ERROR - Health check script execution failure

USAGE EXAMPLES:

    Basic Examples:
        node ${SCRIPT_NAME}.js
        node ${SCRIPT_NAME}.js --mode local --format summary
        node ${SCRIPT_NAME}.js --mode remote --url http://localhost:3000

    CI/CD Integration:
        # Pre-deployment health validation
        node ${SCRIPT_NAME}.js --mode local --format json --timeout 5000

        # Post-deployment endpoint verification
        node ${SCRIPT_NAME}.js --mode remote --url \$DEPLOY_URL --format summary

        # Comprehensive health assessment
        node ${SCRIPT_NAME}.js --mode combined --format json --output health-report.json

    Monitoring Integration:
        # Quick status check for monitoring systems
        node ${SCRIPT_NAME}.js --format summary --timeout 3000

        # Detailed health report with verbose output
        node ${SCRIPT_NAME}.js --verbose --format text --output /var/log/health.log

        # JSON output for log aggregation systems
        node ${SCRIPT_NAME}.js --format json >> /var/log/health-checks.jsonl

    Development Workflow:
        # Local development health check
        node ${SCRIPT_NAME}.js --verbose

        # Remote endpoint testing during development
        node ${SCRIPT_NAME}.js --mode remote --url http://localhost:3000 --verbose

INTEGRATION SCENARIOS:

    Kubernetes Liveness Probe:
        livenessProbe:
          exec:
            command: ["node", "/app/scripts/health-check.js", "--mode", "local", "--timeout", "5000"]
          initialDelaySeconds: 30
          periodSeconds: 10

    Docker Health Check:
        HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
          CMD node /app/scripts/health-check.js --mode local --format summary || exit 1

    GitHub Actions Workflow:
        - name: Health Check
          run: |
            node src/backend/scripts/health-check.js --mode combined --format json
            echo "Health check completed with exit code: \$?"

    Cron Job Monitoring:
        # Check application health every 5 minutes
        */5 * * * * /usr/bin/node /app/health-check.js --format json >> /var/log/health.log 2>&1

EDUCATIONAL FEATURES:
    - Command-line interface development patterns
    - HTTP client usage for health endpoint requests
    - Process exit codes and CI/CD integration
    - Health monitoring methodologies
    - Error handling and logging in CLI applications

For more information, visit: https://nodejs.org/docs/latest/api/
Report issues: https://github.com/your-repo/issues
`;
    
    console.log(helpText);
}

/**
 * Handles script execution errors with proper logging, error formatting, and exit code management
 * for robust CLI operation and debugging support
 * @param {Error} error - Error object with stack trace and error details
 * @param {string} context - Error context describing where the error occurred
 * @returns {void} No return value - logs error and exits process with error code
 */
function handleScriptError(error, context) {
    // Log error information with context and stack trace for debugging
    logger.error('Health check script error', {
        context: context,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Format error message for console output with user-friendly information
    const errorMessage = `
ERROR: Health check script execution failed

Context: ${context}
Error: ${error.message}
Timestamp: ${new Date().toISOString()}

Use --help for usage information or check logs for detailed error information.
    `.trim();
    
    // Display error message to console with appropriate formatting
    console.error(errorMessage);
    
    // Exit process gracefully with error cleanup if necessary
    process.exit(EXIT_CODES.ERROR);
}

/**
 * Validates health check configuration parameters including server URLs, timeouts, and output
 * settings to ensure proper script execution
 * @param {object} config - Configuration object to validate
 * @returns {boolean} True if configuration is valid, throws error with details if invalid
 */
function validateConfiguration(config) {
    // Validate timeout values are positive integers within reasonable ranges
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
        throw new Error(`Invalid timeout: ${config.timeout}ms. Must be between 1000-300000ms`);
    }
    
    // Validate server URL format and accessibility for remote health checks
    if ((config.mode === 'remote' || config.mode === 'combined') && config.url) {
        try {
            const url = new URL(config.url);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error(`Invalid URL protocol: ${url.protocol}. Must be http: or https:`);
            }
        } catch (urlError) {
            throw new Error(`Invalid server URL: ${config.url}. ${urlError.message}`);
        }
    }
    
    // Validate output format is supported and file output paths are writable
    if (config.format && !Object.values(OUTPUT_FORMATS).includes(config.format)) {
        throw new Error(`Invalid output format: ${config.format}. Must be json, text, or summary`);
    }
    
    // Verify health endpoint path format and URL construction validity
    if (config.endpoint && !config.endpoint.startsWith('/')) {
        throw new Error(`Invalid health endpoint: ${config.endpoint}. Must start with /`);
    }
    
    // Validate output file path if specified
    if (config.output) {
        try {
            const path = require('node:path');
            const outputDir = path.dirname(config.output);
            
            // Check if directory exists or can be created
            const fs = require('node:fs');
            if (!fs.existsSync(outputDir)) {
                throw new Error(`Output directory does not exist: ${outputDir}`);
            }
        } catch (pathError) {
            throw new Error(`Invalid output path: ${config.output}. ${pathError.message}`);
        }
    }
    
    // Return true if all validation checks pass successfully
    return true;
}

/**
 * Makes HTTP request to specified URL with timeout protection and error handling
 * @param {string} url - Target URL for HTTP request
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<object>} HTTP response object with status code, headers, and body
 */
function makeHttpRequest(url, timeout) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: timeout,
            headers: {
                'User-Agent': `${SCRIPT_NAME}/${VERSION}`,
                'Accept': 'application/json, text/plain, */*',
                'Connection': 'close'
            }
        };
        
        const request = http.request(requestOptions, (response) => {
            let body = '';
            
            response.on('data', (chunk) => {
                body += chunk;
            });
            
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: body
                });
            });
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.end();
    });
}

/**
 * Correlates local and remote health results to identify consistency issues
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @returns {object} Correlation analysis object
 */
function correlateHealthResults(localResults, remoteResults) {
    const localScore = localResults.health_score || 0;
    const remoteScore = remoteResults.health_score || 0;
    const scoreDifference = Math.abs(localScore - remoteScore);
    
    let correlationScore = 100;
    let alignment = 'aligned';
    
    if (scoreDifference > 20) {
        correlationScore = 60;
        alignment = 'misaligned';
    } else if (scoreDifference > 10) {
        correlationScore = 80;
        alignment = 'partially_aligned';
    }
    
    return {
        correlation_score: correlationScore,
        alignment: alignment,
        local_score: localScore,
        remote_score: remoteScore,
        score_difference: scoreDifference,
        consistency_issues: scoreDifference > 20 ? ['Significant health score difference between local and remote checks'] : []
    };
}

/**
 * Determines overall health status from combined local and remote results
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @returns {string} Overall combined health status
 */
function determineOverallHealthStatus(localResults, remoteResults) {
    const localStatus = localResults.overall_status;
    const remoteStatus = remoteResults.overall_status;
    
    // If either is unhealthy, overall is unhealthy
    if (localStatus === HEALTH_STATUS_TYPES.UNHEALTHY || remoteStatus === HEALTH_STATUS_TYPES.UNHEALTHY) {
        return HEALTH_STATUS_TYPES.UNHEALTHY;
    }
    
    // If either is degraded, overall is degraded
    if (localStatus === HEALTH_STATUS_TYPES.DEGRADED || remoteStatus === HEALTH_STATUS_TYPES.DEGRADED) {
        return HEALTH_STATUS_TYPES.DEGRADED;
    }
    
    // If both are healthy, overall is healthy
    if (localStatus === HEALTH_STATUS_TYPES.HEALTHY && remoteStatus === HEALTH_STATUS_TYPES.HEALTHY) {
        return HEALTH_STATUS_TYPES.HEALTHY;
    }
    
    // Default to unknown for any other combination
    return HEALTH_STATUS_TYPES.UNKNOWN;
}

/**
 * Calculates combined health score from local and remote results
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @returns {number} Combined health score (0-100)
 */
function calculateCombinedHealthScore(localResults, remoteResults) {
    const localScore = localResults.health_score || 0;
    const remoteScore = remoteResults.health_score || 0;
    
    // Weight local health check higher than remote (70/30 split)
    const combinedScore = Math.round((localScore * 0.7) + (remoteScore * 0.3));
    
    return Math.max(0, Math.min(100, combinedScore));
}

/**
 * Calculates system reliability score based on local and remote health consistency
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @returns {number} Reliability score (0-100)
 */
function calculateReliabilityScore(localResults, remoteResults) {
    const localScore = localResults.health_score || 0;
    const remoteScore = remoteResults.health_score || 0;
    const scoreDifference = Math.abs(localScore - remoteScore);
    
    // Higher reliability when local and remote scores are consistent
    let reliabilityScore = 100 - (scoreDifference * 2);
    
    // Additional factors for reliability assessment
    if (remoteResults.remote_endpoint?.reachable === false) {
        reliabilityScore -= 30; // Penalize unreachable endpoints
    }
    
    if (localResults.checks?.server?.status === HEALTH_STATUS_TYPES.UNHEALTHY) {
        reliabilityScore -= 40; // Penalize server health issues
    }
    
    return Math.max(0, Math.min(100, reliabilityScore));
}

/**
 * Generates combined health recommendations based on local and remote analysis
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @param {object} consistencyCheck - Consistency analysis results
 * @returns {Array} Array of health recommendations
 */
function generateCombinedRecommendations(localResults, remoteResults, consistencyCheck) {
    const recommendations = [];
    
    // Local health recommendations
    if (localResults.recommendations) {
        recommendations.push(...localResults.recommendations);
    }
    
    // Remote connectivity recommendations
    if (remoteResults.error) {
        recommendations.push('Investigate remote endpoint connectivity issues');
        recommendations.push('Verify server is running and accessible on configured port');
    }
    
    // Consistency recommendations
    if (consistencyCheck.alignment === 'misaligned') {
        recommendations.push('Investigate significant difference between local and remote health scores');
        recommendations.push('Verify health endpoint is reporting accurate system status');
    }
    
    // General recommendations
    if (recommendations.length === 0) {
        recommendations.push('Health checks are operating normally - continue regular monitoring');
    }
    
    return recommendations;
}

/**
 * Generates combined health alerts based on local and remote results
 * @param {object} localResults - Local health check results
 * @param {object} remoteResults - Remote health check results
 * @param {object} consistencyCheck - Consistency analysis results
 * @returns {Array} Array of health alerts
 */
function generateCombinedAlerts(localResults, remoteResults, consistencyCheck) {
    const alerts = [];
    
    // Include local alerts
    if (localResults.alerts) {
        alerts.push(...localResults.alerts);
    }
    
    // Remote connectivity alerts
    if (remoteResults.error) {
        alerts.push(`CRITICAL: Remote health endpoint unreachable - ${remoteResults.error.message}`);
    }
    
    if (remoteResults.remote_endpoint?.status_code >= 500) {
        alerts.push(`ERROR: Health endpoint returning server error status ${remoteResults.remote_endpoint.status_code}`);
    }
    
    // Consistency alerts
    if (consistencyCheck.alignment === 'misaligned') {
        alerts.push(`WARNING: Health score mismatch - Local: ${consistencyCheck.local_score}, Remote: ${consistencyCheck.remote_score}`);
    }
    
    return alerts;
}

/**
 * Gets description for exit code
 * @param {number} exitCode - Process exit code
 * @returns {string} Exit code description
 */
function getExitCodeDescription(exitCode) {
    switch (exitCode) {
        case EXIT_CODES.SUCCESS:
            return 'SUCCESS - Health check passed';
        case EXIT_CODES.DEGRADED:
            return 'DEGRADED - Performance issues detected';
        case EXIT_CODES.UNHEALTHY:
            return 'UNHEALTHY - Critical health failures';
        case EXIT_CODES.ERROR:
            return 'ERROR - Script execution failure';
        default:
            return 'UNKNOWN - Invalid exit code';
    }
}

// Execute main function if this script is run directly
if (require.main === module) {
    main().catch(error => {
        handleScriptError(error, 'Script initialization');
    });
}

// Export functions for programmatic usage and testing
module.exports = {
    main,
    executeLocalHealthCheck,
    executeRemoteHealthCheck,
    formatHealthOutput,
    determineExitCode,
    parseCommandLineArguments,
    validateConfiguration,
    displayHelp,
    handleScriptError,
    
    // Constants for external usage
    SCRIPT_NAME,
    VERSION,
    EXIT_CODES,
    OUTPUT_FORMATS,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_HEALTH_ENDPOINT
};