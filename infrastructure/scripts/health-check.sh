#!/bin/bash

# Node.js Tutorial HTTP Server - Comprehensive Health Check Script
#
# This script provides automated health validation for the Node.js tutorial HTTP server application
# through HTTP endpoint testing, response validation, and system connectivity checking. It validates
# server health through comprehensive endpoint analysis, response time monitoring, and structured
# health reporting with configurable timeouts, retry mechanisms, and detailed diagnostic output.
#
# Educational Focus: Demonstrates shell scripting best practices, HTTP health checking patterns,
# infrastructure automation concepts, and monitoring integration techniques for operational excellence.
#
# Dependencies: curl (system-default), jq (system-default), bash, coreutils (date, timeout)
# Node.js Version: 22.11.0 LTS
# Health Monitoring: Supports Docker, Kubernetes, and external monitoring service integration

# Enable strict mode for robust error handling and debugging
set -euo pipefail

# Script metadata and version information for operational tracking
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CONFIG_DIR="$SCRIPT_DIR/../monitoring"

# Default configuration constants aligned with health-check.yml and environment.js
readonly DEFAULT_SERVER_HOST="${HEALTH_CHECK_HOST:-127.0.0.1}"
readonly DEFAULT_SERVER_PORT="${HEALTH_CHECK_PORT:-3000}"
readonly DEFAULT_TIMEOUT_SECONDS="${HEALTH_CHECK_TIMEOUT:-10}"
readonly DEFAULT_MAX_RETRIES="${HEALTH_CHECK_MAX_RETRIES:-3}"
readonly DEFAULT_RETRY_DELAY="${HEALTH_CHECK_RETRY_DELAY:-2}"
readonly PRIMARY_ENDPOINT_PATH="/hello"
readonly HEALTH_ENDPOINT_PATH="/health"
readonly EXPECTED_HELLO_RESPONSE="Hello world"
readonly USER_AGENT="${HEALTH_CHECK_USER_AGENT:-Health-Check-Script/1.0}"

# Global variables for configuration and state management
SERVER_HOST="$DEFAULT_SERVER_HOST"
SERVER_PORT="$DEFAULT_SERVER_PORT"
TIMEOUT_SECONDS="$DEFAULT_TIMEOUT_SECONDS"
MAX_RETRIES="$DEFAULT_MAX_RETRIES"
RETRY_DELAY="$DEFAULT_RETRY_DELAY"
VERBOSE_OUTPUT="${HEALTH_CHECK_VERBOSE:-false}"
CONFIG_FILE="$CONFIG_DIR/health-check.yml"
HEALTH_CHECK_SESSION_ID=""
CORRELATION_ID=""

# Health check result tracking
OVERALL_HEALTH_STATUS="unknown"
PRIMARY_ENDPOINT_STATUS="unknown"
HEALTH_ENDPOINT_STATUS="unknown"
TOTAL_RESPONSE_TIME=0
ERRORS_DETECTED=0
WARNINGS_DETECTED=0

# Exit codes for monitoring system integration (aligned with health-check.yml)
readonly EXIT_SUCCESS=0                    # All health checks passed, application is healthy
readonly EXIT_HEALTH_CHECK_FAILED=1       # One or more health checks failed, application is unhealthy
readonly EXIT_NETWORK_ERROR=2             # Network connectivity issues or DNS resolution failures
readonly EXIT_CONFIGURATION_ERROR=3       # Invalid configuration or missing required parameters
readonly EXIT_TIMEOUT_ERROR=4             # Health check requests exceeded configured timeout limits
readonly EXIT_INVALID_RESPONSE=5          # Response format validation failed or unexpected content
readonly EXIT_PREREQUISITES_FAILED=6      # Required tools (curl, jq) not available or script permissions insufficient

# Color codes for enhanced output readability (disabled in non-TTY environments)
if [[ -t 1 ]] && [[ "${TERM:-}" != "dumb" ]]; then
    readonly COLOR_RED='\033[0;31m'
    readonly COLOR_GREEN='\033[0;32m'
    readonly COLOR_YELLOW='\033[0;33m'
    readonly COLOR_BLUE='\033[0;34m'
    readonly COLOR_CYAN='\033[0;36m'
    readonly COLOR_RESET='\033[0m'
else
    readonly COLOR_RED=''
    readonly COLOR_GREEN=''
    readonly COLOR_YELLOW=''
    readonly COLOR_BLUE=''
    readonly COLOR_CYAN=''
    readonly COLOR_RESET=''
fi

# Logging functions for structured output and monitoring integration
log_info() {
    local message="$1"
    local details="${2:-}"
    local timestamp
    timestamp=$(date -Iseconds)
    
    if [[ "$VERBOSE_OUTPUT" == "true" ]]; then
        echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} ${timestamp} ${message}" >&2
        if [[ -n "$details" ]]; then
            echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} ${timestamp} Details: ${details}" >&2
        fi
    fi
    
    # Structured logging for monitoring systems
    printf '{"level":"INFO","timestamp":"%s","correlation_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$message" "$details" >&2
}

