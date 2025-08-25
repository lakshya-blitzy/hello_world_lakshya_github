/**
 * @fileoverview Simple HTTP server test harness for backpropagation integration
 * @description This module implements a minimal HTTP server designed to serve as a test harness
 * for validating backpropagation integration scenarios. The server binds to localhost only,
 * returns a simple "Hello, World!" response, and operates with zero external dependencies.
 * @requires http Node.js built-in HTTP module for server creation
 * @author Blitzy Platform
 * @version 1.0.0
 * @since Node.js v7+
 * @example
 * // Start the server
 * node server.js
 * 
 * @example
 * // Test the server
 * curl http://127.0.0.1:3000
 * // Returns: Hello, World!
 */

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

/**
 * HTTP request handler callback for the test harness server
 * @description Handles all incoming HTTP requests by returning a simple "Hello, World!" response.
 * This callback is designed for testing purposes and provides consistent output for integration validation.
 * @param {http.IncomingMessage} req - The HTTP request object containing client request information
 * @param {http.ServerResponse} res - The HTTP response object used to send data back to the client
 * @returns {void} No return value; response is sent via res.end()
 * @example
 * // The callback automatically handles requests like:
 * // GET http://127.0.0.1:3000/ -> Returns "Hello, World!"
 * // POST http://127.0.0.1:3000/test -> Returns "Hello, World!"
 */
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

/**
 * Server startup callback for the test harness
 * @description Callback function executed when the HTTP server successfully binds to the specified
 * hostname and port. Outputs server status information to console for monitoring and verification.
 * @returns {void} No return value; outputs status message to console
 * @example
 * // Console output when server starts successfully:
 * // "Server running at http://127.0.0.1:3000/"
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
