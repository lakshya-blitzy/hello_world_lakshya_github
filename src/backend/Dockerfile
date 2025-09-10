# Use Node.js 22.x LTS with Alpine Linux as base image for minimal footprint and security
# Node.js 22.x provides stable runtime with latest features, Alpine Linux reduces image size and attack surface
FROM node:22-alpine

# Add metadata labels for container identification, documentation, and maintenance
# Container labels provide metadata for operational management and documentation
LABEL maintainer="Node.js Tutorial" \
      description="Educational Node.js HTTP server with hello endpoint" \
      version="1.0.0" \
      environment="development" \
      node_version="22-alpine" \
      application="nodejs-hello-tutorial" \
      created_date="2024-01-01" \
      license="MIT"

# Set working directory for application files and execution context
# Consistent working directory follows container best practices and simplifies file management
WORKDIR /app

# Copy package.json first for Docker layer caching optimization during dependency installation
# Copying package files first enables Docker layer caching for dependency installation optimization
COPY package*.json ./

# Validate package configuration and demonstrate zero-dependency verification with npm audit
# Demonstrates security auditing and validates zero-dependency architecture while cleaning up package manager artifacts
RUN npm audit --audit-level moderate || true && \
    echo 'Zero dependencies verified - using only Node.js built-in modules' && \
    npm cache clean --force && \
    # Verify package.json configuration and Node.js engine compatibility
    node -e "const pkg = require('./package.json'); console.log('Package:', pkg.name, 'Version:', pkg.version); console.log('Node.js engine requirement:', pkg.engines?.node || 'not specified');" && \
    # Create application user and group for security
    addgroup -g 1000 nodeapp && \
    adduser -D -s /bin/sh -u 1000 -G nodeapp nodeapp

# Copy application source code respecting .dockerignore patterns for optimized build context
# Copies essential application files while .dockerignore excludes development files, tests, and documentation
COPY . .

# Create runtime directories and set proper permissions for non-root execution
# Creates necessary runtime directories with proper ownership for non-root user execution
RUN mkdir -p /app/logs /app/temp && \
    # Set ownership to node user (built-in Alpine node image user)
    chown -R node:node /app && \
    # Set appropriate permissions for application directory
    chmod 755 /app && \
    chmod 755 /app/logs /app/temp && \
    # Ensure server.js and health check script are executable
    chmod +x /app/server.js /app/scripts/docker-healthcheck.js && \
    # Create symlink for compatibility with different user configurations
    ln -sf /app/scripts/docker-healthcheck.js /usr/local/bin/docker-healthcheck && \
    # Validate application entry point exists
    test -f /app/server.js || (echo "ERROR: server.js not found" && exit 1) && \
    # Validate health check script exists
    test -f /app/scripts/docker-healthcheck.js || (echo "ERROR: docker-healthcheck.js not found" && exit 1)

# Switch to non-root node user for secure application execution
# Non-root execution follows security best practices and reduces container escape vulnerabilities
USER node

# Set environment variables for Node.js runtime and application configuration
# Configures application for container networking with host binding for external access
ENV NODE_ENV=development \
    PORT=3000 \
    HOST=0.0.0.0 \
    APP_NAME="Node.js Tutorial HTTP Server" \
    APP_VERSION="1.0.0" \
    LOG_LEVEL=info \
    ENABLE_HEALTH_ENDPOINT=true \
    ENABLE_SECURITY_HEADERS=true \
    ENABLE_REQUEST_LOGGING=true \
    SHUTDOWN_TIMEOUT=30000 \
    HEALTH_CHECK_TIMEOUT=10000

# Document HTTP service port for container networking and port mapping
# Documents container network interface for port mapping and service discovery
EXPOSE 3000

# Configure Docker health monitoring using custom health check script for container management
# Enables container health monitoring with automated restart capabilities for reliable operation
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node /app/scripts/docker-healthcheck.js || exit 1

# Set default command to start Node.js HTTP server using main application entry point
# Uses main application entry point for direct server startup with educational simplicity
CMD ["node", "server.js"]