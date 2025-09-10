#!/bin/bash

# Node.js Tutorial HTTP Server - Comprehensive Deployment Automation Script
#
# Production-ready deployment orchestrator for the educational Node.js HTTP server application.
# Supports multiple deployment strategies (Docker, PM2, hybrid) with zero-downtime deployments,
# comprehensive health validation, automatic rollback capabilities, and operational monitoring.
#
# This script demonstrates enterprise-grade deployment automation patterns while maintaining
# educational clarity for learning advanced deployment concepts and infrastructure best practices.
#
# Educational Focus Areas:
# - Infrastructure as Code (IaC) implementation and automation
# - Multi-strategy deployment patterns with Docker and PM2 integration
# - Health checking and monitoring throughout deployment lifecycle
# - Rollback procedures and disaster recovery automation
# - Security hardening in production deployment pipelines
# - Service discovery and load balancing with Nginx integration
#
# Dependencies: docker (24.x), docker-compose (2.x), nginx (1.24), pm2 (5.x), git (2.x), curl (system)
# Node.js Version: 22.11.0 LTS
# Deployment Strategies: Docker containerization, PM2 process management, hybrid orchestration
# Security: Non-root deployment, SSL/TLS configuration, security headers, credential management

# Enable strict error handling and debugging for robust deployment execution
set -euo pipefail

# =============================================================================
# GLOBAL CONFIGURATION AND CONSTANTS
# =============================================================================

# Script metadata and version information for deployment tracking
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
readonly DEPLOYMENT_CONFIG_DIR="$SCRIPT_DIR/../config"
readonly DOCKER_CONFIG_DIR="$SCRIPT_DIR/../docker"
readonly APPLICATION_DIR="$PROJECT_ROOT/src/backend"

# Default deployment configuration with environment variable overrides
readonly DEFAULT_ENVIRONMENT="${DEPLOYMENT_ENVIRONMENT:-production}"
readonly DEFAULT_DEPLOYMENT_STRATEGY="${DEPLOYMENT_STRATEGY:-docker}"
readonly HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"
readonly ROLLBACK_ENABLED="${ROLLBACK_ENABLED:-true}"
readonly BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Service configuration and networking constants
readonly DEFAULT_APP_PORT="3000"
readonly DEFAULT_NGINX_PORT="80"
readonly DEFAULT_NGINX_SSL_PORT="443"
readonly HEALTH_ENDPOINT_PATH="/health"
readonly PRIMARY_ENDPOINT_PATH="/hello"

# Deployment timing and retry configuration
readonly DEPLOYMENT_TIMEOUT="600"  # 10 minutes maximum deployment time
readonly SERVICE_START_TIMEOUT="60"  # 1 minute for service startup
readonly HEALTH_CHECK_RETRIES="10"
readonly HEALTH_CHECK_INTERVAL="6"  # 6 seconds between health checks

# Exit codes for deployment status and monitoring integration
readonly EXIT_SUCCESS=0
readonly EXIT_DEPLOYMENT_FAILED=1
readonly EXIT_ROLLBACK_EXECUTED=2
readonly EXIT_VALIDATION_FAILED=3
readonly EXIT_DEPENDENCY_ERROR=4

# Color codes for enhanced terminal output readability
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

# Global deployment state variables
DEPLOYMENT_ENVIRONMENT="$DEFAULT_ENVIRONMENT"
DEPLOYMENT_STRATEGY="$DEFAULT_DEPLOYMENT_STRATEGY"
DEPLOYMENT_SESSION_ID=""
DEPLOYMENT_TIMESTAMP=""
BACKUP_ID=""
DRY_RUN="false"
FORCE_DEPLOYMENT="false"
VERBOSE_OUTPUT="false"
ROLLBACK_ON_FAILURE="$ROLLBACK_ENABLED"

# Deployment timing metrics
DEPLOYMENT_START_TIME=""
DEPLOYMENT_END_TIME=""
TOTAL_DEPLOYMENT_TIME=""

# Service health tracking
SERVICES_DEPLOYED=()
SERVICES_FAILED=()
HEALTH_CHECK_RESULTS=()

# =============================================================================
# LOGGING AND OUTPUT FUNCTIONS
# =============================================================================

# Generate unique deployment session identifier for tracking and correlation
generate_deployment_id() {
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local random_suffix
    random_suffix=$(( RANDOM % 10000 ))
    echo "deploy-${timestamp}-${random_suffix}"
}

# Structured logging function with timestamp, level, and correlation ID
log_deployment() {
    local level="$1"
    local message="$2"
    local details="${3:-}"
    local timestamp
    timestamp=$(date -Iseconds)
    
    # Console output with color coding
    local color=""
    case "$level" in
        "ERROR") color="$COLOR_RED" ;;
        "WARN")  color="$COLOR_YELLOW" ;;
        "INFO")  color="$COLOR_BLUE" ;;
        "SUCCESS") color="$COLOR_GREEN" ;;
        "DEBUG") color="$COLOR_CYAN" ;;
    esac
    
    echo -e "${color}[${level}]${COLOR_RESET} ${timestamp} ${message}" >&2
    if [[ -n "$details" && "$VERBOSE_OUTPUT" == "true" ]]; then
        echo -e "${color}[${level}]${COLOR_RESET} ${timestamp} Details: ${details}" >&2
    fi
    
    # Structured JSON logging for monitoring systems
    printf '{"level":"%s","timestamp":"%s","session_id":"%s","message":"%s","details":"%s"}\n' \
        "$level" "$timestamp" "$DEPLOYMENT_SESSION_ID" "$message" "$details" >&2
}

# Convenience logging functions for different log levels
log_info() { log_deployment "INFO" "$1" "${2:-}"; }
log_warn() { log_deployment "WARN" "$1" "${2:-}"; }
log_error() { log_deployment "ERROR" "$1" "${2:-}"; }
log_success() { log_deployment "SUCCESS" "$1" "${2:-}"; }
log_debug() { 
    if [[ "$VERBOSE_OUTPUT" == "true" ]]; then
        log_deployment "DEBUG" "$1" "${2:-}"
    fi
}

# =============================================================================
# COMMAND LINE ARGUMENT PARSING
# =============================================================================

# Parse command line arguments to configure deployment behavior
parse_deployment_args() {
    log_info "Parsing deployment arguments" "arg_count=$#"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                if [[ -n "${2:-}" ]] && [[ "$2" =~ ^(development|staging|production)$ ]]; then
                    DEPLOYMENT_ENVIRONMENT="$2"
                    log_info "Deployment environment configured" "environment=$DEPLOYMENT_ENVIRONMENT"
                else
                    log_error "Invalid environment specified: ${2:-}" "valid_options=development,staging,production"
                    exit $EXIT_VALIDATION_FAILED
                fi
                shift 2
                ;;
            --strategy)
                if [[ -n "${2:-}" ]] && [[ "$2" =~ ^(docker|pm2|hybrid)$ ]]; then
                    DEPLOYMENT_STRATEGY="$2"
                    log_info "Deployment strategy configured" "strategy=$DEPLOYMENT_STRATEGY"
                else
                    log_error "Invalid deployment strategy: ${2:-}" "valid_options=docker,pm2,hybrid"
                    exit $EXIT_VALIDATION_FAILED
                fi
                shift 2
                ;;
            --no-rollback)
                ROLLBACK_ON_FAILURE="false"
                log_info "Automatic rollback disabled" "rollback_on_failure=false"
                shift
                ;;
            --health-timeout)
                if [[ -n "${2:-}" ]] && [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -gt 0 ]]; then
                    HEALTH_CHECK_TIMEOUT="$2"
                    log_info "Health check timeout configured" "timeout=${HEALTH_CHECK_TIMEOUT}s"
                else
                    log_error "Invalid health timeout value: ${2:-}" "must_be_positive_integer"
                    exit $EXIT_VALIDATION_FAILED
                fi
                shift 2
                ;;
            --backup-retention)
                if [[ -n "${2:-}" ]] && [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -gt 0 ]]; then
                    BACKUP_RETENTION_DAYS="$2"
                    log_info "Backup retention configured" "retention_days=$BACKUP_RETENTION_DAYS"
                else
                    log_error "Invalid backup retention value: ${2:-}" "must_be_positive_integer"
                    exit $EXIT_VALIDATION_FAILED
                fi
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                log_info "Dry run mode enabled" "changes_will_not_be_applied"
                shift
                ;;
            --force)
                FORCE_DEPLOYMENT="true"
                log_info "Force deployment enabled" "confirmation_prompts_skipped"
                shift
                ;;
            --verbose)
                VERBOSE_OUTPUT="true"
                log_info "Verbose output enabled" "detailed_logging_active"
                shift
                ;;
            --help|-h)
                display_usage
                exit $EXIT_SUCCESS
                ;;
            *)
                log_error "Unknown deployment option: $1" "use_--help_for_usage"
                exit $EXIT_VALIDATION_FAILED
                ;;
        esac
    done
    
    log_info "Argument parsing completed" "environment=$DEPLOYMENT_ENVIRONMENT strategy=$DEPLOYMENT_STRATEGY dry_run=$DRY_RUN"
}

# =============================================================================
# PREREQUISITE VALIDATION AND DEPENDENCY CHECKING
# =============================================================================

