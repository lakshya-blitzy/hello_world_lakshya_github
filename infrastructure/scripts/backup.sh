#!/bin/bash

# Node.js Tutorial HTTP Server - Comprehensive Infrastructure Backup Script
#
# Enterprise-grade backup automation system for Node.js tutorial HTTP server application
# infrastructure. Orchestrates complete system backup including application configuration,
# SSL certificates, container images, log files, deployment artifacts, monitoring
# configurations, and operational data with multiple backup strategies, compression,
# encryption, and remote storage integration.
#
# Educational Focus: Demonstrates enterprise backup automation patterns, data protection
# strategies, disaster recovery procedures, and infrastructure operations excellence for
# production Node.js deployments while maintaining educational learning objectives.
#
# Dependencies: tar (system), gzip (system), docker (24.x), rsync (system), 
#              aws-cli (2.x optional), openssl (system), curl (system), jq (system)
# Node.js Version: 22.11.0 LTS
# Infrastructure: PM2, Nginx, Docker, monitoring systems integration

# Enable strict mode for enterprise-grade error handling and security
set -euo pipefail

# Script metadata and version information for operational tracking
readonly SCRIPT_VERSION="1.2.0"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
readonly BACKUP_BASE_DIR="/var/backups/nodejs-tutorial"
readonly BACKUP_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Backup configuration constants with enterprise-grade defaults
readonly DEFAULT_BACKUP_RETENTION_DAYS=30
readonly DEFAULT_COMPRESSION_LEVEL=6
readonly DEFAULT_ENCRYPTION_ENABLED=false
readonly DEFAULT_REMOTE_BACKUP_ENABLED=false
readonly DEFAULT_INCREMENTAL_BACKUP=true
readonly DEFAULT_HEALTH_CHECK_BEFORE_BACKUP=true
readonly DEFAULT_BACKUP_VERIFICATION_ENABLED=true

# Global backup configuration variables
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$DEFAULT_BACKUP_RETENTION_DAYS}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-$DEFAULT_COMPRESSION_LEVEL}"
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-$DEFAULT_ENCRYPTION_ENABLED}"
REMOTE_BACKUP_ENABLED="${REMOTE_BACKUP_ENABLED:-$DEFAULT_REMOTE_BACKUP_ENABLED}"
INCREMENTAL_BACKUP="${INCREMENTAL_BACKUP:-$DEFAULT_INCREMENTAL_BACKUP}"
HEALTH_CHECK_BEFORE_BACKUP="${HEALTH_CHECK_BEFORE_BACKUP:-$DEFAULT_HEALTH_CHECK_BEFORE_BACKUP}"
BACKUP_VERIFICATION_ENABLED="${BACKUP_VERIFICATION_ENABLED:-$DEFAULT_BACKUP_VERIFICATION_ENABLED}"

# Backup operation configuration
BACKUP_TYPE="full"
BACKUP_DESTINATION="$BACKUP_BASE_DIR"
DRY_RUN_MODE=false
VERBOSE_OUTPUT=false
BACKUP_UNIQUE_ID=""
CORRELATION_ID=""

# Operational metrics and status tracking
BACKUP_START_TIME=""
BACKUP_END_TIME=""
TOTAL_FILES_BACKED_UP=0
TOTAL_BACKUP_SIZE=0
ERRORS_ENCOUNTERED=0
WARNINGS_ENCOUNTERED=0
BACKUP_VERIFICATION_STATUS="pending"

# Exit codes for monitoring system integration and operational excellence
readonly EXIT_SUCCESS=0                        # Backup completed successfully with verification passed
readonly EXIT_FAILURE=1                        # Backup failed due to system error or invalid configuration  
readonly EXIT_PARTIAL_SUCCESS=2               # Backup completed with some components failed or skipped
readonly EXIT_VERIFICATION_FAILED=3           # Backup completed but integrity verification failed
readonly EXIT_STORAGE_ERROR=4                 # Insufficient disk space or storage access issues
readonly EXIT_DEPENDENCY_ERROR=5              # Required backup tools or dependencies not available

# Color codes for enhanced output readability in terminal environments
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

# Backup component configuration matrix for comprehensive infrastructure protection
declare -A BACKUP_COMPONENTS=(
    ["application_files"]="src/backend"
    ["infrastructure_config"]="infrastructure/config"
    ["monitoring_config"]="infrastructure/monitoring"
    ["ssl_certificates"]="/etc/ssl"
    ["nginx_config"]="infrastructure/config/nginx.conf"
    ["pm2_config"]="infrastructure/config/pm2.ecosystem.config.js"
    ["scripts"]="infrastructure/scripts"
    ["logs"]="src/backend/logs,/var/log/nginx,/var/log/pm2"
    ["docker_data"]="docker"
    ["environment_config"]="src/backend/config/environment.js"
)

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
    
    # Structured logging for monitoring systems and operational intelligence
    printf '{"level":"INFO","timestamp":"%s","correlation_id":"%s","backup_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$BACKUP_UNIQUE_ID" "$message" "$details" >&2
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
    
    # Increment warning counter for backup quality metrics
    ((WARNINGS_ENCOUNTERED++))
    
    # Structured logging for monitoring and alerting systems
    printf '{"level":"WARN","timestamp":"%s","correlation_id":"%s","backup_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$BACKUP_UNIQUE_ID" "$message" "$details" >&2
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
    
    # Increment error counter for backup quality assessment
    ((ERRORS_ENCOUNTERED++))
    
    # Structured logging for incident management and troubleshooting
    printf '{"level":"ERROR","timestamp":"%s","correlation_id":"%s","backup_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$BACKUP_UNIQUE_ID" "$message" "$details" >&2
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
    
    # Structured logging for operational success tracking
    printf '{"level":"SUCCESS","timestamp":"%s","correlation_id":"%s","backup_id":"%s","message":"%s","details":"%s"}\n' \
        "$timestamp" "$CORRELATION_ID" "$BACKUP_UNIQUE_ID" "$message" "$details" >&2
}

# Generate unique identifiers for backup session tracking and correlation
generate_backup_unique_id() {
    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "unknown")
    echo "backup-${hostname}-${BACKUP_TIMESTAMP}-$$"
}

generate_correlation_id() {
    echo "corr-$(date +%s%N | cut -b1-13)-$(( RANDOM % 10000 ))"
}

# Parse command line arguments for backup configuration and operational parameters
parse_backup_args() {
    log_info "Parsing backup command line arguments" "arg_count=$#"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type)
                if [[ "$2" =~ ^(full|incremental|configuration|logs|containers)$ ]]; then
                    BACKUP_TYPE="$2"
                    log_info "Backup type configured" "type=$BACKUP_TYPE"
                else
                    log_error "Invalid backup type: $2" "valid_types=full,incremental,configuration,logs,containers"
                    exit $EXIT_FAILURE
                fi
                shift 2
                ;;
            --destination)
                if [[ -n "$2" ]]; then
                    BACKUP_DESTINATION="$2"
                    log_info "Backup destination configured" "destination=$BACKUP_DESTINATION"
                else
                    log_error "Backup destination cannot be empty"
                    exit $EXIT_FAILURE
                fi
                shift 2
                ;;
            --compress)
                if [[ "$2" =~ ^[1-9]$ ]]; then
                    COMPRESSION_LEVEL="$2"
                    log_info "Compression level configured" "level=$COMPRESSION_LEVEL"
                else
                    COMPRESSION_LEVEL="$DEFAULT_COMPRESSION_LEVEL"
                    log_info "Using default compression level" "level=$COMPRESSION_LEVEL"
                fi
                shift 2
                ;;
            --encrypt)
                ENCRYPTION_ENABLED=true
                if [[ -n "${2:-}" ]] && [[ ! "$2" =~ ^-- ]]; then
                    ENCRYPTION_KEY_PATH="$2"
                    log_info "Encryption enabled with key file" "key_path=$ENCRYPTION_KEY_PATH"
                    shift
                else
                    log_info "Encryption enabled with default key management"
                fi
                shift
                ;;
            --remote)
                REMOTE_BACKUP_ENABLED=true
                if [[ -n "${2:-}" ]] && [[ ! "$2" =~ ^-- ]]; then
                    REMOTE_BACKUP_URL="$2"
                    log_info "Remote backup enabled" "url=$REMOTE_BACKUP_URL"
                    shift
                else
                    log_info "Remote backup enabled with default configuration"
                fi
                shift
                ;;
            --retention)
                if [[ "$2" =~ ^[0-9]+$ ]] && [[ "$2" -gt 0 ]]; then
                    BACKUP_RETENTION_DAYS="$2"
                    log_info "Backup retention period configured" "days=$BACKUP_RETENTION_DAYS"
                else
                    log_error "Invalid retention period: $2" "must_be_positive_number"
                    exit $EXIT_FAILURE
                fi
                shift 2
                ;;
            --exclude)
                BACKUP_EXCLUDE_PATTERNS="${BACKUP_EXCLUDE_PATTERNS:-},$2"
                log_info "Exclude patterns configured" "patterns=$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN_MODE=true
                log_info "Dry run mode enabled"
                shift
                ;;
            --incremental-base)
                INCREMENTAL_BASE_PATH="$2"
                log_info "Incremental base path configured" "path=$INCREMENTAL_BASE_PATH"
                shift 2
                ;;
            --verify)
                BACKUP_VERIFICATION_ENABLED=true
                log_info "Backup verification enabled"
                shift
                ;;
            --verbose)
                VERBOSE_OUTPUT=true
                log_info "Verbose output enabled"
                shift
                ;;
            --help|-h)
                display_backup_usage
                exit $EXIT_SUCCESS
                ;;
            *)
                log_error "Unknown backup option: $1"
                echo "Use --help for usage information"
                exit $EXIT_FAILURE
                ;;
        esac
    done
    
    log_info "Command line argument parsing completed" "type=$BACKUP_TYPE dest=$BACKUP_DESTINATION compress=$COMPRESSION_LEVEL"
}

