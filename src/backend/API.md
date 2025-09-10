# Node.js Tutorial HTTP Server API

Simple educational HTTP server demonstrating fundamental Node.js web server concepts

## Overview

This is a minimalist Node.js HTTP server application designed for educational purposes. The server demonstrates core HTTP concepts including request handling, response generation, and health monitoring using only Node.js built-in modules with zero external dependencies.

**Base URL:** http://localhost:3000
**Version:** 1.0.0
**Protocol:** HTTP/1.1

## Quick Start

### Starting the Server

```bash
node server.js
```

The server will start listening on port 3000 (or the port specified in the PORT environment variable).

### Making Your First Request

```bash
curl http://localhost:3000/hello
```

### Testing with cURL

```bash
# Basic hello endpoint test
curl http://localhost:3000/hello

# Health check endpoint test
curl http://localhost:3000/health

# Verbose output for debugging
curl -v http://localhost:3000/hello
```

## Endpoints

### GET /hello

Returns a simple "Hello world" message demonstrating basic HTTP response handling.

**Request:**
```http
GET /hello HTTP/1.1
Host: localhost:3000
User-Agent: curl/7.68.0
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: Wed, 10 Jan 2024 12:00:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Connection: keep-alive

Hello world
```

**Response Details:**
- **Status Code:** 200 OK
- **Content-Type:** text/plain; charset=utf-8
- **Content-Length:** 11 bytes
- **Body:** "Hello world"

### GET /health

Returns comprehensive server health status and system metrics in JSON format.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 1247
Date: Wed, 10 Jan 2024 12:00:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Connection: keep-alive
Cache-Control: no-cache, no-store, must-revalidate

