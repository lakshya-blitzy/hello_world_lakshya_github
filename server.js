const http = require('http');

// Configuration with environment variable support for flexible deployment
const hostname = process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.PORT || '3000', 10);

// Track active connections for graceful shutdown
const connections = new Set();

// Request handler with comprehensive error handling and input validation
const server = http.createServer((req, res) => {
  try {
    // Input validation: Check request method against allowed list
    const allowedMethods = ['GET', 'HEAD'];
    if (!allowedMethods.includes(req.method)) {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Allow', allowedMethods.join(', '));
      res.end('Method Not Allowed\n');
      return;
    }
    
    // Input validation: Reject excessively long URLs to prevent buffer attacks
    if (req.url.length > 2048) {
      res.statusCode = 414;
      res.setHeader('Content-Type', 'text/plain');
      res.end('URI Too Long\n');
      return;
    }
    
    // Input validation: Detect path traversal and other suspicious patterns
    const suspiciousPatterns = ['..', '\\', '\x00'];
    if (suspiciousPatterns.some(pattern => req.url.includes(pattern))) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Bad Request\n');
      return;
    }
    
    // Normal response for valid requests
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
  } catch (err) {
    // Error handling: Catch any exceptions to prevent server crash
    console.error('Error handling request:', err);
    
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error\n');
    }
  }
});

// Track connections for graceful shutdown capability
server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => {
    connections.delete(conn);
  });
});

// Error handling: Listen for server errors (e.g., EADDRINUSE, EACCES)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use`);
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error(`Error: Permission denied to bind to port ${port}`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Graceful shutdown handling function
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. All requests processed.');
    process.exit(0);
  });
  
  // Force close after timeout to prevent hanging
  setTimeout(() => {
    console.error('Shutdown timeout. Forcing close...');
    
    // Destroy all remaining connections
    connections.forEach((conn) => {
      conn.destroy();
    });
    
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