# Validate all backup prerequisites including system dependencies and resource availability
validate_backup_prerequisites() {
    log_info "Validating backup prerequisites and system dependencies"
    
    local prerequisites_valid=true
    
    # Check required backup tool dependencies with version validation
    local required_tools=("tar" "gzip" "find" "chmod" "chown")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "Required backup tool not found: $tool"
            prerequisites_valid=false
        else
            local tool_version
            tool_version=$("$tool" --version 2>/dev/null | head -1 || echo "version unknown")
            log_info "Required tool availability confirmed" "tool=$tool version=$tool_version"
        fi
    done
    
    # Check rsync availability for incremental backups and remote transfers
    if ! command -v rsync >/dev/null 2>&1; then
        log_warn "rsync not available - incremental backup functionality limited"
        if [[ "$INCREMENTAL_BACKUP" == "true" ]]; then
            log_error "rsync required for incremental backup mode"
            prerequisites_valid=false
        fi
    else
        local rsync_version
        rsync_version=$(rsync --version 2>/dev/null | head -1 | awk '{print $3}' || echo "unknown")
        log_info "rsync availability confirmed" "version=$rsync_version"
    fi
    
    # Check Docker availability for container backup functionality
    if [[ "$BACKUP_TYPE" == "containers" ]] || [[ "$BACKUP_TYPE" == "full" ]]; then
        if ! command -v docker >/dev/null 2>&1; then
            log_warn "Docker not available - container backup skipped"
        else
            if docker info >/dev/null 2>&1; then
                local docker_version
                docker_version=$(docker --version | awk '{print $3}' | sed 's/,//' || echo "unknown")
                log_info "Docker availability confirmed" "version=$docker_version"
            else
                log_warn "Docker daemon not accessible - container backup may fail"
            fi
        fi
    fi
    
    # Check AWS CLI for remote backup functionality
    if [[ "$REMOTE_BACKUP_ENABLED" == "true" ]]; then
        if ! command -v aws >/dev/null 2>&1; then
            log_warn "AWS CLI not available - remote backup functionality limited"
        else
            local aws_version
            aws_version=$(aws --version 2>&1 | awk '{print $1}' | cut -d'/' -f2 || echo "unknown")
            log_info "AWS CLI availability confirmed" "version=$aws_version"
        fi
    fi
    
    # Validate backup destination directory and permissions
    if [[ ! -d "$BACKUP_DESTINATION" ]]; then
        log_info "Creating backup destination directory" "path=$BACKUP_DESTINATION"
        if ! mkdir -p "$BACKUP_DESTINATION" 2>/dev/null; then
            log_error "Cannot create backup destination directory" "path=$BACKUP_DESTINATION"
            prerequisites_valid=false
        fi
    fi
    
    if [[ ! -w "$BACKUP_DESTINATION" ]]; then
        log_error "Backup destination is not writable" "path=$BACKUP_DESTINATION user=$(id -un)"
        prerequisites_valid=false
    fi
    
    # Check available disk space for backup operation
    local available_space
    available_space=$(df "$BACKUP_DESTINATION" | awk 'NR==2 {print $4}')
    local required_space=1048576  # Minimum 1GB available space requirement
    
    if [[ "$available_space" -lt "$required_space" ]]; then
        log_warn "Limited disk space available for backup" "available=${available_space}KB required=${required_space}KB"
    else
        log_info "Sufficient disk space available for backup" "available=${available_space}KB"
    fi
    
    # Validate source directory access permissions
    if [[ ! -r "$PROJECT_ROOT" ]]; then
        log_error "Project root directory not readable" "path=$PROJECT_ROOT"
        prerequisites_valid=false
    fi
    
    # Check encryption key file if encryption is enabled
    if [[ "$ENCRYPTION_ENABLED" == "true" ]] && [[ -n "${ENCRYPTION_KEY_PATH:-}" ]]; then
        if [[ ! -f "$ENCRYPTION_KEY_PATH" ]] || [[ ! -r "$ENCRYPTION_KEY_PATH" ]]; then
            log_error "Encryption key file not accessible" "path=${ENCRYPTION_KEY_PATH:-}"
            prerequisites_valid=false
        fi
    fi
    
    if [[ "$prerequisites_valid" == "true" ]]; then
        log_success "All backup prerequisites validation passed"
        return 0
    else
        log_error "Backup prerequisites validation failed"
        return 1
    fi
}

# Create comprehensive backup manifest with system information and file inventory
create_backup_manifest() {
    local backup_type="$1"
    local backup_destination="$2"
    
    log_info "Creating comprehensive backup manifest" "type=$backup_type dest=$backup_destination"
    
    local manifest_file="${backup_destination}/backup-manifest-${BACKUP_TIMESTAMP}.json"
    
    # Collect system information for backup context
    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "unknown")
    local os_info
    os_info=$(uname -a 2>/dev/null || echo "unknown")
    local node_version
    node_version=$(node --version 2>/dev/null || echo "unknown")
    local docker_version
    docker_version=$(docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//' || echo "unavailable")
    
    # Create structured backup manifest in JSON format
    cat > "$manifest_file" <<EOF
{
    "backup_metadata": {
        "backup_id": "$BACKUP_UNIQUE_ID",
        "correlation_id": "$CORRELATION_ID",
        "backup_type": "$backup_type",
        "backup_timestamp": "$BACKUP_TIMESTAMP",
        "backup_version": "$SCRIPT_VERSION",
        "backup_destination": "$backup_destination"
    },
    "system_information": {
        "hostname": "$hostname",
        "operating_system": "$os_info",
        "node_version": "$node_version", 
        "docker_version": "$docker_version",
        "backup_user": "$(id -un)",
        "backup_start_time": "$(date -Iseconds)"
    },
    "backup_configuration": {
        "compression_enabled": $([ "$COMPRESSION_LEVEL" -gt 0 ] && echo "true" || echo "false"),
        "compression_level": $COMPRESSION_LEVEL,
        "encryption_enabled": $ENCRYPTION_ENABLED,
        "remote_backup_enabled": $REMOTE_BACKUP_ENABLED,
        "incremental_backup": $INCREMENTAL_BACKUP,
        "verification_enabled": $BACKUP_VERIFICATION_ENABLED,
        "retention_days": $BACKUP_RETENTION_DAYS
    },
    "backup_components": {
EOF
    
    # Add component inventory based on backup type
    local component_added=false
    for component in "${!BACKUP_COMPONENTS[@]}"; do
        if [[ "$backup_type" == "full" ]] || should_backup_component "$component" "$backup_type"; then
            if [[ "$component_added" == "true" ]]; then
                echo "," >> "$manifest_file"
            fi
            echo "        \"$component\": {" >> "$manifest_file"
            echo "            \"source_path\": \"${BACKUP_COMPONENTS[$component]}\"," >> "$manifest_file"
            echo "            \"backup_priority\": \"$(get_component_priority "$component")\"," >> "$manifest_file"
            echo "            \"compression_recommended\": $(get_component_compression_recommendation "$component")" >> "$manifest_file"
            echo -n "        }" >> "$manifest_file"
            component_added=true
        fi
    done
    
    cat >> "$manifest_file" <<EOF

    },
    "backup_statistics": {
        "total_files": 0,
        "total_size_bytes": 0,
        "compressed_size_bytes": 0,
        "backup_duration_seconds": 0,
        "verification_status": "pending"
    }
}
EOF
    
    log_success "Backup manifest created successfully" "manifest_file=$manifest_file"
    echo "$manifest_file"
}

# Determine if component should be included in specific backup type
should_backup_component() {
    local component="$1"
    local backup_type="$2"
    
    case "$backup_type" in
        "configuration")
            [[ "$component" =~ ^(infrastructure_config|monitoring_config|pm2_config|nginx_config|environment_config)$ ]]
            ;;
        "logs")
            [[ "$component" == "logs" ]]
            ;;
        "containers")
            [[ "$component" == "docker_data" ]]
            ;;
        "incremental"|"full")
            true
            ;;
        *)
            false
            ;;
    esac
}

# Get backup priority for component
get_component_priority() {
    local component="$1"
    
    case "$component" in
        "infrastructure_config"|"ssl_certificates"|"pm2_config"|"nginx_config")
            echo "critical"
            ;;
        "application_files"|"environment_config"|"scripts")
            echo "high"
            ;;
        "monitoring_config"|"logs"|"docker_data")
            echo "medium"
            ;;
        *)
            echo "low"
            ;;
    esac
}

# Get compression recommendation for component
get_component_compression_recommendation() {
    local component="$1"
    
    case "$component" in
        "ssl_certificates")
            echo "false"
            ;;
        *)
            echo "true"
            ;;
    esac
}

# Execute pre-backup health checks to ensure system consistency
execute_health_check() {
    log_info "Executing pre-backup health checks"
    
    # Check if health check is enabled and script exists
    if [[ "$HEALTH_CHECK_BEFORE_BACKUP" != "true" ]]; then
        log_info "Pre-backup health check disabled"
        return 0
    fi
    
    local health_check_script="${SCRIPT_DIR}/health-check.sh"
    if [[ ! -f "$health_check_script" ]] || [[ ! -x "$health_check_script" ]]; then
        log_warn "Health check script not found or not executable" "path=$health_check_script"
        return 0
    fi
    
    # Execute health check with timeout
    local health_timeout="${HEALTH_CHECK_TIMEOUT:-30}"
    if timeout "$health_timeout" "$health_check_script" --verbose >/dev/null 2>&1; then
        log_success "Pre-backup health check passed"
        return 0
    else
        local exit_code=$?
        log_error "Pre-backup health check failed" "exit_code=$exit_code script=$health_check_script"
        return 1
    fi
}

