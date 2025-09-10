/**
 * PM2 Ecosystem Configuration for Node.js Tutorial HTTP Server
 * 
 * Production-grade PM2 process management configuration for the Node.js tutorial HTTP server
 * application demonstrating comprehensive process clustering, environment-specific settings,
 * monitoring integration, and deployment automation strategies for scalable production operations.
 * 
 * This configuration defines multiple application environments (production, staging, development)
 * with optimized clustering strategies, health monitoring, resource management, log handling,
 * and deployment workflows while maintaining educational clarity for understanding enterprise-grade
 * Node.js application deployment patterns and PM2 process management capabilities.
 * 
 * Educational Features:
 * - Demonstrates PM2 cluster mode for horizontal scaling across multiple Node.js processes
 * - Shows environment-specific configuration management with production/staging/development setups
 * - Illustrates comprehensive logging strategies with rotation, formatting, and structured output
 * - Teaches health monitoring integration with automated restart policies and failure recovery
 * - Provides deployment automation examples with Git-based deployment workflows
 * - Demonstrates resource optimization through memory limits, CPU management, and performance tuning
 * 
 * Dependencies: PM2 v5.x for process management and clustering
 * Node.js Version: 22.x LTS (Active) 
 * Application Entry Point: ../../src/backend/server.js
 */

// Global application constants for consistent PM2 configuration across environments
const APPLICATION_NAME = 'nodejs-hello-tutorial';
const DEFAULT_INSTANCES = 0; // 0 = automatic instance count based on CPU cores
const DEFAULT_PORT = 3000;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RESTART_DELAY = 1000; // 1 second
const MAX_MEMORY_RESTART = '100M';
const LOG_RETENTION = 30; // days

/**
 * PM2 Applications Configuration
 * 
 * Defines multiple application instances for different deployment environments
 * with environment-specific optimizations for clustering, resource management,
 * monitoring, and operational requirements.
 */