log_warn() {
    local message="$1"
    local details="${2:-}"
    local timestamp
    timestamp=$(date -Iseconds)
    
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} ${timestamp} ${message}" >&2
    if [[ -n "$details" ]]; then
        echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} ${timestamp} Details: ${details}" >&2
    fi
    
    # Increment warning counter for health score calculation
    ((WARNINGS_DETECTED++))
    
    # Structured logging for monitoring systems
    printf '{"level":"WARN","timestamp":"%s","correlation_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$message" "$details" >&2
}

log_error() {
    local message="$1"
    local details="${2:-}"
    local timestamp
    timestamp=$(date -Iseconds)
    
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} ${timestamp} ${message}" >&2
    if [[ -n "$details" ]]; then
        echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} ${timestamp} Details: ${details}" >&2
    fi
    
    # Increment error counter for health score calculation
    ((ERRORS_DETECTED++))
    
    # Structured logging for monitoring systems
    printf '{"level":"ERROR","timestamp":"%s","correlation_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$message" "$details" >&2
}

log_success() {
    local message="$1"
    local details="${2:-}"
    local timestamp
    timestamp=$(date -Iseconds)
    
    echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_RESET} ${timestamp} ${message}" >&2
    if [[ -n "$details" ]]; then
        echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_RESET} ${timestamp} Details: ${details}" >&2
    fi
    
    # Structured logging for monitoring systems
    printf '{"level":"SUCCESS","timestamp":"%s","correlation_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$message" "$details" >&2
}

# Generate unique correlation ID for health check session tracking
generate_correlation_id() {
    local timestamp
    timestamp=$(date +%s)
    local random_suffix
    random_suffix=$(( RANDOM % 10000 ))
    echo "health-check-${timestamp}-${random_suffix}"
}

# Parse command line arguments for health check configuration
parse_arguments() {
    log_info "Parsing command line arguments" "arg_count=$#"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --host)
                SERVER_HOST="$2"
                log_info "Server host configured" "host=$SERVER_HOST"
                shift 2
                ;;
            --port)
                if [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -ge 1024 ]] && [[ "$2" -le 65535 ]]; then
                    SERVER_PORT="$2"
                    log_info "Server port configured" "port=$SERVER_PORT"
                else
                    log_error "Invalid port number: $2" "valid_range=1024-65535"
                    exit $EXIT_CONFIGURATION_ERROR
                fi
                shift 2
                ;;
            --timeout)
                if [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -gt 0 ]] && [[ "$2" -le 300 ]]; then
                    TIMEOUT_SECONDS="$2"
                    log_info "Timeout configured" "timeout=${TIMEOUT_SECONDS}s"
                else
                    log_error "Invalid timeout value: $2" "valid_range=1-300 seconds"
                    exit $EXIT_CONFIGURATION_ERROR
                fi
                shift 2
                ;;
            --retries)
                if [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -ge 0 ]] && [[ "$2" -le 10 ]]; then
                    MAX_RETRIES="$2"
                    log_info "Max retries configured" "retries=$MAX_RETRIES"
                else
                    log_error "Invalid retry count: $2" "valid_range=0-10"
                    exit $EXIT_CONFIGURATION_ERROR
                fi
                shift 2
                ;;
            --retry-delay)
                if [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -gt 0 ]] && [[ "$2" -le 60 ]]; then
                    RETRY_DELAY="$2"
                    log_info "Retry delay configured" "delay=${RETRY_DELAY}s"
                else
                    log_error "Invalid retry delay: $2" "valid_range=1-60 seconds"
                    exit $EXIT_CONFIGURATION_ERROR
                fi
                shift 2
                ;;
            --verbose)
                VERBOSE_OUTPUT="true"
                log_info "Verbose output enabled"
                shift
                ;;
            --config)
                if [[ -f "$2" ]]; then
                    CONFIG_FILE="$2"
                    log_info "Configuration file specified" "config_file=$CONFIG_FILE"
                else
                    log_error "Configuration file not found: $2"
                    exit $EXIT_CONFIGURATION_ERROR
                fi
                shift 2
                ;;
            --help|-h)
                display_usage
                exit $EXIT_SUCCESS
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit $EXIT_CONFIGURATION_ERROR
                ;;
        esac
    done
    
    log_info "Command line argument parsing completed" "host=$SERVER_HOST port=$SERVER_PORT timeout=${TIMEOUT_SECONDS}s retries=$MAX_RETRIES"
}

