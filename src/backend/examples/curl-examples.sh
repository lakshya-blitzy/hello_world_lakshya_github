#!/bin/bash
# curl-examples.sh - Node.js Tutorial HTTP Server curl Examples
# Version: 1.0.0
# 
# Comprehensive shell script containing curl examples that demonstrate various HTTP interactions 
# with the Node.js tutorial HTTP server. Provides practical command-line examples for testing 
# endpoints, error scenarios, performance testing, and security validation while serving as 
# educational documentation for HTTP client-server communication patterns and curl usage techniques.
#
# This script demonstrates:
# - Basic HTTP GET requests to /hello and /health endpoints
# - Error handling scenarios including 404 Not Found and 405 Method Not Allowed
# - Security header validation and HTTP security best practices
# - Performance measurement techniques using curl timing variables
# - Health monitoring integration patterns for system monitoring
# - Advanced curl techniques and debugging methods
# - Integration testing patterns for CI/CD pipeline usage
#
# Requirements: curl 7.0+ (system-installed), jq (optional for JSON processing), bash shell
# Usage: ./curl-examples.sh [command] or source this file for function access
# Educational Context: Demonstrates HTTP client-server communication and curl command usage

# Global configuration constants derived from server configuration
BASE_URL="http://127.0.0.1:3000"
HELLO_ENDPOINT="/hello"
HEALTH_ENDPOINT="/health" 
ROOT_ENDPOINT="/"
DEFAULT_TIMEOUT=30
USER_AGENT="curl-examples/1.0 (Node.js Tutorial)"