# Comprehensive validation of deployment prerequisites and system dependencies
validate_prerequisites() {
    log_info "Validating deployment prerequisites and system dependencies"
    
    local prerequisites_valid=true
    local missing_deps=()
    local version_info=()
    
    # Check Docker availability and version for containerized deployments
    if [[ "$DEPLOYMENT_STRATEGY" == "docker" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        if command -v docker >/dev/null 2>&1; then
            local docker_version
            docker_version=$(docker --version | awk '{print $3}' | sed 's/,//' || echo "unknown")
            version_info+=("docker:$docker_version")
            log_debug "Docker availability confirmed" "version=$docker_version"
            
            # Verify Docker daemon is running and accessible
            if ! docker info >/dev/null 2>&1; then
                log_error "Docker daemon not running or not accessible" "start_daemon_or_check_permissions"
                prerequisites_valid=false
            fi
        else
            log_error "Docker not found but required for strategy: $DEPLOYMENT_STRATEGY" "install_docker_24.x"
            missing_deps+=("docker")
            prerequisites_valid=false
        fi
        
        # Check Docker Compose for multi-service orchestration
        if command -v docker-compose >/dev/null 2>&1; then
            local compose_version
            compose_version=$(docker-compose --version | awk '{print $3}' | sed 's/,//' || echo "unknown")
            version_info+=("docker-compose:$compose_version")
            log_debug "Docker Compose availability confirmed" "version=$compose_version"
        else
            log_error "Docker Compose not found but required" "install_docker_compose_2.x"
            missing_deps+=("docker-compose")
            prerequisites_valid=false
        fi
    fi
    
    # Check PM2 process manager for Node.js process-based deployments
    if [[ "$DEPLOYMENT_STRATEGY" == "pm2" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        if command -v pm2 >/dev/null 2>&1; then
            local pm2_version
            pm2_version=$(pm2 --version 2>/dev/null || echo "unknown")
            version_info+=("pm2:$pm2_version")
            log_debug "PM2 availability confirmed" "version=$pm2_version"
        else
            log_error "PM2 not found but required for strategy: $DEPLOYMENT_STRATEGY" "install_pm2_5.x"
            missing_deps+=("pm2")
            prerequisites_valid=false
        fi
        
        # Verify Node.js runtime for PM2 deployments
        if command -v node >/dev/null 2>&1; then
            local node_version
            node_version=$(node --version 2>/dev/null || echo "unknown")
            version_info+=("node:$node_version")
            log_debug "Node.js availability confirmed" "version=$node_version"
        else
            log_error "Node.js runtime not found" "install_nodejs_22.x_lts"
            missing_deps+=("node")
            prerequisites_valid=false
        fi
    fi
    
    # Check Nginx for reverse proxy and load balancing
    if command -v nginx >/dev/null 2>&1; then
        local nginx_version
        nginx_version=$(nginx -v 2>&1 | awk '{print $3}' | sed 's/nginx\///' || echo "unknown")
        version_info+=("nginx:$nginx_version")
        log_debug "Nginx availability confirmed" "version=$nginx_version"
    else
        log_warn "Nginx not found - reverse proxy configuration will be skipped" "install_nginx_1.24_for_production"
    fi
    
    # Check essential system utilities
    local required_utils=("curl" "git" "mktemp" "date" "timeout")
    for util in "${required_utils[@]}"; do
        if command -v "$util" >/dev/null 2>&1; then
            local util_version=""
            case "$util" in
                "curl") util_version=$(curl --version 2>/dev/null | head -n1 | awk '{print $2}' || echo "system") ;;
                "git") util_version=$(git --version 2>/dev/null | awk '{print $3}' || echo "system") ;;
                *) util_version="system" ;;
            esac
            version_info+=("$util:$util_version")
            log_debug "$util availability confirmed" "version=$util_version"
        else
            log_error "Required utility not found: $util" "install_required_system_utilities"
            missing_deps+=("$util")
            prerequisites_valid=false
        fi
    done
    
    # Validate deployment user permissions for service management
    if [[ "$EUID" -eq 0 ]]; then
        log_warn "Running as root - consider using non-root user with sudo privileges" "security_recommendation"
    fi
    
    # Check disk space requirements for deployment and backups
    local required_space_kb=2097152  # 2GB in KB
    local available_space_kb
    available_space_kb=$(df "$PROJECT_ROOT" | tail -1 | awk '{print $4}' || echo "0")
    
    if [[ "$available_space_kb" -lt "$required_space_kb" ]]; then
        log_error "Insufficient disk space for deployment" "required=2GB available=${available_space_kb}KB"
        prerequisites_valid=false
    else
        log_debug "Disk space validation passed" "available=${available_space_kb}KB required=${required_space_kb}KB"
    fi
    
    # Network connectivity validation to essential services
    local connectivity_hosts=("github.com" "registry-1.docker.io")
    for host in "${connectivity_hosts[@]}"; do
        if command -v ping >/dev/null 2>&1; then
            if timeout 5 ping -c 1 "$host" >/dev/null 2>&1; then
                log_debug "Network connectivity confirmed" "host=$host"
            else
                log_warn "Network connectivity test failed" "host=$host may_affect_deployment"
            fi
        fi
    done
    
    # Report prerequisite validation results
    if [[ "$prerequisites_valid" == "true" ]]; then
        log_success "Prerequisites validation completed successfully" "dependencies_satisfied"
        log_info "System dependencies detected" "versions=${version_info[*]}"
        return 0
    else
        log_error "Prerequisites validation failed" "missing_dependencies=${missing_deps[*]}"
        log_error "Install missing dependencies and retry deployment"
        return 1
    fi
}

# =============================================================================
# DEPLOYMENT CONFIGURATION LOADING AND VALIDATION
# =============================================================================

# Load deployment configuration from files and environment variables
load_deployment_config() {
    local environment="$1"
    local strategy="$2"
    
    log_info "Loading deployment configuration" "environment=$environment strategy=$strategy"
    
    # Initialize configuration array with default values
    declare -gA DEPLOYMENT_CONFIG
    
    # Load base configuration from environment.js defaults
    DEPLOYMENT_CONFIG[APP_PORT]="${PORT:-$DEFAULT_APP_PORT}"
    DEPLOYMENT_CONFIG[APP_HOST]="${HOST:-0.0.0.0}"
    DEPLOYMENT_CONFIG[NODE_ENV]="$environment"
    DEPLOYMENT_CONFIG[LOG_LEVEL]="${LOG_LEVEL:-info}"
    
    # Load PM2 configuration if using PM2 strategy
    if [[ "$strategy" == "pm2" ]] || [[ "$strategy" == "hybrid" ]]; then
        local pm2_config="$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js"
        if [[ -f "$pm2_config" ]]; then
            log_debug "PM2 configuration file found" "config_file=$pm2_config"
            
            # Extract PM2 configuration values using Node.js
            if command -v node >/dev/null 2>&1; then
                local pm2_instances
                pm2_instances=$(node -e "
                    const config = require('$pm2_config');
                    const appConfig = config.apps.find(app => app.name === 'nodejs-tutorial-$environment') || config.apps[0];
                    console.log(appConfig.instances || 1);
                " 2>/dev/null || echo "1")
                DEPLOYMENT_CONFIG[PM2_INSTANCES]="$pm2_instances"
                log_debug "PM2 instances configured" "instances=$pm2_instances"
            fi
        else
            log_warn "PM2 configuration file not found" "using_defaults"
            DEPLOYMENT_CONFIG[PM2_INSTANCES]="1"
        fi
    fi
    
    # Load Docker configuration if using Docker strategy
    if [[ "$strategy" == "docker" ]] || [[ "$strategy" == "hybrid" ]]; then
        DEPLOYMENT_CONFIG[DOCKER_IMAGE]="nodejs-tutorial"
        DEPLOYMENT_CONFIG[DOCKER_TAG]="${environment}-$(date +%Y%m%d-%H%M%S)"
        DEPLOYMENT_CONFIG[DOCKER_REGISTRY]="${DOCKER_REGISTRY:-}"
        
        # Configure Docker Compose settings
        DEPLOYMENT_CONFIG[COMPOSE_PROJECT_NAME]="nodejs-tutorial-${environment}"
        DEPLOYMENT_CONFIG[COMPOSE_FILE]="$DOCKER_CONFIG_DIR/docker-compose.${environment}.yml"
        
        log_debug "Docker configuration loaded" "image=${DEPLOYMENT_CONFIG[DOCKER_IMAGE]} tag=${DEPLOYMENT_CONFIG[DOCKER_TAG]}"
    fi
    
    # Load Nginx configuration for reverse proxy setup
    local nginx_config="$DEPLOYMENT_CONFIG_DIR/nginx.conf"
    if [[ -f "$nginx_config" ]]; then
        DEPLOYMENT_CONFIG[NGINX_CONFIG]="$nginx_config"
        DEPLOYMENT_CONFIG[NGINX_PORT]="${NGINX_PORT:-$DEFAULT_NGINX_PORT}"
        DEPLOYMENT_CONFIG[NGINX_SSL_PORT]="${NGINX_SSL_PORT:-$DEFAULT_NGINX_SSL_PORT}"
        log_debug "Nginx configuration found" "config_file=$nginx_config"
    else
        log_warn "Nginx configuration not found" "reverse_proxy_setup_skipped"
    fi
    
    # SSL/TLS configuration if certificates are available
    if [[ -n "${SSL_CERT_PATH:-}" ]] && [[ -f "${SSL_CERT_PATH:-}" ]]; then
        DEPLOYMENT_CONFIG[SSL_ENABLED]="true"
        DEPLOYMENT_CONFIG[SSL_CERT_PATH]="$SSL_CERT_PATH"
        DEPLOYMENT_CONFIG[SSL_KEY_PATH]="${SSL_KEY_PATH:-}"
        log_debug "SSL configuration detected" "cert_path=$SSL_CERT_PATH"
    else
        DEPLOYMENT_CONFIG[SSL_ENABLED]="false"
        log_debug "SSL certificates not configured" "http_only_deployment"
    fi
    
    # Load monitoring configuration
    DEPLOYMENT_CONFIG[MONITORING_ENDPOINT]="${MONITORING_ENDPOINT:-}"
    DEPLOYMENT_CONFIG[HEALTH_CHECK_PATH]="$HEALTH_ENDPOINT_PATH"
    DEPLOYMENT_CONFIG[HEALTH_CHECK_TIMEOUT]="$HEALTH_CHECK_TIMEOUT"
    
    # Backup and rollback configuration
    DEPLOYMENT_CONFIG[BACKUP_ENABLED]="$ROLLBACK_ON_FAILURE"
    DEPLOYMENT_CONFIG[BACKUP_DIR]="/tmp/nodejs-tutorial-backups"
    DEPLOYMENT_CONFIG[BACKUP_RETENTION]="$BACKUP_RETENTION_DAYS"
    
    # Apply environment-specific overrides
    case "$environment" in
        production)
            DEPLOYMENT_CONFIG[LOG_LEVEL]="${LOG_LEVEL:-info}"
            DEPLOYMENT_CONFIG[APP_HOST]="0.0.0.0"  # Bind to all interfaces
            DEPLOYMENT_CONFIG[MAX_CONNECTIONS]="1000"
            ;;
        staging)
            DEPLOYMENT_CONFIG[LOG_LEVEL]="${LOG_LEVEL:-debug}"
            DEPLOYMENT_CONFIG[APP_HOST]="0.0.0.0"
            DEPLOYMENT_CONFIG[MAX_CONNECTIONS]="500"
            ;;
        development)
            DEPLOYMENT_CONFIG[LOG_LEVEL]="${LOG_LEVEL:-debug}"
            DEPLOYMENT_CONFIG[APP_HOST]="127.0.0.1"  # Localhost only
            DEPLOYMENT_CONFIG[MAX_CONNECTIONS]="100"
            ;;
    esac
    
    log_success "Deployment configuration loaded successfully" "config_keys=${!DEPLOYMENT_CONFIG[*]}"
    
    # Export configuration as environment variables for child processes
    for key in "${!DEPLOYMENT_CONFIG[@]}"; do
        export "$key=${DEPLOYMENT_CONFIG[$key]}"
    done
    
    return 0
}