# Load health check configuration from YAML file with environment variable substitution
load_health_config() {
    local config_file="${1:-$CONFIG_FILE}"
    
    log_info "Loading health check configuration" "config_file=$config_file"
    
    # Check if configuration file exists and is readable
    if [[ ! -f "$config_file" ]]; then
        log_warn "Configuration file not found, using defaults" "config_file=$config_file"
        return 0
    fi
    
    if [[ ! -r "$config_file" ]]; then
        log_warn "Configuration file not readable, using defaults" "config_file=$config_file"
        return 0
    fi
    
    # Extract configuration using basic YAML parsing (avoiding external dependencies)
    local yaml_timeout
    yaml_timeout=$(grep -E "^\s*timeout_seconds:" "$config_file" 2>/dev/null | sed 's/.*: *//g' || echo "")
    if [[ -n "$yaml_timeout" ]] && [[ "$yaml_timeout" =~ ^[0-9]+$ ]]; then
        TIMEOUT_SECONDS="$yaml_timeout"
        log_info "Timeout loaded from configuration" "timeout=${TIMEOUT_SECONDS}s"
    fi
    
    local yaml_retries
    yaml_retries=$(grep -E "^\s*retry_attempts:" "$config_file" 2>/dev/null | sed 's/.*: *//g' || echo "")
    if [[ -n "$yaml_retries" ]] && [[ "$yaml_retries" =~ ^[0-9]+$ ]]; then
        MAX_RETRIES="$yaml_retries"
        log_info "Max retries loaded from configuration" "retries=$MAX_RETRIES"
    fi
    
    local yaml_delay
    yaml_delay=$(grep -E "^\s*retry_delay_seconds:" "$config_file" 2>/dev/null | sed 's/.*: *//g' || echo "")
    if [[ -n "$yaml_delay" ]] && [[ "$yaml_delay" =~ ^[0-9]+$ ]]; then
        RETRY_DELAY="$yaml_delay"
        log_info "Retry delay loaded from configuration" "delay=${RETRY_DELAY}s"
    fi
    
    # Apply environment variable substitution
    if [[ -n "${HEALTH_CHECK_HOST:-}" ]]; then
        SERVER_HOST="$HEALTH_CHECK_HOST"
        log_info "Server host overridden by environment variable" "host=$SERVER_HOST"
    fi
    
    if [[ -n "${HEALTH_CHECK_PORT:-}" ]]; then
        SERVER_PORT="$HEALTH_CHECK_PORT"
        log_info "Server port overridden by environment variable" "port=$SERVER_PORT"
    fi
    
    log_info "Configuration loading completed" "final_config=host:$SERVER_HOST port:$SERVER_PORT timeout:${TIMEOUT_SECONDS}s retries:$MAX_RETRIES delay:${RETRY_DELAY}s"
    
    return 0
}

# Validate health check execution prerequisites including required tools and network connectivity
check_prerequisites() {
    log_info "Validating health check prerequisites"
    
    local prerequisites_valid=true
    
    # Check curl availability and version compatibility
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl command not found" "install_suggestion='sudo apt-get install curl' or 'sudo yum install curl'"
        prerequisites_valid=false
    else
        local curl_version
        curl_version=$(curl --version | head -n1 | cut -d' ' -f2 2>/dev/null || echo "unknown")
        log_info "curl availability confirmed" "version=$curl_version"
    fi
    
    # Check jq availability for JSON response processing
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq command not found - JSON response validation will be limited" "install_suggestion='sudo apt-get install jq' or 'sudo yum install jq'"
        # jq is optional but recommended
    else
        local jq_version
        jq_version=$(jq --version 2>/dev/null | sed 's/jq-//' || echo "unknown")
        log_info "jq availability confirmed" "version=$jq_version"
    fi
    
    # Verify timeout command availability
    if ! command -v timeout >/dev/null 2>&1; then
        log_warn "timeout command not available - using curl built-in timeout" "functionality=limited"
    else
        log_info "timeout command available" "functionality=full"
    fi
    
    # Verify date command for timestamp generation
    if ! command -v date >/dev/null 2>&1; then
        log_error "date command not found" "required_for=timestamp_generation"
        prerequisites_valid=false
    else
        log_info "date command available" "iso_timestamps_supported=yes"
    fi
    
    # Basic network connectivity test using ping if available
    if command -v ping >/dev/null 2>&1; then
        local ping_result
        if ping_result=$(timeout 3 ping -c 1 "$SERVER_HOST" 2>/dev/null); then
            log_info "Basic network connectivity confirmed" "target_host=$SERVER_HOST method=ping"
        else
            log_warn "Ping connectivity test failed" "target_host=$SERVER_HOST note=may_still_be_accessible_via_http"
        fi
    else
        log_info "Ping command not available, skipping basic connectivity test"
    fi
    
    # Check script execution permissions and environment
    if [[ ! -r "$0" ]]; then
        log_error "Script not readable" "script_path=$0"
        prerequisites_valid=false
    fi
    
    # Validate that we can create temporary files if needed
    local temp_test_file
    if temp_test_file=$(mktemp -t health-check-test.XXXXXX 2>/dev/null); then
        rm -f "$temp_test_file"
        log_info "Temporary file creation capability confirmed"
    else
        log_warn "Cannot create temporary files" "functionality=limited"
    fi
    
    if [[ "$prerequisites_valid" == "true" ]]; then
        log_success "All prerequisites validation passed"
        return 0
    else
        log_error "Prerequisites validation failed"
        return 1
    fi
}