{
  "status": "healthy",
  "score": 100,
  "timestamp": "2024-01-10T12:00:00.000Z",
  "execution_time_ms": 45,
  "correlation_id": "health-1704888000000-a1b2c3d4e",
  "server": {
    "status": "healthy",
    "uptime_ms": 125000,
    "port": 3000,
    "environment": "development",
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64"
  },
  "system": {
    "status": "healthy",
    "memory": {
      "usage_percent": 15,
      "used_mb": 45,
      "total_mb": 128,
      "heap_used_mb": 25,
      "external_mb": 8
    },
    "cpu": {
      "usage_percent": 5,
      "load_average": [0.1, 0.15, 0.2]
    },
    "disk": {
      "usage_percent": 60,
      "available_mb": 2048
    }
  },
  "process": {
    "status": "healthy",
    "pid": 12345,
    "uptime_ms": 125000,
    "memory": {
      "heap_used_mb": 25,
      "heap_total_mb": 50,
      "external_mb": 8,
      "rss_mb": 45
    },
    "event_loop_lag_ms": 2,
    "gc_stats": null
  },
  "performance": {
    "status": "healthy",
    "response_time_ms": 15,
    "throughput_rps": 10,
    "error_rate_percent": 0,
    "concurrent_requests": 1
  },
  "metrics": {
    "total_requests": 156,
    "success_rate_percent": 100,
    "active_connections": 1,
    "avg_response_time_ms": 15,
    "memory_usage_mb": 45,
    "cpu_usage_percent": 5,
    "uptime_seconds": 125
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

**Response Details:**
- **Status Code:** 200 OK (healthy), 503 Service Unavailable (degraded/unhealthy)
- **Content-Type:** application/json
- **Cache-Control:** no-cache, no-store, must-revalidate
- **Cache TTL:** 5 seconds in-memory cache for performance optimization

**Health Status Values:**
- `healthy`: All systems operational
- `degraded`: Non-critical issues detected
- `unhealthy`: Critical issues requiring attention

## Error Responses

The server returns standardized HTTP error responses with appropriate status codes and messages.

### 404 Not Found

Returned when requesting an unknown endpoint path.

**Request:**
```bash
curl http://localhost:3000/invalid-path
```

**Response:**
```http
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 9
Date: Wed, 10 Jan 2024 12:00:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Connection: keep-alive

Not Found
```

### 405 Method Not Allowed

Returned when using an unsupported HTTP method on a valid endpoint.

**Request:**
```bash
curl -X POST http://localhost:3000/hello
```

**Response:**
```http
HTTP/1.1 405 Method Not Allowed
Content-Type: text/plain; charset=utf-8
Content-Length: 18
Allow: GET
Date: Wed, 10 Jan 2024 12:00:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Connection: keep-alive

Method Not Allowed
```

### 500 Internal Server Error

Returned when an unexpected server error occurs.

**Response:**
```http
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 21
Date: Wed, 10 Jan 2024 12:00:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Connection: keep-alive

Internal Server Error
```

## Usage Examples

### cURL Examples

```bash
# Basic hello endpoint request
curl http://localhost:3000/hello

# Health check endpoint request
curl http://localhost:3000/health

# Verbose output with headers
curl -v http://localhost:3000/hello

# Health check with JSON formatting
curl -H "Accept: application/json" http://localhost:3000/health | jq '.'

# Test error handling
curl http://localhost:3000/nonexistent

# Test method not allowed
curl -X POST http://localhost:3000/hello
```

### JavaScript Fetch API

```javascript
// Hello endpoint request
fetch('http://localhost:3000/hello')
  .then(response => response.text())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// Health endpoint request
fetch('http://localhost:3000/health')
  .then(response => response.json())
  .then(data => console.log('Health Status:', data.status))
  .catch(error => console.error('Error:', error));

// Error handling example
fetch('http://localhost:3000/invalid')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  })
  .catch(error => console.error('Request failed:', error));
```

### Node.js HTTP Client

```javascript
import http from 'node:http';

// Hello endpoint request
function requestHello() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/hello',
    method: 'GET',
    headers: {
      'User-Agent': 'Node.js HTTP Client'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`Response: ${data}`);
    });
  });

  req.on('error', (error) => {
    console.error(`Request error: ${error.message}`);
  });

  req.end();
}

// Health endpoint request
function requestHealth() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      const healthData = JSON.parse(data);
      console.log(`Health Status: ${healthData.status}`);
      console.log(`Server Uptime: ${healthData.server.uptime_ms}ms`);
      console.log(`Memory Usage: ${healthData.system.memory.used_mb}MB`);
    });
  });

  req.end();
}
```

### Python Requests

```python
import requests
import json

# Hello endpoint request
response = requests.get('http://localhost:3000/hello')
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Health endpoint request
health_response = requests.get('http://localhost:3000/health')
if health_response.status_code == 200:
    health_data = health_response.json()
    print(f"Health Status: {health_data['status']}")
    print(f"Response Time: {health_data['execution_time_ms']}ms")
else:
    print(f"Health check failed: {health_response.status_code}")
```

## Response Format

### Response Headers

All responses include the following security and informational headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Type` | `text/plain; charset=utf-8` or `application/json` | Response content format |
| `Content-Length` | Calculated byte length | Response body size |
| `Date` | Current UTC timestamp | Response generation time |
| `Connection` | `keep-alive` | Connection management |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type confusion attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `Cache-Control` | `no-cache, no-store, must-revalidate` | Cache policy (health endpoint only) |

### Content Types

- **Hello Endpoint:** `text/plain; charset=utf-8`
- **Health Endpoint:** `application/json`
- **Error Responses:** `text/plain; charset=utf-8`

## Integration

### Health Check Integration

The `/health` endpoint is designed for integration with monitoring systems, load balancers, and orchestration platforms:

```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

# Docker health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Load balancer health check
upstream backend {
    server localhost:3000;
    health_check uri=/health;
}
```

### Load Balancer Configuration

```nginx
upstream nodejs_backend {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://nodejs_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Health check configuration
        health_check uri=/health match=health_check_ok;
    }
}

match health_check_ok {
    status 200;
    header Content-Type ~ "application/json";
    body ~ "\"status\": \"healthy\"";
}
```

### Monitoring System Setup

```yaml
# Prometheus monitoring configuration
- job_name: 'nodejs-tutorial-server'
  static_configs:
    - targets: ['localhost:3000']
  metrics_path: '/health'
  scrape_interval: 30s
  scrape_timeout: 10s
  params:
    format: ['prometheus']
```

### Client Application Integration

```javascript
class APIClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async hello() {
    const response = await fetch(`${this.baseURL}/hello`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  }

  async healthCheck() {
    const response = await fetch(`${this.baseURL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return await response.json();
  }

  async isServerHealthy() {
    try {
      const health = await this.healthCheck();
      return health.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Usage example
const client = new APIClient();

// Check server health before making requests
if (await client.isServerHealthy()) {
  const message = await client.hello();
  console.log(message);
} else {
  console.error('Server is not healthy');
}
```

## Performance Characteristics

### Response Time Targets

| Endpoint | Target Response Time | Maximum Threshold |
|----------|---------------------|-------------------|
| GET /hello | < 50ms | < 100ms |
| GET /health | < 100ms | < 200ms |

### Throughput

- **Concurrent Connections:** 100+ supported
- **Memory Usage:** < 50MB typical
- **Request Processing:** Single-threaded event loop

### Caching

- **Health Endpoint:** 5-second in-memory cache for performance optimization
- **Hello Endpoint:** No caching (static content)

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Server not running | Start server with `node server.js` |
| 404 Not Found | Invalid endpoint path | Use exact paths `/hello` or `/health` |
| 405 Method Not Allowed | Using wrong HTTP method | Use GET method only |

### Debugging Tips

- Check server logs for detailed error information
- Use `curl -v` for verbose HTTP transaction details
- Verify server is listening on expected port
- Check Node.js version compatibility (18+ required)

### Health Check Debugging

```bash
# Test health endpoint connectivity
curl -f http://localhost:3000/health || echo "Health check failed"

# Check health endpoint response format
curl -s http://localhost:3000/health | jq '.status'

# Monitor health endpoint performance
time curl -s http://localhost:3000/health > /dev/null
```

## Educational Context

### Learning Objectives

- Understanding HTTP request-response cycle
- Learning Node.js built-in HTTP module usage
- Practicing API documentation and client integration
- Exploring health monitoring endpoint patterns

### Concepts Demonstrated

- HTTP server creation with Node.js
- Request routing and URL path matching
- Response generation with proper headers
- Error handling with HTTP status codes
- Health check endpoint implementation

### Next Steps

- Extend with additional endpoints
- Add request body processing
- Implement authentication
- Add database integration
- Deploy to cloud platform

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server listening port |
| `HOST` | '127.0.0.1' | Server bind address |
| `NODE_ENV` | 'development' | Application environment |

### Server Configuration

```javascript
const config = {
    port: process.env.PORT || 3000,
    hostname: process.env.HOST || '127.0.0.1',
    timeout: parseInt(process.env.TIMEOUT) || 120000,
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000
};
```

## Security Considerations

### Authentication

- **None required** - public endpoints for educational purposes
- **No API keys** - open access for learning

### Rate Limiting

- **None implemented** - educational server
- **Recommend implementing** for production use

### CORS Policy

- **Not configured** - same-origin only
- **Headers included** for basic security (X-Content-Type-Options, X-Frame-Options)

---

**API Version:** 1.0.0  
**Last Updated:** January 2024  
**Node.js Version:** 18.0.0+  
**License:** Educational Use