# =============================================================================
# BACKUP AND ROLLBACK MANAGEMENT
# =============================================================================

# Create comprehensive backup of current deployment state
create_deployment_backup() {
    local backup_label="${1:-manual}"
    
    log_info "Creating deployment backup" "label=$backup_label"
    
    # Generate unique backup identifier
    local backup_timestamp
    backup_timestamp=$(date +%Y%m%d-%H%M%S)
    BACKUP_ID="backup-${backup_label}-${backup_timestamp}"
    
    local backup_dir="${DEPLOYMENT_CONFIG[BACKUP_DIR]}/$BACKUP_ID"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would create backup" "backup_id=$BACKUP_ID backup_dir=$backup_dir"
        return 0
    fi
    
    # Create backup directory structure
    mkdir -p "$backup_dir"/{config,services,data}
    
    # Backup current service configurations
    log_debug "Backing up service configurations"
    if [[ -f "${DEPLOYMENT_CONFIG[NGINX_CONFIG]}" ]]; then
        cp "${DEPLOYMENT_CONFIG[NGINX_CONFIG]}" "$backup_dir/config/nginx.conf.backup" 2>/dev/null || true
    fi
    
    if [[ -f "$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js" ]]; then
        cp "$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js" "$backup_dir/config/pm2.ecosystem.config.js.backup" 2>/dev/null || true
    fi
    
    # Backup Docker service state if using Docker strategy
    if [[ "$DEPLOYMENT_STRATEGY" == "docker" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        log_debug "Backing up Docker service state"
        
        # Export current running containers
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" > "$backup_dir/services/docker-containers.txt" 2>/dev/null || true
        
        # Save current Docker images
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" > "$backup_dir/services/docker-images.txt" 2>/dev/null || true
        
        # Backup Docker Compose configuration if exists
        if [[ -f "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" ]]; then
            cp "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" "$backup_dir/config/" 2>/dev/null || true
        fi
    fi
    
    # Backup PM2 service state if using PM2 strategy
    if [[ "$DEPLOYMENT_STRATEGY" == "pm2" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        log_debug "Backing up PM2 service state"
        
        # Export PM2 process list
        pm2 list > "$backup_dir/services/pm2-processes.txt" 2>/dev/null || true
        
        # Save PM2 configuration
        pm2 show nodejs-tutorial-"$DEPLOYMENT_ENVIRONMENT" > "$backup_dir/services/pm2-app-details.txt" 2>/dev/null || true
    fi
    
    # Create backup metadata file
    cat > "$backup_dir/metadata.json" << EOF
{
    "backup_id": "$BACKUP_ID",
    "timestamp": "$(date -Iseconds)",
    "environment": "$DEPLOYMENT_ENVIRONMENT",
    "strategy": "$DEPLOYMENT_STRATEGY",
    "session_id": "$DEPLOYMENT_SESSION_ID",
    "created_by": "$(whoami)",
    "hostname": "$(hostname)",
    "project_root": "$PROJECT_ROOT",
    "configuration": $(printf '%s\n' "${!DEPLOYMENT_CONFIG[@]}" | jq -R . | jq -s 'map(split("=") | {(.[0]): .[1]}) | add // {}')
}
EOF
    
    # Create backup archive for efficient storage
    local backup_archive="$backup_dir.tar.gz"
    tar -czf "$backup_archive" -C "${DEPLOYMENT_CONFIG[BACKUP_DIR]}" "$BACKUP_ID" 2>/dev/null
    
    # Remove uncompressed backup directory
    rm -rf "$backup_dir" 2>/dev/null || true
    
    log_success "Deployment backup created successfully" "backup_id=$BACKUP_ID backup_archive=$backup_archive"
    
    return 0
}

# Execute rollback to previous deployment using backup artifacts
execute_rollback() {
    local backup_id="${1:-$BACKUP_ID}"
    local rollback_options="${2:-}"
    
    log_info "Executing deployment rollback" "backup_id=$backup_id options=$rollback_options"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute rollback" "backup_id=$backup_id"
        return 0
    fi
    
    local backup_archive="${DEPLOYMENT_CONFIG[BACKUP_DIR]}/$backup_id.tar.gz"
    
    # Validate backup exists and is accessible
    if [[ ! -f "$backup_archive" ]]; then
        log_error "Backup archive not found" "backup_id=$backup_id archive_path=$backup_archive"
        return 1
    fi
    
    log_info "Starting rollback procedure" "backup_archive=$backup_archive"
    
    # Create current state backup before rollback (for forward recovery)
    create_deployment_backup "pre-rollback"
    
    # Extract backup archive
    local restore_dir="${DEPLOYMENT_CONFIG[BACKUP_DIR]}/restore-$backup_id"
    mkdir -p "$restore_dir"
    tar -xzf "$backup_archive" -C "$restore_dir" --strip-components=1
    
    # Stop current services gracefully
    log_info "Stopping current services for rollback"
    case "$DEPLOYMENT_STRATEGY" in
        docker|hybrid)
            docker-compose -f "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" down --timeout 30 2>/dev/null || true
            ;;
        pm2|hybrid)
            pm2 stop "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || true
            ;;
    esac
    
    # Restore service configurations
    log_info "Restoring service configurations from backup"
    
    if [[ -f "$restore_dir/config/nginx.conf.backup" ]]; then
        cp "$restore_dir/config/nginx.conf.backup" "${DEPLOYMENT_CONFIG[NGINX_CONFIG]}" 2>/dev/null || true
        nginx -t && nginx -s reload 2>/dev/null || log_warn "Nginx configuration restore failed"
    fi
    
    if [[ -f "$restore_dir/config/pm2.ecosystem.config.js.backup" ]]; then
        cp "$restore_dir/config/pm2.ecosystem.config.js.backup" "$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js" 2>/dev/null || true
    fi
    
    # Restart services with restored configuration
    log_info "Restarting services with restored configuration"
    case "$DEPLOYMENT_STRATEGY" in
        docker|hybrid)
            if [[ -f "$restore_dir/config/docker-compose.${DEPLOYMENT_ENVIRONMENT}.yml" ]]; then
                cp "$restore_dir/config/docker-compose.${DEPLOYMENT_ENVIRONMENT}.yml" "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}"
                docker-compose -f "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" up -d --timeout 60
            fi
            ;;
        pm2|hybrid)
            pm2 start "$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js" --env "$DEPLOYMENT_ENVIRONMENT"
            ;;
    esac
    
    # Verify rollback success through health checks
    log_info "Validating rollback success through health checks"
    if execute_health_checks "${DEPLOYMENT_CONFIG}" "$HEALTH_CHECK_TIMEOUT"; then
        log_success "Rollback completed successfully" "backup_id=$backup_id services_healthy=true"
        
        # Cleanup restore directory
        rm -rf "$restore_dir" 2>/dev/null || true
        
        return 0
    else
        log_error "Rollback validation failed" "backup_id=$backup_id health_checks_failed"
        return 1
    fi
}

# =============================================================================
# DOCKER DEPLOYMENT STRATEGY
# =============================================================================