# Execute HTTP health check against primary application endpoint with response validation
check_primary_endpoint() {
    local host="$1"
    local port="$2"
    local timeout="$3"
    
    log_info "Starting primary endpoint health check" "endpoint=http://${host}:${port}${PRIMARY_ENDPOINT_PATH}"
    
    local start_time end_time response_time
    local http_status_code response_body curl_exit_code
    local primary_url="http://${host}:${port}${PRIMARY_ENDPOINT_PATH}"
    
    # Record start time for response time measurement
    start_time=$(date +%s%N 2>/dev/null || date +%s)
    
    # Execute HTTP request with comprehensive error handling
    local curl_output
    curl_output=$(mktemp -t health-check-primary.XXXXXX)
    
    if curl_exit_code=$(curl --silent --show-error \
        --max-time "$timeout" \
        --connect-timeout "$((timeout / 2))" \
        --user-agent "$USER_AGENT" \
        --write-out "%{http_code}" \
        --output "$curl_output" \
        "$primary_url" 2>/dev/null); then
        
        http_status_code="$curl_exit_code"
        response_body=$(cat "$curl_output" 2>/dev/null)
        curl_exit_code=0
        
    else
        curl_exit_code=$?
        http_status_code="000"
        response_body=""
        log_error "Primary endpoint request failed" "curl_exit_code=$curl_exit_code url=$primary_url"
    fi
    
    # Calculate response time
    end_time=$(date +%s%N 2>/dev/null || date +%s)
    if [[ "$start_time" =~ [0-9]{10}[0-9]{9} ]] && [[ "$end_time" =~ [0-9]{10}[0-9]{9} ]]; then
        response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    else
        response_time=$(( end_time - start_time ))  # Fallback to seconds
    fi
    
    # Add to total response time tracking
    TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + response_time))
    
    # Clean up temporary file
    rm -f "$curl_output"
    
    # Validate HTTP status code
    if [[ "$http_status_code" == "200" ]]; then
        log_success "Primary endpoint HTTP status validation passed" "status_code=$http_status_code"
    else
        log_error "Primary endpoint returned unexpected status code" "expected=200 actual=$http_status_code"
        PRIMARY_ENDPOINT_STATUS="unhealthy"
        return 1
    fi
    
    # Validate response content matches expected value
    if [[ "$response_body" == "$EXPECTED_HELLO_RESPONSE" ]]; then
        log_success "Primary endpoint response content validation passed" "expected='$EXPECTED_HELLO_RESPONSE' actual='$response_body'"
    else
        log_error "Primary endpoint response content validation failed" "expected='$EXPECTED_HELLO_RESPONSE' actual='$response_body'"
        PRIMARY_ENDPOINT_STATUS="unhealthy"
        return 1
    fi
    
    # Validate response time against threshold (100ms from health-check.yml)
    local response_time_threshold=100
    if [[ "$response_time" -le "$response_time_threshold" ]]; then
        log_success "Primary endpoint response time within threshold" "response_time=${response_time}ms threshold=${response_time_threshold}ms"
    else
        log_warn "Primary endpoint response time exceeded threshold" "response_time=${response_time}ms threshold=${response_time_threshold}ms"
        # Don't fail health check for slow response, but log warning
    fi
    
    PRIMARY_ENDPOINT_STATUS="healthy"
    log_success "Primary endpoint health check completed successfully" "status=$PRIMARY_ENDPOINT_STATUS response_time=${response_time}ms"
    
    return 0
}

