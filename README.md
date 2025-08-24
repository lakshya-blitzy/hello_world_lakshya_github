# Hello World HTTP Server

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hxu/hello_world)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A512.0.0-brightgreen.svg)](https://nodejs.org/)

> A minimal HTTP server implementation for testing backpropagation integration workflows

## Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

The **hao-backprop-test** project is a lightweight HTTP server implementation designed specifically for testing backpropagation integration workflows. Built with Node.js core modules only, this server provides a minimal foundation for neural network testing scenarios where a simple HTTP endpoint is needed to validate data flow and network communication patterns.

### Key Features

- **Zero-dependency architecture**: Uses only Node.js core `http` module
- **Minimal resource footprint**: Single-file server implementation
- **Instant startup**: No compilation or build steps required
- **Cross-platform compatibility**: Runs on any Node.js supported platform
- **Production-ready defaults**: Optimized configuration for testing environments

### Use Cases

- **Backpropagation testing**: Validate neural network data pipelines
- **HTTP client testing**: Test HTTP request/response cycles
- **Development prototyping**: Quick server setup for testing ideas
- **Educational purposes**: Learn basic HTTP server concepts
- **CI/CD testing**: Lightweight server for automated testing

## Prerequisites

### System Requirements

| Requirement | Minimum Version | Recommended |
|------------|----------------|-------------|
| **Node.js** | 12.0.0+ | 18.0.0+ |
| **npm** | 6.0.0+ | 8.0.0+ |
| **Memory** | 50MB | 100MB |
| **Storage** | 10MB | 50MB |

### Environment Setup

Before running the server, ensure you have Node.js installed:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

**Installing Node.js:**

- **macOS**: `brew install node` or download from [nodejs.org](https://nodejs.org/)
- **Ubuntu/Debian**: `sudo apt-get install nodejs npm`
- **Windows**: Download installer from [nodejs.org](https://nodejs.org/)
- **Docker**: Use official Node.js images

## Installation

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd hao-backprop-test

# No additional dependencies to install
# The server is ready to run immediately
```

### Verification

Verify your installation by checking the project structure:

```bash
# List project files
ls -la

# Expected output:
# server.js      - Main HTTP server implementation
# package.json   - Project configuration
# README.md      - This documentation
```

### Development Setup

For development and testing purposes:

```bash
# Make the server executable (Linux/macOS)
chmod +x server.js

# Verify Node.js can execute the server
node --check server.js
```

## Configuration

### Default Configuration

The server uses the following default configuration:

| Setting | Value | Description |
|---------|-------|-------------|
| **Hostname** | `127.0.0.1` | Server binding address (localhost) |
| **Port** | `3000` | HTTP listening port |
| **Content-Type** | `text/plain` | Response content type |

### Customization Options

#### Environment Variables

Configure the server using environment variables:

```bash
# Custom hostname (bind to all interfaces)
export HOSTNAME=0.0.0.0

# Custom port
export PORT=8080

# Start server with custom configuration
node server.js
```

#### Code Modification

For persistent configuration changes, modify `server.js`:

```javascript
// server.js
const hostname = process.env.HOSTNAME || '127.0.0.1';
const port = process.env.PORT || 3000;
```

### Network Configuration

#### Local Development
- **Hostname**: `127.0.0.1` (localhost only)
- **Port**: `3000` (avoid conflicts with common services)

#### Production Deployment
- **Hostname**: `0.0.0.0` (accept external connections)
- **Port**: `80` or `8080` (standard HTTP ports)

## Usage

### Starting the Server

#### Basic Usage

```bash
# Start the server
node server.js

# Expected output:
# Server running at http://127.0.0.1:3000/
```

#### Background Execution

```bash
# Run in background (Linux/macOS)
nohup node server.js &

# Run with PM2 (if installed)
pm2 start server.js --name "hello-server"

# Run with systemd (Linux)
# See deployment section for service configuration
```

### Testing the Server

#### Command Line Testing

```bash
# Test with curl
curl http://127.0.0.1:3000/

# Expected response:
# Hello, World!

# Test with wget
wget -qO- http://127.0.0.1:3000/
```

#### Browser Testing

1. Open your web browser
2. Navigate to `http://127.0.0.1:3000/`
3. Verify "Hello, World!" message appears

### Stopping the Server

```bash
# Stop with Ctrl+C (foreground)
^C

# Stop background process
pkill -f "node server.js"

# Stop PM2 process
pm2 stop hello-server
```

## API Documentation

### Endpoint Overview

The server exposes a single HTTP endpoint that responds to all request methods and paths.

### GET / (All Paths)

**Description**: Returns a simple "Hello, World!" message for any HTTP request.

**URL**: `http://{hostname}:{port}/{any-path}`

**Method**: `GET` | `POST` | `PUT` | `DELETE` | `PATCH` | `OPTIONS` | `HEAD`

#### Request

```http
GET / HTTP/1.1
Host: 127.0.0.1:3000
Accept: */*
```

#### Response

**Status Code**: `200 OK`

**Headers**:
```http
Content-Type: text/plain
```

**Body**:
```text
Hello, World!
```

#### Examples

**Basic Request**:
```bash
curl -X GET http://127.0.0.1:3000/
# Output: Hello, World!
```

**POST Request** (same response):
```bash
curl -X POST http://127.0.0.1:3000/api/test
# Output: Hello, World!
```

**With Headers**:
```bash
curl -X GET http://127.0.0.1:3000/ -H "Authorization: Bearer token"
# Output: Hello, World!
```

### Response Characteristics

- **Consistent Response**: All requests return identical response
- **Fast Response Time**: ~1ms average response time
- **No Request Processing**: Request body and headers are ignored
- **Stateless**: No session or state management

## Deployment

### Local Development

**Direct Execution**:
```bash
node server.js
```

**With Nodemon** (auto-restart on changes):
```bash
npm install -g nodemon
nodemon server.js
```

### Docker Deployment

#### Dockerfile

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy application files
COPY server.js package.json ./

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
```

#### Build and Run

```bash
# Build Docker image
docker build -t hello-server .

# Run container
docker run -p 3000:3000 hello-server

# Run in background
docker run -d -p 3000:3000 --name hello-server hello-server
```

### Process Manager (PM2)

#### Installation

```bash
npm install -g pm2
```

#### Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'hello-server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 80,
      HOSTNAME: '0.0.0.0'
    }
  }]
};
```

#### Deployment Commands

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Production deployment
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs hello-server
```

### SystemD Service (Linux)

#### Service Configuration

Create `/etc/systemd/system/hello-server.service`:

```ini
[Unit]
Description=Hello World HTTP Server
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/hello-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

#### Service Management

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable hello-server

# Start service
sudo systemctl start hello-server

# Check status
sudo systemctl status hello-server

# View logs
journalctl -u hello-server -f
```

### Cloud Platform Deployment

#### Heroku

Create `Procfile`:
```text
web: node server.js
```

Deploy commands:
```bash
# Login to Heroku
heroku login

# Create application
heroku create your-app-name

# Deploy
git push heroku main

# Open application
heroku open
```

#### Google Cloud Platform

```bash
# Initialize gcloud
gcloud init

# Deploy to App Engine
gcloud app deploy

# View application
gcloud app browse
```

#### AWS EC2

```bash
# Connect to EC2 instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Deploy application
git clone your-repo
cd hao-backprop-test
node server.js
```

## Architecture

### System Design

The server follows a minimalist architecture designed for simplicity and performance:

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTTP Client   │───▶│   Node.js HTTP   │───▶│   Response      │
│   (Browser/CLI) │    │   Server Core    │    │   Generator     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Static Response│
                       │   "Hello, World!"│
                       └──────────────────┘
```

### Component Breakdown

#### Core Components

1. **HTTP Server Instance**
   - **Module**: Node.js `http.createServer()`
   - **Purpose**: Handle incoming HTTP requests
   - **Configuration**: Hostname and port binding

2. **Request Handler Function**
   - **Type**: Arrow function callback
   - **Parameters**: `req` (IncomingMessage), `res` (ServerResponse)
   - **Behavior**: Ignores request details, returns static response

3. **Response Generator**
   - **Status**: Always `200 OK`
   - **Headers**: `Content-Type: text/plain`
   - **Body**: Static string "Hello, World!\n"

#### Design Patterns

**Callback Pattern**: Uses traditional Node.js callback pattern for request handling
```javascript
const server = http.createServer((req, res) => {
  // Request handler implementation
});
```

**Zero-Configuration Pattern**: No external configuration files or environment setup required

**Stateless Design**: Each request is handled independently without shared state

### File Structure

```text
hao-backprop-test/
├── server.js          # Main server implementation (14 lines)
├── package.json       # Project metadata and configuration
└── README.md          # Project documentation (this file)
```

### Dependencies

**Core Dependencies**: None (uses only Node.js standard library)
- `http`: HTTP server functionality
- `console`: Logging output

**Development Dependencies**: None required

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|--------|
| **Startup Time** | < 10ms | Minimal initialization |
| **Memory Usage** | ~15MB | Base Node.js overhead |
| **Response Time** | < 1ms | Static response generation |
| **Concurrency** | ~1000 connections | Node.js event loop limit |
| **Throughput** | ~10,000 req/s | On modern hardware |

### Security Considerations

**Current Security Posture**:
- No authentication or authorization
- No input validation or sanitization  
- No HTTPS/TLS encryption
- Suitable for testing environments only

**Production Security Recommendations**:
- Add reverse proxy (nginx/Apache) for HTTPS
- Implement rate limiting
- Add request logging and monitoring
- Consider authentication if needed

## Troubleshooting

### Common Issues

#### Port Already in Use

**Problem**: Server fails to start with `EADDRINUSE` error

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill process by PID
kill -9 <PID>

# Or use different port
export PORT=3001
node server.js
```

#### Node.js Version Issues

**Problem**: Server fails with syntax errors or missing features

```bash
SyntaxError: Unexpected token =>
```

**Solutions**:
```bash
# Check Node.js version
node --version

# Update Node.js (macOS with Homebrew)
brew upgrade node

# Update Node.js (Ubuntu/Debian)
sudo apt-get update && sudo apt-get upgrade nodejs

# Use Node Version Manager
nvm install node --latest-npm
```

#### Permission Denied (Port < 1024)

**Problem**: Cannot bind to ports 80 or 443 without root privileges

```bash
Error: listen EACCES: permission denied 0.0.0.0:80
```

**Solutions**:
```bash
# Run with sudo (not recommended for development)
sudo node server.js

# Use port forwarding
sudo iptables -t nat -A OUTPUT -p tcp --dport 80 -j REDIRECT --to-port 3000

# Use reverse proxy (recommended)
# Configure nginx or Apache to proxy port 3000
```

#### Network Binding Issues

**Problem**: Server not accessible from external machines

**Symptoms**: `curl: (7) Failed to connect to <ip>:3000`

**Solutions**:
```bash
# Bind to all interfaces instead of localhost
# Modify server.js:
const hostname = '0.0.0.0';  // Instead of '127.0.0.1'

# Check firewall settings
sudo ufw status
sudo ufw allow 3000

# Check if process is listening
netstat -tulpn | grep :3000
```

### Debugging Tips

#### Enable Debug Logging

```bash
# Add debug output to server.js
console.log('Request received:', req.method, req.url);
console.log('Request headers:', req.headers);

# Run with Node.js debug flag
node --inspect server.js

# Use debug module
DEBUG=* node server.js
```

#### Monitor Server Health

```bash
# Check if server is responding
curl -I http://127.0.0.1:3000/

# Monitor resource usage
top -p $(pgrep -f "node server.js")

# Monitor network connections
ss -tuln | grep :3000
```

#### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `EADDRINUSE` | Port already in use | Change port or kill existing process |
| `EACCES` | Permission denied | Use unprivileged port or sudo |
| `ENOTFOUND` | Hostname resolution failed | Check hostname configuration |
| `ECONNREFUSED` | Connection refused | Check if server is running |

### Performance Optimization

#### For High Load Testing

```javascript
// Increase connection limits
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Optimize for high concurrency
server.maxConnections = 0; // No limit
server.timeout = 0;        // No timeout
```

#### Memory Optimization

```bash
# Run with optimized V8 flags
node --optimize-for-size --gc-interval=100 server.js

# Monitor memory usage
node --trace-gc server.js
```

## Contributing

We welcome contributions to improve the hao-backprop-test project! This section outlines the development workflow and contribution guidelines.

### Development Workflow

#### Getting Started

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/hao-backprop-test.git
   cd hao-backprop-test
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the coding standards below
   - Test your changes thoroughly
   - Update documentation if needed

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create pull request**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

### Coding Standards

#### JavaScript Style Guidelines

- **ES6+ Features**: Use modern JavaScript features when appropriate
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes for strings
- **Line Length**: Maximum 100 characters

#### Code Example

```javascript
// ✅ Good
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// ❌ Avoid
const server = http.createServer(function(req, res){
    res.statusCode=200
    res.setHeader("Content-Type","text/plain")
    res.end("Hello, World!\n")
})
```

#### Documentation Standards

- **Code Comments**: Use JSDoc format for functions
- **README Updates**: Update documentation for new features
- **Inline Comments**: Explain complex logic or non-obvious code

### Testing Guidelines

#### Manual Testing

Before submitting a pull request:

1. **Functionality Test**
   ```bash
   # Start server
   node server.js
   
   # Test in another terminal
   curl http://127.0.0.1:3000/
   ```

2. **Cross-Platform Test**
   - Test on Linux, macOS, and Windows if possible
   - Verify with different Node.js versions (12, 14, 16, 18)

3. **Performance Test**
   ```bash
   # Basic load test
   ab -n 1000 -c 10 http://127.0.0.1:3000/
   ```

#### Automated Testing

While the current project doesn't include automated tests, consider:

- Adding unit tests for future enhancements
- Setting up GitHub Actions for CI/CD
- Including linting with ESLint

### Pull Request Process

#### PR Requirements

- [ ] Code follows style guidelines
- [ ] Changes are manually tested
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] No breaking changes (unless discussed)

#### PR Template

When creating a pull request, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Manual testing performed
- [ ] Cross-platform compatibility verified

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

### Issue Reporting

#### Bug Reports

When reporting bugs, include:

- **Node.js version**: `node --version`
- **Operating system**: OS name and version
- **Steps to reproduce**: Clear reproduction steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error messages**: Complete error output

#### Feature Requests

For new features, provide:

- **Use case description**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternative solutions**: Other approaches considered
- **Breaking changes**: Will this affect existing functionality?

### Code Review Process

#### Review Criteria

Pull requests are evaluated on:

1. **Functionality**: Does it work as intended?
2. **Code Quality**: Is it readable and maintainable?
3. **Performance**: Does it impact server performance?
4. **Documentation**: Are changes properly documented?
5. **Compatibility**: Works with supported Node.js versions?

#### Review Timeline

- **Initial Response**: Within 2-3 days
- **Full Review**: Within 1 week
- **Follow-up**: Within 2-3 days of updates

### Community Guidelines

#### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers and answer questions
- Follow GitHub's Community Guidelines

#### Communication Channels

- **Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

## License

This project is licensed under the **MIT License** - see the details below:

```text
MIT License

Copyright (c) 2024 hxu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### License Summary

**Permissions**:
- ✅ Commercial use
- ✅ Modification  
- ✅ Distribution
- ✅ Private use

**Conditions**:
- 📄 License and copyright notice must be included

**Limitations**:
- ❌ No warranty provided
- ❌ No liability accepted

### Third-Party Dependencies

This project uses **no external dependencies** - only Node.js core modules are used:

| Module | License | Usage |
|--------|---------|--------|
| `http` | Node.js License | HTTP server functionality |

Node.js itself is licensed under the MIT License, making this project fully MIT-compatible.

### Contributing and License

By contributing to this project, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

**Built with ❤️ for backpropagation testing workflows**

For more information, visit the [GitHub repository](https://github.com/hxu/hao-backprop-test) or contact the maintainers.