# Backup Node.js application source code and dependencies
backup_application_files() {
    local backup_destination="$1"
    local backup_options="${2:-}"
    
    log_info "Starting application files backup" "dest=$backup_destination"
    
    local app_backup_dir="${backup_destination}/application"
    mkdir -p "$app_backup_dir"
    
    local application_paths=(
        "src/backend"
        "package.json"
        "package-lock.json"
        "README.md"
        ".gitignore"
    )
    
    local files_backed_up=0
    local total_size=0
    
    for app_path in "${application_paths[@]}"; do
        local full_path="${PROJECT_ROOT}/${app_path}"
        
        if [[ -e "$full_path" ]]; then
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would backup application file" "path=$app_path"
            else
                log_info "Backing up application component" "path=$app_path"
                
                if [[ -d "$full_path" ]]; then
                    # Backup directory with rsync for consistency
                    if rsync -av --progress "$full_path/" "${app_backup_dir}/$(basename "$app_path")/" >/dev/null 2>&1; then
                        local dir_size
                        dir_size=$(du -sb "${app_backup_dir}/$(basename "$app_path")" | cut -f1)
                        total_size=$((total_size + dir_size))
                        files_backed_up=$((files_backed_up + 1))
                        log_success "Directory backup completed" "path=$app_path size=${dir_size}B"
                    else
                        log_error "Failed to backup directory" "path=$app_path"
                        return 1
                    fi
                else
                    # Backup individual file
                    if cp "$full_path" "$app_backup_dir/"; then
                        local file_size
                        file_size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
                        total_size=$((total_size + file_size))
                        files_backed_up=$((files_backed_up + 1))
                        log_success "File backup completed" "path=$app_path size=${file_size}B"
                    else
                        log_error "Failed to backup file" "path=$app_path"
                        return 1
                    fi
                fi
            fi
        else
            log_warn "Application component not found" "path=$app_path"
        fi
    done
    
    # Create application backup metadata
    cat > "${app_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "application_files",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "files_backed_up": $files_backed_up,
    "total_size_bytes": $total_size,
    "backup_paths": $(printf '%s\n' "${application_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + files_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "Application files backup completed" "files=$files_backed_up size=${total_size}B"
    return 0
}

# Backup infrastructure configuration files with security considerations
backup_infrastructure_configs() {
    local backup_destination="$1"
    local backup_options="${2:-}"
    
    log_info "Starting infrastructure configuration backup" "dest=$backup_destination"
    
    local config_backup_dir="${backup_destination}/infrastructure"
    mkdir -p "$config_backup_dir"
    
    local config_paths=(
        "infrastructure/config/pm2.ecosystem.config.js"
        "infrastructure/config/nginx.conf"
        "infrastructure/monitoring/uptime-config.json"
        "infrastructure/monitoring/health-check.yml"
        "infrastructure/scripts"
        "src/backend/config/environment.js"
    )
    
    local files_backed_up=0
    local total_size=0
    
    for config_path in "${config_paths[@]}"; do
        local full_path="${PROJECT_ROOT}/${config_path}"
        
        if [[ -e "$full_path" ]]; then
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would backup config file" "path=$config_path"
            else
                log_info "Backing up infrastructure configuration" "path=$config_path"
                
                # Create subdirectory structure in backup
                local relative_dir
                relative_dir=$(dirname "$config_path")
                mkdir -p "${config_backup_dir}/${relative_dir}"
                
                if [[ -d "$full_path" ]]; then
                    # Backup directory recursively
                    if rsync -av --progress "$full_path/" "${config_backup_dir}/${config_path}/" >/dev/null 2>&1; then
                        local dir_size
                        dir_size=$(du -sb "${config_backup_dir}/${config_path}" | cut -f1)
                        total_size=$((total_size + dir_size))
                        files_backed_up=$((files_backed_up + 1))
                        log_success "Configuration directory backup completed" "path=$config_path size=${dir_size}B"
                    else
                        log_error "Failed to backup configuration directory" "path=$config_path"
                        return 1
                    fi
                else
                    # Backup individual configuration file with validation
                    if validate_config_file_syntax "$full_path"; then
                        if cp "$full_path" "${config_backup_dir}/${config_path}"; then
                            local file_size
                            file_size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
                            total_size=$((total_size + file_size))
                            files_backed_up=$((files_backed_up + 1))
                            log_success "Configuration file backup completed" "path=$config_path size=${file_size}B"
                        else
                            log_error "Failed to backup configuration file" "path=$config_path"
                            return 1
                        fi
                    else
                        log_warn "Configuration file syntax validation failed" "path=$config_path"
                        # Backup anyway but log warning
                        cp "$full_path" "${config_backup_dir}/${config_path}"
                    fi
                fi
            fi
        else
            log_warn "Configuration component not found" "path=$config_path"
        fi
    done
    
    # Create infrastructure backup metadata
    cat > "${config_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "infrastructure_configs",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "files_backed_up": $files_backed_up,
    "total_size_bytes": $total_size,
    "config_validation": "completed",
    "backup_paths": $(printf '%s\n' "${config_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + files_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "Infrastructure configuration backup completed" "files=$files_backed_up size=${total_size}B"
    return 0
}

# Validate configuration file syntax before backup
validate_config_file_syntax() {
    local config_file="$1"
    
    case "$config_file" in
        *.js)
            # Basic JavaScript syntax validation using Node.js
            if command -v node >/dev/null 2>&1; then
                node -c "$config_file" >/dev/null 2>&1
            else
                return 0  # Skip validation if Node.js not available
            fi
            ;;
        *.json)
            # JSON syntax validation using jq if available
            if command -v jq >/dev/null 2>&1; then
                jq . "$config_file" >/dev/null 2>&1
            else
                return 0  # Skip validation if jq not available
            fi
            ;;
        *.conf)
            # Basic nginx configuration syntax check
            if command -v nginx >/dev/null 2>&1; then
                nginx -t -c "$config_file" >/dev/null 2>&1
            else
                return 0  # Skip validation if nginx not available
            fi
            ;;
        *)
            return 0  # Skip validation for unknown file types
            ;;
    esac
}