# Execute comprehensive health check against dedicated health endpoint with JSON validation
check_health_endpoint() {
    local host="$1"
    local port="$2"
    local timeout="$3"
    
    log_info "Starting health endpoint health check" "endpoint=http://${host}:${port}${HEALTH_ENDPOINT_PATH}"
    
    local start_time end_time response_time
    local http_status_code response_body curl_exit_code
    local health_url="http://${host}:${port}${HEALTH_ENDPOINT_PATH}"
    
    # Record start time for response time measurement
    start_time=$(date +%s%N 2>/dev/null || date +%s)
    
    # Execute HTTP request with extended timeout for health data collection
    local curl_output
    curl_output=$(mktemp -t health-check-health.XXXXXX)
    
    if curl_exit_code=$(curl --silent --show-error \
        --max-time "$((timeout * 2))" \
        --connect-timeout "$timeout" \
        --user-agent "$USER_AGENT" \
        --write-out "%{http_code}" \
        --output "$curl_output" \
        "$health_url" 2>/dev/null); then
        
        http_status_code="$curl_exit_code"
        response_body=$(cat "$curl_output" 2>/dev/null)
        curl_exit_code=0
        
    else
        curl_exit_code=$?
        http_status_code="000"
        response_body=""
        log_error "Health endpoint request failed" "curl_exit_code=$curl_exit_code url=$health_url"
    fi
    
    # Calculate response time
    end_time=$(date +%s%N 2>/dev/null || date +%s)
    if [[ "$start_time" =~ [0-9]{10}[0-9]{9} ]] && [[ "$end_time" =~ [0-9]{10}[0-9]{9} ]]; then
        response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    else
        response_time=$(( end_time - start_time ))  # Fallback to seconds
    fi
    
    # Add to total response time tracking
    TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + response_time))
    
    # Clean up temporary file
    rm -f "$curl_output"
    
    # Handle case where health endpoint may not exist (optional endpoint)
    if [[ "$http_status_code" == "404" ]]; then
        log_warn "Health endpoint not available" "status_code=404 note=endpoint_optional"
        HEALTH_ENDPOINT_STATUS="unavailable"
        return 0  # Don't fail overall health check if health endpoint is not implemented
    fi
    
    # Validate HTTP status code
    if [[ "$http_status_code" == "200" ]]; then
        log_success "Health endpoint HTTP status validation passed" "status_code=$http_status_code"
    else
        log_error "Health endpoint returned unexpected status code" "expected=200 actual=$http_status_code"
        HEALTH_ENDPOINT_STATUS="unhealthy"
        return 1
    fi
    
    # Validate JSON response format if jq is available
    if command -v jq >/dev/null 2>&1; then
        # Validate JSON structure
        local json_valid
        if json_valid=$(echo "$response_body" | jq . 2>/dev/null); then
            log_success "Health endpoint JSON format validation passed"
            
            # Extract and validate required fields from health-check.yml configuration
            local required_fields=("status" "timestamp" "server" "system")
            local validation_passed=true
            
            for field in "${required_fields[@]}"; do
                if echo "$response_body" | jq -e ".$field" >/dev/null 2>&1; then
                    local field_value
                    field_value=$(echo "$response_body" | jq -r ".$field")
                    log_info "Required field validation passed" "field=$field value=$field_value"
                else
                    log_error "Required field missing from health response" "field=$field"
                    validation_passed=false
                fi
            done
            
            if [[ "$validation_passed" == "true" ]]; then
                # Extract overall health status
                local overall_status
                overall_status=$(echo "$response_body" | jq -r '.status // "unknown"')
                
                case "$overall_status" in
                    "healthy")
                        log_success "Health endpoint reports healthy status" "overall_status=$overall_status"
                        HEALTH_ENDPOINT_STATUS="healthy"
                        ;;
                    "degraded")
                        log_warn "Health endpoint reports degraded status" "overall_status=$overall_status"
                        HEALTH_ENDPOINT_STATUS="degraded"
                        ;;
                    "unhealthy")
                        log_error "Health endpoint reports unhealthy status" "overall_status=$overall_status"
                        HEALTH_ENDPOINT_STATUS="unhealthy"
                        return 1
                        ;;
                    *)
                        log_warn "Health endpoint reports unknown status" "overall_status=$overall_status"
                        HEALTH_ENDPOINT_STATUS="unknown"
                        ;;
                esac
            else
                log_error "Health endpoint JSON validation failed" "missing_required_fields=true"
                HEALTH_ENDPOINT_STATUS="unhealthy"
                return 1
            fi
        else
            log_error "Health endpoint returned invalid JSON" "response_length=${#response_body}"
            HEALTH_ENDPOINT_STATUS="unhealthy"
            return 1
        fi
    else
        # Basic validation without jq
        if [[ "$response_body" =~ ^\{.*\}$ ]] && [[ "$response_body" =~ "status" ]]; then
            log_success "Health endpoint basic JSON validation passed" "jq_available=false"
            HEALTH_ENDPOINT_STATUS="healthy"
        else
            log_error "Health endpoint response format validation failed" "expected=JSON jq_available=false"
            HEALTH_ENDPOINT_STATUS="unhealthy"
            return 1
        fi
    fi
    
    log_success "Health endpoint health check completed" "status=$HEALTH_ENDPOINT_STATUS response_time=${response_time}ms"
    
    return 0
}

# Implement exponential backoff retry logic for failed health check requests
retry_with_backoff() {
    local check_function="$1"
    local max_retries="$2"
    local base_delay="$3"
    shift 3  # Remove first three arguments, leaving function arguments
    
    log_info "Starting retry logic with exponential backoff" "function=$check_function max_retries=$max_retries base_delay=${base_delay}s"
    
    local attempt=0
    local delay="$base_delay"
    
    while [[ $attempt -le $max_retries ]]; do
        if [[ $attempt -gt 0 ]]; then
            log_info "Retrying health check" "attempt=$((attempt + 1))/$((max_retries + 1)) delay=${delay}s"
            sleep "$delay"
            # Exponential backoff with jitter
            delay=$((delay * 2))
        else
            log_info "Initial health check attempt" "attempt=$((attempt + 1))/$((max_retries + 1))"
        fi
        
        # Execute the check function with provided arguments
        if "$check_function" "$@"; then
            log_success "Health check succeeded" "attempt=$((attempt + 1)) function=$check_function"
            return 0
        else
            log_warn "Health check attempt failed" "attempt=$((attempt + 1)) function=$check_function"
        fi
        
        ((attempt++))
    done
    
    log_error "All retry attempts exhausted" "function=$check_function total_attempts=$((attempt)) max_retries=$max_retries"
    return 1
}

