/**
 * @module server
 * @description Simple HTTP server that responds with "Hello, World!" to all requests.
 * This minimal Node.js HTTP server uses only the built-in http module with no external
 * dependencies. It demonstrates basic HTTP server setup, request handling, and network
 * binding in Node.js.
 * 
 * @author hxu
 * @license MIT
 * @see README.md for comprehensive usage examples and deployment guide
 */

/**
 * Node.js built-in HTTP module for creating HTTP servers and handling HTTP requests.
 * This module provides the core functionality for implementing HTTP server behavior
 * without requiring any external packages.
 * 
 * @requires http
 * @see {@link https://nodejs.org/api/http.html|Node.js HTTP Module Documentation}
 */
const http = require('http');

/**
 * Server hostname configuration specifying the network interface to bind to.
 * 
 * The value '127.0.0.1' is the IPv4 loopback interface, which restricts the server
 * to accepting connections only from the local machine. This provides security by
 * preventing external network access, making it ideal for development and testing.
 * 
 * For production deployment accessible from external networks, consider changing to:
 * - '0.0.0.0' to bind to all available network interfaces
 * - A specific IP address to bind to a particular network interface
 * 
 * @constant {string} hostname
 * @default '127.0.0.1'
 * @see README.md#configuration for customization guide and security implications
 */
const hostname = '127.0.0.1';

/**
 * TCP port number on which the HTTP server listens for incoming connections.
 * 
 * Port 3000 is a conventional choice for Node.js development servers as it:
 * - Falls outside the privileged port range (0-1023) requiring root access
 * - Is commonly used in Node.js tutorials and documentation
 * - Rarely conflicts with system services
 * 
 * This can be customized by modifying this constant or using environment variables:
 * - const port = process.env.PORT || 3000;
 * 
 * Valid port range: 1024-65535 (for non-privileged users)
 * 
 * @constant {number} port
 * @default 3000
 * @see README.md#configuration for port customization examples
 */
const port = 3000;

/**
 * HTTP server instance created with a request handler callback.
 * 
 * The request handler processes all incoming HTTP requests regardless of method or path.
 * This simple implementation demonstrates a minimal HTTP server that responds identically
 * to all requests with a plain text "Hello, World!" message.
 * 
 * Request Handler Callback:
 * - Executes for every incoming HTTP request
 * - Sets HTTP 200 OK status code indicating successful request processing
 * - Sets Content-Type header to 'text/plain' for plain text response
 * - Sends "Hello, World!\n" as the response body
 * - Automatically closes the connection after sending response
 * 
 * @callback requestHandler
 * @param {http.IncomingMessage} req - The incoming HTTP request object containing request
 *        details such as HTTP method, URL, headers, and other metadata. This object is a
 *        readable stream that can be used to access the request body if present.
 * @param {http.ServerResponse} res - The HTTP response object used to send data back to
 *        the client. Provides methods to set status codes, headers, and write the response
 *        body. The response is automatically sent when res.end() is called.
 * @returns {void} No return value - response is sent via res.end()
 * 
 * @example
 * // The server responds to any HTTP request with:
 * // HTTP/1.1 200 OK
 * // Content-Type: text/plain
 * // 
 * // Hello, World!
 * 
 * @see README.md#api-documentation for complete endpoint specifications and examples
 * @see {@link https://nodejs.org/api/http.html#class-httpincomingmessage|IncomingMessage API}
 * @see {@link https://nodejs.org/api/http.html#class-httpserverresponse|ServerResponse API}
 */
const server = http.createServer((req, res) => {
  // Set HTTP status code to 200 OK indicating successful request processing
  res.statusCode = 200;
  
  // Set Content-Type header to text/plain to indicate plain text response format
  res.setHeader('Content-Type', 'text/plain');
  
  // Send the response body "Hello, World!" and close the connection
  res.end('Hello, World!\n');
});

/**
 * Start the HTTP server and bind to the specified hostname and port.
 * 
 * This method binds the server to the loopback interface (127.0.0.1) on port 3000,
 * making it accessible only from the local machine. Once the server successfully
 * binds to the network interface and is ready to accept connections, the callback
 * function executes to log the server URL.
 * 
 * The server will continue running and listening for HTTP requests until the process
 * is terminated (Ctrl+C) or the server is explicitly closed.
 * 
 * Network Binding:
 * - Hostname: 127.0.0.1 (loopback interface, localhost only)
 * - Port: 3000 (TCP port for HTTP connections)
 * - Protocol: HTTP (unencrypted)
 * 
 * @param {number} port - The TCP port number to listen on (3000)
 * @param {string} hostname - The network interface to bind to (127.0.0.1)
 * @param {Function} callback - Executed when server successfully starts listening
 * @listens {number} port - Server listens on TCP port 3000
 * @listens {string} hostname - Server binds to loopback interface 127.0.0.1
 * 
 * @example
 * // After starting with: node server.js
 * // Console output: Server running at http://127.0.0.1:3000/
 * // Test with: curl http://127.0.0.1:3000/
 * 
 * @see README.md#usage for running the server and testing
 * @see README.md#deployment for production deployment options
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
