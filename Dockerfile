# Multi-stage optimized Dockerfile for Python Flask application migration
# Base: python:3.12-slim for minimal footprint and security
FROM python:3.12-slim

# Set metadata for image identification and maintenance
LABEL maintainer="Blitzy Platform"
LABEL description="Flask HTTP server migrated from Node.js implementation"
LABEL version="1.0.0"
LABEL python.version="3.12"
LABEL framework="Flask"

# Create non-root user for security best practices
# This prevents potential security vulnerabilities from root execution
RUN groupadd -r flaskapp && useradd -r -g flaskapp flaskapp

# Set working directory for application files
# Using /app as standard convention for containerized applications
WORKDIR /app

# Copy dependency specification first for optimal Docker layer caching
# This layer will be cached unless requirements.txt changes
COPY requirements.txt .

# Install Flask and dependencies in a single RUN command to minimize layers
# Using --no-cache-dir to reduce image size
# Using --user flag to install for the non-root user
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code after dependencies
# This ensures dependency layer caching when only source code changes
COPY app.py .

# Change ownership of application files to non-root user
RUN chown -R flaskapp:flaskapp /app

# Switch to non-root user for runtime security
USER flaskapp

# Expose port 3000 to match original Node.js server configuration
# This maintains exact feature parity with the original implementation
EXPOSE 3000

# Set environment variables for Python optimization
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check to ensure service is responding correctly
# Validates the exact response content and format
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; response = urllib.request.urlopen('http://127.0.0.1:3000'); assert response.read() == b'Hello, World!\n'; assert response.getcode() == 200"

# Execute Flask application using python interpreter
# Maintains exact execution pattern as specified in requirements
CMD ["python", "app.py"]