/**
 * @fileoverview Minimal Node.js HTTP server for Backprop GPU cloud platform integration testing.
 * 
 * This module implements a simple HTTP server that responds with "Hello, World!" to all requests.
 * It serves as a basic integration test for deploying Node.js applications on the Backprop platform,
 * which offers cost-effective GPU cloud services at 3-4x cheaper rates than traditional providers.
 * 
 * The server binds to localhost:3000 for secure local development and testing purposes.
 * 
 * @author Backprop Integration Team
 * @version 1.0.0
 * @since 1.0.0
 */

const http = require('http');

/**
 * Server configuration constants for local development and testing.
 * These values are statically configured for security and consistency.
 */

/**
 * Hostname for server binding - localhost only for security.
 * Using 127.0.0.1 instead of 0.0.0.0 prevents external network access.
 * @constant {string}
 */
const hostname = '127.0.0.1';

/**
 * Port number for HTTP server.
 * Port 3000 is the standard development port for Node.js applications.
 * @constant {number}
 */
const port = 3000;

/**
 * HTTP request handler callback for the server.
 * Processes all incoming HTTP requests and returns a simple "Hello, World!" response.
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request object containing request details
 * @param {http.ServerResponse} res - The HTTP response object used to send data back to the client
 * @returns {void}
 * 
 * @example
 * // The server responds to all HTTP methods and paths:
 * // GET http://127.0.0.1:3000/ → "Hello, World!"
 * // POST http://127.0.0.1:3000/api → "Hello, World!"
 * // Any request will receive the same response with HTTP 200 status
 */
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

/**
 * Server startup callback function executed when the server begins listening.
 * Logs the server URL to the console for development convenience.
 * 
 * @callback ListenCallback
 * @returns {void}
 * 
 * @example
 * // Console output when server starts successfully:
 * // "Server running at http://127.0.0.1:3000/"
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