const apps = [
    {
        // Production Application Configuration
        // Optimized for high availability, performance, and resource efficiency
        name: `${APPLICATION_NAME}-prod`,
        script: '../../src/backend/server.js',
        cwd: '/opt/nodejs-hello-tutorial',
        
        // Clustering and Process Management
        instances: DEFAULT_INSTANCES, // 0 = max CPU cores for optimal resource utilization
        exec_mode: 'cluster', // Cluster mode for load balancing across multiple processes
        instance_var: 'INSTANCE_ID', // Environment variable for instance identification
        
        // Memory and Resource Management
        max_memory_restart: MAX_MEMORY_RESTART, // Automatic restart if memory exceeds 100MB
        min_uptime: '10s', // Minimum uptime before considering instance stable
        max_restarts: 15, // Maximum restart attempts before stopping
        restart_delay: RESTART_DELAY, // Delay between restart attempts
        autorestart: true, // Automatic restart on crashes
        
        // File Watching and Change Detection (disabled for production)
        watch: false, // No file watching in production for performance
        ignore_watch: ['node_modules', 'logs', 'temp', 'coverage'],
        
        // Production Environment Variables
        env: {
            NODE_ENV: 'production',
            PORT: DEFAULT_PORT,
            HOST: '0.0.0.0', // Bind to all interfaces for production accessibility
            LOG_LEVEL: 'info',
            TIMEOUT: 120000, // 2 minutes request timeout
            KEEP_ALIVE_TIMEOUT: 5000, // 5 seconds keep-alive timeout
            MAX_CONNECTIONS: 1000, // Higher connection limit for production
            ENABLE_CLUSTERING: 'true',
            HEALTH_CHECK_INTERVAL: HEALTH_CHECK_INTERVAL
        },
        
        // Production-specific environment overrides
        env_production: {
            NODE_ENV: 'production',
            PORT: DEFAULT_PORT,
            HOST: '0.0.0.0',
            LOG_LEVEL: 'info',
            TIMEOUT: 120000,
            KEEP_ALIVE_TIMEOUT: 5000,
            MAX_CONNECTIONS: 1000,
            PERFORMANCE_MONITORING: 'enabled',
            SECURITY_HEADERS: 'enabled'
        },
        
        // Comprehensive Logging Configuration
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // ISO timestamp format
        error_file: '/var/log/nodejs-hello-tutorial/error.log',
        out_file: '/var/log/nodejs-hello-tutorial/access.log',
        log_file: '/var/log/nodejs-hello-tutorial/combined.log',
        merge_logs: true, // Merge logs from all instances
        log_type: 'json', // Structured JSON logging for production
        
        // Advanced Process Configuration
        wait_ready: true, // Wait for application ready signal
        listen_timeout: 8000, // Timeout for port binding
        kill_timeout: 5000, // Timeout for graceful shutdown
        
        // Node.js Performance Optimization
        node_args: [
            '--max-old-space-size=128', // Limit V8 old space to 128MB
            '--gc-interval=100', // Garbage collection interval
            '--expose-gc' // Expose garbage collection for monitoring
        ],
        
        // PM2 Plus/Enterprise Integration (disabled for tutorial)
        pmx: false, // Disable PM2 Plus monitoring for simplicity
        
        // Process User and Security
        uid: 'nodejs-app', // Run as dedicated user account
        gid: 'nodejs-app', // Run as dedicated group
        
        // Health Monitoring Integration
        health_check_grace_period: 30000, // Grace period after restart
        health_check_fatal_exceptions: true // Restart on fatal exceptions
    },
    
    {
        // Staging Application Configuration  
        // Balanced configuration for testing and validation with production-like settings
        name: `${APPLICATION_NAME}-staging`,
        script: '../../src/backend/server.js',
        cwd: '/opt/nodejs-hello-tutorial',
        
        // Moderate clustering for staging environment
        instances: 1, // Single instance for staging simplicity
        exec_mode: 'fork', // Fork mode for easier debugging
        
        // Resource Management for Staging
        max_memory_restart: '50M', // Lower memory limit for staging
        min_uptime: '5s', // Shorter minimum uptime
        max_restarts: 10, // Fewer restart attempts
        restart_delay: 500, // Faster restart for testing
        autorestart: true,
        
        // File watching disabled for staging
        watch: false,
        ignore_watch: ['node_modules', 'logs', 'temp', 'coverage'],
        
        // Staging Environment Variables
        env: {
            NODE_ENV: 'staging',
            PORT: 3001, // Different port to avoid conflicts
            HOST: '0.0.0.0',
            LOG_LEVEL: 'debug', // More verbose logging for staging
            TIMEOUT: 60000, // Shorter timeout for faster testing
            KEEP_ALIVE_TIMEOUT: 5000,
            MAX_CONNECTIONS: 500, // Moderate connection limit
            HEALTH_CHECK_INTERVAL: HEALTH_CHECK_INTERVAL
        },
        
        // Staging-specific environment settings
        env_staging: {
            NODE_ENV: 'staging',
            PORT: 3001,
            HOST: '0.0.0.0',
            LOG_LEVEL: 'debug',
            TIMEOUT: 60000,
            KEEP_ALIVE_TIMEOUT: 5000,
            MAX_CONNECTIONS: 500,
            TESTING_MODE: 'enabled',
            DEBUG_LOGGING: 'enabled'
        },
        
        // Staging Logging Configuration
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: '/var/log/nodejs-hello-tutorial/staging-error.log',
        out_file: '/var/log/nodejs-hello-tutorial/staging-access.log',  
        log_file: '/var/log/nodejs-hello-tutorial/staging-combined.log',
        merge_logs: true,
        log_type: 'json', // Structured logging for staging analysis
        
        // Staging Process Configuration
        wait_ready: false, // No wait for ready signal in staging
        listen_timeout: 3000, // Faster timeout for staging
        kill_timeout: 2000,
        
        // Reduced Node.js optimization for staging
        node_args: ['--max-old-space-size=64'],
        
        // Staging monitoring configuration
        pmx: false,
        uid: 'nodejs-app',
        gid: 'nodejs-app'
    },
    
    {
        // Development Application Configuration
        // Optimized for development workflow with hot reloading and extensive logging
        name: `${APPLICATION_NAME}-dev`,
        script: '../../src/backend/server.js',
        cwd: '/opt/nodejs-hello-tutorial',
        
        // Development Process Management
        instances: 1, // Single instance for development simplicity
        exec_mode: 'fork', // Fork mode for easier debugging and development
        
        // Relaxed resource management for development
        max_memory_restart: '30M', // Low memory limit for development
        min_uptime: '1s', // Very short uptime requirement
        max_restarts: 5, // Limited restarts for development
        restart_delay: 100, // Fast restart for development iteration
        autorestart: true,
        
        // File Watching and Hot Reloading
        watch: true, // Enable file watching for development
        watch_delay: 1000, // 1 second delay before restart
        ignore_watch: [
            'node_modules',
            'logs',
            'temp',
            'coverage',
            'test',
            '.git',
            'docs'
        ],
        
        // Development Environment Variables
        env: {
            NODE_ENV: 'development',
            PORT: DEFAULT_PORT,
            HOST: '127.0.0.1', // Localhost only for development security
            LOG_LEVEL: 'debug', // Verbose logging for development
            TIMEOUT: 30000, // Short timeout for faster development feedback
            KEEP_ALIVE_TIMEOUT: 1000,
            MAX_CONNECTIONS: 50, // Lower connection limit for development
            HEALTH_CHECK_INTERVAL: HEALTH_CHECK_INTERVAL,
            HOT_RELOAD: 'enabled'
        },
        
        // Development-specific environment overrides
        env_development: {
            NODE_ENV: 'development',
            PORT: DEFAULT_PORT,
            HOST: '127.0.0.1',
            LOG_LEVEL: 'debug',
            TIMEOUT: 30000,
            KEEP_ALIVE_TIMEOUT: 1000,
            MAX_CONNECTIONS: 50,
            DEVELOPMENT_MODE: 'enabled',
            DEBUG_MODE: 'enabled',
            FILE_WATCHING: 'enabled'
        },
        
        // Development Logging Configuration
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: './logs/dev-error.log', // Relative paths for development
        out_file: './logs/dev-access.log',
        log_file: './logs/dev-combined.log',
        merge_logs: false, // Separate logs for development analysis
        log_type: 'text', // Human-readable text format for development
        
        // Development Process Configuration
        wait_ready: false, // No wait for ready signal in development
        listen_timeout: 1000, // Fast timeout for development
        kill_timeout: 1000,
        
        // Minimal Node.js optimization for development
        node_args: ['--inspect'], // Enable Node.js debugger
        
        // Development monitoring (disabled for simplicity)
        pmx: false,
        
        // Development user permissions (optional)
        // uid: 'developer', // Uncomment if running as specific user
        // gid: 'developer'
    }
];