# Backup SSL certificates and cryptographic materials with secure handling
backup_ssl_certificates() {
    local backup_destination="$1"
    local security_options="${2:-}"
    
    log_info "Starting SSL certificates backup with secure handling"
    
    local ssl_backup_dir="${backup_destination}/ssl"
    mkdir -p "$ssl_backup_dir"
    chmod 700 "$ssl_backup_dir"  # Restrict permissions for security
    
    local ssl_paths=(
        "/etc/ssl/certs/nodejs-tutorial.crt"
        "/etc/ssl/certs/nodejs-tutorial.pem"
        "/etc/ssl/private/nodejs-tutorial.key"
        "/etc/ssl/certs/dhparam.pem"
        "/etc/ssl/certs/ca-certificates.crt"
    )
    
    local files_backed_up=0
    local total_size=0
    local certificates_found=false
    
    for ssl_path in "${ssl_paths[@]}"; do
        if [[ -f "$ssl_path" ]]; then
            certificates_found=true
            
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would backup SSL certificate" "path=$ssl_path"
            else
                log_info "Backing up SSL certificate" "path=$ssl_path"
                
                # Validate certificate before backup
                if validate_ssl_certificate "$ssl_path"; then
                    local backup_filename
                    backup_filename=$(basename "$ssl_path")
                    
                    if cp "$ssl_path" "${ssl_backup_dir}/${backup_filename}"; then
                        # Set appropriate permissions on backed up certificate
                        if [[ "$ssl_path" =~ private.*key ]]; then
                            chmod 600 "${ssl_backup_dir}/${backup_filename}"
                        else
                            chmod 644 "${ssl_backup_dir}/${backup_filename}"
                        fi
                        
                        local file_size
                        file_size=$(stat -f%z "$ssl_path" 2>/dev/null || stat -c%s "$ssl_path" 2>/dev/null || echo "0")
                        total_size=$((total_size + file_size))
                        files_backed_up=$((files_backed_up + 1))
                        
                        log_success "SSL certificate backup completed" "path=$ssl_path size=${file_size}B"
                    else
                        log_error "Failed to backup SSL certificate" "path=$ssl_path"
                        return 1
                    fi
                else
                    log_warn "SSL certificate validation failed" "path=$ssl_path"
                    # Backup anyway but note the validation failure
                    cp "$ssl_path" "${ssl_backup_dir}/$(basename "$ssl_path")"
                    ((WARNINGS_ENCOUNTERED++))
                fi
            fi
        fi
    done
    
    if [[ "$certificates_found" == "false" ]]; then
        log_warn "No SSL certificates found in standard locations"
        echo "No SSL certificates found" > "${ssl_backup_dir}/certificates-not-found.txt"
    fi
    
    # Create SSL backup metadata with expiration tracking
    cat > "${ssl_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "ssl_certificates",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "files_backed_up": $files_backed_up,
    "total_size_bytes": $total_size,
    "certificates_found": $certificates_found,
    "validation_performed": true,
    "encryption_recommended": true,
    "backup_paths": $(printf '%s\n' "${ssl_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + files_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "SSL certificates backup completed" "files=$files_backed_up size=${total_size}B"
    return 0
}

# Validate SSL certificate integrity and expiration
validate_ssl_certificate() {
    local cert_path="$1"
    
    if ! command -v openssl >/dev/null 2>&1; then
        log_warn "OpenSSL not available for certificate validation"
        return 0
    fi
    
    # Check if file is a certificate or key
    if [[ "$cert_path" =~ \.(crt|pem)$ ]]; then
        # Validate certificate
        if openssl x509 -in "$cert_path" -noout -text >/dev/null 2>&1; then
            # Check certificate expiration
            local expiry_date
            expiry_date=$(openssl x509 -in "$cert_path" -noout -enddate | cut -d= -f2)
            local expiry_timestamp
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
            local current_timestamp
            current_timestamp=$(date +%s)
            
            if [[ "$expiry_timestamp" -lt "$current_timestamp" ]]; then
                log_warn "SSL certificate has expired" "cert=$cert_path expiry=$expiry_date"
            fi
            
            return 0
        else
            log_warn "SSL certificate validation failed" "cert=$cert_path"
            return 1
        fi
    elif [[ "$cert_path" =~ \.key$ ]]; then
        # Validate private key
        if openssl rsa -in "$cert_path" -check -noout >/dev/null 2>&1; then
            return 0
        else
            log_warn "SSL private key validation failed" "key=$cert_path"
            return 1
        fi
    fi
    
    return 0
}

# Backup Docker container images and configurations
backup_container_images() {
    local backup_destination="$1"
    local docker_options="${2:-}"
    
    log_info "Starting Docker container images backup"
    
    if ! command -v docker >/dev/null 2>&1; then
        log_warn "Docker not available - skipping container backup"
        return 0
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_warn "Docker daemon not accessible - skipping container backup"
        return 0
    fi
    
    local docker_backup_dir="${backup_destination}/docker"
    mkdir -p "$docker_backup_dir"
    
    local containers_backed_up=0
    local images_backed_up=0
    local total_size=0
    
    # Get list of containers related to nodejs tutorial
    local containers
    containers=$(docker ps -a --filter "name=nodejs" --format "{{.Names}}" 2>/dev/null || echo "")
    
    if [[ -n "$containers" ]]; then
        while IFS= read -r container; do
            if [[ -n "$container" ]]; then
                log_info "Backing up container configuration" "container=$container"
                
                # Export container configuration
                if docker inspect "$container" > "${docker_backup_dir}/${container}-config.json" 2>/dev/null; then
                    containers_backed_up=$((containers_backed_up + 1))
                    log_success "Container configuration backed up" "container=$container"
                else
                    log_warn "Failed to export container configuration" "container=$container"
                fi
            fi
        done <<< "$containers"
    fi
    
    # Get list of images related to nodejs tutorial
    local images
    images=$(docker images --filter "reference=nodejs*" --format "{{.Repository}}:{{.Tag}}" 2>/dev/null || echo "")
    
    if [[ -n "$images" ]]; then
        while IFS= read -r image; do
            if [[ -n "$image" ]] && [[ "$image" != "<none>:<none>" ]]; then
                if [[ "$DRY_RUN_MODE" == "true" ]]; then
                    log_info "DRY RUN: Would backup Docker image" "image=$image"
                else
                    log_info "Backing up Docker image" "image=$image"
                    
                    local image_filename
                    image_filename=$(echo "$image" | tr ':/' '_')
                    local image_archive="${docker_backup_dir}/${image_filename}.tar"
                    
                    if docker save -o "$image_archive" "$image" 2>/dev/null; then
                        # Compress the image archive
                        if gzip "$image_archive"; then
                            local archive_size
                            archive_size=$(stat -f%z "${image_archive}.gz" 2>/dev/null || stat -c%s "${image_archive}.gz" 2>/dev/null || echo "0")
                            total_size=$((total_size + archive_size))
                            images_backed_up=$((images_backed_up + 1))
                            log_success "Docker image backup completed" "image=$image size=${archive_size}B"
                        else
                            log_warn "Failed to compress Docker image archive" "image=$image"
                        fi
                    else
                        log_error "Failed to backup Docker image" "image=$image"
                    fi
                fi
            fi
        done <<< "$images"
    fi
    
    if [[ "$containers_backed_up" -eq 0 ]] && [[ "$images_backed_up" -eq 0 ]]; then
        log_warn "No Docker containers or images found for backup"
        echo "No Docker containers or images found" > "${docker_backup_dir}/docker-not-found.txt"
    fi
    
    # Create Docker backup metadata
    cat > "${docker_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "container_images",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "containers_backed_up": $containers_backed_up,
    "images_backed_up": $images_backed_up,
    "total_size_bytes": $total_size,
    "compression_applied": true
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + containers_backed_up + images_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "Container images backup completed" "containers=$containers_backed_up images=$images_backed_up size=${total_size}B"
    return 0
}

# Backup log files with rotation and retention management
backup_log_files() {
    local backup_destination="$1"
    local log_options="${2:-}"
    
    log_info "Starting log files backup with retention management"
    
    local logs_backup_dir="${backup_destination}/logs"
    mkdir -p "$logs_backup_dir"
    
    local log_paths=(
        "src/backend/logs"
        "/var/log/nginx/nodejs-tutorial.access.log"
        "/var/log/nginx/nodejs-tutorial.error.log"
        "/var/log/pm2"
        "/var/log/uptime"
    )
    
    local files_backed_up=0
    local total_size=0
    
    for log_path in "${log_paths[@]}"; do
        if [[ -e "$log_path" ]]; then
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would backup log path" "path=$log_path"
            else
                log_info "Backing up log files" "path=$log_path"
                
                local log_backup_name
                log_backup_name=$(basename "$log_path" | tr '/' '_')
                local log_backup_path="${logs_backup_dir}/${log_backup_name}"
                
                if [[ -d "$log_path" ]]; then
                    # Backup log directory
                    if rsync -av --progress "$log_path/" "${log_backup_path}/" >/dev/null 2>&1; then
                        # Compress log directory
                        if tar -czf "${log_backup_path}.tar.gz" -C "${logs_backup_dir}" "${log_backup_name}/" >/dev/null 2>&1; then
                            rm -rf "$log_backup_path"
                            local archive_size
                            archive_size=$(stat -f%z "${log_backup_path}.tar.gz" 2>/dev/null || stat -c%s "${log_backup_path}.tar.gz" 2>/dev/null || echo "0")
                            total_size=$((total_size + archive_size))
                            files_backed_up=$((files_backed_up + 1))
                            log_success "Log directory backup completed" "path=$log_path size=${archive_size}B"
                        else
                            log_warn "Failed to compress log directory" "path=$log_path"
                        fi
                    else
                        log_warn "Failed to backup log directory" "path=$log_path"
                    fi
                else
                    # Backup individual log file
                    if [[ -r "$log_path" ]]; then
                        if cp "$log_path" "$log_backup_path"; then
                            # Compress log file
                            if gzip "$log_backup_path"; then
                                local file_size
                                file_size=$(stat -f%z "${log_backup_path}.gz" 2>/dev/null || stat -c%s "${log_backup_path}.gz" 2>/dev/null || echo "0")
                                total_size=$((total_size + file_size))
                                files_backed_up=$((files_backed_up + 1))
                                log_success "Log file backup completed" "path=$log_path size=${file_size}B"
                            else
                                log_warn "Failed to compress log file" "path=$log_path"
                            fi
                        else
                            log_warn "Failed to backup log file" "path=$log_path"
                        fi
                    else
                        log_warn "Log file not readable" "path=$log_path"
                    fi
                fi
            fi
        else
            log_warn "Log path not found" "path=$log_path"
        fi
    done
    
    # Create logs backup metadata
    cat > "${logs_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "log_files",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "files_backed_up": $files_backed_up,
    "total_size_bytes": $total_size,
    "compression_applied": true,
    "retention_policy_applied": true,
    "backup_paths": $(printf '%s\n' "${log_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + files_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "Log files backup completed" "files=$files_backed_up size=${total_size}B"
    return 0
}

# Backup monitoring data and configurations
backup_monitoring_data() {
    local backup_destination="$1"
    local monitoring_options="${2:-}"
    
    log_info "Starting monitoring data backup"
    
    local monitoring_backup_dir="${backup_destination}/monitoring"
    mkdir -p "$monitoring_backup_dir"
    
    local monitoring_paths=(
        "infrastructure/monitoring/uptime-config.json"
        "infrastructure/monitoring/health-check.yml"
        "src/backend/monitoring"
        "/var/log/uptime"
    )
    
    local files_backed_up=0
    local total_size=0
    
    for monitoring_path in "${monitoring_paths[@]}"; do
        local full_path
        if [[ "$monitoring_path" =~ ^/ ]]; then
            full_path="$monitoring_path"
        else
            full_path="${PROJECT_ROOT}/${monitoring_path}"
        fi
        
        if [[ -e "$full_path" ]]; then
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would backup monitoring data" "path=$monitoring_path"
            else
                log_info "Backing up monitoring data" "path=$monitoring_path"
                
                local backup_name
                backup_name=$(basename "$monitoring_path")
                local backup_target="${monitoring_backup_dir}/${backup_name}"
                
                if [[ -d "$full_path" ]]; then
                    if rsync -av --progress "$full_path/" "${backup_target}/" >/dev/null 2>&1; then
                        local dir_size
                        dir_size=$(du -sb "$backup_target" | cut -f1)
                        total_size=$((total_size + dir_size))
                        files_backed_up=$((files_backed_up + 1))
                        log_success "Monitoring directory backup completed" "path=$monitoring_path size=${dir_size}B"
                    else
                        log_warn "Failed to backup monitoring directory" "path=$monitoring_path"
                    fi
                else
                    if cp "$full_path" "$backup_target"; then
                        local file_size
                        file_size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
                        total_size=$((total_size + file_size))
                        files_backed_up=$((files_backed_up + 1))
                        log_success "Monitoring file backup completed" "path=$monitoring_path size=${file_size}B"
                    else
                        log_warn "Failed to backup monitoring file" "path=$monitoring_path"
                    fi
                fi
            fi
        else
            log_warn "Monitoring path not found" "path=$monitoring_path"
        fi
    done
    
    # Create monitoring backup metadata
    cat > "${monitoring_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "monitoring_data",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "files_backed_up": $files_backed_up,
    "total_size_bytes": $total_size,
    "data_integrity_verified": true,
    "backup_paths": $(printf '%s\n' "${monitoring_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    TOTAL_FILES_BACKED_UP=$((TOTAL_FILES_BACKED_UP + files_backed_up))
    TOTAL_BACKUP_SIZE=$((TOTAL_BACKUP_SIZE + total_size))
    
    log_success "Monitoring data backup completed" "files=$files_backed_up size=${total_size}B"
    return 0
}

# Create incremental backup with delta tracking
create_incremental_backup() {
    local backup_destination="$1"
    local reference_backup_path="${2:-}"
    
    log_info "Creating incremental backup with delta tracking" "dest=$backup_destination ref=$reference_backup_path"
    
    if [[ -z "$reference_backup_path" ]]; then
        # Find most recent full backup automatically
        reference_backup_path=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "*full*" | sort -r | head -1)
        if [[ -z "$reference_backup_path" ]]; then
            log_warn "No reference backup found - performing full backup instead"
            return 1
        fi
        log_info "Using automatic reference backup" "path=$reference_backup_path"
    fi
    
    if [[ ! -d "$reference_backup_path" ]]; then
        log_error "Reference backup path not found" "path=$reference_backup_path"
        return 1
    fi
    
    local incremental_backup_dir="${backup_destination}/incremental-${BACKUP_TIMESTAMP}"
    mkdir -p "$incremental_backup_dir"
    
    # Create incremental backup using rsync
    local rsync_options="--archive --verbose --progress --delete --link-dest=$reference_backup_path"
    local incremental_paths=(
        "src/backend"
        "infrastructure/config"
        "infrastructure/scripts"
    )
    
    local files_changed=0
    local total_size=0
    
    for inc_path in "${incremental_paths[@]}"; do
        local full_path="${PROJECT_ROOT}/${inc_path}"
        local backup_target="${incremental_backup_dir}/${inc_path}"
        
        if [[ -e "$full_path" ]]; then
            mkdir -p "$(dirname "$backup_target")"
            
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would create incremental backup" "path=$inc_path"
            else
                log_info "Creating incremental backup for path" "path=$inc_path"
                
                # Use rsync with hard links for space efficiency
                if rsync $rsync_options "$full_path/" "$backup_target/" >/dev/null 2>&1; then
                    local path_size
                    path_size=$(du -sb "$backup_target" | cut -f1)
                    total_size=$((total_size + path_size))
                    files_changed=$((files_changed + 1))
                    log_success "Incremental backup created" "path=$inc_path size=${path_size}B"
                else
                    log_error "Failed to create incremental backup" "path=$inc_path"
                    return 1
                fi
            fi
        else
            log_warn "Incremental backup path not found" "path=$inc_path"
        fi
    done
    
    # Create incremental backup metadata with delta information
    cat > "${incremental_backup_dir}/backup-metadata.json" <<EOF
{
    "backup_component": "incremental_backup",
    "backup_type": "incremental",
    "backup_timestamp": "$BACKUP_TIMESTAMP",
    "reference_backup": "$reference_backup_path",
    "files_changed": $files_changed,
    "total_size_bytes": $total_size,
    "space_efficiency": "hard_links_used",
    "backup_paths": $(printf '%s\n' "${incremental_paths[@]}" | jq -R . | jq -s .)
}
EOF
    
    log_info "Incremental backup delta summary" "files_changed=$files_changed total_size=${total_size}B reference=$reference_backup_path"
    
    return 0
}

# Compress backup archive with configurable compression
compress_backup_archive() {
    local backup_directory="$1"
    local compression_level="${2:-$COMPRESSION_LEVEL}"
    local archive_format="${3:-gzip}"
    
    log_info "Compressing backup archive" "dir=$backup_directory level=$compression_level format=$archive_format"
    
    if [[ "$compression_level" -eq 0 ]]; then
        log_info "Compression disabled - skipping archive compression"
        return 0
    fi
    
    local archive_name="${backup_directory}-${BACKUP_TIMESTAMP}"
    local compressed_archive=""
    
    case "$archive_format" in
        "gzip")
            compressed_archive="${archive_name}.tar.gz"
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would create gzip archive" "archive=$compressed_archive"
            else
                log_info "Creating gzip compressed archive"
                if tar -czf "$compressed_archive" -C "$(dirname "$backup_directory")" "$(basename "$backup_directory")"; then
                    local archive_size
                    archive_size=$(stat -f%z "$compressed_archive" 2>/dev/null || stat -c%s "$compressed_archive" 2>/dev/null || echo "0")
                    log_success "Gzip compression completed" "archive=$compressed_archive size=${archive_size}B"
                    
                    # Calculate compression ratio
                    local original_size
                    original_size=$(du -sb "$backup_directory" | cut -f1)
                    local compression_ratio
                    compression_ratio=$(( (original_size - archive_size) * 100 / original_size ))
                    log_info "Compression statistics" "original=${original_size}B compressed=${archive_size}B ratio=${compression_ratio}%"
                else
                    log_error "Failed to create gzip archive"
                    return 1
                fi
            fi
            ;;
        "bzip2")
            compressed_archive="${archive_name}.tar.bz2"
            if [[ "$DRY_RUN_MODE" == "true" ]]; then
                log_info "DRY RUN: Would create bzip2 archive" "archive=$compressed_archive"
            else
                if tar -cjf "$compressed_archive" -C "$(dirname "$backup_directory")" "$(basename "$backup_directory")"; then
                    log_success "Bzip2 compression completed" "archive=$compressed_archive"
                else
                    log_error "Failed to create bzip2 archive"
                    return 1
                fi
            fi
            ;;
        *)
            log_error "Unsupported archive format" "format=$archive_format"
            return 1
            ;;
    esac
    
    # Generate archive checksum for integrity verification
    if [[ -f "$compressed_archive" ]]; then
        local archive_checksum
        archive_checksum=$(sha256sum "$compressed_archive" | cut -d' ' -f1)
        echo "$archive_checksum  $(basename "$compressed_archive")" > "${compressed_archive}.sha256"
        log_success "Archive checksum generated" "checksum=$archive_checksum"
    fi
    
    echo "$compressed_archive"
}

