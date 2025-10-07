/**
 * @fileoverview Simple HTTP server that responds with "Hello, World!" to all requests
 * @module server
 * @version 1.0.0
 * @license MIT
 * @author hxu
 * @description This module creates a minimal HTTP server using Node.js built-in http module.
 * The server binds to localhost (127.0.0.1) on port 3000 and responds with a static
 * plain-text "Hello, World!" message to all incoming requests regardless of HTTP method or path.
 * @example
 * // Start the server
 * node server.js
 * // Expected output: Server running at http://127.0.0.1:3000/
 * @see README.md for complete usage examples and deployment guide
 */
const http = require('http');

/**
 * Hostname for server binding - uses loopback address for local-only access
 * @constant {string}
 * @default '127.0.0.1'
 * @description The server binds exclusively to localhost, restricting access to the local machine.
 * To allow network access, change this to '0.0.0.0' (all interfaces) or a specific IP address.
 * Consider using environment variables for production deployments.
 */
const hostname = '127.0.0.1';
/**
 * Port number for HTTP server
 * @constant {number}
 * @default 3000
 * @description The TCP port on which the HTTP server listens for incoming connections.
 * Port numbers below 1024 require elevated privileges on Unix-like systems.
 * Recommend using environment variable (process.env.PORT) for production deployments.
 */
const port = 3000;

/**
 * HTTP server instance that handles all incoming requests
 * @type {http.Server}
 * @description Creates an HTTP server with a request handler callback that responds
 * with a static "Hello, World!" message. The server accepts all HTTP methods (GET, POST,
 * PUT, DELETE, etc.) and responds identically to all request paths.
 */
const server = http.createServer(
  /**
   * Request handler callback - invoked for every incoming HTTP request
   * @callback requestHandler
   * @param {http.IncomingMessage} req - HTTP request object containing request details (method, url, headers)
   * @param {http.ServerResponse} res - HTTP response object for sending the response
   * @description Sets status code to 200 (OK), Content-Type header to 'text/plain',
   * and sends "Hello, World!" as the response body. No request parsing or routing logic implemented.
   */
  (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

/**
 * Start the HTTP server and bind to configured hostname and port
 * @description Initiates the server, binding it to the specified hostname and port.
 * Once the server is ready to accept connections, the callback function executes
 * and logs the server URL to the console. The server runs indefinitely until
 * terminated (Ctrl+C) or the process is killed.
 * @listens port - Binds to the configured port number
 * @listens hostname - Binds to the configured hostname/IP address
 * @fires console.log - Outputs startup message when server is ready
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
