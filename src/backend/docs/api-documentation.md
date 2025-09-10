# Node.js Tutorial HTTP Server API Documentation

## Table of Contents

1. [API Overview](#api-overview)
2. [Getting Started](#getting-started)
3. [Endpoints](#endpoints)
4. [Request/Response Format](#requestresponse-format)
5. [Error Handling](#error-handling)
6. [Security](#security)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Performance](#performance)
9. [Examples](#examples)
10. [Educational Resources](#educational-resources)

## API Overview

### Introduction

The Node.js Tutorial HTTP Server API is an educational REST API designed to demonstrate fundamental HTTP server concepts using Node.js built-in modules. This API serves as a practical learning resource for developers new to Node.js web development, showcasing essential patterns including request routing, response generation, error handling, and health monitoring.

### Version Information

- **API Version**: 1.0.0
- **API Title**: Node.js Tutorial HTTP Server API
- **Node.js Version**: 22.x LTS (Active)
- **JavaScript Standard**: ES2023
- **Dependencies**: Zero external dependencies (Node.js built-ins only)

### Base URL

```
http://localhost:3000
```

### Content Types

- **Request Content-Type**: `application/json`, `text/plain`
- **Response Content-Type**: `text/plain; charset=utf-8`, `application/json`

### Authentication

No authentication required. This is an educational API designed for learning purposes.

## Getting Started

### Prerequisites

- Node.js 18+ (22.x LTS recommended)
- Basic understanding of HTTP protocols
- Terminal or command-line interface access

### Installation

1. Clone or download the tutorial application
2. Navigate to the project directory
3. No additional dependencies to install (zero external dependencies)

### Running the Server

```bash
node src/backend/lib/http-server.js
```

Or using the configured startup script:

```bash
npm start
```

### Basic Usage

Once the server is running, you can test the API endpoints:

```bash
# Test the hello endpoint
curl http://localhost:3000/hello

# Test the health check endpoint
curl http://localhost:3000/health
```

### Testing the API

The server provides immediate feedback and comprehensive logging for all requests. Monitor the console output to understand request processing flow and performance characteristics.

## Endpoints

### Hello Endpoint

#### `GET /hello`

**Summary**: Hello World Endpoint - Primary Educational Demonstration

**Description**: Returns a simple "Hello world" message demonstrating the basic HTTP request-response cycle, endpoint routing, and response generation using Node.js built-in HTTP module. This endpoint showcases fundamental server-side development concepts including request handling, response formatting, and performance monitoring.

**Parameters**:
- **Query Parameters**: None
- **Path Parameters**: None
- **Headers**:
  - `User-Agent` (optional): Client user agent string for logging and analytics purposes

**Responses**:

**200 OK - Successful Response**
```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: Wed, 15 Jan 2024 10:30:00 GMT
Connection: keep-alive
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0

Hello world
```

**405 Method Not Allowed - Unsupported HTTP Method**
```http
HTTP/1.1 405 Method Not Allowed
Allow: GET
Content-Type: text/plain; charset=utf-8
Content-Length: 18
Date: Wed, 15 Jan 2024 10:30:00 GMT
Connection: keep-alive
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0

Method Not Allowed
```

**Example Requests**:

```bash
# Basic GET request
curl -X GET http://localhost:3000/hello

# Request with custom User-Agent
curl -X GET \
  -H "User-Agent: Educational-Client/1.0" \
  http://localhost:3000/hello

# Verbose request showing full HTTP exchange
curl -v http://localhost:3000/hello
```

**Response Time Target**: < 100ms for optimal user experience

### Health Check Endpoint

#### `GET /health`

**Summary**: Health Check Endpoint - System Health Monitoring

**Description**: Returns comprehensive application and system health status in JSON format for monitoring systems, load balancers, and operational visibility. This endpoint provides detailed health information including server status, system resources, process metrics, and performance indicators.

**Parameters**:
- **Query Parameters**: None
- **Path Parameters**: None
- **Headers**:
  - `User-Agent` (optional): Client user agent string for monitoring system identification

**Responses**:

**200 OK - Healthy System Status**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache, no-store, must-revalidate
X-Health-Check: nodejs-tutorial
X-Content-Type-Options: nosniff
Date: Wed, 15 Jan 2024 10:30:00 GMT
Connection: keep-alive

{
  "status": "healthy",
  "score": 100,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "execution_time_ms": 45,
  "correlation_id": "health-1705316200000-abc123",
  "server": {
    "status": "healthy",
    "uptime_ms": 3600000,
    "port": 3000,
    "environment": "development",
    "nodeVersion": "v22.0.0",
    "platform": "linux",
    "arch": "x64"
  },
  "system": {
    "status": "healthy",
    "memory": {
      "usage_percent": 25,
      "used_mb": 45,
      "total_mb": 512,
      "heap_used_mb": 12,
      "external_mb": 2
    },
    "cpu": {
      "usage_percent": 15,
      "load_average": [0.5, 0.4, 0.3]
    },
    "disk": {
      "usage_percent": 60,
      "available_mb": 2048
    }
  },
  "process": {
    "status": "healthy",
    "pid": 12345,
    "uptime_ms": 3600000,
    "memory": {
      "heap_used_mb": 12,
      "heap_total_mb": 25,
      "external_mb": 2,
      "rss_mb": 45
    },
    "event_loop_lag_ms": 2,
    "gc_stats": null
  },
  "performance": {
    "status": "healthy",
    "response_time_ms": 25,
    "throughput_rps": 50,
    "error_rate_percent": 0,
    "concurrent_requests": 1
  },
  "metrics": {
    "total_requests": 150,
    "success_rate_percent": 100,
    "active_connections": 1,
    "avg_response_time_ms": 25,
    "memory_usage_mb": 45,
    "cpu_usage_percent": 15,
    "uptime_seconds": 3600
  },
  "alerts": [],
  "recommendations": [],
  "metadata": {
    "endpoint_version": "1.0.0",
    "schema_version": "2024-01",
    "cache_hit": false,
    "health_check_timeout_ms": 10000,
    "response_cache_ttl_ms": 5000
  }
}
```

**503 Service Unavailable - Degraded or Unhealthy System**
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Cache-Control: no-cache, no-store, must-revalidate
X-Health-Check: nodejs-tutorial
X-Content-Type-Options: nosniff

{
  "status": "unhealthy",
  "score": 25,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "execution_time_ms": 150,
  "correlation_id": "health-1705316200000-def456",
  "server": {
    "status": "degraded",
    "uptime_ms": 7200000
  },
  "system": {
    "status": "unhealthy",
    "memory": {
      "usage_percent": 85,
      "used_mb": 435
    }
  },
  "alerts": [
    "High memory usage detected",
    "System performance degraded"
  ],
  "recommendations": [
    "Check system resources",
    "Consider restarting services"
  ]
}
```

**Example Requests**:

```bash
# Basic health check
curl -X GET http://localhost:3000/health

# Health check with monitoring user agent
curl -X GET \
  -H "User-Agent: Monitoring-System/2.1" \
  http://localhost:3000/health

# Pretty-printed JSON response
curl -X GET http://localhost:3000/health | jq '.'
```

**Response Time Target**: < 200ms including comprehensive health checks

**Health Status Values**:
- `healthy`: All systems operational and functioning normally
- `degraded`: Some non-critical systems experiencing issues
- `unhealthy`: Critical systems failing or unavailable

**Health Score Range**: 0-100 (higher values indicate better system health)

## Request/Response Format

### HTTP Methods

**Supported Methods**:
- `GET`: Retrieve data from endpoints
- `HEAD`: Retrieve headers only (health endpoint)
- `OPTIONS`: CORS preflight requests (disabled in tutorial)

**Unsupported Methods**:
- `POST`, `PUT`, `DELETE`, `PATCH`: Return `405 Method Not Allowed`

### Request Headers

**Standard Headers**:
- `Host`: Target host (automatically set by HTTP clients)
- `User-Agent`: Client identification (optional, used for logging)
- `Accept`: Acceptable response content types
- `Connection`: Connection management (keep-alive supported)

**Custom Headers**:
- `X-Correlation-ID`: Request correlation tracking (optional)

### Response Headers

**Standard Headers** (all responses):
- `Content-Type`: Response content type and charset
- `Content-Length`: Response body size in bytes
- `Date`: Response generation timestamp (RFC 7231 format)
- `Connection`: Connection handling directive
- `Server`: Server identification string

**Security Headers** (all responses):
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking attacks
- `X-XSS-Protection: 0`: Disables legacy XSS protection

**Health Endpoint Specific Headers**:
- `Cache-Control: no-cache, no-store, must-revalidate`: Prevents caching
- `X-Health-Check: nodejs-tutorial`: Health endpoint identification

### Content Types

**Request Content Types**:
- Requests typically do not include bodies (GET requests)
- `application/json` accepted for future extension
- `text/plain` accepted for simple requests

**Response Content Types**:
- Hello endpoint: `text/plain; charset=utf-8`
- Health endpoint: `application/json`
- Error responses: `text/plain; charset=utf-8`

## Error Handling

### Error Response Format

All errors follow a consistent plain text format for educational clarity and HTTP compliance. Error responses include appropriate status codes, descriptive messages, and security-conscious information disclosure.

### HTTP Status Codes

#### 400 Bad Request
**Description**: Invalid request format, malformed headers, or request validation failure

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 11

Bad Request
```

**Common Causes**:
- Malformed HTTP request structure
- Invalid headers or header values
- Request validation failure

#### 404 Not Found
**Description**: Requested endpoint or resource does not exist on the server

```http
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 9

Not Found
```

**Common Causes**:
- Invalid endpoint path (e.g., `/helllo` instead of `/hello`)
- Typo in URL
- Accessing undefined resources

#### 405 Method Not Allowed
**Description**: HTTP method not supported for the requested endpoint

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET
Content-Type: text/plain; charset=utf-8
Content-Length: 18

Method Not Allowed
```

**Common Causes**:
- Using POST on GET-only endpoints
- Attempting unsupported HTTP methods
- Method name misspelling

#### 500 Internal Server Error
**Description**: Unexpected server error during request processing

```http
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 21

Internal Server Error
```

**Common Causes**:
- Server component failure
- Unexpected exception in request processing
- System resource exhaustion

#### 503 Service Unavailable
**Description**: Server temporarily unable to handle requests

```http
HTTP/1.1 503 Service Unavailable
Content-Type: text/plain; charset=utf-8
Content-Length: 19

Service Unavailable
```

**Common Causes**:
- Server maintenance mode
- Resource overload or exhaustion
- System health degradation

### Error Security Considerations

**Information Disclosure Prevention**:
- Generic error messages prevent system information leakage
- Stack traces never exposed to clients
- Internal error details logged separately from client responses
- Sensitive configuration data excluded from error responses

**Correlation Tracking**:
- Internal error logging includes correlation IDs for debugging
- Detailed error information available in server logs
- Client receives safe, generic error messages

## Security

### Security Headers

The API implements essential security headers to protect against common web vulnerabilities:

#### X-Content-Type-Options: nosniff
**Purpose**: Prevents browsers from MIME-type sniffing responses away from declared Content-Type
**Security Benefit**: Reduces risk of content type confusion attacks

#### X-Frame-Options: DENY
**Purpose**: Prevents the page from being embedded in frames or iframes
**Security Benefit**: Protects against clickjacking attacks

#### X-XSS-Protection: 0
**Purpose**: Disables legacy XSS protection as it can create vulnerabilities
**Security Benefit**: Avoids false sense of security and potential XSS bypass techniques

### Input Validation

**HTTP Method Validation**: Only GET methods accepted; all others return `405 Method Not Allowed`

**Path Validation**: Exact string matching for defined routes prevents path traversal attacks

**Header Validation**: Basic header validation to prevent malformed requests

**Query Parameter Handling**: No query parameters processed, reducing attack surface

### Information Disclosure Prevention

**Error Message Sanitization**: Generic error messages prevent system information leakage

**Stack Trace Filtering**: Stack traces never exposed to clients in any environment

**System Information Protection**: Health endpoint excludes sensitive configuration details

**Log Data Separation**: Detailed error information logged internally but not exposed to clients

### Rate Limiting

Rate limiting is disabled in the tutorial configuration for educational simplicity. In production environments, implement appropriate rate limiting based on your requirements:

```javascript
// Example rate limiting configuration (not active in tutorial)
rateLimiting: {
  enabled: false,              // Disabled for tutorial
  windowMs: 60000,             // 1 minute window
  maxRequests: 100,            // 100 requests per minute
  skipSuccessfulRequests: false,
  skipFailedRequests: false
}
```

## Monitoring & Health Checks

### Health Check Integration

**Monitoring Systems**: Compatible with Prometheus, Datadog, New Relic, and other monitoring platforms

**Load Balancer Integration**: HTTP status codes support standard load balancer health checking
- `200 OK`: Instance healthy, include in rotation
- `503 Service Unavailable`: Instance unhealthy, remove from rotation

**Alerting Integration**: Health status changes can trigger monitoring system alerts

**Dashboard Compatibility**: Health metrics formatted for monitoring dashboard consumption

### Health Response Schema

The health endpoint returns a comprehensive JSON object with the following structure:

```json
{
  "status": "healthy|degraded|unhealthy",
  "score": 0-100,
  "timestamp": "ISO 8601 datetime",
  "execution_time_ms": "number",
  "correlation_id": "unique request identifier",
  "server": {
    "status": "component health status",
    "uptime_ms": "server uptime in milliseconds",
    "port": "listening port number",
    "environment": "deployment environment",
    "nodeVersion": "Node.js version",
    "platform": "operating system platform",
    "arch": "system architecture"
  },
  "system": {
    "status": "system resource health",
    "memory": {
      "usage_percent": "memory utilization percentage",
      "used_mb": "memory usage in megabytes",
      "total_mb": "total available memory",
      "heap_used_mb": "Node.js heap usage",
      "external_mb": "external memory usage"
    },
    "cpu": {
      "usage_percent": "CPU utilization percentage",
      "load_average": "system load averages [1m, 5m, 15m]"
    },
    "disk": {
      "usage_percent": "disk utilization percentage",
      "available_mb": "available disk space"
    }
  },
  "process": {
    "status": "Node.js process health",
    "pid": "process identifier",
    "uptime_ms": "process uptime",
    "memory": "process memory metrics",
    "event_loop_lag_ms": "event loop responsiveness",
    "gc_stats": "garbage collection statistics"
  },
  "performance": {
    "status": "application performance health",
    "response_time_ms": "average response time",
    "throughput_rps": "requests per second",
    "error_rate_percent": "error rate percentage",
    "concurrent_requests": "active concurrent requests"
  },
  "metrics": "comprehensive application metrics",
  "alerts": "array of active alerts",
  "recommendations": "array of improvement suggestions",
  "metadata": "endpoint metadata and configuration"
}
```

### Logging Integration

**Request Logging**: All requests logged with correlation IDs for tracking and debugging

**Performance Logging**: Response times and performance metrics tracked for analysis

**Error Logging**: Comprehensive error logging with context for troubleshooting

**Health Check Logging**: Health check executions logged for monitoring effectiveness

## Performance

### Response Time Targets

**Hello Endpoint**: < 100ms target response time for optimal user experience

**Health Endpoint**: < 200ms target response time including comprehensive health checks

**Error Responses**: < 50ms target response time for consistent performance

### Throughput Capabilities

**Concurrent Connections**: 100+ simultaneous connections supported on standard hardware

**Requests Per Second**: 1000+ RPS capability for hello endpoint under normal conditions

**Health Check Performance**: 50+ health checks per second with caching optimization

### Resource Utilization

**Memory Footprint**: < 50MB memory usage during normal operation

**CPU Usage**: < 50% CPU utilization under typical load conditions

**Network Efficiency**: Keep-alive connections for improved network performance

### Performance Monitoring

The server includes built-in performance monitoring with the following metrics:

- Request processing times with microsecond precision
- Memory usage tracking (heap and RSS)
- Event loop lag monitoring
- Request throughput measurement
- Error rate calculation
- Resource utilization tracking

## Examples

### cURL Examples

#### Basic Hello Endpoint Request
```bash
curl -X GET http://localhost:3000/hello
# Expected Response: Hello world
```

#### Hello Endpoint with Verbose Output
```bash
curl -v http://localhost:3000/hello
# Shows: HTTP headers, status code, and response body
```

#### Health Check Request
```bash
curl -X GET http://localhost:3000/health
# Expected Response: JSON health status object
```

#### Health Check with Pretty JSON
```bash
curl -X GET http://localhost:3000/health | jq '.'
# Returns formatted JSON health status
```

#### Error Scenario - Invalid Endpoint
```bash
curl -X GET http://localhost:3000/invalid
# Expected Response: HTTP/1.1 404 Not Found
```

#### Error Scenario - Unsupported Method
```bash
curl -X POST http://localhost:3000/hello
# Expected Response: HTTP/1.1 405 Method Not Allowed
```

### JavaScript Examples

#### Hello Endpoint with Fetch API
```javascript
fetch('http://localhost:3000/hello')
  .then(response => response.text())
  .then(data => console.log(data));
// Expected Output: Hello world
```

#### Health Check with JSON Parsing
```javascript
fetch('http://localhost:3000/health')
  .then(response => response.json())
  .then(health => {
    console.log(`Server Status: ${health.status}`);
    console.log(`Health Score: ${health.score}/100`);
    console.log(`Uptime: ${health.server.uptime_ms}ms`);
  });
```

#### Error Handling Example
```javascript
fetch('http://localhost:3000/hello', { method: 'POST' })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  })
  .catch(error => console.error('Request failed:', error));
// Expected Error: HTTP 405: Method Not Allowed
```

#### Async/Await Pattern
```javascript
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:3000/health');
    const health = await response.json();
    
    if (health.status === 'healthy') {
      console.log('✅ Server is healthy');
    } else {
      console.log('⚠️ Server health issues detected');
      console.log('Alerts:', health.alerts);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

checkServerHealth();
```

### HTTP Client Examples

#### Python with requests
```python
import requests

# Hello endpoint
response = requests.get('http://localhost:3000/hello')
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Health check
health_response = requests.get('http://localhost:3000/health')
health_data = health_response.json()
print(f"Health Status: {health_data['status']}")
print(f"Server Uptime: {health_data['server']['uptime_ms']}ms")
```

#### Node.js with built-in http
```javascript
import http from 'node:http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/hello',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(`Response: ${data}`));
});

req.on('error', (error) => console.error('Request error:', error));
req.end();
```

### Integration Examples

#### Load Balancer Health Check (nginx)
```nginx
upstream tutorial_servers {
    server localhost:3000;
}

server {
    location / {
        proxy_pass http://tutorial_servers;
        
        # Health check configuration
        health_check uri=/health match=server_ok;
    }
}

match server_ok {
    status 200;
    header Content-Type ~ "application/json";
    body ~ "\"status\": *\"healthy\"";
}
```

#### Docker Health Check
```dockerfile
FROM node:22-alpine

COPY . /app
WORKDIR /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/backend/lib/http-server.js"]
```

#### Monitoring Script
```bash
#!/bin/bash
# monitoring.sh - Simple health monitoring script

while true; do
    health_status=$(curl -s http://localhost:3000/health | jq -r '.status')
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ "$health_status" = "healthy" ]; then
        echo "[$timestamp] ✅ Server is healthy"
    else
        echo "[$timestamp] ⚠️ Server health: $health_status"
        # Send alert notification here
    fi
    
    sleep 30
done
```

## Educational Resources

### Learning Objectives

This API demonstrates the following Node.js and HTTP server concepts:

1. **HTTP Server Creation**: Understanding Node.js built-in HTTP module usage and server lifecycle management
2. **Request Routing**: Implementing URL path matching and method validation
3. **Response Generation**: Creating appropriate HTTP responses with headers and content
4. **Error Handling**: Implementing consistent error responses with proper status codes
5. **Security Headers**: Adding security headers following modern web security practices
6. **Health Monitoring**: Creating operational visibility through health check endpoints
7. **Performance Monitoring**: Tracking response times and resource utilization
8. **Logging and Correlation**: Implementing structured logging with request correlation
9. **API Documentation**: Creating comprehensive API documentation for developer experience

### Concepts Demonstrated

**Core HTTP Concepts**:
- HTTP request-response cycle implementation
- Status codes and their appropriate usage
- Header management and security considerations
- Content type handling and charset specification

**Node.js Patterns**:
- Built-in module usage (http, url, util, perf_hooks)
- Event-driven programming with request/response events
- Asynchronous request processing with async/await
- Module organization and export patterns
- Error propagation and handling strategies

**Web Development Practices**:
- RESTful API design principles
- Security header implementation
- Input validation and sanitization
- Correlation tracking for debugging
- Performance measurement and optimization
- Health check endpoint patterns

**Educational Value**:
- **Simplicity**: Minimal complexity focuses attention on core HTTP concepts
- **Zero Dependencies**: Uses only Node.js built-in modules for clear learning path
- **Comprehensive Documentation**: Detailed documentation serves as learning reference
- **Practical Examples**: Working examples demonstrate real-world usage patterns
- **Progressive Complexity**: Foundation for understanding more advanced web frameworks

### Extension Ideas

**Beginner Extensions**:
1. Add more endpoints (e.g., `/info`, `/time`)
2. Implement query parameter handling
3. Add request body parsing for POST requests
4. Create custom response headers

**Intermediate Extensions**:
1. Implement basic routing with parameters (e.g., `/users/:id`)
2. Add JSON request/response handling
3. Implement basic middleware patterns
4. Add file serving capabilities

**Advanced Extensions**:
1. Integrate with Express.js framework
2. Add database connectivity (SQLite, PostgreSQL)
3. Implement authentication and authorization
4. Add comprehensive logging and monitoring
5. Create containerized deployment with Docker
6. Implement clustering for production scaling

### Further Reading

**Node.js Official Documentation**:
- [HTTP Module](https://nodejs.org/api/http.html)
- [URL Module](https://nodejs.org/api/url.html)
- [Performance Hooks](https://nodejs.org/api/perf_hooks.html)

**HTTP Protocol Resources**:
- [RFC 7231 - HTTP/1.1 Semantics](https://tools.ietf.org/html/rfc7231)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Security Headers](https://owasp.org/www-project-secure-headers/)

**Web Development Best Practices**:
- [REST API Design Guidelines](https://restfulapi.net/)
- [API Documentation Standards](https://swagger.io/specification/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Troubleshooting Guide

**Common Issues**:

1. **Connection Refused**
   - **Cause**: Server not running or wrong port
   - **Solution**: Verify server is running on correct port (default 3000)
   - **Debug**: Check console output for startup messages

2. **404 Not Found for Valid Endpoints**
   - **Cause**: Incorrect URL or server routing issue
   - **Solution**: Check URL spelling and server logs for routing errors
   - **Debug**: Use verbose curl (`-v`) to inspect request details

3. **405 Method Not Allowed**
   - **Cause**: Using unsupported HTTP method
   - **Solution**: Use GET method only - POST, PUT, DELETE not supported
   - **Debug**: Check Allow header in response for supported methods

4. **Health Endpoint Returns 503**
   - **Cause**: System health issues or resource constraints
   - **Solution**: Check system resources, server logs, and application health
   - **Debug**: Review health response JSON for specific health check failures

**Debugging Tips**:

1. **Enable Verbose Logging**: Check server console output for detailed request processing information
2. **Use Correlation IDs**: Track requests using correlation IDs in logs for debugging complex issues
3. **Monitor Health Endpoint**: Regularly check `/health` for system status and performance metrics
4. **Check Node.js Version**: Ensure Node.js 18+ compatibility (22.x LTS recommended)
5. **Inspect HTTP Headers**: Use browser developer tools or curl `-v` flag for header inspection

**Performance Optimization**:

1. **Monitor Response Times**: Use health endpoint performance metrics to identify bottlenecks
2. **Check Memory Usage**: Monitor memory consumption through health endpoint system metrics
3. **Review Error Rates**: Track error patterns through comprehensive error logging
4. **Optimize Keep-Alive**: Ensure connection pooling for better network performance

---

## API Reference Summary

| Endpoint | Method | Response Type | Status Codes | Description |
|----------|--------|---------------|--------------|-------------|
| `/hello` | GET | text/plain | 200, 405 | Returns "Hello world" message |
| `/health` | GET | application/json | 200, 503 | Comprehensive health status |
| `/*` | * | text/plain | 404 | Not found for undefined routes |

**Security**: All responses include security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

**Performance**: Built-in performance monitoring with microsecond precision timing

**Monitoring**: Comprehensive health checks with system resource monitoring and alerting

**Educational**: Zero external dependencies, extensive documentation, and practical examples for Node.js learning

---

*This documentation serves as both an API reference and educational resource for understanding Node.js HTTP server development fundamentals.*