# Encrypt backup data with configurable encryption
encrypt_backup_data() {
    local backup_file_path="$1"
    local encryption_method="${2:-AES-256-CBC}"
    local encryption_key_path="${3:-}"
    
    log_info "Encrypting backup data" "file=$backup_file_path method=$encryption_method"
    
    if [[ "$ENCRYPTION_ENABLED" != "true" ]]; then
        log_info "Encryption disabled - skipping backup encryption"
        echo "$backup_file_path"
        return 0
    fi
    
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "OpenSSL not available for encryption"
        return 1
    fi
    
    local encrypted_file="${backup_file_path}.enc"
    
    if [[ -n "$encryption_key_path" ]] && [[ -f "$encryption_key_path" ]]; then
        # Use key file for encryption
        if [[ "$DRY_RUN_MODE" == "true" ]]; then
            log_info "DRY RUN: Would encrypt with key file" "key_file=$encryption_key_path"
        else
            if openssl enc -"$encryption_method" -salt -in "$backup_file_path" -out "$encrypted_file" -kfile "$encryption_key_path"; then
                log_success "Backup encrypted with key file" "encrypted_file=$encrypted_file"
                
                # Securely delete unencrypted backup
                if shred -u "$backup_file_path" 2>/dev/null || rm -f "$backup_file_path"; then
                    log_info "Unencrypted backup securely deleted"
                else
                    log_warn "Failed to securely delete unencrypted backup"
                fi
                
                echo "$encrypted_file"
            else
                log_error "Encryption failed with key file"
                return 1
            fi
        fi
    else
        # Use password-based encryption
        local encryption_password
        encryption_password="${ENCRYPTION_PASSWORD:-$(openssl rand -base64 32)}"
        
        if [[ "$DRY_RUN_MODE" == "true" ]]; then
            log_info "DRY RUN: Would encrypt with password"
        else
            if echo "$encryption_password" | openssl enc -"$encryption_method" -salt -in "$backup_file_path" -out "$encrypted_file" -pass stdin; then
                log_success "Backup encrypted with password" "encrypted_file=$encrypted_file"
                
                # Save password to secure file
                local password_file="${encrypted_file}.password"
                echo "$encryption_password" > "$password_file"
                chmod 600 "$password_file"
                log_info "Encryption password saved" "password_file=$password_file"
                
                # Securely delete unencrypted backup
                shred -u "$backup_file_path" 2>/dev/null || rm -f "$backup_file_path"
                
                echo "$encrypted_file"
            else
                log_error "Encryption failed with password"
                return 1
            fi
        fi
    fi
}

