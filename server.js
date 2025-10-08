/**
 * @fileoverview Simple HTTP server that responds with "Hello, World!" to all requests.
 * This module creates a basic Node.js HTTP server bound to localhost that demonstrates
 * fundamental server creation and request handling patterns.
 * 
 * For usage instructions and deployment guide, see README.md
 * 
 * @module server
 * @author hxu
 */

// Import the Node.js core HTTP module for server creation
const http = require('http');

/**
 * Server hostname - bound to localhost for local development.
 * Using 127.0.0.1 (loopback interface) restricts access to the local machine only,
 * providing security by preventing external network access. For production deployment
 * with external access, change this to '0.0.0.0' to bind to all network interfaces.
 * 
 * @constant {string}
 * @default '127.0.0.1'
 */
const hostname = '127.0.0.1';

/**
 * Server port number to listen on.
 * Port 3000 is commonly used for development servers. Ensure this port is not
 * already in use by another application. For production, consider using port 80
 * (HTTP) or 443 (HTTPS) with appropriate permissions, or use environment variables
 * for configuration flexibility.
 * 
 * @constant {number}
 * @default 3000
 */
const port = 3000;

/**
 * HTTP request handler function that processes all incoming requests.
 * This handler responds to every request (regardless of HTTP method or path)
 * with a simple "Hello, World!" plain text message. In a production application,
 * this would typically include routing logic to handle different endpoints.
 * 
 * @param {http.IncomingMessage} req - The HTTP request object containing request details
 *                                      (method, URL, headers, etc.)
 * @param {http.ServerResponse} res - The HTTP response object used to send the response
 *                                     back to the client
 * @returns {void} This function doesn't return a value; it sends the response directly
 */
const server = http.createServer((req, res) => {
  // Set HTTP status code to 200 (OK) indicating successful request processing
  res.statusCode = 200;
  
  // Set Content-Type header to 'text/plain' to indicate plain text response format
  // This tells the client (browser/HTTP client) how to interpret the response body
  res.setHeader('Content-Type', 'text/plain');
  
  // Send the response body "Hello, World!\n" and close the connection
  // res.end() finalizes the response and signals completion to the client
  res.end('Hello, World!\n');
});

/**
 * Start the HTTP server and bind it to the specified hostname and port.
 * The server begins listening for incoming HTTP connections on the configured
 * network interface. The callback function executes once the server successfully
 * starts and is ready to accept requests.
 * 
 * @listens {number} port - The port number (3000) on which the server listens
 * @listens {string} hostname - The hostname/IP address (127.0.0.1) to bind to
 * @callback Executes when server successfully starts listening
 */
server.listen(port, hostname, () => {
  // Log startup confirmation message to console for developer feedback
  // This confirms the server is running and displays the access URL
  console.log(`Server running at http://${hostname}:${port}/`);
});