# Calculate overall health score based on endpoint results and performance metrics
calculate_health_score() {
    local primary_status="$1"
    local health_status="$2"
    local total_response_time="$3"
    
    log_info "Calculating overall health score" "primary=$primary_status health=$health_status response_time=${total_response_time}ms"
    
    local health_score=0
    local max_score=100
    
    # Primary endpoint scoring (50 points maximum)
    case "$primary_status" in
        "healthy")
            health_score=$((health_score + 50))
            log_info "Primary endpoint score applied" "points=50 status=$primary_status"
            ;;
        "degraded")
            health_score=$((health_score + 25))
            log_info "Primary endpoint score applied" "points=25 status=$primary_status"
            ;;
        "unhealthy"|*)
            log_info "Primary endpoint score applied" "points=0 status=$primary_status"
            ;;
    esac
    
    # Health endpoint scoring (30 points maximum)
    case "$health_status" in
        "healthy")
            health_score=$((health_score + 30))
            log_info "Health endpoint score applied" "points=30 status=$health_status"
            ;;
        "degraded")
            health_score=$((health_score + 15))
            log_info "Health endpoint score applied" "points=15 status=$health_status"
            ;;
        "unavailable")
            health_score=$((health_score + 20))  # Partial score for optional endpoint
            log_info "Health endpoint score applied" "points=20 status=$health_status note=optional_endpoint"
            ;;
        "unhealthy"|*)
            log_info "Health endpoint score applied" "points=0 status=$health_status"
            ;;
    esac
    
    # Performance scoring (20 points maximum) - based on total response time
    local performance_score=20
    if [[ "$total_response_time" -gt 1000 ]]; then
        performance_score=0  # Very slow responses
    elif [[ "$total_response_time" -gt 500 ]]; then
        performance_score=10  # Slow responses
    elif [[ "$total_response_time" -gt 200 ]]; then
        performance_score=15  # Acceptable responses
    fi
    
    health_score=$((health_score + performance_score))
    log_info "Performance score applied" "points=$performance_score total_response_time=${total_response_time}ms"
    
    # Determine health classification based on score
    local health_classification
    if [[ "$health_score" -ge 80 ]]; then
        health_classification="healthy"
    elif [[ "$health_score" -ge 50 ]]; then
        health_classification="degraded"
    else
        health_classification="unhealthy"
    fi
    
    log_info "Overall health score calculated" "score=${health_score}/${max_score} classification=$health_classification"
    
    OVERALL_HEALTH_STATUS="$health_classification"
    
    # Return appropriate exit code based on health classification
    case "$health_classification" in
        "healthy")
            return 0
            ;;
        "degraded")
            return 1  # Still considered a failure for monitoring purposes
            ;;
        "unhealthy"|*)
            return 1
            ;;
    esac
}

# Generate comprehensive health check report with detailed results and recommendations
generate_health_report() {
    local overall_status="$1"
    local primary_status="$2"
    local health_status="$3"
    local total_time="$4"
    local verbose="${5:-false}"
    
    local timestamp
    timestamp=$(date -Iseconds)
    
    log_info "Generating comprehensive health report" "status=$overall_status verbose=$verbose"
    
    # Report header with session information
    echo
    echo "========================================="
    echo "Node.js Tutorial HTTP Server Health Check"
    echo "========================================="
    echo "Session ID: $HEALTH_CHECK_SESSION_ID"
    echo "Correlation ID: $CORRELATION_ID"
    echo "Timestamp: $timestamp"
    echo "Script Version: $SCRIPT_VERSION"
    echo "Target Server: ${SERVER_HOST}:${SERVER_PORT}"
    echo
    
    # Overall health status with color coding
    echo -n "Overall Health Status: "
    case "$overall_status" in
        "healthy")
            echo -e "${COLOR_GREEN}✓ HEALTHY${COLOR_RESET}"
            ;;
        "degraded")
            echo -e "${COLOR_YELLOW}⚠ DEGRADED${COLOR_RESET}"
            ;;
        "unhealthy")
            echo -e "${COLOR_RED}✗ UNHEALTHY${COLOR_RESET}"
            ;;
        *)
            echo -e "${COLOR_CYAN}? UNKNOWN${COLOR_RESET}"
            ;;
    esac
    echo
    
    # Endpoint health details
    echo "Endpoint Health Details:"
    echo "------------------------"
    
    # Primary endpoint results
    echo -n "Primary Endpoint (${PRIMARY_ENDPOINT_PATH}): "
    case "$primary_status" in
        "healthy")
            echo -e "${COLOR_GREEN}✓ HEALTHY${COLOR_RESET}"
            ;;
        "degraded")
            echo -e "${COLOR_YELLOW}⚠ DEGRADED${COLOR_RESET}"
            ;;
        "unhealthy")
            echo -e "${COLOR_RED}✗ UNHEALTHY${COLOR_RESET}"
            ;;
        *)
            echo -e "${COLOR_CYAN}? UNKNOWN${COLOR_RESET}"
            ;;
    esac
    
    # Health endpoint results
    echo -n "Health Endpoint (${HEALTH_ENDPOINT_PATH}): "
    case "$health_status" in
        "healthy")
            echo -e "${COLOR_GREEN}✓ HEALTHY${COLOR_RESET}"
            ;;
        "degraded")
            echo -e "${COLOR_YELLOW}⚠ DEGRADED${COLOR_RESET}"
            ;;
        "unavailable")
            echo -e "${COLOR_CYAN}- UNAVAILABLE${COLOR_RESET}"
            ;;
        "unhealthy")
            echo -e "${COLOR_RED}✗ UNHEALTHY${COLOR_RESET}"
            ;;
        *)
            echo -e "${COLOR_CYAN}? UNKNOWN${COLOR_RESET}"
            ;;
    esac
    echo
    
    # Performance metrics
    echo "Performance Metrics:"
    echo "-------------------"
    echo "Total Response Time: ${total_time}ms"
    echo "Errors Detected: $ERRORS_DETECTED"
    echo "Warnings Detected: $WARNINGS_DETECTED"
    echo "Configuration: timeout=${TIMEOUT_SECONDS}s retries=${MAX_RETRIES} delay=${RETRY_DELAY}s"
    echo
    
    # Verbose details if requested
    if [[ "$verbose" == "true" ]]; then
        echo "Detailed Information:"
        echo "--------------------"
        echo "Server Configuration:"
        echo "  - Host: $SERVER_HOST"
        echo "  - Port: $SERVER_PORT"
        echo "  - Primary Endpoint: http://${SERVER_HOST}:${SERVER_PORT}${PRIMARY_ENDPOINT_PATH}"
        echo "  - Health Endpoint: http://${SERVER_HOST}:${SERVER_PORT}${HEALTH_ENDPOINT_PATH}"
        echo
        echo "Health Check Configuration:"
        echo "  - Timeout: ${TIMEOUT_SECONDS} seconds"
        echo "  - Max Retries: $MAX_RETRIES"
        echo "  - Retry Delay: ${RETRY_DELAY} seconds"
        echo "  - User Agent: $USER_AGENT"
        echo
        echo "System Information:"
        echo "  - Script Path: $0"
        echo "  - Config File: $CONFIG_FILE"
        echo "  - Session ID: $HEALTH_CHECK_SESSION_ID"
        echo "  - Process PID: $$"
        echo
    fi
    
    # Recommendations based on health status
    echo "Recommendations:"
    echo "---------------"
    case "$overall_status" in
        "healthy")
            echo "✓ Server is operating normally"
            echo "✓ All health checks passed successfully"
            echo "✓ No immediate action required"
            ;;
        "degraded")
            echo "⚠ Server is operational but performance may be impacted"
            echo "⚠ Monitor server closely for potential issues"
            echo "⚠ Consider investigating response time performance"
            if [[ "$WARNINGS_DETECTED" -gt 0 ]]; then
                echo "⚠ Review warning messages in logs for details"
            fi
            ;;
        "unhealthy")
            echo "✗ Server requires immediate attention"
            echo "✗ One or more critical health checks failed"
            echo "✗ Investigate server status and connectivity"
            if [[ "$primary_status" == "unhealthy" ]]; then
                echo "✗ Primary endpoint is not responding correctly"
            fi
            if [[ "$health_status" == "unhealthy" ]]; then
                echo "✗ Health endpoint reports system issues"
            fi
            echo "✗ Check server logs for error details"
            ;;
        *)
            echo "? Unable to determine server health status"
            echo "? Review health check configuration and connectivity"
            echo "? Ensure server is running and accessible"
            ;;
    esac
    echo
    
    # Integration examples for monitoring systems
    if [[ "$verbose" == "true" ]]; then
        echo "Integration Examples:"
        echo "--------------------"
        echo "Docker Health Check:"
        echo "  HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\"
        echo "    CMD $0 --host localhost --port 3000 --timeout 5"
        echo
        echo "Kubernetes Liveness Probe:"
        echo "  livenessProbe:"
        echo "    exec:"
        echo "      command: ['$0', '--host', '127.0.0.1', '--port', '3000']"
        echo "    initialDelaySeconds: 30"
        echo "    periodSeconds: 10"
        echo
        echo "Monitoring System Integration:"
        echo "  - Exit Code: \$? (0=healthy, 1=unhealthy, 2=network error, etc.)"
        echo "  - Structured Logs: Available in stderr with JSON format"
        echo "  - Correlation ID: $CORRELATION_ID"
        echo
    fi
    
    # Footer with timestamp
    echo "Health check completed at: $timestamp"
    echo "========================================="
}