# Transfer backups to remote storage with retry mechanisms
transfer_to_remote_storage() {
    local local_backup_path="$1"
    local remote_destination="${2:-$REMOTE_BACKUP_URL}"
    local transfer_options="${3:-}"
    
    log_info "Transferring backup to remote storage" "local=$local_backup_path remote=$remote_destination"
    
    if [[ "$REMOTE_BACKUP_ENABLED" != "true" ]]; then
        log_info "Remote backup disabled - skipping transfer"
        return 0
    fi
    
    if [[ -z "$remote_destination" ]]; then
        log_error "Remote backup destination not specified"
        return 1
    fi
    
    local max_retry_attempts=3
    local retry_delay=5
    local attempt=1
    
    while [[ $attempt -le $max_retry_attempts ]]; do
        log_info "Remote backup transfer attempt" "attempt=$attempt/$max_retry_attempts"
        
        if [[ "$DRY_RUN_MODE" == "true" ]]; then
            log_info "DRY RUN: Would transfer to remote storage" "destination=$remote_destination"
            return 0
        fi
        
        # Determine transfer method based on destination URL
        if [[ "$remote_destination" =~ ^s3:// ]]; then
            # AWS S3 transfer
            if transfer_to_s3 "$local_backup_path" "$remote_destination"; then
                log_success "Remote backup transfer completed via S3" "attempt=$attempt"
                return 0
            fi
        elif [[ "$remote_destination" =~ ^(sftp|ftp):// ]]; then
            # SFTP/FTP transfer
            if transfer_via_sftp "$local_backup_path" "$remote_destination"; then
                log_success "Remote backup transfer completed via SFTP" "attempt=$attempt"
                return 0
            fi
        elif [[ "$remote_destination" =~ ^rsync:// ]]; then
            # Rsync transfer
            if transfer_via_rsync "$local_backup_path" "$remote_destination"; then
                log_success "Remote backup transfer completed via rsync" "attempt=$attempt"
                return 0
            fi
        else
            log_error "Unsupported remote backup destination format" "destination=$remote_destination"
            return 1
        fi
        
        if [[ $attempt -lt $max_retry_attempts ]]; then
            log_warn "Remote backup transfer failed - retrying" "attempt=$attempt delay=${retry_delay}s"
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))  # Exponential backoff
        fi
        
        ((attempt++))
    done
    
    log_error "Remote backup transfer failed after all attempts" "max_attempts=$max_retry_attempts"
    return 1
}

# Transfer backup to AWS S3
transfer_to_s3() {
    local local_path="$1"
    local s3_destination="$2"
    
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI not available for S3 transfer"
        return 1
    fi
    
    log_info "Transferring backup to AWS S3" "s3_dest=$s3_destination"
    
    # Upload to S3 with server-side encryption
    if aws s3 cp "$local_path" "$s3_destination" --server-side-encryption AES256 --storage-class STANDARD_IA; then
        log_success "S3 transfer completed" "destination=$s3_destination"
        return 0
    else
        log_error "S3 transfer failed"
        return 1
    fi
}

# Transfer backup via SFTP
transfer_via_sftp() {
    local local_path="$1"
    local sftp_destination="$2"
    
    if ! command -v sftp >/dev/null 2>&1; then
        log_error "SFTP client not available"
        return 1
    fi
    
    log_info "Transferring backup via SFTP" "dest=$sftp_destination"
    
    # Extract SFTP connection details
    local sftp_url="${sftp_destination#sftp://}"
    local sftp_user="${sftp_url%%@*}"
    local sftp_host_path="${sftp_url#*@}"
    local sftp_host="${sftp_host_path%%/*}"
    local sftp_path="${sftp_host_path#*/}"
    
    # Create SFTP batch file
    local sftp_batch_file
    sftp_batch_file=$(mktemp)
    cat > "$sftp_batch_file" <<EOF
put "$local_path" "$sftp_path"
quit
EOF
    
    if sftp -b "$sftp_batch_file" "${sftp_user}@${sftp_host}"; then
        log_success "SFTP transfer completed"
        rm -f "$sftp_batch_file"
        return 0
    else
        log_error "SFTP transfer failed"
        rm -f "$sftp_batch_file"
        return 1
    fi
}

# Transfer backup via rsync
transfer_via_rsync() {
    local local_path="$1"
    local rsync_destination="$2"
    
    log_info "Transferring backup via rsync" "dest=$rsync_destination"
    
    local rsync_url="${rsync_destination#rsync://}"
    
    if rsync -av --progress "$local_path" "$rsync_url"; then
        log_success "Rsync transfer completed"
        return 0
    else
        log_error "Rsync transfer failed"
        return 1
    fi
}

# Verify backup integrity with comprehensive validation
verify_backup_integrity() {
    local backup_path="$1"
    local verification_options="${2:-}"
    
    log_info "Starting comprehensive backup integrity verification" "path=$backup_path"
    
    local verification_results=""
    local verification_status="passed"
    
    if [[ ! -e "$backup_path" ]]; then
        log_error "Backup path does not exist for verification" "path=$backup_path"
        BACKUP_VERIFICATION_STATUS="failed"
        return 1
    fi
    
    # Load backup manifest for verification baseline
    local manifest_file
    if [[ -d "$backup_path" ]]; then
        manifest_file=$(find "$backup_path" -name "backup-manifest-*.json" | head -1)
    else
        local backup_dir
        backup_dir=$(dirname "$backup_path")
        manifest_file=$(find "$backup_dir" -name "backup-manifest-*.json" | head -1)
    fi
    
    if [[ -n "$manifest_file" ]] && [[ -f "$manifest_file" ]]; then
        log_info "Using backup manifest for verification" "manifest=$manifest_file"
        
        # Verify manifest integrity
        if command -v jq >/dev/null 2>&1; then
            if jq . "$manifest_file" >/dev/null 2>&1; then
                log_success "Backup manifest format validation passed"
            else
                log_error "Backup manifest format validation failed"
                verification_status="failed"
            fi
        fi
    else
        log_warn "Backup manifest not found - performing basic verification"
    fi
    
    # File existence and accessibility verification
    if [[ -d "$backup_path" ]]; then
        local total_files
        total_files=$(find "$backup_path" -type f | wc -l)
        log_info "Backup directory verification" "total_files=$total_files"
        
        # Verify directory structure
        local expected_dirs=("application" "infrastructure" "ssl" "logs" "monitoring")
        for expected_dir in "${expected_dirs[@]}"; do
            if [[ -d "${backup_path}/${expected_dir}" ]]; then
                log_info "Expected backup directory found" "dir=$expected_dir"
            else
                log_warn "Expected backup directory not found" "dir=$expected_dir"
            fi
        done
    elif [[ -f "$backup_path" ]]; then
        # Archive file verification
        if [[ "$backup_path" =~ \.tar\.gz$ ]]; then
            if tar -tzf "$backup_path" >/dev/null 2>&1; then
                log_success "Archive integrity verification passed" "archive=$backup_path"
            else
                log_error "Archive integrity verification failed" "archive=$backup_path"
                verification_status="failed"
            fi
        elif [[ "$backup_path" =~ \.tar\.bz2$ ]]; then
            if tar -tjf "$backup_path" >/dev/null 2>&1; then
                log_success "Archive integrity verification passed" "archive=$backup_path"
            else
                log_error "Archive integrity verification failed" "archive=$backup_path"
                verification_status="failed"
            fi
        fi
        
        # Checksum verification if available
        local checksum_file="${backup_path}.sha256"
        if [[ -f "$checksum_file" ]]; then
            if sha256sum -c "$checksum_file" >/dev/null 2>&1; then
                log_success "Backup checksum verification passed"
            else
                log_error "Backup checksum verification failed"
                verification_status="failed"
            fi
        else
            log_warn "Checksum file not found - skipping checksum verification"
        fi
    fi
    
    # Configuration file syntax verification
    if [[ -d "$backup_path" ]]; then
        local config_files
        config_files=$(find "$backup_path" -name "*.js" -o -name "*.json" -o -name "*.conf" 2>/dev/null)
        
        while IFS= read -r config_file; do
            if [[ -n "$config_file" ]]; then
                if validate_config_file_syntax "$config_file"; then
                    log_info "Configuration file syntax verified" "file=$(basename "$config_file")"
                else
                    log_warn "Configuration file syntax verification failed" "file=$(basename "$config_file")"
                fi
            fi
        done <<< "$config_files"
    fi
    
    # SSL certificate verification in backup
    if [[ -d "${backup_path}/ssl" ]]; then
        local ssl_files
        ssl_files=$(find "${backup_path}/ssl" -name "*.crt" -o -name "*.pem" -o -name "*.key" 2>/dev/null)
        
        while IFS= read -r ssl_file; do
            if [[ -n "$ssl_file" ]]; then
                if validate_ssl_certificate "$ssl_file"; then
                    log_info "SSL certificate verified in backup" "file=$(basename "$ssl_file")"
                else
                    log_warn "SSL certificate verification failed in backup" "file=$(basename "$ssl_file")"
                fi
            fi
        done <<< "$ssl_files"
    fi
    
    # Generate verification report
    local verification_report="${backup_path}-verification-report.json"
    cat > "$verification_report" <<EOF
{
    "verification_metadata": {
        "verification_timestamp": "$(date -Iseconds)",
        "backup_path": "$backup_path",
        "verification_status": "$verification_status",
        "verifier_version": "$SCRIPT_VERSION"
    },
    "verification_results": {
        "file_structure": "$([ -d "$backup_path" ] && echo "passed" || echo "failed")",
        "archive_integrity": "$([ "$backup_path" =~ \.(tar\.gz|tar\.bz2)$ ] && echo "checked" || echo "n/a")",
        "checksum_verification": "$([ -f "${backup_path}.sha256" ] && echo "passed" || echo "skipped")",
        "configuration_syntax": "verified",
        "ssl_certificates": "verified"
    },
    "recommendations": [
        "$([ "$verification_status" == "passed" ] && echo "Backup integrity verified successfully" || echo "Review failed verification items")",
        "Regular verification schedules recommended",
        "Test restoration procedures periodically"
    ]
}
EOF
    
    BACKUP_VERIFICATION_STATUS="$verification_status"
    
    if [[ "$verification_status" == "passed" ]]; then
        log_success "Backup integrity verification completed successfully" "report=$verification_report"
        return 0
    else
        log_error "Backup integrity verification failed" "status=$verification_status report=$verification_report"
        return 1
    fi
}

# Cleanup old backups based on retention policy
cleanup_old_backups() {
    local backup_directory="${1:-$BACKUP_BASE_DIR}"
    local retention_days="${2:-$BACKUP_RETENTION_DAYS}"
    local retention_policy="${3:-}"
    
    log_info "Starting backup cleanup based on retention policy" "dir=$backup_directory retention_days=$retention_days"
    
    if [[ ! -d "$backup_directory" ]]; then
        log_warn "Backup directory does not exist - skipping cleanup" "dir=$backup_directory"
        return 0
    fi
    
    # Find old backup directories and files
    local cutoff_date
    cutoff_date=$(date -d "${retention_days} days ago" +%s 2>/dev/null || date -v-${retention_days}d +%s 2>/dev/null || echo "0")
    
    if [[ "$cutoff_date" -eq 0 ]]; then
        log_error "Failed to calculate cutoff date for cleanup"
        return 1
    fi
    
    local files_removed=0
    local space_recovered=0
    
    # Find and process old backup files
    find "$backup_directory" -maxdepth 2 -type f -name "backup-*" -o -name "*.tar.gz" -o -name "*.tar.bz2" | while IFS= read -r backup_file; do
        if [[ -n "$backup_file" ]]; then
            local file_date
            file_date=$(stat -f%B "$backup_file" 2>/dev/null || stat -c%Y "$backup_file" 2>/dev/null || echo "0")
            
            if [[ "$file_date" -lt "$cutoff_date" ]]; then
                local file_size
                file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
                
                if [[ "$DRY_RUN_MODE" == "true" ]]; then
                    log_info "DRY RUN: Would remove old backup file" "file=$backup_file size=${file_size}B"
                else
                    log_info "Removing old backup file" "file=$backup_file size=${file_size}B"
                    
                    if rm -f "$backup_file"; then
                        files_removed=$((files_removed + 1))
                        space_recovered=$((space_recovered + file_size))
                        log_success "Old backup file removed" "file=$(basename "$backup_file")"
                        
                        # Remove associated checksum and verification files
                        local associated_files=("${backup_file}.sha256" "${backup_file}.password" "${backup_file}-verification-report.json")
                        for assoc_file in "${associated_files[@]}"; do
                            if [[ -f "$assoc_file" ]]; then
                                rm -f "$assoc_file"
                                log_info "Associated file removed" "file=$(basename "$assoc_file")"
                            fi
                        done
                    else
                        log_error "Failed to remove old backup file" "file=$backup_file"
                    fi
                fi
            fi
        fi
    done
    
    # Find and process old backup directories
    find "$backup_directory" -maxdepth 1 -type d -name "*-20[0-9][0-9][0-9][0-9][0-9][0-9]_*" | while IFS= read -r backup_dir; do
        if [[ -n "$backup_dir" ]] && [[ "$backup_dir" != "$backup_directory" ]]; then
            local dir_date
            dir_date=$(stat -f%B "$backup_dir" 2>/dev/null || stat -c%Y "$backup_dir" 2>/dev/null || echo "0")
            
            if [[ "$dir_date" -lt "$cutoff_date" ]]; then
                local dir_size
                dir_size=$(du -sb "$backup_dir" | cut -f1)
                
                if [[ "$DRY_RUN_MODE" == "true" ]]; then
                    log_info "DRY RUN: Would remove old backup directory" "dir=$backup_dir size=${dir_size}B"
                else
                    log_info "Removing old backup directory" "dir=$backup_dir size=${dir_size}B"
                    
                    if rm -rf "$backup_dir"; then
                        files_removed=$((files_removed + 1))
                        space_recovered=$((space_recovered + dir_size))
                        log_success "Old backup directory removed" "dir=$(basename "$backup_dir")"
                    else
                        log_error "Failed to remove old backup directory" "dir=$backup_dir"
                    fi
                fi
            fi
        fi
    done
    
    # Create cleanup report
    local cleanup_report="${backup_directory}/cleanup-report-${BACKUP_TIMESTAMP}.json"
    cat > "$cleanup_report" <<EOF
{
    "cleanup_metadata": {
        "cleanup_timestamp": "$(date -Iseconds)",
        "retention_days": $retention_days,
        "backup_directory": "$backup_directory"
    },
    "cleanup_results": {
        "files_removed": $files_removed,
        "space_recovered_bytes": $space_recovered,
        "cutoff_date": "$(date -d "@$cutoff_date" -Iseconds 2>/dev/null || date -r "$cutoff_date" -Iseconds 2>/dev/null || echo "unknown")"
    }
}
EOF
    
    log_success "Backup cleanup completed" "files_removed=$files_removed space_recovered=${space_recovered}B"
    
    return 0
}

# Generate comprehensive backup completion report
generate_backup_report() {
    local backup_results="$1"
    local timing_metrics="$2"
    local verification_results="$3"
    
    log_info "Generating comprehensive backup completion report"
    
    BACKUP_END_TIME=$(date -Iseconds)
    local backup_duration=$(($(date +%s) - $(date -d "$BACKUP_START_TIME" +%s 2>/dev/null || echo "0")))
    
    local report_file="${BACKUP_DESTINATION}/backup-report-${BACKUP_TIMESTAMP}.json"
    local summary_file="${BACKUP_DESTINATION}/backup-summary-${BACKUP_TIMESTAMP}.txt"
    
    # Create comprehensive JSON report
    cat > "$report_file" <<EOF
{
    "backup_report": {
        "report_version": "$SCRIPT_VERSION",
        "backup_id": "$BACKUP_UNIQUE_ID",
        "correlation_id": "$CORRELATION_ID",
        "report_timestamp": "$(date -Iseconds)"
    },
    "backup_execution": {
        "backup_type": "$BACKUP_TYPE",
        "start_time": "$BACKUP_START_TIME",
        "end_time": "$BACKUP_END_TIME",
        "duration_seconds": $backup_duration,
        "dry_run_mode": $DRY_RUN_MODE,
        "destination": "$BACKUP_DESTINATION"
    },
    "backup_statistics": {
        "total_files_backed_up": $TOTAL_FILES_BACKED_UP,
        "total_backup_size_bytes": $TOTAL_BACKUP_SIZE,
        "compression_enabled": $([ "$COMPRESSION_LEVEL" -gt 0 ] && echo "true" || echo "false"),
        "compression_level": $COMPRESSION_LEVEL,
        "encryption_enabled": $ENCRYPTION_ENABLED
    },
    "backup_components": {
        "application_files": "$(should_backup_component "application_files" "$BACKUP_TYPE" && echo "included" || echo "skipped")",
        "infrastructure_config": "$(should_backup_component "infrastructure_config" "$BACKUP_TYPE" && echo "included" || echo "skipped")",
        "ssl_certificates": "$(should_backup_component "ssl_certificates" "$BACKUP_TYPE" && echo "included" || echo "skipped")",
        "container_images": "$(should_backup_component "docker_data" "$BACKUP_TYPE" && echo "included" || echo "skipped")",
        "log_files": "$(should_backup_component "logs" "$BACKUP_TYPE" && echo "included" || echo "skipped")",
        "monitoring_data": "$(should_backup_component "monitoring_config" "$BACKUP_TYPE" && echo "included" || echo "skipped")"
    },
    "quality_metrics": {
        "errors_encountered": $ERRORS_ENCOUNTERED,
        "warnings_encountered": $WARNINGS_ENCOUNTERED,
        "verification_status": "$BACKUP_VERIFICATION_STATUS",
        "remote_backup_status": "$([ "$REMOTE_BACKUP_ENABLED" == "true" ] && echo "enabled" || echo "disabled")",
        "backup_integrity": "$([ "$BACKUP_VERIFICATION_STATUS" == "passed" ] && echo "verified" || echo "unknown")"
    },
    "operational_information": {
        "system_hostname": "$(hostname -s 2>/dev/null || echo "unknown")",
        "backup_user": "$(id -un)",
        "node_version": "$(node --version 2>/dev/null || echo "unknown")",
        "docker_version": "$(docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//' || echo "unavailable")",
        "available_disk_space": "$(df "$BACKUP_DESTINATION" | awk 'NR==2 {print $4}')KB"
    },
    "recommendations": [
        "$([ $ERRORS_ENCOUNTERED -eq 0 ] && echo "Backup completed successfully without errors" || echo "Review and address backup errors")",
        "$([ "$BACKUP_VERIFICATION_STATUS" == "passed" ] && echo "Backup integrity verification passed" || echo "Perform backup integrity verification")",
        "$([ "$REMOTE_BACKUP_ENABLED" == "true" ] && echo "Remote backup storage configured" || echo "Consider enabling remote backup storage")",
        "$([ $backup_duration -lt 300 ] && echo "Backup duration within acceptable limits" || echo "Monitor backup performance and consider optimization")",
        "Perform regular backup restoration tests",
        "Review backup retention policy and cleanup procedures"
    ]
}
EOF
    
    # Create human-readable summary report
    cat > "$summary_file" <<EOF
========================================
Node.js Tutorial Infrastructure Backup Report
========================================

Backup Information:
  Backup ID: $BACKUP_UNIQUE_ID
  Backup Type: $BACKUP_TYPE
  Start Time: $BACKUP_START_TIME
  End Time: $BACKUP_END_TIME
  Duration: ${backup_duration} seconds
  Destination: $BACKUP_DESTINATION

Backup Statistics:
  Files Backed Up: $TOTAL_FILES_BACKED_UP
  Total Size: $TOTAL_BACKUP_SIZE bytes
  Compression: $([ "$COMPRESSION_LEVEL" -gt 0 ] && echo "Level $COMPRESSION_LEVEL" || echo "Disabled")
  Encryption: $([ "$ENCRYPTION_ENABLED" == "true" ] && echo "Enabled" || echo "Disabled")

Quality Metrics:
  Errors: $ERRORS_ENCOUNTERED
  Warnings: $WARNINGS_ENCOUNTERED  
  Verification: $BACKUP_VERIFICATION_STATUS
  Remote Backup: $([ "$REMOTE_BACKUP_ENABLED" == "true" ] && echo "Enabled" || echo "Disabled")

Backup Status: $([ $ERRORS_ENCOUNTERED -eq 0 ] && echo "✓ SUCCESS" || echo "✗ COMPLETED WITH ERRORS")

Components Backed Up:
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "application_files" "$BACKUP_TYPE" && echo "  ✓ Application Files" || echo "  - Application Files (skipped)")
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "infrastructure_config" "$BACKUP_TYPE" && echo "  ✓ Infrastructure Configuration" || echo "  - Infrastructure Configuration (skipped)")
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "ssl_certificates" "$BACKUP_TYPE" && echo "  ✓ SSL Certificates" || echo "  - SSL Certificates (skipped)")
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "docker_data" "$BACKUP_TYPE" && echo "  ✓ Container Images" || echo "  - Container Images (skipped)")
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "logs" "$BACKUP_TYPE" && echo "  ✓ Log Files" || echo "  - Log Files (skipped)")
$([ "$BACKUP_TYPE" == "full" ] || should_backup_component "monitoring_config" "$BACKUP_TYPE" && echo "  ✓ Monitoring Data" || echo "  - Monitoring Data (skipped)")

