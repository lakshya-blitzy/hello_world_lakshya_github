# Hello World Node.js Test Harness

A minimal Node.js HTTP server implementation designed as a test harness for backpropagation integration testing. This project provides a simple, zero-dependency web server that responds with "Hello, World!" to demonstrate basic HTTP server functionality.

## Features

- **Zero-dependency architecture**: Uses only Node.js built-in modules
- **Localhost-only binding**: Binds to 127.0.0.1 for enhanced security during testing
- **Minimal resource footprint**: Lightweight server implementation perfect for testing scenarios
- **Simple HTTP endpoint**: Single GET / endpoint for basic connectivity verification
- **Test harness purpose**: Specifically designed for backpropagation integration testing

## Prerequisites

- **Node.js**: Version 7.0 or higher
- **npm**: Comes bundled with Node.js

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hello_world
```

2. Install dependencies (none required, but validates npm setup):
```bash
npm install
```

## Usage

### Option 1: Direct Node.js Execution
```bash
node server.js
```

### Option 2: Using npm start (recommended setup)

First, add a start script to your `package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

Then run:
```bash
npm start
```

Both methods will start the server and display:
```
Server running at http://127.0.0.1:3000/
```

## API Documentation

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | / | Returns a simple greeting | "Hello, World!\n" |

### Request/Response Details

**Request:**
```bash
curl http://127.0.0.1:3000/
```

**Response:**
- **Status Code**: 200 OK
- **Content-Type**: text/plain
- **Body**: `Hello, World!\n`

### Example Usage

```javascript
// Using Node.js built-in http module as client
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
});

req.end();
```

## Code Walkthrough

The server implementation in `server.js` is intentionally minimal:

```javascript
const http = require('http');              // Line 1: Import Node.js HTTP module

const hostname = '127.0.0.1';             // Line 3: Bind to localhost only
const port = 3000;                        // Line 4: Use port 3000

const server = http.createServer((req, res) => {  // Line 6: Create HTTP server
  res.statusCode = 200;                    // Line 7: Set success status
  res.setHeader('Content-Type', 'text/plain');    // Line 8: Set content type
  res.end('Hello, World!\n');             // Line 9: Send response body
});

server.listen(port, hostname, () => {     // Line 12: Start server
  console.log(`Server running at http://${hostname}:${port}/`);  // Line 13: Log startup
});
```

### Architecture Notes

- **Single-file implementation**: All server logic contained in one file for simplicity
- **Synchronous response**: No async operations, immediate response generation
- **Stateless design**: No session management or persistent state
- **HTTP/1.1 compatible**: Uses standard Node.js HTTP server implementation

## Deployment Guide

### Local Development

For development and testing:
```bash
node server.js
```

### Docker Deployment

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t hello-world-server .
docker run -p 3000:3000 hello-world-server
```

### PM2 Process Management

For production-like environments:
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server.js --name "hello-world"

# Monitor
pm2 status
pm2 logs hello-world
```

### systemd Service Configuration

Create `/etc/systemd/system/hello-world.service`:
```ini
[Unit]
Description=Hello World Node.js Server
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/hello-world
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable hello-world
sudo systemctl start hello-world
```

## Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill -9 <PID>
```

**Node.js version compatibility:**
- This server requires Node.js v7.0 or higher
- Check version: `node --version`
- Update if needed: Visit [nodejs.org](https://nodejs.org/)

**Permission denied on port binding:**
- Default configuration uses port 3000 (unprivileged)
- If you modify to use port 80, run with sudo or use port redirection

**Server not accessible from other machines:**
- Server binds to 127.0.0.1 (localhost only) by design
- To allow external access, change hostname to '0.0.0.0' in server.js

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test locally: `node server.js`
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

### Development Guidelines

- Maintain zero-dependency architecture
- Keep implementation minimal and focused
- Follow Node.js best practices
- Test all changes locally before submitting

## License

MIT License - see package.json for details

## Project Notes

- **Package.json discrepancy**: The `main` field points to `index.js`, but the actual entry point is `server.js`
- **Test harness purpose**: This server is specifically designed for backpropagation integration testing
- **Security model**: Localhost-only binding (127.0.0.1) provides isolation during testing phases