/**
 * @fileoverview Express.js HTTP Server Application
 * 
 * This module implements a simple HTTP server using Express.js framework,
 * providing RESTful endpoints for greeting messages. The server demonstrates
 * basic Express.js routing patterns and serves as a foundation for building
 * more complex web applications.
 * 
 * @module server
 * @version 1.0.0
 * @author hxu
 * @license MIT
 * 
 * @description
 * The server provides two HTTP GET endpoints:
 * - GET / : Returns "Hello, World!" greeting
 * - GET /evening : Returns "Good evening" greeting
 * 
 * Server Configuration:
 * - Hostname: 127.0.0.1 (localhost only for security)
 * - Port: 3000 (default development port)
 * 
 * @example
 * // Start the server
 * $ node server.js
 * // Output: Server running at http://127.0.0.1:3000/
 * 
 * @example
 * // Test the root endpoint
 * $ curl http://127.0.0.1:3000/
 * // Output: Hello, World!
 * 
 * @example
 * // Test the evening endpoint
 * $ curl http://127.0.0.1:3000/evening
 * // Output: Good evening
 */

'use strict';

// ============================================================================
// DEPENDENCIES
// ============================================================================

/**
 * Express.js framework - Fast, unopinionated, minimalist web framework for Node.js
 * @see {@link https://expressjs.com/} for Express.js documentation
 * 
 * Express provides:
 * - Robust routing with HTTP method support (GET, POST, PUT, DELETE, etc.)
 * - Middleware support for request/response processing
 * - Template engine support for dynamic HTML generation
 * - Static file serving capabilities
 */
const express = require('express');

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

/**
 * Server hostname configuration
 * 
 * Using '127.0.0.1' (localhost) ensures the server only accepts connections
 * from the local machine, providing a secure default for development.
 * 
 * For production deployments accepting external connections, this should
 * be changed to '0.0.0.0' or a specific network interface IP address.
 * 
 * @constant {string}
 * @default '127.0.0.1'
 */
const hostname = '127.0.0.1';

/**
 * Server port configuration
 * 
 * Port 3000 is a common default for Node.js development servers.
 * This port should be available (not in use by other applications)
 * for the server to start successfully.
 * 
 * For production deployments, consider using:
 * - Port 80 for HTTP (requires root privileges on Unix systems)
 * - Port 443 for HTTPS (requires SSL certificates)
 * - Environment variable for flexible configuration
 * 
 * @constant {number}
 * @default 3000
 */
const port = 3000;

// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================

/**
 * Express application instance
 * 
 * The express() function creates an Express application object that provides
 * methods for:
 * - Routing HTTP requests (app.get(), app.post(), etc.)
 * - Configuring middleware (app.use())
 * - Rendering HTML views (app.render())
 * - Configuring application settings (app.set())
 * 
 * This instance is the central object that orchestrates all request handling.
 * 
 * @constant {express.Application}
 */
const app = express();

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * Root endpoint handler - Returns Hello World greeting
 * 
 * This route handles HTTP GET requests to the root path ('/').
 * It serves as the default landing endpoint and returns a classic
 * "Hello, World!" message commonly used to verify server functionality.
 * 
 * @function
 * @name getRootHandler
 * @route {GET} /
 * 
 * @param {express.Request} req - Express request object containing:
 *   - req.params: Route parameters (none for this endpoint)
 *   - req.query: Query string parameters
 *   - req.body: Request body (not used for GET requests)
 *   - req.headers: HTTP request headers
 * 
 * @param {express.Response} res - Express response object providing methods:
 *   - res.send(): Send a response of various types
 *   - res.json(): Send a JSON response
 *   - res.status(): Set HTTP status code
 *   - res.set(): Set response headers
 * 
 * @returns {void} Sends plain text response to client
 * 
 * @example
 * // Request
 * GET / HTTP/1.1
 * Host: 127.0.0.1:3000
 * 
 * // Response
 * HTTP/1.1 200 OK
 * Content-Type: text/html; charset=utf-8
 * 
 * Hello, World!
 */
app.get('/', (req, res) => {
  // The res.send() method automatically:
  // 1. Sets the Content-Type header based on the response body type
  // 2. Sets the Content-Length header
  // 3. Ends the response with the provided data
  // The '\n' newline character ensures proper formatting in terminal output
  res.send('Hello, World!\n');
});

/**
 * Evening greeting endpoint handler - Returns Good Evening message
 * 
 * This route handles HTTP GET requests to the '/evening' path.
 * It demonstrates how to create additional routes in Express.js
 * and returns a contextual "Good evening" greeting message.
 * 
 * @function
 * @name getEveningHandler
 * @route {GET} /evening
 * 
 * @param {express.Request} req - Express request object
 *   The request object represents the HTTP request and has properties
 *   for the request query string, parameters, body, HTTP headers, etc.
 * 
 * @param {express.Response} res - Express response object
 *   The response object represents the HTTP response that the Express
 *   app sends when it receives an HTTP request.
 * 
 * @returns {void} Sends plain text response to client
 * 
 * @example
 * // Request
 * GET /evening HTTP/1.1
 * Host: 127.0.0.1:3000
 * 
 * // Response
 * HTTP/1.1 200 OK
 * Content-Type: text/html; charset=utf-8
 * 
 * Good evening
 */
app.get('/evening', (req, res) => {
  // Send the evening greeting response
  // Note: No trailing newline to match the exact user requirement
  res.send('Good evening');
});

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Start the Express HTTP server
 * 
 * The app.listen() method binds and listens for connections on the specified
 * host and port. This method is identical to Node.js's http.Server.listen().
 * 
 * The callback function is invoked once the server is ready to accept
 * connections, confirming successful startup.
 * 
 * @function
 * @name startServer
 * 
 * @param {number} port - Port number to listen on (3000)
 * @param {string} hostname - Hostname to bind to (127.0.0.1)
 * @param {Function} callback - Function called when server is ready
 * 
 * @returns {http.Server} The underlying Node.js HTTP server instance
 * 
 * @fires Server#listening When the server has been bound
 * @fires Server#error When an error occurs (e.g., port in use)
 * 
 * @example
 * // Server startup output
 * Server running at http://127.0.0.1:3000/
 */
app.listen(port, hostname, () => {
  // Log server status to console for operator visibility
  // Template literal constructs the full URL for convenience
  console.log(`Server running at http://${hostname}:${port}/`);
});

// ============================================================================
// MODULE DOCUMENTATION
// ============================================================================

/**
 * Express.js application patterns demonstrated in this module:
 * 
 * 1. APPLICATION CREATION
 *    const app = express() creates the application instance
 * 
 * 2. ROUTE DEFINITION
 *    app.METHOD(PATH, HANDLER) defines route handlers
 *    - METHOD: HTTP method (get, post, put, delete, etc.)
 *    - PATH: URL path pattern ('/', '/evening', '/users/:id')
 *    - HANDLER: Function(req, res) that processes the request
 * 
 * 3. REQUEST HANDLING
 *    Request object (req) provides:
 *    - req.params: Route parameters
 *    - req.query: Query string parameters
 *    - req.body: Request body (requires body-parser middleware)
 *    - req.headers: HTTP headers
 * 
 * 4. RESPONSE SENDING
 *    Response object (res) provides:
 *    - res.send(): Send various response types
 *    - res.json(): Send JSON response
 *    - res.status(): Set HTTP status code
 *    - res.redirect(): Redirect to another URL
 * 
 * 5. SERVER BINDING
 *    app.listen(port, [hostname], [callback]) starts the server
 *    - Binds to specified port and hostname
 *    - Callback confirms successful startup
 */