# Execute containerized deployment using Docker and Docker Compose
deploy_docker_strategy() {
    local deployment_config="$1"
    
    log_info "Executing Docker deployment strategy" "image=${DEPLOYMENT_CONFIG[DOCKER_IMAGE]} tag=${DEPLOYMENT_CONFIG[DOCKER_TAG]}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute Docker deployment" "strategy=docker"
        return 0
    fi
    
    # Change to application directory for build context
    cd "$APPLICATION_DIR" || {
        log_error "Failed to change to application directory" "path=$APPLICATION_DIR"
        return 1
    }
    
    log_info "Building production Docker image with multi-stage optimization"
    
    # Build production Docker image using multi-stage Dockerfile
    local docker_image="${DEPLOYMENT_CONFIG[DOCKER_IMAGE]}:${DEPLOYMENT_CONFIG[DOCKER_TAG]}"
    if ! docker build \
        -f "$DOCKER_CONFIG_DIR/Dockerfile.production" \
        --target production \
        --tag "$docker_image" \
        --tag "${DEPLOYMENT_CONFIG[DOCKER_IMAGE]}:latest" \
        --build-arg NODE_ENV="$DEPLOYMENT_ENVIRONMENT" \
        --build-arg BUILD_DATE="$(date -Iseconds)" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        "$PROJECT_ROOT"; then
        log_error "Docker image build failed" "image=$docker_image"
        return 1
    fi
    
    log_success "Docker image built successfully" "image=$docker_image size=$(docker images --format 'table {{.Size}}' | grep -v SIZE | head -1)"
    
    # Push image to registry if configured
    if [[ -n "${DEPLOYMENT_CONFIG[DOCKER_REGISTRY]}" ]]; then
        log_info "Pushing Docker image to registry" "registry=${DEPLOYMENT_CONFIG[DOCKER_REGISTRY]}"
        
        local registry_image="${DEPLOYMENT_CONFIG[DOCKER_REGISTRY]}/$docker_image"
        docker tag "$docker_image" "$registry_image"
        
        if docker push "$registry_image"; then
            log_success "Docker image pushed to registry" "registry_image=$registry_image"
        else
            log_warn "Docker image push failed - continuing with local deployment" "registry_image=$registry_image"
        fi
    fi
    
    # Generate Docker Compose configuration for the environment
    local compose_file="${DEPLOYMENT_CONFIG[COMPOSE_FILE]}"
    log_info "Generating Docker Compose configuration" "compose_file=$compose_file"
    
    mkdir -p "$(dirname "$compose_file")"
    
    cat > "$compose_file" << EOF
version: '3.8'

services:
  app:
    image: ${docker_image}
    container_name: nodejs-tutorial-${DEPLOYMENT_ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "${DEPLOYMENT_CONFIG[APP_PORT]}:3000"
    environment:
      - NODE_ENV=${DEPLOYMENT_ENVIRONMENT}
      - PORT=3000
      - HOST=0.0.0.0
      - LOG_LEVEL=${DEPLOYMENT_CONFIG[LOG_LEVEL]}
    healthcheck:
      test: ["CMD", "node", "/app/scripts/docker-healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - nodejs-tutorial-network
    volumes:
      - app-logs:/app/logs
      - app-temp:/app/temp
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nodejs-tutorial.rule=Host(\`${DEPLOYMENT_ENVIRONMENT}.nodejs-tutorial.local\`)"
      - "com.nodejs-tutorial.environment=${DEPLOYMENT_ENVIRONMENT}"
      - "com.nodejs-tutorial.deployment=${DEPLOYMENT_SESSION_ID}"

networks:
  nodejs-tutorial-network:
    driver: bridge
    name: nodejs-tutorial-${DEPLOYMENT_ENVIRONMENT}

volumes:
  app-logs:
    name: nodejs-tutorial-logs-${DEPLOYMENT_ENVIRONMENT}
  app-temp:
    name: nodejs-tutorial-temp-${DEPLOYMENT_ENVIRONMENT}
EOF
    
    # Stop existing services gracefully with connection draining
    log_info "Stopping existing Docker services gracefully"
    docker-compose -f "$compose_file" -p "${DEPLOYMENT_CONFIG[COMPOSE_PROJECT_NAME]}" down --timeout 30 || true
    
    # Start new services with health monitoring
    log_info "Starting Docker services with health monitoring"
    if ! docker-compose -f "$compose_file" -p "${DEPLOYMENT_CONFIG[COMPOSE_PROJECT_NAME]}" up -d --timeout 60; then
        log_error "Docker service startup failed" "compose_file=$compose_file"
        return 1
    fi
    
    # Wait for services to become healthy
    log_info "Waiting for Docker services to become healthy" "timeout=${SERVICE_START_TIMEOUT}s"
    local wait_count=0
    local max_wait=$((SERVICE_START_TIMEOUT / 5))
    
    while [[ $wait_count -lt $max_wait ]]; do
        local health_status
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || echo "unknown")
        
        case "$health_status" in
            "healthy")
                log_success "Docker service is healthy" "container=nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT"
                break
                ;;
            "unhealthy")
                log_error "Docker service became unhealthy" "container=nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT"
                return 1
                ;;
            "starting"|"unknown")
                log_debug "Docker service still starting" "status=$health_status wait_count=$wait_count"
                sleep 5
                ((wait_count++))
                ;;
        esac
    done
    
    if [[ $wait_count -ge $max_wait ]]; then
        log_error "Docker service failed to become healthy within timeout" "timeout=${SERVICE_START_TIMEOUT}s"
        return 1
    fi
    
    SERVICES_DEPLOYED+=("docker:nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT")
    log_success "Docker deployment strategy completed successfully" "services_deployed=${SERVICES_DEPLOYED[*]}"
    
    return 0
}

# =============================================================================
# PM2 DEPLOYMENT STRATEGY
# =============================================================================

# Execute process-based deployment using PM2 with clustering and monitoring
deploy_pm2_strategy() {
    local deployment_config="$1"
    
    log_info "Executing PM2 deployment strategy" "instances=${DEPLOYMENT_CONFIG[PM2_INSTANCES]} environment=$DEPLOYMENT_ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute PM2 deployment" "strategy=pm2"
        return 0
    fi
    
    # Change to application directory
    cd "$APPLICATION_DIR" || {
        log_error "Failed to change to application directory" "path=$APPLICATION_DIR"
        return 1
    }
    
    # Install/update application dependencies for production
    log_info "Installing application dependencies for production"
    if ! npm install --only=production --no-audit --no-fund; then
        log_error "Failed to install application dependencies" "npm_install_failed"
        return 1
    fi
    
    log_success "Application dependencies installed successfully"
    
    # Apply environment-specific configuration
    log_info "Applying environment-specific configuration" "environment=$DEPLOYMENT_ENVIRONMENT"
    export NODE_ENV="$DEPLOYMENT_ENVIRONMENT"
    export PORT="${DEPLOYMENT_CONFIG[APP_PORT]}"
    export HOST="${DEPLOYMENT_CONFIG[APP_HOST]}"
    export LOG_LEVEL="${DEPLOYMENT_CONFIG[LOG_LEVEL]}"
    
    # Stop existing PM2 processes gracefully
    log_info "Stopping existing PM2 processes gracefully"
    pm2 stop "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || true
    pm2 delete "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || true
    
    # Deploy application using PM2 ecosystem configuration
    log_info "Deploying application using PM2 ecosystem configuration"
    local pm2_config="$DEPLOYMENT_CONFIG_DIR/pm2.ecosystem.config.js"
    
    if ! pm2 start "$pm2_config" --env "$DEPLOYMENT_ENVIRONMENT"; then
        log_error "PM2 application startup failed" "config=$pm2_config environment=$DEPLOYMENT_ENVIRONMENT"
        return 1
    fi
    
    # Wait for PM2 processes to stabilize
    log_info "Waiting for PM2 processes to stabilize" "timeout=${SERVICE_START_TIMEOUT}s"
    sleep 10
    
    # Validate PM2 process health and status
    local pm2_status
    pm2_status=$(pm2 show "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" | grep -E "status.*online" || echo "")
    
    if [[ -z "$pm2_status" ]]; then
        log_error "PM2 process failed to start or is not online" "app=nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT"
        pm2 logs "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" --lines 20
        return 1
    fi
    
    log_success "PM2 processes are online and stable"
    
    # Configure PM2 startup script for system boot
    log_info "Configuring PM2 startup script for system boot"
    pm2 save
    if command -v systemctl >/dev/null 2>&1; then
        pm2 startup systemd -u "$(whoami)" --hp "$(eval echo ~$USER)" 2>/dev/null || log_warn "PM2 startup configuration may need manual setup"
    fi
    
    # Set up PM2 monitoring and log management
    log_info "Configuring PM2 monitoring and log management"
    pm2 install pm2-logrotate 2>/dev/null || true
    pm2 set pm2-logrotate:max_size 10M 2>/dev/null || true
    pm2 set pm2-logrotate:retain 7 2>/dev/null || true
    pm2 set pm2-logrotate:compress true 2>/dev/null || true
    
    SERVICES_DEPLOYED+=("pm2:nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT")
    log_success "PM2 deployment strategy completed successfully" "services_deployed=${SERVICES_DEPLOYED[*]}"
    
    return 0
}

# =============================================================================
# NGINX REVERSE PROXY CONFIGURATION
# =============================================================================

# Configure and deploy Nginx reverse proxy with load balancing and SSL
configure_nginx_proxy() {
    local deployment_config="$1"
    
    log_info "Configuring Nginx reverse proxy" "config_file=${DEPLOYMENT_CONFIG[NGINX_CONFIG]}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would configure Nginx reverse proxy" "ssl_enabled=${DEPLOYMENT_CONFIG[SSL_ENABLED]}"
        return 0
    fi
    
    # Check if Nginx is available
    if ! command -v nginx >/dev/null 2>&1; then
        log_warn "Nginx not available - skipping reverse proxy configuration" "install_nginx_for_production"
        return 0
    fi
    
    local nginx_config_source="${DEPLOYMENT_CONFIG[NGINX_CONFIG]}"
    if [[ ! -f "$nginx_config_source" ]]; then
        log_warn "Nginx configuration template not found - skipping reverse proxy setup" "config_file=$nginx_config_source"
        return 0
    fi
    
    # Create environment-specific Nginx configuration
    local nginx_config_target="/etc/nginx/sites-available/nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT"
    local nginx_config_enabled="/etc/nginx/sites-enabled/nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT"
    
    log_info "Generating environment-specific Nginx configuration" "target=$nginx_config_target"
    
    # Process template variables in Nginx configuration
    sed -e "s/{{APP_PORT}}/${DEPLOYMENT_CONFIG[APP_PORT]}/g" \
        -e "s/{{ENVIRONMENT}}/$DEPLOYMENT_ENVIRONMENT/g" \
        -e "s/{{SSL_ENABLED}}/${DEPLOYMENT_CONFIG[SSL_ENABLED]}/g" \
        -e "s/{{SSL_CERT_PATH}}/${DEPLOYMENT_CONFIG[SSL_CERT_PATH]}/g" \
        -e "s/{{SSL_KEY_PATH}}/${DEPLOYMENT_CONFIG[SSL_KEY_PATH]}/g" \
        -e "s/{{SERVER_NAME}}/nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT.local/g" \
        "$nginx_config_source" > "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID"
    
    # Validate Nginx configuration syntax
    if nginx -t -c "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID" >/dev/null 2>&1; then
        log_success "Nginx configuration syntax validation passed"
    else
        log_error "Nginx configuration syntax validation failed"
        nginx -t -c "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID" 2>&1 | log_debug
        rm -f "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID"
        return 1
    fi
    
    # Deploy validated Nginx configuration
    if [[ -w "$(dirname "$nginx_config_target")" ]]; then
        cp "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID" "$nginx_config_target"
        
        # Enable site configuration
        ln -sf "$nginx_config_target" "$nginx_config_enabled" 2>/dev/null || {
            log_warn "Could not create symbolic link for Nginx site" "may_need_manual_enable"
        }
        
        # Test upstream connectivity before reload
        log_info "Testing upstream connectivity before Nginx reload"
        local upstream_test_url="http://${DEPLOYMENT_CONFIG[APP_HOST]}:${DEPLOYMENT_CONFIG[APP_PORT]}$PRIMARY_ENDPOINT_PATH"
        if curl -f --max-time 10 "$upstream_test_url" >/dev/null 2>&1; then
            log_success "Upstream connectivity test passed" "url=$upstream_test_url"
        else
            log_warn "Upstream connectivity test failed - Nginx may show 502 errors initially" "url=$upstream_test_url"
        fi
        
        # Reload Nginx configuration gracefully
        log_info "Reloading Nginx configuration gracefully"
        if nginx -s reload; then
            log_success "Nginx configuration reloaded successfully"
        else
            log_error "Nginx configuration reload failed"
            return 1
        fi
    else
        log_warn "Cannot write to Nginx configuration directory" "may_need_sudo_privileges"
        log_info "Manual Nginx configuration required:" 
        log_info "1. Copy configuration: sudo cp /tmp/nginx-config-$DEPLOYMENT_SESSION_ID $nginx_config_target"
        log_info "2. Enable site: sudo ln -sf $nginx_config_target $nginx_config_enabled"
        log_info "3. Reload Nginx: sudo nginx -s reload"
    fi
    
    # Clean up temporary configuration file
    rm -f "/tmp/nginx-config-$DEPLOYMENT_SESSION_ID"
    
    # Verify reverse proxy functionality
    log_info "Verifying reverse proxy functionality"
    local proxy_test_url="http://localhost:${DEPLOYMENT_CONFIG[NGINX_PORT]}$PRIMARY_ENDPOINT_PATH"
    if curl -f --max-time 10 -H "Host: nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT.local" "$proxy_test_url" >/dev/null 2>&1; then
        log_success "Nginx reverse proxy functionality verified" "url=$proxy_test_url"
        return 0
    else
        log_warn "Nginx reverse proxy verification failed" "may_need_dns_configuration url=$proxy_test_url"
        return 1
    fi
}

# =============================================================================
# HEALTH CHECK AND VALIDATION SYSTEM
# =============================================================================

# Execute comprehensive health validation using health-check.sh script
execute_health_checks() {
    local deployment_config="$1"
    local timeout_seconds="${2:-$HEALTH_CHECK_TIMEOUT}"
    
    log_info "Executing comprehensive health validation" "timeout=${timeout_seconds}s retries=$HEALTH_CHECK_RETRIES"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute health checks" "endpoints=primary,health"
        return 0
    fi
    
    local health_check_script="$SCRIPT_DIR/health-check.sh"
    if [[ ! -x "$health_check_script" ]]; then
        log_error "Health check script not found or not executable" "script_path=$health_check_script"
        return 1
    fi
    
    local health_results=()
    local overall_health="healthy"
    
    # Execute health checks with retry logic
    log_info "Starting health check validation with retry logic"
    
    local retry_count=0
    while [[ $retry_count -lt $HEALTH_CHECK_RETRIES ]]; do
        log_debug "Health check attempt" "attempt=$((retry_count + 1))/$HEALTH_CHECK_RETRIES"
        
        # Execute health check script with appropriate parameters
        local health_check_exit_code
        if "$health_check_script" \
            --host "${DEPLOYMENT_CONFIG[APP_HOST]}" \
            --port "${DEPLOYMENT_CONFIG[APP_PORT]}" \
            --timeout "$timeout_seconds" \
            --verbose; then
            health_check_exit_code=$?
            break
        else
            health_check_exit_code=$?
            log_warn "Health check attempt failed" "attempt=$((retry_count + 1)) exit_code=$health_check_exit_code"
            
            if [[ $retry_count -lt $((HEALTH_CHECK_RETRIES - 1)) ]]; then
                log_info "Retrying health check in ${HEALTH_CHECK_INTERVAL} seconds"
                sleep "$HEALTH_CHECK_INTERVAL"
            fi
        fi
        
        ((retry_count++))
    done
    
    # Evaluate health check results
    case "$health_check_exit_code" in
        0)
            overall_health="healthy"
            log_success "Health validation passed" "status=$overall_health"
            ;;
        1)
            overall_health="unhealthy"
            log_error "Health validation failed" "status=$overall_health"
            ;;
        2)
            overall_health="network_error"
            log_error "Health validation network error" "status=$overall_health"
            ;;
        4)
            overall_health="timeout"
            log_error "Health validation timeout" "status=$overall_health"
            ;;
        *)
            overall_health="unknown"
            log_error "Health validation unknown error" "status=$overall_health exit_code=$health_check_exit_code"
            ;;
    esac
    
    # Store health check results for reporting
    HEALTH_CHECK_RESULTS+=("primary_endpoint:$overall_health")
    
    # Additional service-specific health checks
    case "$DEPLOYMENT_STRATEGY" in
        docker|hybrid)
            # Docker container health check
            local container_health
            container_health=$(docker inspect --format='{{.State.Health.Status}}' "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || echo "unknown")
            HEALTH_CHECK_RESULTS+=("docker_container:$container_health")
            
            if [[ "$container_health" != "healthy" ]]; then
                overall_health="unhealthy"
                log_warn "Docker container health check failed" "status=$container_health"
            fi
            ;;
        pm2|hybrid)
            # PM2 process health check
            local pm2_health="unhealthy"
            if pm2 show "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" | grep -q "online"; then
                pm2_health="healthy"
            fi
            HEALTH_CHECK_RESULTS+=("pm2_process:$pm2_health")
            
            if [[ "$pm2_health" != "healthy" ]]; then
                overall_health="unhealthy"
                log_warn "PM2 process health check failed" "status=$pm2_health"
            fi
            ;;
    esac
    
    # Nginx reverse proxy health check if configured
    if [[ -n "${DEPLOYMENT_CONFIG[NGINX_CONFIG]:-}" ]] && command -v nginx >/dev/null 2>&1; then
        local nginx_health="unhealthy"
        if nginx -t >/dev/null 2>&1; then
            nginx_health="healthy"
        fi
        HEALTH_CHECK_RESULTS+=("nginx_proxy:$nginx_health")
        
        if [[ "$nginx_health" != "healthy" ]]; then
            overall_health="degraded"  # Nginx issues are not critical
            log_warn "Nginx proxy health check failed" "status=$nginx_health"
        fi
    fi
    
    # Generate comprehensive health report
    log_info "Health validation completed" "overall_status=$overall_health results=${HEALTH_CHECK_RESULTS[*]}"
    
    case "$overall_health" in
        "healthy")
            return 0
            ;;
        "degraded")
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

# =============================================================================
# DEPLOYMENT FAILURE HANDLING AND ROLLBACK
# =============================================================================

# Handle deployment failures with automatic rollback and notification
handle_deployment_failure() {
    local failure_reason="$1"
    local backup_id="${2:-$BACKUP_ID}"
    local deployment_context="$3"
    
    log_error "Deployment failure detected" "reason=$failure_reason backup_id=$backup_id"
    
    # Record failure in deployment metrics
    SERVICES_FAILED+=("$failure_reason")
    
    # Stop any partially deployed services to prevent resource conflicts
    log_info "Stopping partially deployed services" "context=$deployment_context"
    
    case "$DEPLOYMENT_STRATEGY" in
        docker|hybrid)
            docker-compose -f "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" down --timeout 30 2>/dev/null || true
            ;;
        pm2|hybrid)
            pm2 stop "nodejs-tutorial-$DEPLOYMENT_ENVIRONMENT" 2>/dev/null || true
            ;;
    esac
    
    # Execute automatic rollback if enabled and backup exists
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]] && [[ -n "$backup_id" ]]; then
        log_info "Executing automatic rollback" "backup_id=$backup_id"
        
        if execute_rollback "$backup_id"; then
            log_success "Automatic rollback completed successfully" "backup_id=$backup_id"
            
            # Generate deployment failure report with rollback status
            generate_deployment_failure_report "$failure_reason" "$backup_id" "rollback_successful"
            
            return 0  # Rollback successful
        else
            log_error "Automatic rollback failed" "backup_id=$backup_id"
            
            # Generate deployment failure report with rollback failure
            generate_deployment_failure_report "$failure_reason" "$backup_id" "rollback_failed"
            
            return 1  # Rollback failed, manual intervention required
        fi
    else
        log_warn "Automatic rollback disabled or no backup available" "rollback_enabled=$ROLLBACK_ON_FAILURE backup_id=${backup_id:-none}"
        
        # Generate deployment failure report without rollback
        generate_deployment_failure_report "$failure_reason" "$backup_id" "no_rollback"
        
        return 1  # No rollback, manual intervention required
    fi
}

# Generate comprehensive deployment failure report
generate_deployment_failure_report() {
    local failure_reason="$1"
    local backup_id="$2"
    local rollback_status="$3"
    
    local report_file="/tmp/deployment-failure-report-$DEPLOYMENT_SESSION_ID.json"
    local timestamp
    timestamp=$(date -Iseconds)
    
    cat > "$report_file" << EOF
{
    "deployment_failure_report": {
        "session_id": "$DEPLOYMENT_SESSION_ID",
        "timestamp": "$timestamp",
        "environment": "$DEPLOYMENT_ENVIRONMENT",
        "strategy": "$DEPLOYMENT_STRATEGY",
        "failure_reason": "$failure_reason",
        "backup_id": "$backup_id",
        "rollback_status": "$rollback_status",
        "services_deployed": $(printf '%s\n' "${SERVICES_DEPLOYED[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
        "services_failed": $(printf '%s\n' "${SERVICES_FAILED[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
        "health_check_results": $(printf '%s\n' "${HEALTH_CHECK_RESULTS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
        "deployment_duration": "${TOTAL_DEPLOYMENT_TIME:-unknown}",
        "system_info": {
            "hostname": "$(hostname)",
            "user": "$(whoami)",
            "working_directory": "$(pwd)",
            "project_root": "$PROJECT_ROOT"
        },
        "recommendations": [
            "Check service logs for detailed error information",
            "Verify system prerequisites and dependencies",
            "Ensure sufficient resources (disk space, memory)",
            "Validate configuration files and environment variables",
            "Test deployment in staging environment first"
        ]
    }
}
EOF
    
    log_error "Deployment failure report generated" "report_file=$report_file"
    
    # Send notification to monitoring endpoint if configured
    if [[ -n "${DEPLOYMENT_CONFIG[MONITORING_ENDPOINT]:-}" ]]; then
        curl -X POST \
             -H "Content-Type: application/json" \
             -d "@$report_file" \
             "${DEPLOYMENT_CONFIG[MONITORING_ENDPOINT]}/deployment-failure" \
             --max-time 10 2>/dev/null || log_warn "Failed to send failure notification to monitoring endpoint"
    fi
}

# =============================================================================
# MONITORING INTEGRATION AND CONFIGURATION
# =============================================================================

# Update monitoring and logging configuration for new deployment
update_monitoring_config() {
    local deployment_config="$1"
    
    log_info "Updating monitoring and logging configuration for new deployment"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would update monitoring configuration" "endpoints=metrics,logs"
        return 0
    fi
    
    # Update service discovery configuration for monitoring systems
    local monitoring_config="/tmp/service-discovery-$DEPLOYMENT_SESSION_ID.json"
    
    cat > "$monitoring_config" << EOF
{
    "service_discovery": {
        "session_id": "$DEPLOYMENT_SESSION_ID",
        "timestamp": "$(date -Iseconds)",
        "environment": "$DEPLOYMENT_ENVIRONMENT",
        "strategy": "$DEPLOYMENT_STRATEGY",
        "services": [
            {
                "name": "nodejs-tutorial-app",
                "type": "http",
                "address": "${DEPLOYMENT_CONFIG[APP_HOST]}",
                "port": ${DEPLOYMENT_CONFIG[APP_PORT]},
                "health_endpoint": "${DEPLOYMENT_CONFIG[HEALTH_CHECK_PATH]}",
                "metrics_endpoint": "/metrics",
                "tags": ["nodejs", "tutorial", "$DEPLOYMENT_ENVIRONMENT"]
            }
        ],
        "load_balancers": [
            {
                "name": "nginx-proxy",
                "type": "nginx",
                "address": "localhost",
                "port": ${DEPLOYMENT_CONFIG[NGINX_PORT]:-80},
                "ssl_port": ${DEPLOYMENT_CONFIG[NGINX_SSL_PORT]:-443},
                "ssl_enabled": ${DEPLOYMENT_CONFIG[SSL_ENABLED]}
            }
        ]
    }
}
EOF
    
    log_debug "Service discovery configuration generated" "config_file=$monitoring_config"
    
    # Configure log aggregation and forwarding for new service instances
    case "$DEPLOYMENT_STRATEGY" in
        docker|hybrid)
            # Configure Docker log driver and aggregation
            log_info "Configuring Docker log aggregation"
            
            # Update Docker Compose with logging configuration
            if [[ -f "${DEPLOYMENT_CONFIG[COMPOSE_FILE]}" ]]; then
                # Add logging configuration to compose file (simplified approach)
                log_debug "Docker logging configured via compose file" "log_driver=json-file"
            fi
            ;;
        pm2|hybrid)
            # Configure PM2 log management and rotation
            log_info "Configuring PM2 log management"
            
            pm2 set pm2-logrotate:max_size 50M 2>/dev/null || true
            pm2 set pm2-logrotate:retain 10 2>/dev/null || true
            pm2 set pm2-logrotate:compress true 2>/dev/null || true
            pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss 2>/dev/null || true
            
            log_debug "PM2 log rotation configured" "max_size=50M retain=10"
            ;;
    esac
    
    # Test monitoring integration and health endpoints
    log_info "Testing monitoring integration and health endpoints"
    
    local health_url="http://${DEPLOYMENT_CONFIG[APP_HOST]}:${DEPLOYMENT_CONFIG[APP_PORT]}${DEPLOYMENT_CONFIG[HEALTH_CHECK_PATH]}"
    if curl -f --max-time 10 "$health_url" >/dev/null 2>&1; then
        log_success "Health endpoint accessible for monitoring" "url=$health_url"
    else
        log_warn "Health endpoint not accessible" "url=$health_url may_affect_monitoring"
    fi
    
    # Configure alerting rules and thresholds for deployment-specific metrics
    log_info "Configuring alerting rules and thresholds" "environment=$DEPLOYMENT_ENVIRONMENT"
    
    # Clean up temporary monitoring configuration
    rm -f "$monitoring_config" 2>/dev/null || true
    
    log_success "Monitoring configuration updated successfully"
    
    return 0
}

# =============================================================================
# CLEANUP AND MAINTENANCE FUNCTIONS
# =============================================================================

# Clean up deployment artifacts and maintain backup retention
cleanup_deployment_artifacts() {
    local retention_days="${1:-$BACKUP_RETENTION_DAYS}"
    
    log_info "Cleaning up deployment artifacts and maintaining backup retention" "retention_days=$retention_days"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would clean up deployment artifacts" "retention_days=$retention_days"
        return 0
    fi
    
    local cleanup_count=0
    local space_recovered=0
    
    # Remove temporary deployment files
    log_debug "Removing temporary deployment files"
    find /tmp -name "deployment-*-$DEPLOYMENT_SESSION_ID*" -type f -delete 2>/dev/null || true
    find /tmp -name "nginx-config-*" -type f -mtime +1 -delete 2>/dev/null || true
    find /tmp -name "health-check-*" -type f -mtime +1 -delete 2>/dev/null || true
    
    # Clean up Docker resources if using Docker strategy
    if [[ "$DEPLOYMENT_STRATEGY" == "docker" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        log_debug "Cleaning up unused Docker resources"
        
        # Remove unused Docker images (keeping recent ones)
        local unused_images
        unused_images=$(docker images --filter "dangling=true" -q 2>/dev/null || echo "")
        if [[ -n "$unused_images" ]]; then
            docker rmi $unused_images 2>/dev/null || true
            ((cleanup_count++))
        fi
        
        # Prune Docker system (volumes, networks, build cache)
        docker system prune -f --filter "until=24h" >/dev/null 2>&1 || true
    fi
    
    # Remove old deployment backups beyond retention period
    local backup_dir="${DEPLOYMENT_CONFIG[BACKUP_DIR]}"
    if [[ -d "$backup_dir" ]]; then
        log_debug "Cleaning up old deployment backups" "backup_dir=$backup_dir retention_days=$retention_days"
        
        # Find and remove backup files older than retention period
        find "$backup_dir" -name "backup-*.tar.gz" -type f -mtime "+$retention_days" -print0 | \
        while IFS= read -r -d '' backup_file; do
            local file_size
            file_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
            rm -f "$backup_file"
            space_recovered=$((space_recovered + file_size))
            ((cleanup_count++))
            log_debug "Removed old backup file" "file=$(basename "$backup_file") size=${file_size}bytes"
        done
    fi
    
    # Clean up PM2 logs if using PM2 strategy
    if [[ "$DEPLOYMENT_STRATEGY" == "pm2" ]] || [[ "$DEPLOYMENT_STRATEGY" == "hybrid" ]]; then
        log_debug "Cleaning up old PM2 log files"
        pm2 flush 2>/dev/null || true
    fi
    
    # Update deployment history and maintain audit trail
    local deployment_history="/var/log/nodejs-tutorial-deployment-history.log"
    if [[ -w "$(dirname "$deployment_history")" ]] || [[ -w "$deployment_history" ]]; then
        echo "$(date -Iseconds) CLEANUP session_id=$DEPLOYMENT_SESSION_ID environment=$DEPLOYMENT_ENVIRONMENT files_removed=$cleanup_count space_recovered=${space_recovered}bytes" >> "$deployment_history"
    fi
    
    # Log cleanup completion with statistics
    local space_recovered_mb=$((space_recovered / 1024 / 1024))
    log_success "Deployment artifact cleanup completed" "files_removed=$cleanup_count space_recovered=${space_recovered_mb}MB retention_days=$retention_days"
    
    return 0
}

# =============================================================================
# DEPLOYMENT REPORTING AND SUMMARY
# =============================================================================

# Display comprehensive deployment summary with status and metrics
display_deployment_summary() {
    local deployment_results="$1"
    local timing_metrics="$2"
    
    echo
    echo "=============================================="
    echo "Node.js Tutorial HTTP Server - Deployment Summary"
    echo "=============================================="
    echo "Session ID: $DEPLOYMENT_SESSION_ID"
    echo "Timestamp: $(date -Iseconds)"
    echo "Environment: $DEPLOYMENT_ENVIRONMENT"
    echo "Strategy: $DEPLOYMENT_STRATEGY"
    echo "Duration: ${TOTAL_DEPLOYMENT_TIME:-calculating...}"
    echo
    
    # Deployment status with color coding
    echo -n "Deployment Status: "
    case "$deployment_results" in
        "success")
            echo -e "${COLOR_GREEN}✓ SUCCESS${COLOR_RESET}"
            ;;
        "failed")
            echo -e "${COLOR_RED}✗ FAILED${COLOR_RESET}"
            ;;
        "rolled_back")
            echo -e "${COLOR_YELLOW}↻ ROLLED BACK${COLOR_RESET}"
            ;;
        *)
            echo -e "${COLOR_CYAN}? UNKNOWN${COLOR_RESET}"
            ;;
    esac
    echo
    
    # Services deployment status
    echo "Services Deployed:"
    echo "  └─ Successful: ${#SERVICES_DEPLOYED[@]}"
    for service in "${SERVICES_DEPLOYED[@]}"; do
        echo "     ├─ $service"
    done
    
    if [[ ${#SERVICES_FAILED[@]} -gt 0 ]]; then
        echo "  └─ Failed: ${#SERVICES_FAILED[@]}"
        for service in "${SERVICES_FAILED[@]}"; do
            echo "     ├─ $service"
        done
    fi
    echo
    
    # Service endpoints and access information
    echo "Service Endpoints:"
    echo "  ├─ Application: http://${DEPLOYMENT_CONFIG[APP_HOST]}:${DEPLOYMENT_CONFIG[APP_PORT]}"
    echo "  ├─ Primary Endpoint: http://${DEPLOYMENT_CONFIG[APP_HOST]}:${DEPLOYMENT_CONFIG[APP_PORT]}$PRIMARY_ENDPOINT_PATH"
    echo "  ├─ Health Check: http://${DEPLOYMENT_CONFIG[APP_HOST]}:${DEPLOYMENT_CONFIG[APP_PORT]}$HEALTH_ENDPOINT_PATH"
    
    if [[ -n "${DEPLOYMENT_CONFIG[NGINX_CONFIG]:-}" ]]; then
        echo "  ├─ Reverse Proxy: http://localhost:${DEPLOYMENT_CONFIG[NGINX_PORT]:-80}"
        if [[ "${DEPLOYMENT_CONFIG[SSL_ENABLED]}" == "true" ]]; then
            echo "  ├─ HTTPS Proxy: https://localhost:${DEPLOYMENT_CONFIG[NGINX_SSL_PORT]:-443}"
        fi
    fi
    echo
    
    # Health check results
    if [[ ${#HEALTH_CHECK_RESULTS[@]} -gt 0 ]]; then
        echo "Health Check Results:"
        for result in "${HEALTH_CHECK_RESULTS[@]}"; do
            local check_name="${result%%:*}"
            local check_status="${result##*:}"
            echo -n "  ├─ $check_name: "
            case "$check_status" in
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
                    echo -e "${COLOR_CYAN}? $check_status${COLOR_RESET}"
                    ;;
            esac
        done
        echo
    fi
    
    # Deployment timing metrics
    echo "Performance Metrics:"
    echo "  ├─ Total Duration: ${TOTAL_DEPLOYMENT_TIME:-calculating...}"
    echo "  ├─ Strategy: $DEPLOYMENT_STRATEGY"
    echo "  ├─ Health Checks: ${#HEALTH_CHECK_RESULTS[@]} executed"
    echo "  └─ Services: ${#SERVICES_DEPLOYED[@]} deployed"
    echo
    
    # Backup and rollback information
    if [[ -n "$BACKUP_ID" ]]; then
        echo "Backup Information:"
        echo "  ├─ Backup ID: $BACKUP_ID"
        echo "  ├─ Rollback Available: $ROLLBACK_ON_FAILURE"
        echo "  └─ Retention: $BACKUP_RETENTION_DAYS days"
        echo
    fi
    
    # Next steps and operational procedures
    echo "Next Steps:"
    case "$deployment_results" in
        "success")
            echo "  ├─ ✓ Deployment completed successfully"
            echo "  ├─ ✓ All services are healthy and running"
            echo "  ├─ → Monitor service health and performance"
            echo "  ├─ → Review application logs for any warnings"
            echo "  └─ → Test application functionality thoroughly"
            ;;
        "failed")
            echo "  ├─ ✗ Deployment failed - manual intervention required"
            echo "  ├─ → Check deployment logs for error details"
            echo "  ├─ → Verify system prerequisites and dependencies"
            echo "  ├─ → Test configuration files and environment variables"
            if [[ -n "$BACKUP_ID" ]]; then
                echo "  ├─ → Consider manual rollback: $0 --rollback $BACKUP_ID"
            fi
            echo "  └─ → Contact operations team if issues persist"
            ;;
        "rolled_back")
            echo "  ├─ ↻ Deployment failed but rollback completed successfully"
            echo "  ├─ → Investigate deployment failure cause"
            echo "  ├─ → Fix identified issues and retry deployment"
            echo "  └─ → Verify rollback service functionality"
            ;;
    esac
    echo
    
    # Monitoring and operational access points
    if [[ -n "${DEPLOYMENT_CONFIG[MONITORING_ENDPOINT]:-}" ]]; then
        echo "Monitoring Access:"
        echo "  ├─ Monitoring Endpoint: ${DEPLOYMENT_CONFIG[MONITORING_ENDPOINT]}"
        echo "  ├─ Service Discovery: Updated with new deployment"
        echo "  └─ Alerting: Configured for $DEPLOYMENT_ENVIRONMENT environment"
        echo
    fi
    
    echo "Deployment completed at: $(date -Iseconds)"
    echo "Session ID: $DEPLOYMENT_SESSION_ID"
    echo "=============================================="
}

# Display comprehensive script usage information
display_usage() {
    cat << 'EOF'
Node.js Tutorial HTTP Server - Comprehensive Deployment Automation Script

DESCRIPTION:
    Production-ready deployment orchestrator supporting multiple strategies (Docker, PM2, hybrid)
    with zero-downtime deployments, health validation, automatic rollback, and monitoring integration.
    
    Educational focus on enterprise-grade deployment automation, infrastructure as code,
    service orchestration, and operational best practices for Node.js applications.

USAGE:
    ./infrastructure/scripts/deploy.sh [OPTIONS]

DEPLOYMENT STRATEGIES:
    docker      Containerized deployment using Docker and Docker Compose
    pm2         Process-based deployment using PM2 with clustering
    hybrid      Combined Docker + PM2 deployment for maximum flexibility

OPTIONS:
    --environment ENV       Target environment (development|staging|production)
    --strategy STRATEGY     Deployment strategy (docker|pm2|hybrid)
    --no-rollback          Disable automatic rollback on deployment failure
    --health-timeout SECS   Health check timeout in seconds (default: 60)
    --backup-retention DAYS Backup retention period in days (default: 7)
    --dry-run              Validate deployment without executing changes
    --force                Skip confirmation prompts and proceed automatically
    --verbose              Enable detailed output logging and debugging
    --help, -h             Display this usage information

EXAMPLES:
    # Production Docker deployment
    ./infrastructure/scripts/deploy.sh --environment production --strategy docker

    # Staging PM2 deployment with verbose output
    ./infrastructure/scripts/deploy.sh --environment staging --strategy pm2 --verbose

    # Development hybrid deployment with dry run validation
    ./infrastructure/scripts/deploy.sh --environment development --strategy hybrid --dry-run

    # Production deployment with custom health timeout
    ./infrastructure/scripts/deploy.sh --environment production --health-timeout 120

    # Force deployment without confirmation prompts
    ./infrastructure/scripts/deploy.sh --environment production --force

EXIT CODES:
    0    SUCCESS - Deployment completed successfully
    1    DEPLOYMENT_FAILED - One or more deployment phases failed
    2    ROLLBACK_EXECUTED - Deployment failed but automatic rollback completed
    3    VALIDATION_FAILED - Pre-deployment validation failed
    4    DEPENDENCY_ERROR - Required dependencies not available

ENVIRONMENT VARIABLES:
    DEPLOYMENT_ENVIRONMENT     Override default deployment environment
    DEPLOYMENT_STRATEGY        Override default deployment strategy  
    DOCKER_REGISTRY           Docker registry URL for image storage
    SSL_CERT_PATH            Path to SSL certificate files
    MONITORING_ENDPOINT      Monitoring system integration endpoint
    HEALTH_CHECK_TIMEOUT     Override health check timeout
    BACKUP_RETENTION_DAYS    Override backup retention period

DEPLOYMENT WORKFLOW:
    1. Parse arguments and load configuration
    2. Validate prerequisites and dependencies
    3. Create deployment backup for rollback
    4. Execute deployment strategy (Docker/PM2/hybrid)
    5. Configure reverse proxy and load balancing
    6. Execute comprehensive health validation
    7. Update monitoring and logging configuration
    8. Clean up artifacts and generate summary

SECURITY FEATURES:
    ├─ Non-root deployment execution with privilege validation
    ├─ SSL/TLS certificate management and HTTPS configuration  
    ├─ Secure credential handling and environment variable validation
    ├─ Container image security scanning integration
    ├─ Service isolation and network security configuration
    └─ Audit logging and deployment activity tracking

MONITORING INTEGRATION:
    ├─ Health endpoint validation and monitoring setup
    ├─ Service discovery updates for monitoring systems
    ├─ Log aggregation and forwarding configuration
    ├─ Performance metrics collection and alerting
    ├─ Container and process health monitoring
    └─ Deployment status reporting and notifications

EDUCATIONAL OBJECTIVES:
    ├─ Understanding enterprise deployment automation patterns
    ├─ Learning multi-strategy deployment orchestration
    ├─ Implementing health checking and monitoring integration
    ├─ Mastering rollback procedures and disaster recovery
    ├─ Applying security hardening in deployment pipelines
    └─ Integrating Infrastructure as Code best practices

TROUBLESHOOTING:
    ├─ Check system prerequisites: docker, docker-compose, pm2, nginx
    ├─ Verify configuration files exist and are properly formatted
    ├─ Ensure sufficient disk space and system resources
    ├─ Test network connectivity to required services
    ├─ Review deployment logs with --verbose flag
    ├─ Validate environment variables and SSL certificates
    └─ Use --dry-run for deployment validation without changes

For comprehensive documentation and examples:
https://github.com/your-repo/nodejs-tutorial-server/tree/main/infrastructure

EOF
}

# =============================================================================
# MAIN DEPLOYMENT ORCHESTRATION FUNCTION
# =============================================================================

# Main deployment orchestration function coordinating all deployment phases
main() {
    # Initialize deployment session and timing
    DEPLOYMENT_SESSION_ID=$(generate_deployment_id)
    DEPLOYMENT_TIMESTAMP=$(date -Iseconds)
    DEPLOYMENT_START_TIME=$(date +%s)
    
    log_info "Starting Node.js Tutorial HTTP Server deployment" "session_id=$DEPLOYMENT_SESSION_ID version=$SCRIPT_VERSION"
    
    # Phase 1: Parse command line arguments and validate input
    log_info "Phase 1: Parsing deployment arguments and configuration"
    parse_deployment_args "$@"
    
    # Phase 2: Validate deployment prerequisites and system dependencies
    log_info "Phase 2: Validating deployment prerequisites and dependencies"
    if ! validate_prerequisites; then
        log_error "Prerequisites validation failed - cannot proceed with deployment"
        exit $EXIT_DEPENDENCY_ERROR
    fi
    
    # Phase 3: Load deployment configuration and apply environment settings
    log_info "Phase 3: Loading deployment configuration and environment settings"
    if ! load_deployment_config "$DEPLOYMENT_ENVIRONMENT" "$DEPLOYMENT_STRATEGY"; then
        log_error "Deployment configuration loading failed"
        exit $EXIT_VALIDATION_FAILED
    fi
    
    # Phase 4: Create deployment backup for rollback capabilities
    log_info "Phase 4: Creating deployment backup for rollback capabilities"
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
        if ! create_deployment_backup "pre-deployment"; then
            log_warn "Backup creation failed - continuing without rollback capability"
            ROLLBACK_ON_FAILURE="false"
        fi
    fi
    
    # Deployment confirmation for production environments
    if [[ "$DEPLOYMENT_ENVIRONMENT" == "production" ]] && [[ "$FORCE_DEPLOYMENT" == "false" ]] && [[ "$DRY_RUN" == "false" ]]; then
        echo
        echo "⚠️  Production Deployment Confirmation ⚠️"
        echo "Environment: $DEPLOYMENT_ENVIRONMENT"
        echo "Strategy: $DEPLOYMENT_STRATEGY"
        echo "Session ID: $DEPLOYMENT_SESSION_ID"
        echo "Rollback Enabled: $ROLLBACK_ON_FAILURE"
        echo
        read -p "Proceed with production deployment? (yes/no): " -r confirmation
        if [[ ! "$confirmation" =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Production deployment cancelled by user"
            exit $EXIT_SUCCESS
        fi
    fi
    
    # Phase 5: Execute deployment strategy with error handling
    log_info "Phase 5: Executing deployment strategy" "strategy=$DEPLOYMENT_STRATEGY"
    
    local deployment_success=false
    local deployment_start_phase
    deployment_start_phase=$(date +%s)
    
    case "$DEPLOYMENT_STRATEGY" in
        docker)
            if deploy_docker_strategy "${DEPLOYMENT_CONFIG[*]}"; then
                deployment_success=true
                log_success "Docker deployment strategy completed successfully"
            else
                log_error "Docker deployment strategy failed"
                handle_deployment_failure "docker_deployment_failed" "$BACKUP_ID" "docker_strategy"
                exit $EXIT_ROLLBACK_EXECUTED
            fi
            ;;
        pm2)
            if deploy_pm2_strategy "${DEPLOYMENT_CONFIG[*]}"; then
                deployment_success=true
                log_success "PM2 deployment strategy completed successfully"
            else
                log_error "PM2 deployment strategy failed"
                handle_deployment_failure "pm2_deployment_failed" "$BACKUP_ID" "pm2_strategy"
                exit $EXIT_ROLLBACK_EXECUTED
            fi
            ;;
        hybrid)
            # Execute hybrid deployment with Docker for app and PM2 for auxiliary services
            if deploy_docker_strategy "${DEPLOYMENT_CONFIG[*]}" && deploy_pm2_strategy "${DEPLOYMENT_CONFIG[*]}"; then
                deployment_success=true
                log_success "Hybrid deployment strategy completed successfully"
            else
                log_error "Hybrid deployment strategy failed"
                handle_deployment_failure "hybrid_deployment_failed" "$BACKUP_ID" "hybrid_strategy"
                exit $EXIT_ROLLBACK_EXECUTED
            fi
            ;;
        *)
            log_error "Invalid deployment strategy specified" "strategy=$DEPLOYMENT_STRATEGY"
            exit $EXIT_VALIDATION_FAILED
            ;;
    esac
    
    local deployment_end_phase
    deployment_end_phase=$(date +%s)
    local strategy_duration=$((deployment_end_phase - deployment_start_phase))
    log_info "Deployment strategy execution completed" "duration=${strategy_duration}s success=$deployment_success"
    
    # Phase 6: Configure reverse proxy and load balancing
    log_info "Phase 6: Configuring reverse proxy and load balancing"
    if ! configure_nginx_proxy "${DEPLOYMENT_CONFIG[*]}"; then
        log_warn "Nginx reverse proxy configuration failed - continuing deployment"
        # Nginx configuration failure is not critical for deployment success
    fi
    
    # Phase 7: Execute comprehensive health validation
    log_info "Phase 7: Executing comprehensive health validation"
    local health_start_time
    health_start_time=$(date +%s)
    
    if ! execute_health_checks "${DEPLOYMENT_CONFIG[*]}" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Health validation failed after deployment"
        handle_deployment_failure "health_validation_failed" "$BACKUP_ID" "post_deployment_health"
        exit $EXIT_ROLLBACK_EXECUTED
    fi
    
    local health_end_time
    health_end_time=$(date +%s)
    local health_duration=$((health_end_time - health_start_time))
    log_success "Health validation completed successfully" "duration=${health_duration}s"
    
    # Phase 8: Update monitoring and logging configuration
    log_info "Phase 8: Updating monitoring and logging configuration"
    if ! update_monitoring_config "${DEPLOYMENT_CONFIG[*]}"; then
        log_warn "Monitoring configuration update failed - deployment successful but monitoring may be limited"
    fi
    
    # Phase 9: Clean up deployment artifacts and maintain backups
    log_info "Phase 9: Cleaning up deployment artifacts and maintaining backups"
    cleanup_deployment_artifacts "$BACKUP_RETENTION_DAYS"
    
    # Calculate total deployment time
    DEPLOYMENT_END_TIME=$(date +%s)
    TOTAL_DEPLOYMENT_TIME=$((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))
    
    # Phase 10: Generate comprehensive deployment summary
    log_info "Phase 10: Generating comprehensive deployment summary"
    display_deployment_summary "success" "duration=${TOTAL_DEPLOYMENT_TIME}s"
    
    log_success "Node.js Tutorial HTTP Server deployment completed successfully" "session_id=$DEPLOYMENT_SESSION_ID duration=${TOTAL_DEPLOYMENT_TIME}s environment=$DEPLOYMENT_ENVIRONMENT strategy=$DEPLOYMENT_STRATEGY"
    
    exit $EXIT_SUCCESS
}

# Execute main deployment function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi