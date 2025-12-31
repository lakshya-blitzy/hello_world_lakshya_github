# Hello World Express Server

A simple, production-ready Node.js HTTP server built with [Express.js](https://expressjs.com/) that demonstrates basic routing patterns with multiple RESTful endpoints.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.2.1-blue.svg)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Code Architecture](#code-architecture)
- [Configuration](#configuration)
- [Deployment Guide](#deployment-guide)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

---

## Overview

This project implements a minimal Express.js web server that serves as a foundational template for Node.js web applications. It demonstrates:

- Express.js application setup and configuration
- RESTful route definition patterns
- HTTP request/response handling
- Server binding and lifecycle management

The server exposes two HTTP endpoints that return simple greeting messages, making it ideal for:
- Learning Express.js fundamentals
- Testing deployment pipelines
- Health check endpoints for container orchestration
- Starting point for more complex applications

---

## Features

- **Lightweight**: Minimal dependencies (only Express.js)
- **Fast**: Express.js provides high-performance HTTP handling
- **Simple**: Clean, well-documented code structure
- **Secure**: Binds to localhost by default for development safety
- **Modern**: Uses Express.js 5.x with latest features

---

## Prerequisites

Before setting up this project, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Recommended | Check Command |
|----------|-----------------|-------------|---------------|
| Node.js | 18.0.0 | 20.x LTS | `node --version` |
| npm | 7.0.0 | 10.x+ | `npm --version` |

### System Requirements

- **Operating System**: Windows, macOS, or Linux
- **Memory**: 256MB minimum (512MB recommended)
- **Disk Space**: 100MB for dependencies
- **Network**: Port 3000 must be available

### Installing Node.js

If you don't have Node.js installed:

**macOS (using Homebrew):**
```bash
brew install node
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download the installer from [nodejs.org](https://nodejs.org/)

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd hello_world
```

### Step 2: Install Dependencies

```bash
npm install
```

This command installs Express.js and all required dependencies as defined in `package.json`.

### Step 3: Verify Installation

```bash
# Verify Node.js
node --version
# Expected: v18.x.x or higher

# Verify npm packages are installed
npm list --depth=0
# Expected: Shows express@5.2.1
```

---

## Quick Start

### Starting the Server

**Option 1: Using npm start script (recommended)**
```bash
npm start
```

**Option 2: Direct Node.js execution**
```bash
node server.js
```

### Expected Output

Upon successful startup, you'll see:
```
Server running at http://127.0.0.1:3000/
```

### Testing the Endpoints

Open a new terminal window and test the endpoints:

```bash
# Test root endpoint
curl http://127.0.0.1:3000/
# Output: Hello, World!

# Test evening endpoint
curl http://127.0.0.1:3000/evening
# Output: Good evening
```

Or open your web browser and navigate to:
- http://127.0.0.1:3000/ - Displays "Hello, World!"
- http://127.0.0.1:3000/evening - Displays "Good evening"

### Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## API Documentation

### Base URL

```
http://127.0.0.1:3000
```

### Endpoints

#### GET /

Returns a "Hello, World!" greeting message.

**Request:**
```http
GET / HTTP/1.1
Host: 127.0.0.1:3000
```

**Response:**
- **Status Code**: `200 OK`
- **Content-Type**: `text/html; charset=utf-8`
- **Body**: `Hello, World!`

**Example using curl:**
```bash
curl -i http://127.0.0.1:3000/
```

**Example Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 14
Date: Mon, 01 Jan 2025 00:00:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello, World!
```

---

#### GET /evening

Returns a "Good evening" greeting message.

**Request:**
```http
GET /evening HTTP/1.1
Host: 127.0.0.1:3000
```

**Response:**
- **Status Code**: `200 OK`
- **Content-Type**: `text/html; charset=utf-8`
- **Body**: `Good evening`

**Example using curl:**
```bash
curl -i http://127.0.0.1:3000/evening
```

**Example Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 12
Date: Mon, 01 Jan 2025 00:00:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Good evening
```

---

### Error Responses

#### 404 Not Found

Returned when accessing undefined routes.

**Example:**
```bash
curl -i http://127.0.0.1:3000/undefined
```

**Response:**
```http
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>Cannot GET /undefined</body>
</html>
```

---

## Code Architecture

### Project Structure

```
hello_world/
├── server.js           # Main application file
├── package.json        # Project configuration and dependencies
├── package-lock.json   # Dependency lock file
├── README.md           # This documentation file
└── node_modules/       # Installed dependencies (git-ignored)
```

### server.js Explained

The `server.js` file follows this structure:

```javascript
// 1. DEPENDENCIES
// Import Express.js framework for HTTP handling
const express = require('express');

// 2. CONFIGURATION
// Define server hostname and port
const hostname = '127.0.0.1';  // Localhost only (security)
const port = 3000;              // Development port

// 3. APPLICATION SETUP
// Create Express application instance
const app = express();

// 4. ROUTE DEFINITIONS
// Define HTTP GET routes with handlers
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

app.get('/evening', (req, res) => {
  res.send('Good evening');
});

// 5. SERVER START
// Bind and listen for connections
app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| `express()` | Creates an Express application instance |
| `app.get(path, handler)` | Defines a route for HTTP GET requests |
| `req` (Request) | Object containing request data (headers, params, etc.) |
| `res` (Response) | Object for sending responses back to the client |
| `res.send()` | Sends a response and automatically sets Content-Type |
| `app.listen()` | Binds and starts the server on specified host/port |

---

## Configuration

### Environment Configuration

The server uses hardcoded configuration values for simplicity. For production, consider using environment variables:

| Setting | Default Value | Description |
|---------|---------------|-------------|
| Hostname | `127.0.0.1` | Network interface to bind to |
| Port | `3000` | TCP port for HTTP connections |

### Modifying Configuration

To change the hostname or port, edit `server.js`:

```javascript
// For external access (all interfaces)
const hostname = '0.0.0.0';

// For different port
const port = 8080;
```

### Using Environment Variables (Advanced)

For production deployments, modify the configuration section:

```javascript
const hostname = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 3000;
```

Then start with:
```bash
HOST=0.0.0.0 PORT=8080 node server.js
```

---

## Deployment Guide

### Local Development

```bash
# Start development server
npm start

# Server runs at http://127.0.0.1:3000/
```

### Production Deployment

#### Option 1: Standalone Node.js

**Step 1: Prepare Production Environment**
```bash
# Install production dependencies only
npm install --production
```

**Step 2: Configure for External Access**
Modify `server.js` to use `0.0.0.0` as hostname:
```javascript
const hostname = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 3000;
```

**Step 3: Use Process Manager (PM2)**
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start server.js --name "hello-world"

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

**PM2 Management Commands:**
```bash
pm2 status          # View running processes
pm2 logs            # View application logs
pm2 restart all     # Restart all processes
pm2 stop all        # Stop all processes
```

---

#### Option 2: Docker Deployment

**Step 1: Create Dockerfile**
```dockerfile
# Use Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY server.js ./

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

**Step 2: Build Docker Image**
```bash
docker build -t hello-world-server .
```

**Step 3: Run Container**
```bash
docker run -d -p 3000:3000 --name hello-app hello-world-server
```

**Step 4: Verify Deployment**
```bash
curl http://localhost:3000/
```

---

#### Option 3: Cloud Platform Deployment

##### Heroku

```bash
# Login to Heroku
heroku login

# Create new app
heroku create my-hello-world

# Deploy
git push heroku main

# Open app
heroku open
```

Note: Heroku requires `process.env.PORT` for port configuration.

##### AWS Elastic Beanstalk

```bash
# Initialize EB CLI
eb init

# Create environment
eb create hello-world-env

# Deploy
eb deploy
```

##### Google Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/hello-world

# Deploy to Cloud Run
gcloud run deploy hello-world \
  --image gcr.io/PROJECT_ID/hello-world \
  --platform managed
```

---

### Nginx Reverse Proxy (Production)

For production deployments, place Nginx in front of Node.js:

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3000
```

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 node server.js
```

---

#### Permission Denied (Ports < 1024)

**Error:**
```
Error: listen EACCES: permission denied
```

**Solution:**
Use ports above 1024, or run with elevated privileges (not recommended):
```bash
sudo node server.js  # Not recommended for production
```

---

#### Module Not Found: express

**Error:**
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
npm install
```

---

#### Connection Refused

**Error:**
```
curl: (7) Failed to connect to 127.0.0.1 port 3000: Connection refused
```

**Solutions:**
1. Ensure the server is running
2. Check the correct port number
3. Verify firewall settings

---

### Debug Mode

Enable verbose logging with Node.js debug:
```bash
DEBUG=express:* node server.js
```

---

## Development

### Running in Development Mode

```bash
# Start server
npm start

# Or with auto-restart on file changes (requires nodemon)
npm install -g nodemon
nodemon server.js
```

### Code Style

This project follows:
- ES6+ JavaScript features
- CommonJS module syntax (`require`/`module.exports`)
- JSDoc documentation comments
- 2-space indentation

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-endpoint`)
3. Make your changes
4. Test your changes
5. Commit (`git commit -am 'Add new endpoint'`)
6. Push (`git push origin feature/new-endpoint`)
7. Create a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
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

---

## Support

For issues and feature requests, please open an issue in the repository.