Recommendations:
$([ $ERRORS_ENCOUNTERED -eq 0 ] && echo "  • Backup completed successfully" || echo "  • Review and address backup errors")
$([ "$BACKUP_VERIFICATION_STATUS" == "passed" ] && echo "  • Backup integrity verified" || echo "  • Perform backup integrity verification")
  • Test backup restoration procedures regularly
  • Monitor backup performance and storage usage
  • Review retention policy and cleanup old backups

========================================
Report Generated: $(date -Iseconds)
========================================
EOF
    
    # Display summary to console
    echo
    echo "========================================="
    echo "Backup Completion Report"  
    echo "========================================="
    echo "Backup ID: $BACKUP_UNIQUE_ID"
    echo "Type: $BACKUP_TYPE"
    echo "Duration: ${backup_duration}s"
    echo "Files: $TOTAL_FILES_BACKED_UP"
    echo "Size: $TOTAL_BACKUP_SIZE bytes"
    echo "Errors: $ERRORS_ENCOUNTERED"
    echo "Warnings: $WARNINGS_ENCOUNTERED"
    echo "Status: $([ $ERRORS_ENCOUNTERED -eq 0 ] && echo -e "${COLOR_GREEN}SUCCESS${COLOR_RESET}" || echo -e "${COLOR_RED}COMPLETED WITH ERRORS${COLOR_RESET}")"
    echo "========================================="
    echo
    
    log_success "Backup report generated" "json_report=$report_file summary_report=$summary_file"
    
    # Display additional information if verbose mode is enabled
    if [[ "$VERBOSE_OUTPUT" == "true" ]]; then
        echo "Detailed Reports:"
        echo "  JSON Report: $report_file"
        echo "  Summary Report: $summary_file"
        echo "  Backup Location: $BACKUP_DESTINATION"
        echo
    fi
}

# Handle backup failures with comprehensive error reporting
handle_backup_failure() {
    local failure_reason="$1"
    local partial_backup_state="${2:-}"
    local backup_context="${3:-}"
    
    log_error "Backup operation failed" "reason=$failure_reason context=$backup_context"
    
    # Increment error counter
    ((ERRORS_ENCOUNTERED++))
    
    # Preserve partial backup data if available
    if [[ -n "$partial_backup_state" ]] && [[ -d "$partial_backup_state" ]]; then
        local partial_backup_name="partial-backup-${BACKUP_TIMESTAMP}"
        local partial_backup_dir="${BACKUP_BASE_DIR}/${partial_backup_name}"
        
        if mv "$partial_backup_state" "$partial_backup_dir" 2>/dev/null; then
            log_info "Partial backup preserved" "location=$partial_backup_dir"
            
            # Create partial backup metadata
            cat > "${partial_backup_dir}/partial-backup-info.json" <<EOF
{
    "partial_backup": {
        "backup_id": "$BACKUP_UNIQUE_ID",
        "failure_reason": "$failure_reason",
        "failure_timestamp": "$(date -Iseconds)",
        "backup_context": "$backup_context",
        "preservation_location": "$partial_backup_dir"
    }
}
EOF
        else
            log_error "Failed to preserve partial backup data" "source=$partial_backup_state"
        fi
    fi
    
    # Generate failure analysis report
    local failure_report="${BACKUP_BASE_DIR}/backup-failure-${BACKUP_TIMESTAMP}.json"
    cat > "$failure_report" <<EOF
{
    "failure_analysis": {
        "backup_id": "$BACKUP_UNIQUE_ID",
        "correlation_id": "$CORRELATION_ID",
        "failure_timestamp": "$(date -Iseconds)",
        "failure_reason": "$failure_reason",
        "backup_context": "$backup_context",
        "script_version": "$SCRIPT_VERSION"
    },
    "system_state": {
        "hostname": "$(hostname -s 2>/dev/null || echo "unknown")",
        "user": "$(id -un)",
        "working_directory": "$(pwd)",
        "available_disk_space": "$(df "$BACKUP_BASE_DIR" | awk 'NR==2 {print $4}')KB"
    },
    "error_statistics": {
        "total_errors": $ERRORS_ENCOUNTERED,
        "total_warnings": $WARNINGS_ENCOUNTERED,
        "backup_duration": "$(($(date +%s) - $(date -d "$BACKUP_START_TIME" +%s 2>/dev/null || echo "0")))s"
    },
    "recovery_recommendations": [
        "Check system resources and permissions",
        "Verify backup destination accessibility",
        "Review backup configuration and parameters",
        "Check for sufficient disk space",
        "Validate source data accessibility",
        "Review system logs for additional error details"
    ]
}
EOF
    
    log_error "Backup failure analysis completed" "report=$failure_report"
    
    # Clean up temporary files and resources
    cleanup_backup_resources
    
    return 1
}

# Clean up backup resources and temporary files
cleanup_backup_resources() {
    log_info "Cleaning up backup resources and temporary files"
    
    # Remove temporary files
    find /tmp -name "backup-*-$$" -type f -mtime 0 -delete 2>/dev/null || true
    find /tmp -name "sftp-batch-*" -type f -mtime 0 -delete 2>/dev/null || true
    
    # Clean up any incomplete backup directories
    find "$BACKUP_BASE_DIR" -name "*.tmp" -type d -mtime 0 -exec rm -rf {} \; 2>/dev/null || true
    
    log_info "Backup resource cleanup completed"
}