/**
 * PM2 Deployment Configuration
 * 
 * Defines automated deployment workflows for production and staging environments
 * with Git-based deployment, SSH connectivity, and post-deployment automation.
 */
const deploy = {
    // Production Deployment Configuration
    production: {
        user: 'deploy', // SSH user for deployment
        host: ['production-server-1', 'production-server-2'], // Multiple production servers
        ref: 'origin/main', // Deploy from main branch
        repo: 'git@github.com:tutorial/nodejs-hello-tutorial.git', // Git repository URL
        path: '/opt/nodejs-hello-tutorial', // Deployment path on server
        ssh_options: 'StrictHostKeyChecking=no', // SSH connection options
        
        // Pre-deployment setup commands
        'pre-setup': [
            'sudo mkdir -p /opt/nodejs-hello-tutorial',
            'sudo chown deploy:deploy /opt/nodejs-hello-tutorial',
            'sudo mkdir -p /var/log/nodejs-hello-tutorial',
            'sudo chown deploy:deploy /var/log/nodejs-hello-tutorial'
        ].join(' && '),
        
        // Post-setup commands (run once after initial deployment)
        'post-setup': [
            'npm install --production',
            'pm2 reload ecosystem.config.js --env production',
            'pm2 save'
        ].join(' && '),
        
        // Post-deployment commands (run after each deployment)
        'post-deploy': [
            'npm install --production',
            'pm2 reload ecosystem.config.js --env production',
            'pm2 save',
            'pm2 logs --lines 50'
        ].join(' && '),
        
        // Pre-deployment validation
        'pre-deploy-local': [
            'npm test',
            'npm run lint',
            'echo "Pre-deployment validation passed"'
        ].join(' && ')
    },
    
    // Staging Deployment Configuration
    staging: {
        user: 'deploy',
        host: 'staging-server', // Single staging server
        ref: 'origin/develop', // Deploy from develop branch
        repo: 'git@github.com:tutorial/nodejs-hello-tutorial.git',
        path: '/opt/nodejs-hello-tutorial',
        ssh_options: 'StrictHostKeyChecking=no',
        
        // Staging pre-setup
        'pre-setup': [
            'sudo mkdir -p /opt/nodejs-hello-tutorial',
            'sudo chown deploy:deploy /opt/nodejs-hello-tutorial',
            'sudo mkdir -p /var/log/nodejs-hello-tutorial',
            'sudo chown deploy:deploy /var/log/nodejs-hello-tutorial'
        ].join(' && '),
        
        // Staging post-setup (includes development dependencies)
        'post-setup': [
            'npm install', // Include dev dependencies for staging
            'pm2 reload ecosystem.config.js --env staging',
            'pm2 save'
        ].join(' && '),
        
        // Staging post-deployment
        'post-deploy': [
            'npm install',
            'npm run test', // Run tests in staging
            'pm2 reload ecosystem.config.js --env staging',
            'pm2 save',
            'pm2 logs --lines 50'
        ].join(' && '),
        
        // Staging pre-deployment validation
        'pre-deploy-local': [
            'npm test',
            'echo "Staging pre-deployment validation passed"'
        ].join(' && ')
    }
};