# Display comprehensive script usage information and examples
display_usage() {
    cat << EOF
Node.js Tutorial HTTP Server Health Check Script

DESCRIPTION:
    Comprehensive health check script for validating Node.js tutorial HTTP server 
    health through endpoint testing, response validation, and system connectivity 
    checking. Provides automated health assessment with configurable timeouts, 
    retry mechanisms, and detailed reporting for monitoring integration.

USAGE:
    $SCRIPT_NAME [OPTIONS]

OPTIONS:
    --host HOST          Target server hostname or IP address (default: $DEFAULT_SERVER_HOST)
    --port PORT          Target server port number (default: $DEFAULT_SERVER_PORT)
    --timeout SECONDS    HTTP request timeout in seconds (default: $DEFAULT_TIMEOUT_SECONDS)
    --retries COUNT      Maximum retry attempts for failed requests (default: $DEFAULT_MAX_RETRIES)
    --retry-delay SECS   Delay between retry attempts in seconds (default: $DEFAULT_RETRY_DELAY)
    --verbose            Enable detailed output and diagnostic information
    --config FILE        Path to custom health-check.yml configuration file
    --help, -h           Display this usage information

EXIT CODES:
    0    SUCCESS - All health checks passed, application is healthy
    1    HEALTH_CHECK_FAILED - One or more health checks failed
    2    NETWORK_ERROR - Network connectivity issues or DNS resolution failures  
    3    CONFIGURATION_ERROR - Invalid configuration or missing parameters
    4    TIMEOUT_ERROR - Health check requests exceeded timeout limits
    5    INVALID_RESPONSE - Response format validation failed
    6    PREREQUISITES_FAILED - Required tools not available

EXAMPLES:
    # Basic health check with defaults
    $SCRIPT_NAME

    # Health check with custom server address
    $SCRIPT_NAME --host 192.168.1.100 --port 8080

    # Verbose health check with custom timeout and retries
    $SCRIPT_NAME --verbose --timeout 15 --retries 5

    # Health check with custom configuration file
    $SCRIPT_NAME --config /path/to/health-check.yml

    # Health check suitable for Docker HEALTHCHECK
    $SCRIPT_NAME --host localhost --port 3000 --timeout 5

    # Kubernetes readiness probe example
    $SCRIPT_NAME --host 127.0.0.1 --port 3000

ENVIRONMENT VARIABLES:
    HEALTH_CHECK_HOST            Override default server hostname
    HEALTH_CHECK_PORT            Override default server port  
    HEALTH_CHECK_TIMEOUT         Override default timeout
    HEALTH_CHECK_VERBOSE         Enable verbose output (any value)
    HEALTH_CHECK_USER_AGENT      Custom user agent string

INTEGRATION:
    Docker:
        HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
            CMD $SCRIPT_NAME --host localhost --port 3000

    Kubernetes:
        livenessProbe:
          exec:
            command: ['$SCRIPT_NAME', '--host', '127.0.0.1', '--port', '3000']

    Monitoring Systems:
        Compatible with Nagios, Prometheus, and other monitoring systems
        through standardized exit codes and structured logging output.

TROUBLESHOOTING:
    - Ensure curl is installed and available in PATH
    - Verify server is running and accessible on specified host/port
    - Check firewall rules and network connectivity
    - Review logs with --verbose flag for detailed diagnostic information
    - Validate configuration file format if using --config option

For more information and documentation, visit:
https://github.com/your-repo/nodejs-tutorial-server

EOF
}