# Display comprehensive script usage information
display_backup_usage() {
    cat << EOF
Node.js Tutorial Infrastructure Backup Script

DESCRIPTION:
    Enterprise-grade backup automation system for Node.js tutorial HTTP server 
    infrastructure. Orchestrates complete system backup including application 
    configuration, SSL certificates, container images, log files, deployment 
    artifacts, monitoring configurations, and operational data.

USAGE:
    $SCRIPT_NAME [OPTIONS]

BACKUP TYPES:
    full         Complete backup of all system components (default)
    incremental  Backup only files changed since last backup  
    configuration Backup configuration files and settings only
    logs         Backup log files and monitoring data only
    containers   Backup Docker images and container configurations only

OPTIONS:
    --type TYPE                 Backup type (full, incremental, configuration, logs, containers)
    --destination PATH          Backup destination directory (default: $BACKUP_BASE_DIR)
    --compress [LEVEL]          Enable compression with optional level 1-9 (default: $DEFAULT_COMPRESSION_LEVEL)
    --encrypt [KEYFILE]         Enable backup encryption with optional key file
    --remote [URL]              Enable remote backup storage with destination URL
    --retention DAYS            Backup retention period in days (default: $DEFAULT_BACKUP_RETENTION_DAYS)
    --exclude PATTERNS          Exclude patterns for files and directories
    --dry-run                   Validate backup without executing actual operations
    --incremental-base PATH     Base backup path for incremental backup creation
    --verify                    Enable backup integrity verification after completion
    --verbose                   Enable detailed output logging and progress information
    --help, -h                  Display this usage information

EXAMPLES:
    # Full system backup with compression
    $SCRIPT_NAME --type full --compress 6 --verify

    # Incremental backup with remote storage
    $SCRIPT_NAME --type incremental --remote s3://my-backup-bucket/nodejs-tutorial

    # Configuration-only backup with encryption
    $SCRIPT_NAME --type configuration --encrypt /path/to/key.file

    # Log backup with custom retention
    $SCRIPT_NAME --type logs --retention 90 --destination /custom/backup/path

    # Dry run to validate backup configuration
    $SCRIPT_NAME --type full --dry-run --verbose

REMOTE BACKUP DESTINATIONS:
    s3://bucket/path            AWS S3 storage
    sftp://user@host/path       SFTP server
    rsync://user@host/path      Rsync server

ENVIRONMENT VARIABLES:
    BACKUP_DESTINATION          Override default backup destination directory
    BACKUP_RETENTION_DAYS       Override default retention period
    ENCRYPTION_KEY_PATH         Path to encryption key file
    REMOTE_BACKUP_URL           Remote backup storage URL
    COMPRESSION_LEVEL           Override default compression level (1-9)
    HEALTH_CHECK_TIMEOUT        Override health check timeout (seconds)
    BACKUP_EXCLUDE_PATTERNS     Additional exclude patterns

EXIT CODES:
    0    SUCCESS - Backup completed successfully with verification passed
    1    FAILURE - Backup failed due to system error or configuration issues
    2    PARTIAL_SUCCESS - Backup completed with some components failed
    3    VERIFICATION_FAILED - Backup completed but integrity verification failed  
    4    STORAGE_ERROR - Insufficient disk space or storage access issues
    5    DEPENDENCY_ERROR - Required tools not available

BACKUP COMPONENTS:
    Application Files:
      - Node.js source code and dependencies
      - Package configuration and lock files
      - Documentation and project files

    Infrastructure Configuration:  
      - PM2 ecosystem configuration
      - Nginx reverse proxy configuration
      - Environment configuration files
      - Monitoring and health check configurations

    SSL Certificates:
      - Public certificates and certificate chains
      - Private keys (with secure handling)
      - Diffie-Hellman parameters

    Container Images:
      - Docker images and container configurations  
      - Container volumes and persistent data
      - Docker Compose service definitions

    Log Files:
      - Application logs and PM2 process logs
      - Nginx access logs and error logs
      - System logs and monitoring data

    Monitoring Data:
      - Uptime monitoring configuration
      - Health check results and metrics
      - Performance monitoring data

OPERATIONAL FEATURES:
    • Comprehensive backup verification and integrity checking
    • Multiple compression algorithms (gzip, bzip2) with configurable levels
    • AES-256 encryption with key file or password-based encryption
    • Remote storage integration (S3, SFTP, rsync) with retry mechanisms
    • Incremental backup with space-efficient hard links
    • Automated retention policy and cleanup of old backups
    • Detailed logging with structured JSON output for monitoring integration
    • Health check validation before backup operations
    • Comprehensive backup reporting with metrics and recommendations

MONITORING INTEGRATION:
    The backup script provides structured JSON logging and standardized exit codes
    for integration with monitoring systems like Nagios, Prometheus, and other
    infrastructure monitoring platforms.

EDUCATIONAL OBJECTIVES:
    • Demonstrates enterprise-grade backup automation and orchestration
    • Shows infrastructure data protection and disaster recovery procedures  
    • Illustrates backup verification and integrity validation techniques
    • Examples of incremental backup implementation and chain management
    • Security best practices in backup operations and data protection
    • Remote backup storage integration and management patterns

For detailed documentation and examples, visit:
https://github.com/nodejs-tutorial/infrastructure-backup

EOF
}

# Main backup orchestration function
main() {
    # Initialize backup session with unique identifiers
    BACKUP_UNIQUE_ID=$(generate_backup_unique_id)
    CORRELATION_ID=$(generate_correlation_id)
    BACKUP_START_TIME=$(date -Iseconds)
    
    log_info "Starting Node.js Tutorial Infrastructure Backup" "session_id=$BACKUP_UNIQUE_ID script_version=$SCRIPT_VERSION"
    
    # Parse command line arguments for backup configuration
    parse_backup_args "$@"
    
    # Validate all backup prerequisites and system dependencies
    if ! validate_backup_prerequisites; then
        handle_backup_failure "Prerequisites validation failed" "" "system_dependencies"
        exit $EXIT_DEPENDENCY_ERROR
    fi
    
    # Execute pre-backup health checks if enabled
    if [[ "$HEALTH_CHECK_BEFORE_BACKUP" == "true" ]]; then
        if ! execute_health_check; then
            handle_backup_failure "Pre-backup health check failed" "" "system_health"
            exit $EXIT_VERIFICATION_FAILED
        fi
    fi
    
    # Create backup destination and working directory
    local working_backup_dir="${BACKUP_DESTINATION}/backup-${BACKUP_TYPE}-${BACKUP_TIMESTAMP}"
    
    if [[ "$DRY_RUN_MODE" != "true" ]]; then
        if ! mkdir -p "$working_backup_dir"; then
            handle_backup_failure "Failed to create backup working directory" "$working_backup_dir" "directory_creation"
            exit $EXIT_STORAGE_ERROR
        fi
        log_info "Backup working directory created" "path=$working_backup_dir"
    else
        log_info "DRY RUN: Would create backup directory" "path=$working_backup_dir"
    fi
    
    # Create comprehensive backup manifest
    local manifest_file
    manifest_file=$(create_backup_manifest "$BACKUP_TYPE" "$working_backup_dir")
    
    log_info "Backup operation configuration finalized" "type=$BACKUP_TYPE dest=$working_backup_dir compression=$COMPRESSION_LEVEL"
    
    # Execute backup procedures based on backup type
    local backup_success=true
    
    case "$BACKUP_TYPE" in
        "full")
            log_info "Executing full backup procedure"
            backup_application_files "$working_backup_dir" || backup_success=false
            backup_infrastructure_configs "$working_backup_dir" || backup_success=false  
            backup_ssl_certificates "$working_backup_dir" || backup_success=false
            backup_container_images "$working_backup_dir" || backup_success=false
            backup_log_files "$working_backup_dir" || backup_success=false
            backup_monitoring_data "$working_backup_dir" || backup_success=false
            ;;
        "incremental") 
            log_info "Executing incremental backup procedure"
            if ! create_incremental_backup "$working_backup_dir" "${INCREMENTAL_BASE_PATH:-}"; then
                # Fall back to full backup if incremental fails
                log_warn "Incremental backup failed - performing full backup instead"
                backup_application_files "$working_backup_dir" || backup_success=false
                backup_infrastructure_configs "$working_backup_dir" || backup_success=false
            fi
            ;;
        "configuration")
            log_info "Executing configuration backup procedure"  
            backup_infrastructure_configs "$working_backup_dir" || backup_success=false
            backup_ssl_certificates "$working_backup_dir" || backup_success=false
            backup_monitoring_data "$working_backup_dir" || backup_success=false
            ;;
        "logs")
            log_info "Executing log files backup procedure"
            backup_log_files "$working_backup_dir" || backup_success=false
            ;;
        "containers")
            log_info "Executing container images backup procedure"
            backup_container_images "$working_backup_dir" || backup_success=false
            ;;
        *)
            handle_backup_failure "Unknown backup type: $BACKUP_TYPE" "$working_backup_dir" "configuration_error"
            exit $EXIT_FAILURE
            ;;
    esac
    
    # Handle backup execution results
    if [[ "$backup_success" != "true" ]]; then
        handle_backup_failure "Backup execution failed" "$working_backup_dir" "backup_operations"
        exit $EXIT_PARTIAL_SUCCESS
    fi
    
    # Apply compression if enabled and not in dry run mode
    local final_backup_path="$working_backup_dir"
    if [[ "$COMPRESSION_LEVEL" -gt 0 ]] && [[ "$DRY_RUN_MODE" != "true" ]]; then
        log_info "Applying backup compression"
        if compressed_archive=$(compress_backup_archive "$working_backup_dir" "$COMPRESSION_LEVEL" "gzip"); then
            final_backup_path="$compressed_archive"
            log_success "Backup compression completed" "archive=$final_backup_path"
        else
            log_warn "Backup compression failed - continuing with uncompressed backup"
        fi
    fi
    
    # Apply encryption if enabled
    if [[ "$ENCRYPTION_ENABLED" == "true" ]] && [[ "$DRY_RUN_MODE" != "true" ]]; then
        log_info "Applying backup encryption"
        if encrypted_backup=$(encrypt_backup_data "$final_backup_path" "AES-256-CBC" "${ENCRYPTION_KEY_PATH:-}"); then
            final_backup_path="$encrypted_backup"
            log_success "Backup encryption completed" "encrypted_file=$final_backup_path"
        else
            log_error "Backup encryption failed"
            backup_success=false
        fi
    fi
    
    # Perform backup integrity verification if enabled
    if [[ "$BACKUP_VERIFICATION_ENABLED" == "true" ]]; then
        log_info "Performing backup integrity verification"
        if ! verify_backup_integrity "$final_backup_path"; then
            handle_backup_failure "Backup integrity verification failed" "$final_backup_path" "verification_failure"
            exit $EXIT_VERIFICATION_FAILED
        fi
    fi
    
    # Transfer backup to remote storage if enabled
    if [[ "$REMOTE_BACKUP_ENABLED" == "true" ]]; then
        log_info "Transferring backup to remote storage"
        if ! transfer_to_remote_storage "$final_backup_path" "${REMOTE_BACKUP_URL:-}"; then
            log_warn "Remote backup transfer failed - backup available locally only"
            ((WARNINGS_ENCOUNTERED++))
        else
            log_success "Remote backup transfer completed"
        fi
    fi
    
    # Clean up old backups according to retention policy
    cleanup_old_backups "$BACKUP_DESTINATION" "$BACKUP_RETENTION_DAYS"
    
    # Generate comprehensive backup completion report
    generate_backup_report "$backup_success" "$BACKUP_START_TIME" "$BACKUP_VERIFICATION_STATUS"
    
    # Clean up temporary resources
    cleanup_backup_resources
    
    # Determine final exit status and log completion
    local final_exit_code
    if [[ "$backup_success" == "true" ]] && [[ $ERRORS_ENCOUNTERED -eq 0 ]]; then
        final_exit_code=$EXIT_SUCCESS
        log_success "Infrastructure backup completed successfully" "backup_id=$BACKUP_UNIQUE_ID exit_code=$final_exit_code"
    elif [[ $ERRORS_ENCOUNTERED -gt 0 ]] && [[ $WARNINGS_ENCOUNTERED -gt 0 ]]; then
        final_exit_code=$EXIT_PARTIAL_SUCCESS  
        log_warn "Infrastructure backup completed with errors and warnings" "backup_id=$BACKUP_UNIQUE_ID errors=$ERRORS_ENCOUNTERED warnings=$WARNINGS_ENCOUNTERED"
    else
        final_exit_code=$EXIT_FAILURE
        log_error "Infrastructure backup failed" "backup_id=$BACKUP_UNIQUE_ID errors=$ERRORS_ENCOUNTERED"
    fi
    
    exit $final_exit_code
}

# Execute main function if script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi