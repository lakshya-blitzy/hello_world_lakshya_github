/**
 * @fileoverview Simple HTTP Server for the Accounting System
 * 
 * This module creates a basic HTTP server using Node.js's built-in http module.
 * The server listens for incoming HTTP requests and responds with a simple
 * "Hello, World!" message. This serves as the foundation for the Accounting
 * System's server-side infrastructure.
 * 
 * @module server
 * @requires http
 * @version 1.0.0
 * @author Accounting System Development Team
 * @license MIT
 */

'use strict';

// Import the built-in Node.js HTTP module for creating the web server
// The http module provides low-level functionality to create HTTP servers
// and make HTTP requests without external dependencies
const http = require('http');

/**
 * The hostname/IP address where the server will listen for connections.
 * Using '127.0.0.1' (localhost) restricts access to the local machine only.
 * For production, this might be changed to '0.0.0.0' to accept external connections.
 * 
 * @constant {string}
 * @default '127.0.0.1'
 */
const hostname = '127.0.0.1';

/**
 * The port number on which the server will listen for incoming connections.
 * Port 3000 is commonly used for development servers to avoid conflicts
 * with standard ports (80 for HTTP, 443 for HTTPS).
 * 
 * @constant {number}
 * @default 3000
 */
const port = 3000;

/**
 * Request handler callback function for the HTTP server.
 * This function is invoked for every incoming HTTP request to the server.
 * It processes the request and sends an appropriate response back to the client.
 * 
 * @callback requestHandler
 * @param {http.IncomingMessage} req - The incoming HTTP request object containing
 *   request headers, URL, HTTP method, and other request metadata.
 * @param {http.ServerResponse} res - The HTTP response object used to send
 *   data back to the client, including status codes, headers, and body content.
 * @returns {void}
 * 
 * @example
 * // When a client makes a request to http://127.0.0.1:3000/
 * // The server responds with:
 * // HTTP/1.1 200 OK
 * // Content-Type: text/plain
 * // 
 * // Hello, World!
 */

/**
 * HTTP server instance created using the http.createServer() method.
 * The server handles all incoming HTTP requests by executing the provided
 * callback function for each request.
 * 
 * @type {http.Server}
 * @description Creates an HTTP server that responds to all requests with
 *   a plain text "Hello, World!" message. This is the foundation for
 *   the Accounting System's API endpoints.
 */
const server = http.createServer((req, res) => {
  // Set the HTTP status code to 200 (OK) indicating a successful request
  // Status code 200 means the request was received, understood, and processed successfully
  res.statusCode = 200;
  
  // Set the Content-Type header to 'text/plain' to inform the client
  // that the response body contains plain text (not HTML, JSON, etc.)
  // This header helps browsers and clients properly interpret the response
  res.setHeader('Content-Type', 'text/plain');
  
  // End the response and send the "Hello, World!" message to the client
  // The res.end() method signals that all response headers and body have been sent
  // The newline character (\n) ensures proper line termination in the output
  res.end('Hello, World!\n');
});

/**
 * Starts the HTTP server and begins listening for incoming connections.
 * 
 * The server.listen() method binds the server to the specified hostname and port,
 * making it ready to accept incoming HTTP requests. The callback function is
 * executed once the server is successfully bound and listening.
 * 
 * @fires server#listening - Emitted when the server has been bound after calling server.listen()
 * 
 * @example
 * // After starting the server, you can access it at:
 * // http://127.0.0.1:3000/
 * 
 * // Expected console output:
 * // Server running at http://127.0.0.1:3000/
 */
server.listen(port, hostname, () => {
  // Log a message to the console indicating the server is running
  // This provides feedback to developers/operators that the server started successfully
  // Template literal is used to dynamically insert the hostname and port values
  console.log(`Server running at http://${hostname}:${port}/`);
});

/**
 * Export the server instance for testing and external module access.
 * This allows other modules to interact with the server programmatically,
 * which is useful for integration testing and graceful shutdown handling.
 * 
 * @exports server
 */
module.exports = server;
