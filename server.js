/**
 * @fileoverview HTTP server implementation for hao-backprop-test project
 * @module server
 * @description Simple HTTP server that responds with "Hello, World!" to all requests.
 * This server demonstrates basic Node.js HTTP server functionality with configurable
 * hostname and port settings.
 * 
 * @example
 * // Basic server usage
 * const server = require('./server');
 * // Server will start automatically when file is executed
 * 
 * @example
 * // Accessing the server
 * // GET http://127.0.0.1:3000/
 * // Response: "Hello, World!"
 * 
 * @author Generated via Blitzy Platform
 * @version 1.0.0
 */

const http = require('http');

/**
 * Server binding address - the IP address where the server will accept connections
 * @const {string} hostname
 * @default '127.0.0.1'
 * @description Localhost IP address for local development. Change to '0.0.0.0' 
 * for external access or use specific IP for production deployment.
 */
const hostname = '127.0.0.1';

/**
 * Server listening port number
 * @const {number} port
 * @default 3000
 * @description TCP port where the HTTP server will listen for incoming requests.
 * Ensure this port is available and not blocked by firewall rules.
 * Common alternatives: 8000, 8080, 3001
 */
const port = 3000;

/**
 * HTTP request handler callback function
 * @callback RequestHandler
 * @param {http.IncomingMessage} req - The HTTP request object containing request details
 * @param {http.ServerResponse} res - The HTTP response object used to send response back to client
 * @description Handles all incoming HTTP requests and sends a simple "Hello, World!" response.
 * Sets appropriate status code (200 OK) and content type (text/plain) for successful responses.
 * 
 * @example
 * // Request handler behavior:
 * // Input: Any HTTP request to server
 * // Output: HTTP/1.1 200 OK with "Hello, World!" message
 */

/**
 * HTTP server instance created with request handler
 * @type {http.Server}
 * @description Creates an HTTP server that listens for requests and responds with the
 * configured request handler. The server handles all HTTP methods (GET, POST, etc.)
 * and routes uniformly.
 */
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

/**
 * Server startup listener callback
 * @callback StartupCallback
 * @description Executed when the server successfully starts listening on the specified
 * hostname and port. Logs server status and access URL to console for development feedback.
 * 
 * @example
 * // Console output when server starts:
 * // "Server running at http://127.0.0.1:3000/"
 */

/**
 * Start the HTTP server and begin listening for connections
 * @function
 * @description Binds the server to the specified hostname and port, then executes
 * the startup callback when ready. The server will continue running until manually
 * stopped or the process is terminated.
 * 
 * @param {number} port - Port number to listen on (from port constant)
 * @param {string} hostname - IP address to bind to (from hostname constant) 
 * @param {StartupCallback} callback - Function to execute when server starts successfully
 * 
 * @example
 * // Server startup process:
 * // 1. Bind to 127.0.0.1:3000
 * // 2. Begin accepting connections
 * // 3. Log "Server running at http://127.0.0.1:3000/"
 * // 4. Continue handling requests indefinitely
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
