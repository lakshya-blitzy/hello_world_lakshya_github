const http = require('http');
const url = require('url');

const hostname = '127.0.0.1';
const port = 3000;

// Configuration for security and resource limits
const MAX_HEADER_SIZE = 8192;
const REQUEST_TIMEOUT = 30000;
const HEADERS_TIMEOUT = 5000;
const KEEP_ALIVE_TIMEOUT = 5000;
const MAX_REQUESTS_PER_SOCKET = 100;

// Track connections for graceful shutdown
const activeConnections = new Set();
let isShuttingDown = false;

const server = http.createServer((req, res) => {
  // CRITICAL: Validate HTTP method to prevent unsupported operations
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Allow', allowedMethods.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // CRITICAL: Validate URL to prevent XSS and injection attacks
  if (req.url.includes('..') || req.url.includes('<') || req.url.includes('>') ||
      req.url.toLowerCase().includes('javascript:')) {
    res.statusCode = 400;
    res.end('Invalid URL - potentially malicious content detected\n');
    return;
  }

  // CRITICAL: Set security headers to prevent various attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
  }
  
  res.end('Hello, World!\n');
});

// CRITICAL: Configure timeouts to prevent resource exhaustion
server.requestTimeout = REQUEST_TIMEOUT;
server.headersTimeout = HEADERS_TIMEOUT;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;
server.maxRequestsPerSocket = MAX_REQUESTS_PER_SOCKET;

// CRITICAL: Handle server errors to prevent crashes
server.on('error', (err) => {
  console.error('Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  }
});

// CRITICAL: Track connections for proper cleanup
server.on('connection', (socket) => {
  activeConnections.add(socket);
  socket.setTimeout(REQUEST_TIMEOUT);
  socket.on('close', () => activeConnections.delete(socket));
  socket.on('timeout', () => {
    socket.destroy();
    activeConnections.delete(socket);
  });
});

// CRITICAL: Handle malformed requests
server.on('clientError', (err, socket) => {
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

// CRITICAL: Implement graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}, starting graceful shutdown...`);
  isShuttingDown = true;
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Forcing shutdown');
    activeConnections.forEach(socket => socket.destroy());
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

module.exports = server;