/**
 * Complete PM2 Ecosystem Export
 * 
 * Exports the complete PM2 ecosystem configuration including applications
 * and deployment configurations for use by PM2 process manager.
 */
module.exports = {
    // Application definitions for different environments
    apps,
    
    // Deployment configurations for automation
    deploy
};

/**
 * PM2 Usage Examples and Commands:
 * 
 * Production Deployment:
 * pm2 start ecosystem.config.js --env production
 * pm2 reload ecosystem.config.js --env production
 * pm2 deploy production setup    # Initial deployment setup
 * pm2 deploy production          # Deploy latest changes
 * 
 * Staging Deployment: 
 * pm2 start ecosystem.config.js --env staging
 * pm2 reload ecosystem.config.js --env staging
 * pm2 deploy staging setup      # Initial staging setup
 * pm2 deploy staging            # Deploy to staging
 * 
 * Development:
 * pm2 start ecosystem.config.js --env development
 * pm2 logs nodejs-hello-tutorial-dev --follow
 * 
 * Monitoring and Management:
 * pm2 status                    # View all processes
 * pm2 logs                      # View all logs
 * pm2 monit                     # Real-time monitoring
 * pm2 reload all                # Reload all processes
 * pm2 stop all                  # Stop all processes
 * pm2 delete all                # Delete all processes
 * 
 * Health Monitoring:
 * pm2 describe nodejs-hello-tutorial-prod  # Process details
 * pm2 logs nodejs-hello-tutorial-prod     # Process logs
 * pm2 restart nodejs-hello-tutorial-prod  # Restart specific process
 * 
 * Cluster Management:
 * pm2 scale nodejs-hello-tutorial-prod 4  # Scale to 4 instances
 * pm2 scale nodejs-hello-tutorial-prod +2 # Add 2 more instances
 * pm2 reload nodejs-hello-tutorial-prod   # Reload without downtime
 * 
 * Log Management:
 * pm2 logs --lines 100          # View last 100 log lines
 * pm2 flush                     # Clear all logs
 * pm2 reloadLogs                # Reload log configuration
 * 
 * Process Persistence:
 * pm2 save                      # Save current process list
 * pm2 resurrect                 # Restore saved processes
 * pm2 startup                   # Generate startup script
 * 
 * Educational Notes:
 * 
 * Clustering Strategy:
 * - Production uses cluster mode with automatic instance scaling based on CPU cores
 * - Staging uses single fork instance for simplified testing and debugging  
 * - Development uses single fork with file watching for rapid development iteration
 * 
 * Environment Configuration:
 * - Each environment has optimized settings for its specific use case
 * - Resource limits are adjusted based on expected load and available resources
 * - Logging strategies vary from human-readable development logs to structured production JSON
 * 
 * Deployment Automation:
 * - Git-based deployment with branch-specific targeting (main for production, develop for staging)
 * - Automated dependency installation and process reloading
 * - Pre and post-deployment hooks for validation and cleanup
 * 
 * Operational Excellence:
 * - Comprehensive logging with rotation and structured output for analysis
 * - Health monitoring integration with automated restart policies
 * - Resource optimization through memory limits and performance tuning
 * - Security considerations through user isolation and resource constraints
 */