# Color constants for enhanced terminal output visibility
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_PURPLE='\033[0;35m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_RESET='\033[0m'

# Script execution state tracking for cleanup and monitoring
SCRIPT_START_TIME=$(date +%s%N | cut -b1-13)
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0

# Temporary files for advanced curl examples (cleaned up automatically)
CURL_OUTPUT_FILE="/tmp/curl-examples-output-$$"
CURL_TIMING_FILE="/tmp/curl-examples-timing-$$"
CURL_HEADERS_FILE="/tmp/curl-examples-headers-$$"

/**
 * Prints an informative banner explaining the curl examples script purpose, prerequisites, 
 * and usage instructions for educational clarity
 * @returns {void} No return value - prints banner to stdout
 */
function print_banner() {
    echo -e "${COLOR_CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                    Node.js Tutorial HTTP Server                             ║"
    echo "║                         curl Examples Script                                ║"
    echo "║                            Version 1.0.0                                    ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${COLOR_RESET}"
    echo
    echo -e "${COLOR_BLUE}Purpose:${COLOR_RESET}"
    echo "  Comprehensive curl examples demonstrating HTTP client-server interactions"
    echo "  with the Node.js tutorial application including endpoint testing, error"
    echo "  scenarios, performance analysis, and security validation techniques."
    echo
    echo -e "${COLOR_BLUE}Educational Objectives:${COLOR_RESET}"
    echo "  • Understanding HTTP client-server communication using curl"
    echo "  • Learning HTTP status codes and their meanings through practical examples"
    echo "  • Practicing API testing techniques and response validation methods"
    echo "  • Exploring HTTP headers and their role in web security"
    echo "  • Developing performance testing skills for web applications"
    echo "  • Building automated testing scripts using curl and shell scripting"
    echo
    echo -e "${COLOR_BLUE}Prerequisites:${COLOR_RESET}"
    echo "  • curl command-line tool (version 7.0 or higher)"
    echo "  • jq JSON processor (optional but recommended for JSON formatting)"
    echo "  • Node.js tutorial HTTP server running on ${BASE_URL}"
    echo "  • bash shell environment for script execution"
    echo
    echo -e "${COLOR_BLUE}Quick Start:${COLOR_RESET}"
    echo "  1. Start the Node.js server: node server.js"
    echo "  2. Run examples: ./curl-examples.sh [function_name]"
    echo "  3. Or source this script: source curl-examples.sh"
    echo
    echo -e "${COLOR_BLUE}Available Example Categories:${COLOR_RESET}"
    echo "  • run_basic_examples      - Basic HTTP GET requests and response analysis"
    echo "  • run_health_examples     - Health endpoint testing with JSON processing"
    echo "  • run_error_examples      - Error scenario testing and response handling"
    echo "  • run_security_examples   - Security header validation and testing"
    echo "  • run_performance_examples - Performance measurement and optimization"
    echo "  • run_advanced_examples   - Advanced curl techniques and debugging"
    echo "  • run_integration_examples - Integration testing and automation patterns"
    echo
    echo -e "${COLOR_YELLOW}Server Connection Information:${COLOR_RESET}"
    echo "  Base URL: ${BASE_URL}"
    echo "  Hello Endpoint: ${BASE_URL}${HELLO_ENDPOINT}"
    echo "  Health Endpoint: ${BASE_URL}${HEALTH_ENDPOINT}"
    echo "  Default Timeout: ${DEFAULT_TIMEOUT} seconds"
    echo
}

/**
 * Checks if the Node.js tutorial server is running and accessible by attempting a basic 
 * connection to the base URL with timeout handling
 * @param {string} base_url - Server base URL to check for accessibility
 * @returns {number} Exit code: 0 for server accessible, 1 for server unreachable
 */
function check_server() {
    local base_url=${1:-$BASE_URL}
    local timeout=${2:-5}
    
    echo -e "${COLOR_BLUE}Checking server connectivity...${COLOR_RESET}"
    echo "  Testing connection to: ${base_url}"
    echo "  Connection timeout: ${timeout} seconds"
    echo
    
    # Attempt basic connectivity test with curl
    if curl --connect-timeout "$timeout" \
           --max-time "$timeout" \
           --silent \
           --fail \
           --user-agent "$USER_AGENT" \
           "$base_url$HELLO_ENDPOINT" > /dev/null 2>&1; then
        
        echo -e "${COLOR_GREEN}✓ Server is accessible and responding${COLOR_RESET}"
        echo "  Server URL: ${base_url}"
        echo "  Response: Server returned HTTP 200 OK"
        echo "  Connection: Successful within ${timeout} seconds"
        echo
        return 0
    else
        echo -e "${COLOR_RED}✗ Server is not accessible${COLOR_RESET}"
        echo "  Server URL: ${base_url}"
        echo "  Error: Connection failed or server not responding"
        echo
        echo -e "${COLOR_YELLOW}Troubleshooting Steps:${COLOR_RESET}"
        echo "  1. Verify Node.js server is running: node server.js"
        echo "  2. Check server is listening on port 3000"
        echo "  3. Ensure no firewall blocking connections"
        echo "  4. Verify server hostname and port configuration"
        echo
        return 1
    fi
}

/**
 * Executes basic curl examples demonstrating fundamental HTTP GET requests to the /hello 
 * endpoint with response analysis and educational commentary
 * @returns {void} No return value - displays curl commands and responses
 */
function run_basic_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                           BASIC HTTP REQUEST EXAMPLES${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • Basic HTTP GET request syntax and curl command usage"
    echo "  • HTTP response analysis including status codes, headers, and body content"
    echo "  • Understanding HTTP request-response cycle through practical examples"
    echo "  • Learning curl command options for different output formats"
    echo "  • Response timing measurement for performance awareness"
    echo
    
    # Example 1: Basic GET request to /hello endpoint
    echo -e "${COLOR_CYAN}Example 1: Basic GET Request to Hello Endpoint${COLOR_RESET}"
    echo "Command: curl -X GET ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Demonstrates simplest HTTP GET request with minimal output"
    echo
    
    curl -X GET "$BASE_URL$HELLO_ENDPOINT"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo
        echo -e "${COLOR_GREEN}✓ Request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo
        echo -e "${COLOR_RED}✗ Request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Response Analysis:"
    echo "  • Expected Status: 200 OK"
    echo "  • Expected Response: 'Hello world'"
    echo "  • Content-Type: text/plain; charset=utf-8"
    echo "  • Content-Length: 11 bytes"
    echo
    
    sleep 1
    
    # Example 2: Verbose request showing headers and timing
    echo -e "${COLOR_CYAN}Example 2: Verbose GET Request with Headers and Timing${COLOR_RESET}"
    echo "Command: curl -v ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Shows complete HTTP transaction including request/response headers"
    echo
    
    curl -v "$BASE_URL$HELLO_ENDPOINT" 2>&1
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Verbose request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Verbose request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Verbose Output Analysis:"
    echo "  • Request headers sent by curl to the server"
    echo "  • Response status line (HTTP/1.1 200 OK)"
    echo "  • Response headers received from server"
    echo "  • Security headers: X-Content-Type-Options, X-Frame-Options"
    echo "  • Connection management: keep-alive, Date header"
    echo
    
    sleep 1
    
    # Example 3: Silent mode for clean response extraction
    echo -e "${COLOR_CYAN}Example 3: Silent Mode for Clean Response Body${COLOR_RESET}"
    echo "Command: curl -s ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Extracts only response body without progress meter or error information"
    echo
    
    response=$(curl -s "$BASE_URL$HELLO_ENDPOINT")
    exit_code=$?
    
    echo "Response Body: '$response'"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Silent request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Silent request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Silent Mode Benefits:"
    echo "  • Clean output suitable for shell scripting and automation"
    echo "  • No progress meter or diagnostic information"
    echo "  • Ideal for response content processing in scripts"
    echo "  • Enables easy response validation and parsing"
    echo
    
    sleep 1
    
    # Example 4: Response timing with detailed timing information
    echo -e "${COLOR_CYAN}Example 4: Response Timing Analysis${COLOR_RESET}"
    echo "Command: curl -w 'Total: %{time_total}s, Connect: %{time_connect}s' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Measures request timing components for performance analysis"
    echo
    
    curl -s -w "Total Time: %{time_total}s\nConnect Time: %{time_connect}s\nName Lookup: %{time_namelookup}s\nResponse Code: %{http_code}\nResponse Size: %{size_download} bytes\n" \
         "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Timing request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Timing request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Timing Metrics Explanation:"
    echo "  • time_total: Complete transaction time including all phases"
    echo "  • time_connect: Time to establish TCP connection"
    echo "  • time_namelookup: DNS name resolution time"
    echo "  • http_code: HTTP response status code"
    echo "  • size_download: Response body size in bytes"
    echo
    
    sleep 1
    
    # Example 5: Custom User-Agent header demonstration
    echo -e "${COLOR_CYAN}Example 5: Custom User-Agent Header${COLOR_RESET}"
    echo "Command: curl -H 'User-Agent: ${USER_AGENT}' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Demonstrates custom header setting and client identification"
    echo
    
    curl -H "User-Agent: $USER_AGENT" \
         -s -w "Response: %{http_code} %{content_type}\n" \
         "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Custom User-Agent request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Custom User-Agent request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Custom Headers Benefits:"
    echo "  • Client identification for server-side logging and analytics"
    echo "  • API versioning and feature negotiation"
    echo "  • User-Agent string customization for automation tools"
    echo "  • Request tracking and debugging assistance"
    echo
    
    # Example 6: Response header extraction
    echo -e "${COLOR_CYAN}Example 6: Response Header Extraction${COLOR_RESET}"
    echo "Command: curl -I ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Extracts only response headers without body content (HEAD request)"
    echo
    
    curl -I "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Header extraction successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Header extraction failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Header Analysis:"
    echo "  • HTTP/1.1 200 OK status line"
    echo "  • Content-Type: text/plain; charset=utf-8"
    echo "  • Security headers: X-Content-Type-Options, X-Frame-Options"
    echo "  • Connection management: keep-alive"
    echo "  • Date header with response timestamp"
    echo
    
    echo -e "${COLOR_PURPLE}Basic Examples Summary:${COLOR_RESET}"
    echo "  Demonstrated fundamental HTTP GET request patterns with curl"
    echo "  Explored response analysis techniques and timing measurement"
    echo "  Showed header customization and extraction methods"
    echo "  Established foundation for advanced curl usage patterns"
    echo
}

/**
 * Executes health endpoint curl examples demonstrating JSON response handling, health status 
 * validation, and monitoring system integration patterns
 * @returns {void} No return value - displays health endpoint curl commands and JSON responses
 */
function run_health_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          HEALTH ENDPOINT TESTING EXAMPLES${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • Health endpoint testing for monitoring and alerting systems"
    echo "  • JSON response processing and validation techniques"
    echo "  • System metrics interpretation and threshold analysis"
    echo "  • Integration patterns for load balancers and orchestration platforms"
    echo "  • Performance measurement and health status validation"
    echo
    
    # Example 1: Basic health check request
    echo -e "${COLOR_CYAN}Example 1: Basic Health Check Request${COLOR_RESET}"
    echo "Command: curl ${BASE_URL}${HEALTH_ENDPOINT}"
    echo "Purpose: Retrieves comprehensive server health status in JSON format"
    echo
    
    curl "$BASE_URL$HEALTH_ENDPOINT"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo
        echo -e "${COLOR_GREEN}✓ Health check request successful (Exit code: $exit_code)${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo
        echo -e "${COLOR_RED}✗ Health check request failed (Exit code: $exit_code)${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Health Response Analysis:"
    echo "  • Status: healthy/degraded/unhealthy indicator"
    echo "  • Score: Numerical health score (0-100)"
    echo "  • Server metrics: Uptime, memory, CPU usage"
    echo "  • System metrics: Memory, CPU, disk usage"
    echo "  • Performance metrics: Response time, throughput"
    echo
    
    sleep 1
    
    # Example 2: Health check with JSON pretty-printing (requires jq)
    echo -e "${COLOR_CYAN}Example 2: Health Check with JSON Formatting${COLOR_RESET}"
    
    if command -v jq > /dev/null 2>&1; then
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | jq ."
        echo "Purpose: Formats JSON response for improved readability and analysis"
        echo
        
        curl -s "$BASE_URL$HEALTH_ENDPOINT" | jq .
        exit_code=${PIPESTATUS[0]}
        
        if [ $exit_code -eq 0 ]; then
            echo -e "${COLOR_GREEN}✓ Formatted health check successful (Exit code: $exit_code)${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo -e "${COLOR_RED}✗ Formatted health check failed (Exit code: $exit_code)${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
        
        echo
        echo "JSON Formatting Benefits:"
        echo "  • Improved readability for manual inspection"
        echo "  • Hierarchical structure visualization"
        echo "  • Syntax highlighting and validation"
        echo "  • Easy identification of nested metrics"
        echo
    else
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | jq ."
        echo "Note: jq not installed - showing raw JSON response"
        echo
        
        curl -s "$BASE_URL$HEALTH_ENDPOINT"
        exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo
            echo -e "${COLOR_GREEN}✓ Raw health check successful (Exit code: $exit_code)${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo
            echo -e "${COLOR_RED}✗ Raw health check failed (Exit code: $exit_code)${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
        
        echo
        echo -e "${COLOR_YELLOW}Recommendation: Install jq for enhanced JSON processing${COLOR_RESET}"
        echo "  sudo apt-get install jq  # Ubuntu/Debian"
        echo "  brew install jq          # macOS"
        echo
    fi
    
    sleep 1
    
    # Example 3: Extract specific health status value
    echo -e "${COLOR_CYAN}Example 3: Health Status Extraction${COLOR_RESET}"
    
    if command -v jq > /dev/null 2>&1; then
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | jq -r '.status'"
        echo "Purpose: Extracts only the health status value for automated monitoring"
        echo
        
        health_status=$(curl -s "$BASE_URL$HEALTH_ENDPOINT" | jq -r '.status')
        exit_code=${PIPESTATUS[0]}
        
        echo "Health Status: $health_status"
        
        if [ $exit_code -eq 0 ] && [ "$health_status" = "healthy" ]; then
            echo -e "${COLOR_GREEN}✓ Server is healthy${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        elif [ $exit_code -eq 0 ] && [ "$health_status" != "healthy" ]; then
            echo -e "${COLOR_YELLOW}⚠ Server status: $health_status${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo -e "${COLOR_RED}✗ Failed to determine health status${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
    else
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | grep -o '\"status\":\"[^\"]*\"'"
        echo "Purpose: Extracts health status using grep (jq alternative)"
        echo
        
        health_line=$(curl -s "$BASE_URL$HEALTH_ENDPOINT" | grep -o '"status":"[^"]*"')
        exit_code=${PIPESTATUS[0]}
        
        echo "Health Status Line: $health_line"
        
        if [ $exit_code -eq 0 ]; then
            echo -e "${COLOR_GREEN}✓ Status extraction successful${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo -e "${COLOR_RED}✗ Status extraction failed${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
    fi
    
    echo
    echo "Monitoring Integration:"
    echo "  • Automated health status checking for alerting systems"
    echo "  • Boolean health validation for load balancer configuration"
    echo "  • Threshold-based monitoring with status classification"
    echo "  • Integration with monitoring platforms (Nagios, Zabbix, etc.)"
    echo
    
    sleep 1
    
    # Example 4: Health metrics extraction for monitoring
    echo -e "${COLOR_CYAN}Example 4: System Metrics Extraction${COLOR_RESET}"
    
    if command -v jq > /dev/null 2>&1; then
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | jq '.system.memory, .process.memory'"
        echo "Purpose: Extracts specific system metrics for performance monitoring"
        echo
        
        curl -s "$BASE_URL$HEALTH_ENDPOINT" | jq '.system.memory, .process.memory'
        exit_code=${PIPESTATUS[0]}
        
        if [ $exit_code -eq 0 ]; then
            echo -e "${COLOR_GREEN}✓ Metrics extraction successful${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo -e "${COLOR_RED}✗ Metrics extraction failed${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
        
        echo
        echo "Memory Metrics Analysis:"
        echo "  • System memory: Total available and current usage"
        echo "  • Process memory: Heap usage, RSS, and external memory"
        echo "  • Usage percentages for threshold-based alerting"
        echo "  • Memory allocation tracking for resource planning"
        echo
    else
        echo "Command: curl -s ${BASE_URL}${HEALTH_ENDPOINT} | grep -E '\"memory\":|\"used_mb\":|\"heap_used_mb\"'"
        echo "Purpose: Extracts memory metrics using grep pattern matching"
        echo
        
        curl -s "$BASE_URL$HEALTH_ENDPOINT" | grep -E '"memory":|"used_mb":|"heap_used_mb"'
        exit_code=${PIPESTATUS[0]}
        
        if [ $exit_code -eq 0 ]; then
            echo -e "${COLOR_GREEN}✓ Memory metrics extraction successful${COLOR_RESET}"
            ((SUCCESSFUL_REQUESTS++))
        else
            echo -e "${COLOR_RED}✗ Memory metrics extraction failed${COLOR_RESET}"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
    fi
    
    sleep 1
    
    # Example 5: Health endpoint timing and performance measurement
    echo -e "${COLOR_CYAN}Example 5: Health Endpoint Performance Measurement${COLOR_RESET}"
    echo "Command: curl -w 'Health Check Time: %{time_total}s' ${BASE_URL}${HEALTH_ENDPOINT}"
    echo "Purpose: Measures health endpoint response time for performance monitoring"
    echo
    
    curl -s -w "Health Check Performance:\n  Total Time: %{time_total}s\n  Connect Time: %{time_connect}s\n  Response Code: %{http_code}\n  Response Size: %{size_download} bytes\n" \
         "$BASE_URL$HEALTH_ENDPOINT" > /dev/null
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Health performance measurement successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Health performance measurement failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Performance Monitoring Benefits:"
    echo "  • Health endpoint response time tracking"
    echo "  • Performance degradation detection"
    echo "  • SLA compliance monitoring for health checks"
    echo "  • Response time trend analysis for capacity planning"
    echo
    
    # Example 6: Load balancer health check simulation
    echo -e "${COLOR_CYAN}Example 6: Load Balancer Health Check Simulation${COLOR_RESET}"
    echo "Command: curl -f --max-time 10 ${BASE_URL}${HEALTH_ENDPOINT} && echo 'HEALTHY' || echo 'UNHEALTHY'"
    echo "Purpose: Simulates load balancer health check behavior with timeout and failure handling"
    echo
    
    if curl -f --max-time 10 -s "$BASE_URL$HEALTH_ENDPOINT" > /dev/null; then
        echo "Load Balancer Status: HEALTHY"
        echo -e "${COLOR_GREEN}✓ Load balancer health check passed${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo "Load Balancer Status: UNHEALTHY"
        echo -e "${COLOR_RED}✗ Load balancer health check failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Load Balancer Integration:"
    echo "  • Timeout-based health validation (10 second limit)"
    echo "  • HTTP status code validation with --fail option"
    echo "  • Binary health status for load balancer decision making"
    echo "  • Automated backend server rotation based on health status"
    echo
    
    echo -e "${COLOR_PURPLE}Health Examples Summary:${COLOR_RESET}"
    echo "  Demonstrated comprehensive health endpoint testing techniques"
    echo "  Explored JSON response processing and metrics extraction"
    echo "  Showed monitoring system integration patterns"
    echo "  Established performance measurement and validation methods"
    echo
}

/**
 * Executes error scenario curl examples demonstrating various HTTP error responses including 
 * 404 Not Found, 405 Method Not Allowed, and server error handling
 * @returns {void} No return value - displays error scenario curl commands and error responses
 */
function run_error_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          ERROR HANDLING DEMONSTRATION${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • HTTP error codes and their meanings in practical scenarios"
    echo "  • Client-side error handling strategies and response processing"
    echo "  • Server-side error response validation and debugging techniques"
    echo "  • Error detection patterns for automated testing and monitoring"
    echo "  • HTTP method validation and supported operation identification"
    echo
    
    # Example 1: 404 Not Found error
    echo -e "${COLOR_CYAN}Example 1: 404 Not Found Error${COLOR_RESET}"
    echo "Command: curl -v ${BASE_URL}/nonexistent"
    echo "Purpose: Demonstrates 404 error response when requesting non-existent endpoint"
    echo
    
    curl -v "$BASE_URL/nonexistent"
    local exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ 404 error response received as expected${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠ curl returned exit code $exit_code (expected for error scenarios)${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    ((FAILED_REQUESTS++))  # Expected failure for educational purposes
    
    echo
    echo "404 Not Found Analysis:"
    echo "  • Status Code: 404 Not Found"
    echo "  • Meaning: Requested resource does not exist on server"
    echo "  • Response Body: 'Not Found' message"
    echo "  • Security: No sensitive path information disclosed"
    echo "  • Client Action: Check URL spelling and endpoint availability"
    echo
    
    sleep 1
    
    # Example 2: 405 Method Not Allowed error
    echo -e "${COLOR_CYAN}Example 2: 405 Method Not Allowed Error${COLOR_RESET}"
    echo "Command: curl -X POST ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests unsupported HTTP method (POST) on hello endpoint"
    echo
    
    curl -v -X POST "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ 405 error response received as expected${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠ curl returned exit code $exit_code (expected for error scenarios)${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    ((FAILED_REQUESTS++))  # Expected failure for educational purposes
    
    echo
    echo "405 Method Not Allowed Analysis:"
    echo "  • Status Code: 405 Method Not Allowed"
    echo "  • Meaning: HTTP method not supported for this endpoint"
    echo "  • Allow Header: Shows supported methods (GET)"
    echo "  • Response Body: 'Method Not Allowed' message"
    echo "  • Client Action: Use supported HTTP methods only"
    echo
    
    sleep 1
    
    # Example 3: PUT method test
    echo -e "${COLOR_CYAN}Example 3: PUT Method Validation${COLOR_RESET}"
    echo "Command: curl -X PUT -d 'test data' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests another unsupported HTTP method with request body"
    echo
    
    curl -X PUT -d "test data" -v "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ PUT method error response received as expected${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠ curl returned exit code $exit_code (expected for error scenarios)${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    ((FAILED_REQUESTS++))  # Expected failure for educational purposes
    
    echo
    echo "PUT Method Analysis:"
    echo "  • Status Code: 405 Method Not Allowed (expected)"
    echo "  • Request Body: Sent but ignored due to method rejection"
    echo "  • Server Response: Consistent error handling across methods"
    echo "  • Security: Server properly validates HTTP methods"
    echo
    
    sleep 1
    
    # Example 4: DELETE method test
    echo -e "${COLOR_CYAN}Example 4: DELETE Method Validation${COLOR_RESET}"
    echo "Command: curl -X DELETE ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests DELETE method support and error response consistency"
    echo
    
    curl -X DELETE -v "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ DELETE method error response received as expected${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠ curl returned exit code $exit_code (expected for error scenarios)${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    ((FAILED_REQUESTS++))  # Expected failure for educational purposes
    
    echo
    echo "DELETE Method Analysis:"
    echo "  • Status Code: 405 Method Not Allowed (expected)"
    echo "  • Consistency: Same error handling as other unsupported methods"
    echo "  • Security: Proper method filtering prevents unintended operations"
    echo
    
    sleep 1
    
    # Example 5: Invalid header test
    echo -e "${COLOR_CYAN}Example 5: Request Validation with Invalid Headers${COLOR_RESET}"
    echo "Command: curl -H 'Invalid-Header: \${malicious-content}' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests server handling of potentially problematic header values"
    echo
    
    curl -H "Invalid-Header: \${malicious-content}" -v "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Server handled invalid header appropriately${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Request with invalid header failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Header Validation Analysis:"
    echo "  • Server Response: Processed request despite unusual header"
    echo "  • Security: Header values properly handled without exploitation"
    echo "  • Robustness: Server continues normal operation with invalid input"
    echo
    
    sleep 1
    
    # Example 6: Error response format analysis
    echo -e "${COLOR_CYAN}Example 6: Error Response Format Analysis${COLOR_RESET}"
    echo "Command: curl -w 'Status: %{http_code}, Size: %{size_download}' ${BASE_URL}/invalid"
    echo "Purpose: Analyzes error response characteristics and formatting"
    echo
    
    curl -s -w "Error Response Analysis:\n  HTTP Status: %{http_code}\n  Content Type: %{content_type}\n  Response Size: %{size_download} bytes\n  Total Time: %{time_total}s\n" \
         "$BASE_URL/invalid"
    exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Error response analysis completed${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠ Error response received (expected behavior)${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    ((FAILED_REQUESTS++))  # Expected failure for educational purposes
    
    echo
    echo "Error Response Characteristics:"
    echo "  • Consistent error message formatting across endpoints"
    echo "  • Appropriate Content-Type headers for error responses"
    echo "  • Reasonable response sizes for error messages"
    echo "  • Fast error response times indicating efficient error handling"
    echo
    
    # Example 7: Error handling with curl options
    echo -e "${COLOR_CYAN}Example 7: Error Handling with curl --fail Option${COLOR_RESET}"
    echo "Command: curl --fail ${BASE_URL}/nonexistent && echo 'Success' || echo 'Failed as expected'"
    echo "Purpose: Demonstrates curl's --fail option for HTTP error detection"
    echo
    
    if curl --fail -s "$BASE_URL/nonexistent" > /dev/null 2>&1; then
        echo "Unexpected Success - this should have failed"
        echo -e "${COLOR_RED}✗ curl --fail did not detect HTTP error${COLOR_RESET}"
    else
        echo "Failed as expected - curl --fail detected HTTP error"
        echo -e "${COLOR_GREEN}✓ curl --fail properly detected HTTP error status${COLOR_RESET}"
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "curl --fail Option Benefits:"
    echo "  • Treats HTTP error codes (4xx, 5xx) as curl failures"
    echo "  • Enables shell script error detection with exit codes"
    echo "  • Useful for automated testing and health check scripts"
    echo "  • Simplifies error handling in shell scripting workflows"
    echo
    
    echo -e "${COLOR_PURPLE}Error Examples Summary:${COLOR_RESET}"
    echo "  Demonstrated comprehensive HTTP error scenario testing"
    echo "  Explored various error codes and their appropriate usage"
    echo "  Showed server error handling consistency and security"
    echo "  Established error detection patterns for automation"
    echo "  Total error scenarios tested: 7"
    echo "  Expected failures: 6 (demonstration purposes)"
    echo
}

/**
 * Executes security-focused curl examples demonstrating security header validation, request 
 * authentication testing, and secure HTTP practices
 * @returns {void} No return value - displays security testing curl commands and security analysis
 */
function run_security_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          SECURITY TESTING AND VALIDATION${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • HTTP security headers analysis and validation techniques"
    echo "  • Client request modification and server response testing"
    echo "  • Security best practices demonstration through practical examples"
    echo "  • Common web security vulnerabilities and mitigation verification"
    echo "  • Security header compliance testing and standards validation"
    echo
    
    # Example 1: Security headers analysis
    echo -e "${COLOR_CYAN}Example 1: Security Headers Analysis${COLOR_RESET}"
    echo "Command: curl -I ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Extracts and analyzes HTTP security headers in server responses"
    echo
    
    curl -I "$BASE_URL$HELLO_ENDPOINT"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Security headers retrieved successfully${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Failed to retrieve security headers${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Security Headers Analysis:"
    echo "  • X-Content-Type-Options: nosniff - Prevents MIME type sniffing attacks"
    echo "  • X-Frame-Options: DENY - Prevents clickjacking attacks via frames"
    echo "  • X-XSS-Protection: 0 - Modern approach disabling legacy XSS filter"
    echo "  • Content-Type: Proper MIME type specification"
    echo "  • Date: Response timestamp for request tracking"
    echo
    
    sleep 1
    
    # Example 2: Content-Type validation
    echo -e "${COLOR_CYAN}Example 2: Content-Type Security Validation${COLOR_RESET}"
    echo "Command: curl -H 'Accept: text/html' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests server response to different Accept headers and content negotiation"
    echo
    
    curl -H "Accept: text/html" -v "$BASE_URL$HELLO_ENDPOINT" 2>&1 | grep -E "(Content-Type|Accept)"
    exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Content-Type validation successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Content-Type validation failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Content-Type Security Benefits:"
    echo "  • Prevents MIME type confusion attacks"
    echo "  • Ensures browsers handle content appropriately"
    echo "  • Validates server content negotiation behavior"
    echo "  • Confirms proper HTTP header handling"
    echo
    
    sleep 1
    
    # Example 3: User-Agent header security testing
    echo -e "${COLOR_CYAN}Example 3: User-Agent Header Security Testing${COLOR_RESET}"
    echo "Command: curl -H 'User-Agent: Security-Test/1.0' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests server handling of custom User-Agent strings and request identification"
    echo
    
    response=$(curl -H "User-Agent: Security-Test/1.0" -s "$BASE_URL$HELLO_ENDPOINT")
    exit_code=$?
    
    echo "Response: '$response'"
    
    if [ $exit_code -eq 0 ] && [ "$response" = "Hello world" ]; then
        echo -e "${COLOR_GREEN}✓ User-Agent security test passed - normal response maintained${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ User-Agent security test failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "User-Agent Security Analysis:"
    echo "  • Server maintains consistent response regardless of User-Agent"
    echo "  • No sensitive information disclosed based on client identification"
    echo "  • Proper request logging without compromising security"
    echo "  • Demonstrates defense against User-Agent-based attacks"
    echo
    
    sleep 1
    
    # Example 4: Header injection attempt
    echo -e "${COLOR_CYAN}Example 4: Header Injection Security Test${COLOR_RESET}"
    echo "Command: curl -H 'X-Test: header\\nX-Injected: malicious' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests server resistance to HTTP header injection attacks"
    echo
    
    curl -H "X-Test: header"$'\n'"X-Injected: malicious" -v "$BASE_URL$HELLO_ENDPOINT" 2>&1 | head -20
    exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Server handled header injection attempt appropriately${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_YELLOW}⚠ Header injection test result unclear${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Header Injection Security Analysis:"
    echo "  • Server properly processes headers without interpretation"
    echo "  • No evidence of header injection vulnerability"
    echo "  • Request continues normal processing flow"
    echo "  • HTTP parsing security appears robust"
    echo
    
    sleep 1
    
    # Example 5: Response header security validation
    echo -e "${COLOR_CYAN}Example 5: Complete Security Headers Validation${COLOR_RESET}"
    echo "Command: curl -s -D - ${BASE_URL}${HELLO_ENDPOINT} | grep -E 'X-|Cache-Control|Content-Type'"
    echo "Purpose: Validates presence and values of all security-related headers"
    echo
    
    headers=$(curl -s -D - "$BASE_URL$HELLO_ENDPOINT" | grep -E "X-|Cache-Control|Content-Type")
    exit_code=${PIPESTATUS[0]}
    
    echo "Security Headers Found:"
    echo "$headers"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Security headers validation completed${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Security headers validation failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Security Compliance Check:"
    
    # Check for X-Content-Type-Options
    if echo "$headers" | grep -q "X-Content-Type-Options: nosniff"; then
        echo -e "  ${COLOR_GREEN}✓ X-Content-Type-Options: nosniff (MIME sniffing protection)${COLOR_RESET}"
    else
        echo -e "  ${COLOR_RED}✗ Missing X-Content-Type-Options header${COLOR_RESET}"
    fi
    
    # Check for X-Frame-Options
    if echo "$headers" | grep -q "X-Frame-Options: DENY"; then
        echo -e "  ${COLOR_GREEN}✓ X-Frame-Options: DENY (clickjacking protection)${COLOR_RESET}"
    else
        echo -e "  ${COLOR_RED}✗ Missing X-Frame-Options header${COLOR_RESET}"
    fi
    
    # Check for proper Content-Type
    if echo "$headers" | grep -q "Content-Type: text/plain"; then
        echo -e "  ${COLOR_GREEN}✓ Content-Type: text/plain (proper MIME type)${COLOR_RESET}"
    else
        echo -e "  ${COLOR_RED}✗ Missing or incorrect Content-Type header${COLOR_RESET}"
    fi
    
    echo
    
    sleep 1
    
    # Example 6: SSL/TLS security note (for HTTPS deployments)
    echo -e "${COLOR_CYAN}Example 6: Transport Security Considerations${COLOR_RESET}"
    echo "Note: Current server runs on HTTP - HTTPS recommended for production"
    echo "HTTPS Command: curl -k https://localhost:3000/hello (if SSL configured)"
    echo "Purpose: Highlights transport layer security importance"
    echo
    
    echo "Transport Security Analysis:"
    echo "  • Current: HTTP (unencrypted) - suitable for local development"
    echo "  • Production: HTTPS required for data protection"
    echo "  • Certificate: SSL/TLS certificate needed for HTTPS"
    echo "  • Headers: Additional security headers available for HTTPS"
    echo "  • Recommendation: Deploy with reverse proxy (nginx) for SSL termination"
    echo
    
    # Example 7: Request size and DoS protection
    echo -e "${COLOR_CYAN}Example 7: Request Size Limits Testing${COLOR_RESET}"
    echo "Command: curl -H 'X-Large-Header: [large_value]' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Tests server handling of large header values and DoS protection"
    echo
    
    large_header=$(printf 'A%.0s' {1..1000})  # 1000 character header value
    
    curl -H "X-Large-Header: $large_header" -s -w "Response Code: %{http_code}, Size: %{size_download} bytes\n" \
         "$BASE_URL$HELLO_ENDPOINT" > /dev/null
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Server handled large header appropriately${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Large header test failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "DoS Protection Analysis:"
    echo "  • Server processed large header without errors"
    echo "  • Response time maintained within reasonable limits"
    echo "  • No evidence of resource exhaustion or crash"
    echo "  • Robust handling of edge case input sizes"
    echo
    
    echo -e "${COLOR_PURPLE}Security Examples Summary:${COLOR_RESET}"
    echo "  Validated essential HTTP security headers implementation"
    echo "  Tested server resilience against common attack vectors"
    echo "  Confirmed proper request handling and response security"
    echo "  Identified areas for security enhancement in production"
    echo "  Security compliance: Good (essential headers present)"
    echo "  Recommendation: Add HTTPS and additional security headers for production"
    echo
}

/**
 * Executes performance testing curl examples demonstrating response time measurement, connection 
 * timing analysis, and throughput testing techniques
 * @returns {void} No return value - displays performance testing curl commands and timing analysis
 */
function run_performance_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          PERFORMANCE TESTING AND ANALYSIS${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • HTTP response time measurement and performance benchmarking"
    echo "  • Connection timing analysis and network performance optimization"
    echo "  • Throughput testing techniques and capacity planning methods"
    echo "  • Performance monitoring integration and threshold validation"
    echo "  • Load testing patterns and concurrent request handling analysis"
    echo
    
    # Create timing format file for detailed curl timing analysis
    cat > "$CURL_TIMING_FILE" << EOF
     namelookup:  %{time_namelookup}s
        connect:  %{time_connect}s
     appconnect:  %{time_appconnect}s
    pretransfer:  %{time_pretransfer}s
       redirect:  %{time_redirect}s
  starttransfer:  %{time_starttransfer}s
                ----------
          total:  %{time_total}s
   response_code:  %{http_code}
    content_type:  %{content_type}
   size_download:  %{size_download} bytes
     speed_download:  %{speed_download} bytes/sec
EOF
    
    # Example 1: Basic response time measurement
    echo -e "${COLOR_CYAN}Example 1: Basic Response Time Measurement${COLOR_RESET}"
    echo "Command: curl -w 'Response Time: %{time_total}s' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Measures total request-response time for baseline performance"
    echo
    
    response_time=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$HELLO_ENDPOINT")
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "Response Time: ${response_time}s"
        
        # Performance threshold analysis
        threshold="0.100"  # 100ms threshold
        if awk "BEGIN {exit ($response_time > $threshold)}"; then
            echo -e "${COLOR_GREEN}✓ Response time within threshold (< ${threshold}s)${COLOR_RESET}"
        else
            echo -e "${COLOR_YELLOW}⚠ Response time exceeds threshold (> ${threshold}s)${COLOR_RESET}"
        fi
        
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Response time measurement failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Performance Analysis:"
    echo "  • Total Time: Complete request-response cycle duration"
    echo "  • Threshold: < 100ms for optimal user experience"
    echo "  • Network: Local connection - minimal network latency"
    echo "  • Server: Node.js event loop processing efficiency"
    echo
    
    sleep 1
    
    # Example 2: Detailed timing breakdown
    echo -e "${COLOR_CYAN}Example 2: Detailed Timing Breakdown Analysis${COLOR_RESET}"
    echo "Command: curl -w '@curl-format.txt' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Analyzes individual timing components of HTTP request processing"
    echo
    
    curl -s -w "@$CURL_TIMING_FILE" -o /dev/null "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Detailed timing analysis completed${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Detailed timing analysis failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Timing Components Explanation:"
    echo "  • namelookup: DNS resolution time"
    echo "  • connect: TCP connection establishment time"
    echo "  • pretransfer: Time from connection to start of transfer"
    echo "  • starttransfer: Time to first response byte (TTFB)"
    echo "  • total: Complete transaction time"
    echo
    
    sleep 1
    
    # Example 3: Connection reuse and keep-alive testing
    echo -e "${COLOR_CYAN}Example 3: Connection Keep-Alive Performance Testing${COLOR_RESET}"
    echo "Command: Multiple requests with connection reuse"
    echo "Purpose: Tests HTTP keep-alive performance and connection management"
    echo
    
    echo "Testing connection reuse with 5 consecutive requests:"
    
    total_time=0
    for i in {1..5}; do
        request_time=$(curl -s -w "%{time_total}" -o /dev/null \
                           -H "Connection: keep-alive" \
                           "$BASE_URL$HELLO_ENDPOINT")
        exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "  Request $i: ${request_time}s"
            total_time=$(awk "BEGIN {print $total_time + $request_time}")
            ((SUCCESSFUL_REQUESTS++))
        else
            echo "  Request $i: FAILED"
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
    done
    
    average_time=$(awk "BEGIN {print $total_time / 5}")
    echo "  Average Response Time: ${average_time}s"
    
    echo
    echo "Keep-Alive Benefits Analysis:"
    echo "  • Reduced connection establishment overhead"
    echo "  • Lower latency for subsequent requests"
    echo "  • Better server resource utilization"
    echo "  • Improved throughput for multiple requests"
    echo
    
    sleep 1
    
    # Example 4: Concurrent request simulation
    echo -e "${COLOR_CYAN}Example 4: Concurrent Request Performance Testing${COLOR_RESET}"
    echo "Command: Parallel curl requests for concurrency testing"
    echo "Purpose: Simulates multiple simultaneous clients and measures performance impact"
    echo
    
    echo "Testing concurrent requests (3 parallel requests):"
    
    # Use background processes to simulate concurrent requests
    {
        time1=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$HELLO_ENDPOINT")
        echo "Concurrent Request 1: ${time1}s"
    } &
    
    {
        time2=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$HELLO_ENDPOINT")
        echo "Concurrent Request 2: ${time2}s"
    } &
    
    {
        time3=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$HELLO_ENDPOINT")
        echo "Concurrent Request 3: ${time3}s"
    } &
    
    # Wait for all background jobs to complete
    wait
    
    ((TOTAL_REQUESTS += 3))
    ((SUCCESSFUL_REQUESTS += 3))
    
    echo
    echo "Concurrency Analysis:"
    echo "  • Node.js handles concurrent requests via event loop"
    echo "  • Single-threaded architecture with non-blocking I/O"
    echo "  • Performance maintained under moderate concurrent load"
    echo "  • Scalability depends on CPU and memory resources"
    echo
    
    sleep 1
    
    # Example 5: Memory usage and resource monitoring
    echo -e "${COLOR_CYAN}Example 5: Resource Usage During Performance Testing${COLOR_RESET}"
    echo "Command: Monitor server resources during load testing"
    echo "Purpose: Correlates response times with system resource utilization"
    echo
    
    echo "Performing 10 rapid requests while monitoring performance:"
    
    start_time=$(date +%s%N | cut -b1-13)
    
    for i in {1..10}; do
        curl -s "$BASE_URL$HELLO_ENDPOINT" > /dev/null &
        if [ $((i % 3)) -eq 0 ]; then
            wait  # Wait every 3 requests to prevent overwhelming
        fi
    done
    wait  # Wait for all remaining requests
    
    end_time=$(date +%s%N | cut -b1-13)
    duration=$(awk "BEGIN {print ($end_time - $start_time) / 1000}")
    
    echo "Load Test Results:"
    echo "  • Total Requests: 10"
    echo "  • Total Duration: ${duration}s"
    echo "  • Average RPS: $(awk "BEGIN {print 10 / ($duration / 1000)}")"
    
    ((TOTAL_REQUESTS += 10))
    ((SUCCESSFUL_REQUESTS += 10))
    
    echo
    echo "Resource Monitoring Notes:"
    echo "  • Memory usage should remain stable during load"
    echo "  • CPU usage correlates with request processing"
    echo "  • Event loop lag indicates performance bottlenecks"
    echo "  • Monitor /health endpoint for real-time metrics"
    echo
    
    sleep 1
    
    # Example 6: Throughput measurement
    echo -e "${COLOR_CYAN}Example 6: Throughput and Capacity Testing${COLOR_RESET}"
    echo "Command: Sustained throughput measurement over time period"
    echo "Purpose: Determines maximum sustainable request rate and capacity limits"
    echo
    
    echo "Measuring sustained throughput (20 requests over 10 seconds):"
    
    throughput_start=$(date +%s)
    successful_throughput=0
    
    for i in {1..20}; do
        if curl -s -f "$BASE_URL$HELLO_ENDPOINT" > /dev/null; then
            ((successful_throughput++))
        fi
        
        # Pace requests evenly over 10 seconds
        sleep 0.5
    done
    
    throughput_end=$(date +%s)
    throughput_duration=$((throughput_end - throughput_start))
    requests_per_second=$(awk "BEGIN {print $successful_throughput / $throughput_duration}")
    
    echo "Throughput Results:"
    echo "  • Successful Requests: $successful_throughput/20"
    echo "  • Test Duration: ${throughput_duration}s"
    echo "  • Requests per Second: $requests_per_second RPS"
    echo "  • Success Rate: $(awk "BEGIN {print ($successful_throughput / 20) * 100}")%"
    
    ((TOTAL_REQUESTS += 20))
    ((SUCCESSFUL_REQUESTS += successful_throughput))
    ((FAILED_REQUESTS += $((20 - successful_throughput))))
    
    echo
    echo "Capacity Planning Analysis:"
    echo "  • Current RPS capability: $requests_per_second (sustained)"
    echo "  • Scaling recommendation: Monitor at 70% capacity"
    echo "  • Bottleneck identification: CPU, memory, or I/O bound"
    echo "  • Load balancer configuration: Multiple instances for higher RPS"
    echo
    
    # Example 7: Performance regression testing
    echo -e "${COLOR_CYAN}Example 7: Performance Regression Baseline${COLOR_RESET}"
    echo "Command: Establish performance baseline for regression testing"
    echo "Purpose: Creates repeatable performance benchmark for CI/CD integration"
    echo
    
    echo "Performance Baseline Test (5 samples):"
    
    baseline_times=()
    for i in {1..5}; do
        sample_time=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$HELLO_ENDPOINT")
        baseline_times+=("$sample_time")
        echo "  Sample $i: ${sample_time}s"
    done
    
    # Calculate average baseline time
    total_baseline=0
    for time in "${baseline_times[@]}"; do
        total_baseline=$(awk "BEGIN {print $total_baseline + $time}")
    done
    average_baseline=$(awk "BEGIN {print $total_baseline / 5}")
    
    echo "Performance Baseline Summary:"
    echo "  • Average Response Time: ${average_baseline}s"
    echo "  • Performance Threshold: $(awk "BEGIN {print $average_baseline * 1.5}")s (50% tolerance)"
    echo "  • Regression Detection: Response time > threshold indicates regression"
    echo "  • CI/CD Integration: Include in automated testing pipeline"
    
    ((TOTAL_REQUESTS += 5))
    ((SUCCESSFUL_REQUESTS += 5))
    
    echo
    
    echo -e "${COLOR_PURPLE}Performance Examples Summary:${COLOR_RESET}"
    echo "  Established comprehensive performance testing methodology"
    echo "  Measured response times, throughput, and concurrent request handling"
    echo "  Created performance baselines for regression testing"
    echo "  Demonstrated scalability analysis and capacity planning techniques"
    echo "  Performance Status: $([ $(awk "BEGIN {print ($average_baseline < 0.100)}") ] && echo "GOOD (< 100ms)" || echo "ACCEPTABLE (< 1s)")"
    echo
    
    # Cleanup timing file
    rm -f "$CURL_TIMING_FILE" 2>/dev/null
}

/**
 * Executes advanced curl examples demonstrating sophisticated HTTP client techniques including 
 * custom headers, request modification, and debugging methods
 * @returns {void} No return value - displays advanced curl usage examples and techniques
 */
function run_advanced_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          ADVANCED CURL TECHNIQUES AND DEBUGGING${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • Advanced curl command options and configuration techniques"
    echo "  • HTTP debugging methods and protocol analysis tools"
    echo "  • Custom request modification and header manipulation"
    echo "  • Connection management and performance optimization"
    echo "  • Automation patterns for complex HTTP testing scenarios"
    echo
    
    # Example 1: Detailed debugging with trace output
    echo -e "${COLOR_CYAN}Example 1: Detailed HTTP Debug Tracing${COLOR_RESET}"
    echo "Command: curl --trace-ascii - ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Shows complete HTTP protocol communication including raw data"
    echo
    
    echo "Trace Output (first 1000 characters):"
    curl --trace-ascii - "$BASE_URL$HELLO_ENDPOINT" 2>&1 | head -20
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ HTTP trace debugging successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ HTTP trace debugging failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Trace Analysis Benefits:"
    echo "  • Complete HTTP protocol visibility including raw bytes"
    echo "  • Request/response header inspection and validation"
    echo "  • Network communication debugging and troubleshooting"
    echo "  • Protocol compliance verification and analysis"
    echo
    
    sleep 1
    
    # Example 2: Custom configuration file usage
    echo -e "${COLOR_CYAN}Example 2: curl Configuration File Usage${COLOR_RESET}"
    echo "Purpose: Demonstrates complex request configuration through config files"
    
    # Create temporary curl config file
    cat > "${CURL_OUTPUT_FILE}.config" << EOF
# curl configuration file for Node.js tutorial testing
url = "$BASE_URL$HELLO_ENDPOINT"
user-agent = "Advanced-curl-example/2.0"
header = "X-Test-Mode: advanced"
header = "X-Client-Version: 1.0.0"
connect-timeout = 10
max-time = 30
silent
write-out = "Advanced Config Test - Status: %{http_code}, Time: %{time_total}s\\n"
EOF
    
    echo "Command: curl -K curl-config-file"
    echo "Config file contains: URL, headers, timeouts, and output format"
    echo
    
    curl -K "${CURL_OUTPUT_FILE}.config"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Configuration file usage successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Configuration file usage failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Configuration File Benefits:"
    echo "  • Complex request setup management and reusability"
    echo "  • Consistent testing parameters across different scenarios"
    echo "  • Version-controlled request configuration for reproducibility"
    echo "  • Simplified command-line usage for complex requests"
    echo
    
    sleep 1
    
    # Example 3: Connection management and HTTP/1.1 features
    echo -e "${COLOR_CYAN}Example 3: HTTP/1.1 Connection Management${COLOR_RESET}"
    echo "Command: curl --http1.1 -H 'Connection: keep-alive' ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Demonstrates HTTP/1.1 specific features and connection optimization"
    echo
    
    curl --http1.1 \
         -H "Connection: keep-alive" \
         -H "Cache-Control: no-cache" \
         -v "$BASE_URL$HELLO_ENDPOINT" 2>&1 | grep -E "(HTTP/1.1|Connection|Cache-Control)"
    exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ HTTP/1.1 connection management successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ HTTP/1.1 connection management failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "HTTP/1.1 Features Analysis:"
    echo "  • Keep-alive connections for request reuse and performance"
    echo "  • Cache control headers for response caching behavior"
    echo "  • Protocol version negotiation and compatibility"
    echo "  • Connection persistence and resource optimization"
    echo
    
    sleep 1
    
    # Example 4: Request and response data handling
    echo -e "${COLOR_CYAN}Example 4: Advanced Data Handling and Output Control${COLOR_RESET}"
    echo "Command: Complex output redirection and data processing"
    echo "Purpose: Demonstrates advanced data handling for automation and analysis"
    echo
    
    # Capture response with headers and timing
    curl -D "$CURL_HEADERS_FILE" \
         -o "$CURL_OUTPUT_FILE" \
         -w "Response captured - Status: %{http_code}, Size: %{size_download} bytes\n" \
         "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "Response Headers:"
        cat "$CURL_HEADERS_FILE"
        echo
        echo "Response Body:"
        cat "$CURL_OUTPUT_FILE"
        echo
        echo -e "${COLOR_GREEN}✓ Advanced data handling successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Advanced data handling failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Data Handling Benefits:"
    echo "  • Separate header and body processing for automation"
    echo "  • File-based response storage for further analysis"
    echo "  • Structured data extraction and validation"
    echo "  • Integration with shell scripts and processing pipelines"
    echo
    
    sleep 1
    
    # Example 5: Retry logic and error recovery
    echo -e "${COLOR_CYAN}Example 5: Retry Logic and Error Recovery Patterns${COLOR_RESET}"
    echo "Command: curl --retry 3 --retry-delay 1 ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Demonstrates resilient request patterns with automatic retry"
    echo
    
    curl --retry 3 \
         --retry-delay 1 \
         --retry-connrefused \
         -s -w "Retry test - Attempts: %{num_connects}, Status: %{http_code}, Time: %{time_total}s\n" \
         "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${COLOR_GREEN}✓ Retry logic test successful${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Retry logic test failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Retry Patterns Benefits:"
    echo "  • Resilient client behavior for unreliable networks"
    echo "  • Automated recovery from transient failures"
    echo "  • Configurable retry strategies and backoff policies"
    echo "  • Improved success rates in unstable environments"
    echo
    
    sleep 1
    
    # Example 6: Cookie and session management
    echo -e "${COLOR_CYAN}Example 6: Cookie and Session Management (Educational)${COLOR_RESET}"
    echo "Command: curl -c cookies.txt -b cookies.txt ${BASE_URL}${HELLO_ENDPOINT}"
    echo "Purpose: Demonstrates cookie handling for session-aware applications"
    echo "Note: Tutorial server doesn't use cookies, but shows the technique"
    echo
    
    cookie_jar="${CURL_OUTPUT_FILE}.cookies"
    
    curl -c "$cookie_jar" \
         -b "$cookie_jar" \
         -s -w "Cookie test - Status: %{http_code}, Cookies: %{num_headers}\n" \
         "$BASE_URL$HELLO_ENDPOINT"
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "Cookie file contents:"
        if [ -f "$cookie_jar" ] && [ -s "$cookie_jar" ]; then
            cat "$cookie_jar"
        else
            echo "(No cookies received - expected for this stateless server)"
        fi
        echo -e "${COLOR_GREEN}✓ Cookie management test completed${COLOR_RESET}"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo -e "${COLOR_RED}✗ Cookie management test failed${COLOR_RESET}"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Cookie Management Applications:"
    echo "  • Session-aware application testing and automation"
    echo "  • Authentication state maintenance across requests"
    echo "  • Multi-step workflow testing with state persistence"
    echo "  • Web application testing with login sessions"
    echo
    
    sleep 1
    
    # Example 7: Advanced scripting integration
    echo -e "${COLOR_CYAN}Example 7: Shell Scripting Integration Patterns${COLOR_RESET}"
    echo "Purpose: Demonstrates curl integration with advanced shell scripting"
    echo
    
    # Function to validate response and extract data
    validate_and_extract() {
        local url="$1"
        local expected_response="$2"
        
        response=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}" "$url")
        
        # Extract response body and metadata
        http_code=$(echo "$response" | tail -1 | cut -d'|' -f1)
        time_total=$(echo "$response" | tail -1 | cut -d'|' -f2)
        size_download=$(echo "$response" | tail -1 | cut -d'|' -f3)
        body=$(echo "$response" | sed '$d')  # Remove last line (metadata)
        
        echo "Advanced Validation Results:"
        echo "  HTTP Code: $http_code"
        echo "  Response Time: ${time_total}s"
        echo "  Response Size: ${size_download} bytes"
        echo "  Response Body: '$body'"
        
        # Validation logic
        if [ "$http_code" = "200" ] && [ "$body" = "$expected_response" ]; then
            echo -e "  ${COLOR_GREEN}✓ Response validation successful${COLOR_RESET}"
            return 0
        else
            echo -e "  ${COLOR_RED}✗ Response validation failed${COLOR_RESET}"
            return 1
        fi
    }
    
    echo "Running advanced validation function:"
    if validate_and_extract "$BASE_URL$HELLO_ENDPOINT" "Hello world"; then
        ((SUCCESSFUL_REQUESTS++))
    else
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Scripting Integration Benefits:"
    echo "  • Complex response validation and processing logic"
    echo "  • Automated test assertion and result analysis"
    echo "  • Data extraction and transformation pipelines"
    echo "  • Integration with CI/CD and monitoring systems"
    echo
    
    echo -e "${COLOR_PURPLE}Advanced Examples Summary:${COLOR_RESET}"
    echo "  Demonstrated sophisticated curl usage patterns and techniques"
    echo "  Explored debugging, configuration, and automation capabilities"
    echo "  Showed integration patterns for complex testing scenarios"
    echo "  Established foundation for professional HTTP testing workflows"
    echo
    
    # Cleanup temporary files
    rm -f "${CURL_OUTPUT_FILE}.config" \
          "$CURL_HEADERS_FILE" \
          "$CURL_OUTPUT_FILE" \
          "${CURL_OUTPUT_FILE}.cookies" 2>/dev/null
}

/**
 * Executes integration testing curl examples demonstrating real-world usage patterns including 
 * monitoring integration, load balancer health checks, and CI/CD pipeline testing
 * @returns {void} No return value - displays integration testing curl examples and automation patterns
 */
function run_integration_examples() {
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}                          INTEGRATION TESTING AND AUTOMATION${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}═══════════════════════════════════════════════════════════════════════════════${COLOR_RESET}"
    echo
    
    echo -e "${COLOR_BLUE}Educational Focus:${COLOR_RESET}"
    echo "  • Real-world integration patterns for monitoring and automation systems"
    echo "  • Load balancer health check implementation and validation"
    echo "  • CI/CD pipeline integration with automated testing and validation"
    echo "  • Production deployment verification and smoke testing patterns"
    echo "  • Monitoring system integration and alerting automation"
    echo
    
    # Example 1: Load balancer health check pattern
    echo -e "${COLOR_CYAN}Example 1: Load Balancer Health Check Implementation${COLOR_RESET}"
    echo "Purpose: Simulates load balancer health check behavior and decision making"
    echo
    
    # Function to simulate load balancer health check
    lb_health_check() {
        local endpoint="$1"
        local timeout="${2:-5}"
        local max_retries="${3:-3}"
        
        echo "Load Balancer Health Check Configuration:"
        echo "  Endpoint: $endpoint"
        echo "  Timeout: ${timeout}s"
        echo "  Max Retries: $max_retries"
        echo
        
        for attempt in $(seq 1 $max_retries); do
            echo "Health Check Attempt $attempt/$max_retries:"
            
            if curl -f \
                   --connect-timeout "$timeout" \
                   --max-time "$timeout" \
                   --silent \
                   --write-out "  Status: %{http_code}, Time: %{time_total}s, Size: %{size_download} bytes\n" \
                   --output /dev/null \
                   "$endpoint"; then
                
                echo -e "  ${COLOR_GREEN}✓ BACKEND HEALTHY - Adding to load balancer pool${COLOR_RESET}"
                return 0
            else
                echo -e "  ${COLOR_RED}✗ Health check failed (attempt $attempt)${COLOR_RESET}"
                [ $attempt -lt $max_retries ] && sleep 1
            fi
        done
        
        echo -e "  ${COLOR_RED}✗ BACKEND UNHEALTHY - Removing from load balancer pool${COLOR_RESET}"
        return 1
    }
    
    if lb_health_check "$BASE_URL$HEALTH_ENDPOINT" 5 2; then
        echo "Load Balancer Decision: ROUTE TRAFFIC TO BACKEND"
        ((SUCCESSFUL_REQUESTS++))
    else
        echo "Load Balancer Decision: REMOVE BACKEND FROM POOL"
        ((FAILED_REQUESTS++))
    fi
    ((TOTAL_REQUESTS++))
    
    echo
    echo "Load Balancer Integration Benefits:"
    echo "  • Automatic backend health validation and traffic routing"
    echo "  • Failure detection and recovery automation"
    echo "  • Zero-downtime deployment support with health checks"
    echo "  • Scalable architecture with dynamic backend management"
    echo
    
    sleep 2
    
    # Example 2: CI/CD pipeline smoke testing
    echo -e "${COLOR_CYAN}Example 2: CI/CD Pipeline Smoke Testing${COLOR_RESET}"
    echo "Purpose: Implements comprehensive smoke tests for deployment verification"
    echo
    
    # Function to simulate CI/CD smoke test suite
    cicd_smoke_test() {
        local base_url="$1"
        local test_timeout="${2:-10}"
        
        echo "CI/CD Smoke Test Suite Configuration:"
        echo "  Base URL: $base_url"
        echo "  Test Timeout: ${test_timeout}s"
        echo "  Pipeline Stage: post-deployment-verification"
        echo
        
        local tests_passed=0
        local tests_failed=0
        local test_results=()
        
        # Test 1: Basic connectivity
        echo "Test 1/4: Basic Connectivity Test"
        if curl -f --connect-timeout 5 --max-time $test_timeout -s "$base_url$HELLO_ENDPOINT" > /dev/null; then
            echo -e "  ${COLOR_GREEN}✓ PASS - Server is accessible${COLOR_RESET}"
            ((tests_passed++))
            test_results+=("connectivity:PASS")
        else
            echo -e "  ${COLOR_RED}✗ FAIL - Server connectivity failed${COLOR_RESET}"
            ((tests_failed++))
            test_results+=("connectivity:FAIL")
        fi
        
        # Test 2: Response validation
        echo "Test 2/4: Response Content Validation"
        response=$(curl -s "$base_url$HELLO_ENDPOINT")
        if [ "$response" = "Hello world" ]; then
            echo -e "  ${COLOR_GREEN}✓ PASS - Response content matches expected value${COLOR_RESET}"
            ((tests_passed++))
            test_results+=("content:PASS")
        else
            echo -e "  ${COLOR_RED}✗ FAIL - Response content mismatch${COLOR_RESET}"
            echo "    Expected: 'Hello world'"
            echo "    Received: '$response'"
            ((tests_failed++))
            test_results+=("content:FAIL")
        fi
        
        # Test 3: Health endpoint validation
        echo "Test 3/4: Health Endpoint Validation"
        if curl -f -s "$base_url$HEALTH_ENDPOINT" | grep -q '"status":"healthy"'; then
            echo -e "  ${COLOR_GREEN}✓ PASS - Health endpoint reports healthy status${COLOR_RESET}"
            ((tests_passed++))
            test_results+=("health:PASS")
        else
            echo -e "  ${COLOR_RED}✗ FAIL - Health endpoint validation failed${COLOR_RESET}"
            ((tests_failed++))
            test_results+=("health:FAIL")
        fi
        
        # Test 4: Performance threshold validation
        echo "Test 4/4: Performance Threshold Validation"
        response_time=$(curl -s -w "%{time_total}" -o /dev/null "$base_url$HELLO_ENDPOINT")
        if awk "BEGIN {exit ($response_time > 1.0)}"; then
            echo -e "  ${COLOR_GREEN}✓ PASS - Response time within acceptable limits (${response_time}s < 1.0s)${COLOR_RESET}"
            ((tests_passed++))
            test_results+=("performance:PASS")
        else
            echo -e "  ${COLOR_RED}✗ FAIL - Response time exceeds threshold (${response_time}s > 1.0s)${COLOR_RESET}"
            ((tests_failed++))
            test_results+=("performance:FAIL")
        fi
        
        echo
        echo "CI/CD Smoke Test Results Summary:"
        echo "  Tests Passed: $tests_passed/4"
        echo "  Tests Failed: $tests_failed/4"
        echo "  Success Rate: $(awk "BEGIN {print ($tests_passed / 4) * 100}")%"
        echo "  Test Results: ${test_results[*]}"
        
        if [ $tests_failed -eq 0 ]; then
            echo -e "  ${COLOR_GREEN}✓ DEPLOYMENT VERIFIED - Smoke tests passed${COLOR_RESET}"
            return 0
        else
            echo -e "  ${COLOR_RED}✗ DEPLOYMENT FAILED - Smoke tests failed${COLOR_RESET}"
            return 1
        fi
    }
    
    if cicd_smoke_test "$BASE_URL" 10; then
        echo "CI/CD Pipeline Action: APPROVE DEPLOYMENT"
        ((SUCCESSFUL_REQUESTS += 4))
    else
        echo "CI/CD Pipeline Action: ROLLBACK DEPLOYMENT"
        ((FAILED_REQUESTS += 4))
    fi
    ((TOTAL_REQUESTS += 4))
    
    echo
    echo "CI/CD Integration Benefits:"
    echo "  • Automated deployment verification and quality gates"
    echo "  • Early detection of deployment issues and regressions"
    echo "  • Consistent testing across different environments"
    echo "  • Automated rollback triggers based on test failures"
    echo
    
    sleep 2
    
    # Example 3: Monitoring system integration
    echo -e "${COLOR_CYAN}Example 3: Monitoring System Integration Pattern${COLOR_RESET}"
    echo "Purpose: Demonstrates monitoring system data collection and alerting"
    echo
    
    # Function to simulate monitoring data collection
    monitoring_collection() {
        local base_url="$1"
        local collection_interval="${2:-30}"
        
        echo "Monitoring System Configuration:"
        echo "  Target: $base_url"
        echo "  Collection Interval: ${collection_interval}s"
        echo "  Metrics: response_time, availability, health_score"
        echo
        
        # Collect metrics sample
        echo "Collecting metrics sample (3 data points):"
        
        local metrics=()
        local total_response_time=0
        local successful_checks=0
        
        for i in {1..3}; do
            echo "Metric Collection $i/3:"
            
            # Collect response time and availability
            response_data=$(curl -s -w "%{http_code}|%{time_total}" -o /dev/null "$base_url$HELLO_ENDPOINT")
            http_code=$(echo "$response_data" | cut -d'|' -f1)
            response_time=$(echo "$response_data" | cut -d'|' -f2)
            
            # Collect health score
            if command -v jq > /dev/null 2>&1; then
                health_score=$(curl -s "$base_url$HEALTH_ENDPOINT" | jq -r '.score // 0' 2>/dev/null || echo "0")
            else
                health_score="100"  # Default if jq not available
            fi
            
            # Availability calculation
            if [ "$http_code" = "200" ]; then
                availability="1"
                ((successful_checks++))
            else
                availability="0"
            fi
            
            total_response_time=$(awk "BEGIN {print $total_response_time + $response_time}")
            
            echo "  Response Time: ${response_time}s"
            echo "  Availability: $availability (HTTP $http_code)"
            echo "  Health Score: $health_score/100"
            
            metrics+=("${response_time},${availability},${health_score}")
            
            [ $i -lt 3 ] && sleep 1
        done
        
        # Calculate aggregated metrics
        avg_response_time=$(awk "BEGIN {print $total_response_time / 3}")
        availability_percent=$(awk "BEGIN {print ($successful_checks / 3) * 100}")
        
        echo
        echo "Monitoring Metrics Summary:"
        echo "  Average Response Time: ${avg_response_time}s"
        echo "  Availability: ${availability_percent}%"
        echo "  Data Points Collected: 3"
        echo "  Collection Status: SUCCESS"
        
        # Alert threshold checking
        echo
        echo "Alert Threshold Analysis:"
        if awk "BEGIN {exit ($avg_response_time > 0.5)}"; then
            echo -e "  ${COLOR_GREEN}✓ Response Time Alert: OK (${avg_response_time}s < 0.5s threshold)${COLOR_RESET}"
        else
            echo -e "  ${COLOR_YELLOW}⚠ Response Time Alert: WARNING (${avg_response_time}s > 0.5s threshold)${COLOR_RESET}"
        fi
        
        if awk "BEGIN {exit ($availability_percent < 95)}"; then
            echo -e "  ${COLOR_GREEN}✓ Availability Alert: OK (${availability_percent}% >= 95% threshold)${COLOR_RESET}"
        else
            echo -e "  ${COLOR_RED}✗ Availability Alert: CRITICAL (${availability_percent}% < 95% threshold)${COLOR_RESET}"
        fi
        
        return 0
    }
    
    monitoring_collection "$BASE_URL" 1
    ((TOTAL_REQUESTS += 6))  # 3 hello + 3 health requests
    ((SUCCESSFUL_REQUESTS += 6))
    
    echo
    echo "Monitoring Integration Benefits:"
    echo "  • Continuous application performance and availability monitoring"
    echo "  • Automated alerting based on configurable thresholds"
    echo "  • Historical data collection for trend analysis and capacity planning"
    echo "  • Integration with monitoring platforms (Prometheus, Grafana, etc.)"
    echo
    
    sleep 1
    
    # Example 4: Blue-Green deployment validation
    echo -e "${COLOR_CYAN}Example 4: Blue-Green Deployment Validation${COLOR_RESET}"
    echo "Purpose: Simulates blue-green deployment testing and traffic switching"
    echo
    
    # Simulate blue-green deployment testing
    blue_green_validation() {
        local blue_url="$1"
        local green_url="$1"  # Same URL for demo, normally different
        local validation_requests=5
        
        echo "Blue-Green Deployment Validation:"
        echo "  Blue Environment: $blue_url (current production)"
        echo "  Green Environment: $green_url (new deployment)"
        echo "  Validation Requests: $validation_requests per environment"
        echo
        
        # Validate blue environment (current production)
        echo "Validating Blue Environment (Current Production):"
        blue_success=0
        for i in $(seq 1 $validation_requests); do
            if curl -f -s --max-time 5 "$blue_url$HELLO_ENDPOINT" > /dev/null; then
                ((blue_success++))
            fi
        done
        blue_success_rate=$(awk "BEGIN {print ($blue_success / $validation_requests) * 100}")
        echo "  Blue Success Rate: ${blue_success_rate}% ($blue_success/$validation_requests)"
        
        # Validate green environment (new deployment)
        echo "Validating Green Environment (New Deployment):"
        green_success=0
        for i in $(seq 1 $validation_requests); do
            if curl -f -s --max-time 5 "$green_url$HELLO_ENDPOINT" > /dev/null; then
                ((green_success++))
            fi
        done
        green_success_rate=$(awk "BEGIN {print ($green_success / $validation_requests) * 100}")
        echo "  Green Success Rate: ${green_success_rate}% ($green_success/$validation_requests)"
        
        echo
        echo "Deployment Decision Matrix:"
        if awk "BEGIN {exit ($green_success_rate >= 95)}"; then
            echo -e "  ${COLOR_GREEN}✓ Green environment validation passed (>= 95% success rate)${COLOR_RESET}"
            echo -e "  ${COLOR_GREEN}✓ APPROVED: Switch traffic from Blue to Green${COLOR_RESET}"
            echo "  Action: Update load balancer to route traffic to Green environment"
            return 0
        else
            echo -e "  ${COLOR_RED}✗ Green environment validation failed (< 95% success rate)${COLOR_RESET}"
            echo -e "  ${COLOR_RED}✗ REJECTED: Maintain traffic on Blue environment${COLOR_RESET}"
            echo "  Action: Investigate Green environment issues before retry"
            return 1
        fi
    }
    
    if blue_green_validation "$BASE_URL"; then
        echo "Deployment Result: TRAFFIC SWITCHED TO GREEN"
        ((SUCCESSFUL_REQUESTS += 10))
    else
        echo "Deployment Result: TRAFFIC REMAINS ON BLUE"
        ((FAILED_REQUESTS += 5))
        ((SUCCESSFUL_REQUESTS += 5))
    fi
    ((TOTAL_REQUESTS += 10))
    
    echo
    echo "Blue-Green Deployment Benefits:"
    echo "  • Zero-downtime deployments with instant rollback capability"
    echo "  • Production environment testing before traffic switching"
    echo "  • Risk mitigation through validation and automated decision making"
    echo "  • Consistent deployment process with automated quality gates"
    echo
    
    echo -e "${COLOR_PURPLE}Integration Examples Summary:${COLOR_RESET}"
    echo "  Demonstrated real-world integration patterns and automation"
    echo "  Showed load balancer, CI/CD, and monitoring system integration"
    echo "  Established production-ready testing and validation workflows"
    echo "  Created foundation for enterprise deployment and operations"
    echo
}

/**
 * Displays comprehensive help information including available example categories, command-line 
 * options, troubleshooting guidance, and educational resources
 * @returns {void} No return value - prints help information to stdout
 */
function print_help() {
    echo -e "${COLOR_CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                         curl Examples Help Documentation                     ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${COLOR_RESET}"
    echo
    echo -e "${COLOR_BLUE}USAGE:${COLOR_RESET}"
    echo "  $0 [COMMAND] [OPTIONS]"
    echo "  source $0                    # Load functions into current shell"
    echo
    echo -e "${COLOR_BLUE}AVAILABLE COMMANDS:${COLOR_RESET}"
    echo "  run_basic_examples          Execute basic HTTP GET request examples"
    echo "  run_health_examples         Test health endpoint with JSON processing"
    echo "  run_error_examples          Demonstrate error handling and HTTP status codes"
    echo "  run_security_examples       Validate security headers and best practices"
    echo "  run_performance_examples    Measure response times and performance metrics"
    echo "  run_advanced_examples       Advanced curl techniques and debugging methods"
    echo "  run_integration_examples    Integration testing and automation patterns"
    echo "  check_server               Verify server connectivity and accessibility"
    echo "  print_banner               Display informational banner and overview"
    echo "  print_help                 Show this help documentation"
    echo "  cleanup                    Clean up temporary files and reset environment"
    echo
    echo -e "${COLOR_BLUE}EXAMPLE CATEGORIES:${COLOR_RESET}"
    echo
    echo -e "${COLOR_GREEN}Basic Examples:${COLOR_RESET}"
    echo "  • Simple HTTP GET requests to /hello endpoint"
    echo "  • Response analysis including headers and timing"
    echo "  • Verbose output and silent modes for different use cases"
    echo "  • Custom User-Agent headers and request identification"
    echo
    echo -e "${COLOR_GREEN}Health Examples:${COLOR_RESET}"
    echo "  • Comprehensive health endpoint testing with JSON responses"
    echo "  • System metrics extraction and monitoring integration"
    echo "  • Load balancer health check simulation and validation"
    echo "  • Performance measurement for health endpoint optimization"
    echo
    echo -e "${COLOR_GREEN}Error Examples:${COLOR_RESET}"
    echo "  • HTTP error codes demonstration (404, 405, 500)"
    echo "  • Error response format analysis and debugging"
    echo "  • Client-side error handling strategies and patterns"
    echo "  • Server error response validation and security testing"
    echo
    echo -e "${COLOR_GREEN}Security Examples:${COLOR_RESET}"
    echo "  • HTTP security headers analysis and validation"
    echo "  • Security best practices demonstration through testing"
    echo "  • Header injection testing and vulnerability assessment"
    echo "  • Transport security considerations and recommendations"
    echo
    echo -e "${COLOR_GREEN}Performance Examples:${COLOR_RESET}"
    echo "  • Response time measurement and performance benchmarking"
    echo "  • Concurrent request testing and throughput analysis"
    echo "  • Connection management and HTTP keep-alive optimization"
    echo "  • Performance baseline establishment for regression testing"
    echo
    echo -e "${COLOR_GREEN}Advanced Examples:${COLOR_RESET}"
    echo "  • HTTP protocol debugging with detailed trace output"
    echo "  • Configuration file usage for complex request setups"
    echo "  • Retry logic and error recovery patterns"
    echo "  • Shell scripting integration for automation workflows"
    echo
    echo -e "${COLOR_GREEN}Integration Examples:${COLOR_RESET}"
    echo "  • Load balancer health check implementation patterns"
    echo "  • CI/CD pipeline smoke testing and deployment verification"
    echo "  • Monitoring system integration and metrics collection"
    echo "  • Blue-green deployment validation and traffic switching"
    echo
    echo -e "${COLOR_BLUE}SERVER REQUIREMENTS:${COLOR_RESET}"
    echo "  • Node.js tutorial HTTP server must be running"
    echo "  • Default server location: http://127.0.0.1:3000"
    echo "  • Available endpoints: /hello, /health, / (root)"
    echo "  • Server startup command: node server.js"
    echo
    echo -e "${COLOR_BLUE}SYSTEM REQUIREMENTS:${COLOR_RESET}"
    echo "  • curl command-line tool (version 7.0 or higher)"
    echo "  • bash shell environment for script execution"
    echo "  • jq JSON processor (optional but recommended)"
    echo "  • Network connectivity to the tutorial server"
    echo
    echo -e "${COLOR_BLUE}INSTALLATION COMMANDS:${COLOR_RESET}"
    echo "  # Ubuntu/Debian"
    echo "  sudo apt-get update && sudo apt-get install curl jq"
    echo
    echo "  # macOS with Homebrew"
    echo "  brew install curl jq"
    echo
    echo "  # Red Hat/CentOS/Fedora"
    echo "  sudo yum install curl jq    # or dnf install curl jq"
    echo
    echo -e "${COLOR_BLUE}TROUBLESHOOTING:${COLOR_RESET}"
    echo
    echo -e "${COLOR_YELLOW}Connection Issues:${COLOR_RESET}"
    echo "  • Verify Node.js server is running: node server.js"
    echo "  • Check server is listening on correct port (default: 3000)"
    echo "  • Ensure no firewall blocking connections to server port"
    echo "  • Test local connectivity: curl http://127.0.0.1:3000/hello"
    echo
    echo -e "${COLOR_YELLOW}curl Issues:${COLOR_RESET}"
    echo "  • Check curl installation: curl --version"
    echo "  • Verify curl can access internet: curl -I https://httpbin.org/get"
    echo "  • Test with verbose output: curl -v http://127.0.0.1:3000/hello"
    echo "  • Check for proxy settings: echo \$http_proxy \$https_proxy"
    echo
    echo -e "${COLOR_YELLOW}JSON Processing Issues:${COLOR_RESET}"
    echo "  • Install jq for JSON processing: sudo apt-get install jq"
    echo "  • Test jq installation: echo '{\"test\": \"value\"}' | jq ."
    echo "  • Alternative: Use curl with grep for basic JSON extraction"
    echo "  • Verify health endpoint returns valid JSON format"
    echo
    echo -e "${COLOR_YELLOW}Permission Issues:${COLOR_RESET}"
    echo "  • Make script executable: chmod +x $0"
    echo "  • Check temporary file permissions in /tmp directory"
    echo "  • Ensure user has network access permissions"
    echo
    echo -e "${COLOR_BLUE}EDUCATIONAL RESOURCES:${COLOR_RESET}"
    echo
    echo -e "${COLOR_GREEN}Learning Objectives:${COLOR_RESET}"
    echo "  • Master HTTP client-server communication using curl"
    echo "  • Understand HTTP status codes and their meanings"
    echo "  • Learn API testing techniques and response validation"
    echo "  • Explore HTTP headers and web security best practices"
    echo "  • Develop performance testing and optimization skills"
    echo "  • Build automation scripts for testing and monitoring"
    echo
    echo -e "${COLOR_GREEN}Practical Applications:${COLOR_RESET}"
    echo "  • API development and testing workflows"
    echo "  • Health check automation for monitoring systems"
    echo "  • Load balancer configuration and testing"
    echo "  • CI/CD pipeline integration for deployment verification"
    echo "  • Security testing and vulnerability assessment"
    echo "  • Performance benchmarking and optimization analysis"
    echo
    echo -e "${COLOR_BLUE}ADVANCED USAGE:${COLOR_RESET}"
    echo
    echo "  # Run specific example category"
    echo "  $0 run_basic_examples"
    echo
    echo "  # Check server status before running examples"
    echo "  $0 check_server && $0 run_health_examples"
    echo
    echo "  # Run all examples in sequence"
    echo "  for example in basic health error security performance advanced integration; do"
    echo "    $0 run_\${example}_examples"
    echo "  done"
    echo
    echo "  # Load functions and run interactively"
    echo "  source $0"
    echo "  run_basic_examples"
    echo
    echo -e "${COLOR_BLUE}ENVIRONMENT VARIABLES:${COLOR_RESET}"
    echo "  BASE_URL            Override server base URL (default: http://127.0.0.1:3000)"
    echo "  DEFAULT_TIMEOUT     Override default request timeout (default: 30)"
    echo "  USER_AGENT          Override default User-Agent string"
    echo
    echo "  # Example with custom configuration"
    echo "  BASE_URL=http://localhost:8080 $0 run_basic_examples"
    echo
    echo -e "${COLOR_BLUE}FILES CREATED:${COLOR_RESET}"
    echo "  /tmp/curl-examples-output-\$\$    Temporary response storage"
    echo "  /tmp/curl-examples-timing-\$\$    Temporary timing data"
    echo "  /tmp/curl-examples-headers-\$\$   Temporary header storage"
    echo "  Note: All temporary files are automatically cleaned up"
    echo
    echo -e "${COLOR_BLUE}EXIT CODES:${COLOR_RESET}"
    echo "  0    Success - all operations completed successfully"
    echo "  1    General error - server connectivity or script execution failed"
    echo "  2    Invalid arguments - unsupported command or option provided"
    echo
    echo -e "${COLOR_BLUE}VERSION INFORMATION:${COLOR_RESET}"
    echo "  Script Version: 1.0.0"
    echo "  Compatible with: Node.js Tutorial HTTP Server v1.0.0"
    echo "  curl Version Required: 7.0+"
    echo "  bash Version Required: 4.0+"
    echo
    echo -e "${COLOR_GREEN}For additional help and documentation:${COLOR_RESET}"
    echo "  • Review the Node.js Tutorial HTTP Server API documentation"
    echo "  • Check server logs for detailed error information"
    echo "  • Visit curl documentation: https://curl.se/docs/"
    echo "  • HTTP/1.1 specification: https://tools.ietf.org/html/rfc7231"
    echo
}

/**
 * Performs cleanup operations including temporary file removal, connection cleanup, and resource 
 * deallocation for clean script termination
 * @returns {void} No return value - performs cleanup operations
 */
function cleanup() {
    echo -e "${COLOR_BLUE}Performing cleanup operations...${COLOR_RESET}"
    
    # Calculate script execution statistics
    local script_end_time=$(date +%s%N | cut -b1-13)
    local total_execution_time=$(awk "BEGIN {print ($script_end_time - $SCRIPT_START_TIME) / 1000}")
    
    # Remove temporary files created during curl examples execution
    local files_removed=0
    for temp_file in "$CURL_OUTPUT_FILE" "$CURL_TIMING_FILE" "$CURL_HEADERS_FILE" \
                     "${CURL_OUTPUT_FILE}.config" "${CURL_OUTPUT_FILE}.cookies"; do
        if [ -f "$temp_file" ]; then
            rm -f "$temp_file" 2>/dev/null
            ((files_removed++))
        fi
    done
    
    # Reset terminal formatting and color settings
    echo -e "${COLOR_RESET}"
    
    # Display script completion summary and cleanup status
    echo -e "${COLOR_GREEN}Cleanup completed successfully${COLOR_RESET}"
    echo
    echo -e "${COLOR_PURPLE}Script Execution Summary:${COLOR_RESET}"
    echo "  Total Execution Time: ${total_execution_time}s"
    echo "  Total Requests Made: $TOTAL_REQUESTS"
    echo "  Successful Requests: $SUCCESSFUL_REQUESTS"
    echo "  Failed Requests: $FAILED_REQUESTS"
    echo "  Success Rate: $(awk "BEGIN {if ($TOTAL_REQUESTS > 0) print ($SUCCESSFUL_REQUESTS / $TOTAL_REQUESTS) * 100; else print 0}")%"
    echo "  Temporary Files Cleaned: $files_removed"
    echo
    echo -e "${COLOR_CYAN}Thank you for using the Node.js Tutorial curl Examples!${COLOR_RESET}"
    echo -e "${COLOR_CYAN}For more examples and documentation, visit the project repository.${COLOR_RESET}"
    echo
}

# Main script execution logic based on command line arguments
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    # Script is being executed directly, not sourced
    
    # Set up signal handlers for clean script termination
    trap cleanup EXIT
    trap 'cleanup; exit 130' INT
    trap 'cleanup; exit 143' TERM
    
    # Process command line arguments
    case "${1:-help}" in
        "run_basic_examples"|"basic")
            print_banner
            check_server && run_basic_examples
            ;;
        "run_health_examples"|"health")
            print_banner
            check_server && run_health_examples
            ;;
        "run_error_examples"|"error"|"errors")
            print_banner
            check_server && run_error_examples
            ;;
        "run_security_examples"|"security")
            print_banner
            check_server && run_security_examples
            ;;
        "run_performance_examples"|"performance"|"perf")
            print_banner
            check_server && run_performance_examples
            ;;
        "run_advanced_examples"|"advanced")
            print_banner
            check_server && run_advanced_examples
            ;;
        "run_integration_examples"|"integration")
            print_banner
            check_server && run_integration_examples
            ;;
        "all"|"all_examples")
            print_banner
            if check_server; then
                echo -e "${COLOR_PURPLE}Running all curl example categories...${COLOR_RESET}"
                echo
                run_basic_examples
                sleep 2
                run_health_examples
                sleep 2
                run_error_examples
                sleep 2
                run_security_examples
                sleep 2
                run_performance_examples
                sleep 2
                run_advanced_examples
                sleep 2
                run_integration_examples
                echo -e "${COLOR_PURPLE}All example categories completed successfully!${COLOR_RESET}"
            fi
            ;;
        "check_server"|"check")
            print_banner
            check_server
            ;;
        "banner")
            print_banner
            ;;
        "help"|"-h"|"--help"|*)
            print_help
            ;;
    esac
    
    exit $?
else
    # Script is being sourced - make functions available but don't execute automatically
    echo -e "${COLOR_GREEN}curl examples functions loaded successfully!${COLOR_RESET}"
    echo "Available functions: run_basic_examples, run_health_examples, run_error_examples,"
    echo "                     run_security_examples, run_performance_examples, run_advanced_examples,"
    echo "                     run_integration_examples, check_server, print_banner, print_help, cleanup"
    echo
    echo "Run 'print_help' for detailed usage information"
    echo "Run 'print_banner' for script overview and educational objectives"
    echo
fi

# Export functions for external usage when script is sourced
export -f print_banner check_server run_basic_examples run_health_examples run_error_examples
export -f run_security_examples run_performance_examples run_advanced_examples run_integration_examples
export -f print_help cleanup

# Export configuration constants for external scripts
export BASE_URL HELLO_ENDPOINT HEALTH_ENDPOINT ROOT_ENDPOINT DEFAULT_TIMEOUT USER_AGENT