# Main health check orchestration function
main() {
    # Initialize health check session
    HEALTH_CHECK_SESSION_ID="health-check-$(date +%s)-$$"
    CORRELATION_ID=$(generate_correlation_id)
    
    log_info "Starting Node.js Tutorial HTTP Server health check" "session_id=$HEALTH_CHECK_SESSION_ID script_version=$SCRIPT_VERSION"
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Load configuration from file with environment variable overrides
    load_health_config
    
    # Validate execution prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites validation failed - cannot continue health check"
        exit $EXIT_PREREQUISITES_FAILED
    fi
    
    log_info "Health check configuration finalized" "host=$SERVER_HOST port=$SERVER_PORT timeout=${TIMEOUT_SECONDS}s retries=$MAX_RETRIES"
    
    # Initialize health check status tracking
    local health_check_start_time
    health_check_start_time=$(date +%s%N 2>/dev/null || date +%s)
    
    local primary_check_success=false
    local health_check_success=false
    
    # Execute primary endpoint health check with retry logic
    log_info "Executing primary endpoint health check with retry logic"
    if retry_with_backoff check_primary_endpoint "$MAX_RETRIES" "$RETRY_DELAY" "$SERVER_HOST" "$SERVER_PORT" "$TIMEOUT_SECONDS"; then
        primary_check_success=true
        log_success "Primary endpoint health check completed successfully"
    else
        log_error "Primary endpoint health check failed after all retry attempts"
        PRIMARY_ENDPOINT_STATUS="unhealthy"
    fi
    
    # Execute health endpoint check with retry logic
    log_info "Executing health endpoint health check with retry logic"
    if retry_with_backoff check_health_endpoint "$MAX_RETRIES" "$RETRY_DELAY" "$SERVER_HOST" "$SERVER_PORT" "$TIMEOUT_SECONDS"; then
        health_check_success=true
        log_success "Health endpoint health check completed successfully"
    else
        log_warn "Health endpoint health check failed - continuing with available data"
        # Health endpoint failure is not critical if primary endpoint is healthy
    fi
    
    # Calculate total health check execution time
    local health_check_end_time execution_time
    health_check_end_time=$(date +%s%N 2>/dev/null || date +%s)
    if [[ "$health_check_start_time" =~ [0-9]{10}[0-9]{9} ]] && [[ "$health_check_end_time" =~ [0-9]{10}[0-9]{9} ]]; then
        execution_time=$(( (health_check_end_time - health_check_start_time) / 1000000 ))
    else
        execution_time=$(( health_check_end_time - health_check_start_time ))
    fi
    
    # Calculate overall health score and determine final status
    log_info "Calculating overall health score and status"
    local final_exit_code
    if calculate_health_score "$PRIMARY_ENDPOINT_STATUS" "$HEALTH_ENDPOINT_STATUS" "$TOTAL_RESPONSE_TIME"; then
        final_exit_code=$EXIT_SUCCESS
        log_success "Overall health assessment completed - server is healthy"
    else
        final_exit_code=$EXIT_HEALTH_CHECK_FAILED
        log_error "Overall health assessment completed - server health issues detected"
    fi
    
    # Generate and display comprehensive health report
    generate_health_report "$OVERALL_HEALTH_STATUS" "$PRIMARY_ENDPOINT_STATUS" "$HEALTH_ENDPOINT_STATUS" "$execution_time" "$VERBOSE_OUTPUT"
    
    # Log final health check summary
    log_info "Health check session completed" "session_id=$HEALTH_CHECK_SESSION_ID overall_status=$OVERALL_HEALTH_STATUS execution_time=${execution_time}ms exit_code=$final_exit_code"
    
    # Exit with appropriate code for monitoring system integration
    exit $final_exit_code
}

# Execute main function if script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi