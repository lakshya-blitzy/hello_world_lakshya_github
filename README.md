# hao-backprop-test

A simple Node.js HTTP server built with Express.js, demonstrating basic routing and request handling. This project serves as a learning resource for understanding Express fundamentals and server configuration.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Usage](#usage)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

### Project Purpose

This project provides a minimal yet complete example of a Node.js HTTP server using the Express.js framework. It's designed for developers learning server-side JavaScript development, Express routing patterns, and basic HTTP server configuration.

### Features

- **Simple HTTP Server**: Lightweight Express.js server with minimal dependencies
- **Multiple Route Handlers**: Demonstrates GET request handling with two example endpoints
- **Localhost Binding**: Secure local-only access using loopback address
- **CommonJS Modules**: Uses standard Node.js require() syntax for educational clarity
- **Production Dependencies**: Leverages Express 5.x with modern JavaScript features

### Technology Stack

- **Runtime**: Node.js 18+ (required for Express 5.x dependencies)
- **Framework**: Express.js 5.1.0
- **Module System**: CommonJS (require/module.exports)
- **HTTP Server**: Built on Node.js native http module via Express

## Prerequisites

Before setting up this project, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm**: Comes bundled with Node.js
  - Verify installation: `npm --version`

## Installation

Follow these steps to set up the project locally:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd hao-backprop-test
   ```

2. **Install dependencies**:
   ```bash
   npm ci
   ```
   
   The `npm ci` command installs exact dependency versions from `package-lock.json`, ensuring consistent environments across installations.

3. **Verify installation**:
   ```bash
   node --version  # Should show v18.x.x or higher
   npm list express  # Should show express@5.1.0
   ```

## Configuration

The server configuration is defined in `server.js` using the following constants:

- **Hostname**: `127.0.0.1` (localhost)
  - Restricts server access to the local machine only
  - Prevents external network access for security during development
  - Use `0.0.0.0` for production deployments requiring external access

- **Port**: `3000`
  - Standard development port for Node.js applications
  - Can be changed by modifying the `port` constant in `server.js`
  - Ensure the selected port is not in use by other applications

**Future Enhancement**: Environment variable support for port configuration (e.g., `process.env.PORT || 3000`)

## API Endpoints

The server provides the following HTTP endpoints:

| Method | Path | Description | Response Type | Response Body |
|--------|------|-------------|---------------|---------------|
| GET | `/` | Root endpoint returning a welcome message | text/html | `Hello, World!\n` |
| GET | `/evening` | Greeting endpoint with time-of-day message | text/html | `Good evening` |

### Endpoint Details

#### GET /

Returns a welcome message to verify server connectivity.

**Request Example**:
```bash
curl http://127.0.0.1:3000/
```

**Response**:
```
Hello, World!

```

**Status Code**: 200 OK

**Content-Type**: text/html; charset=utf-8

---

#### GET /evening

Returns an evening greeting message.

**Request Example**:
```bash
curl http://127.0.0.1:3000/evening
```

**Response**:
```
Good evening
```

**Status Code**: 200 OK

**Content-Type**: text/html; charset=utf-8

---

**Undefined Routes**: Any request to an undefined route returns a 404 error with Express's default error page.

## Usage

### Starting the Server

Run the following command from the project root directory:

```bash
node server.js
```

**Expected Output**:
```
Server running at http://127.0.0.1:3000/
```

The server is now running and ready to accept requests.

### Testing Endpoints

With the server running, open a new terminal window and test the endpoints:

**Test the root endpoint**:
```bash
curl http://127.0.0.1:3000/
```

**Test the evening endpoint**:
```bash
curl http://127.0.0.1:3000/evening
```

Alternatively, open your web browser and navigate to:
- http://127.0.0.1:3000/
- http://127.0.0.1:3000/evening

### Stopping the Server

To stop the server, press `Ctrl + C` in the terminal where the server is running.

## Development

### Project Structure

```
hao-backprop-test/
├── server.js           # Main application file with Express server and routes
├── package.json        # Project metadata and dependencies
├── package-lock.json   # Locked dependency versions
├── README.md           # Project documentation (this file)
└── node_modules/       # Installed dependencies (not committed to version control)
```

### Adding New Endpoints

To add a new route to the server:

1. Open `server.js`
2. Add a new route handler before the `app.listen()` call:
   ```javascript
   app.get('/your-path', (req, res) => {
     res.send('Your response message');
   });
   ```
3. Save the file
4. Restart the server (`Ctrl + C`, then `node server.js`)
5. Test your new endpoint: `curl http://127.0.0.1:3000/your-path`

### Code Style Conventions

- **Module System**: Use CommonJS `require()` for imports (no ES6 `import`)
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Use semicolons at the end of statements
- **Arrow Functions**: Preferred for route handlers and callbacks
- **Const/Let**: Use `const` for variables that won't be reassigned
- **String Literals**: Use single quotes for strings, template literals for interpolation

## Deployment

### Local Development Deployment

For local development, follow the [Installation](#installation) and [Usage](#usage) instructions above. The default configuration binds to localhost only for security.

### Production Deployment Options

#### Option 1: Direct Node.js Execution

1. Set environment to production:
   ```bash
   export NODE_ENV=production
   ```

2. Update `server.js` to bind to all interfaces:
   ```javascript
   const hostname = '0.0.0.0';  // Allow external access
   ```

3. Run the server:
   ```bash
   node server.js
   ```

#### Option 2: Process Manager (PM2)

PM2 ensures your application stays running and restarts automatically on crashes.

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the application with PM2:
   ```bash
   pm2 start server.js --name hao-backprop-test
   ```

3. Configure PM2 to restart on system reboot:
   ```bash
   pm2 startup
   pm2 save
   ```

4. Monitor application status:
   ```bash
   pm2 status
   pm2 logs hao-backprop-test
   ```

#### Option 3: Docker Container

1. Create a `Dockerfile`:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY server.js ./
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

2. Build and run:
   ```bash
   docker build -t hao-backprop-test .
   docker run -p 3000:3000 hao-backprop-test
   ```

#### Option 4: systemd Service (Linux)

1. Create `/etc/systemd/system/hao-backprop-test.service`:
   ```ini
   [Unit]
   Description=hao-backprop-test Node.js Server
   After=network.target

   [Service]
   Type=simple
   User=nodeuser
   WorkingDirectory=/path/to/hao-backprop-test
   ExecStart=/usr/bin/node server.js
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl enable hao-backprop-test
   sudo systemctl start hao-backprop-test
   ```

## Troubleshooting

### Port Already in Use (EADDRINUSE)

**Error Message**:
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3000
```

**Cause**: Another process is already using port 3000.

**Solutions**:

1. **Find and stop the conflicting process**:
   ```bash
   # On macOS/Linux
   lsof -i :3000
   kill -9 <PID>

   # On Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **Use a different port**: Change the `port` constant in `server.js` to an available port (e.g., 3001, 8080).

### Missing Dependencies

**Error Message**:
```
Error: Cannot find module 'express'
```

**Cause**: Dependencies not installed or `node_modules` directory missing.

**Solution**:
```bash
npm ci
```

This reinstalls all dependencies from `package-lock.json`.

### Node.js Version Mismatch

**Error Message**:
```
Error: The engine "node" is incompatible with this module
```

**Cause**: Node.js version is below 18.0.0 (required by Express 5.x dependencies).

**Solution**:

1. Check current version:
   ```bash
   node --version
   ```

2. Upgrade Node.js:
   - Download the latest LTS version from [nodejs.org](https://nodejs.org/)
   - Or use a version manager like [nvm](https://github.com/nvm-sh/nvm):
     ```bash
     nvm install 18
     nvm use 18
     ```

3. Verify the upgrade:
   ```bash
   node --version  # Should show v18.x.x or higher
   ```

4. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Server Not Responding

**Symptoms**: curl commands timeout or connection refused.

**Checklist**:

1. Verify the server is running: Look for "Server running at http://127.0.0.1:3000/" message
2. Check the correct URL: Must use `127.0.0.1` (not `localhost` in some cases)
3. Confirm the port number: Default is 3000, verify it matches your configuration
4. Check firewall settings: Ensure localhost connections are allowed

## License

This project is licensed under the MIT License.

**MIT License Summary**: You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of this software, provided the original copyright notice and permission notice are included in all copies or substantial portions of the software.

**Copyright**: © hxu

---

**Project Metadata**:
- **Name**: hello_world
- **Version**: 1.0.0
- **Author**: hxu
- **Main File**: server.js