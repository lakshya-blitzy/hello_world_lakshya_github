/**
 * @fileoverview Simple HTTP server for Backprop platform integration testing
 * @module server
 * @requires http
 * @author hxu
 * @license MIT
 */
const http = require('http');

/**
 * Server hostname configuration
 * @const {string} hostname - IP address for server binding (localhost only)
 * @default '127.0.0.1'
 */
const hostname = '127.0.0.1';
/**
 * Server port configuration
 * @const {number} port - Port number for HTTP server
 * @default 3000
 */
const port = 3000;

/**
 * HTTP request handler for all incoming requests
 * @function requestHandler
 * @param {http.IncomingMessage} req - The request object
 * @param {http.ServerResponse} res - The response object
 * @returns {void}
 * @description Handles all HTTP requests and returns a Hello World response
 * @example
 * // Automatically called by http.createServer for each request
 * // GET http://127.0.0.1:3000/ → "Hello, World!\n"
 */
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

/**
 * Server startup callback
 * @function startupCallback
 * @returns {void}
 * @description Logs server startup confirmation to console
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
