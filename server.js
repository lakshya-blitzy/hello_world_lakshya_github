/**
 * Simple Hello World Express HTTP Server
 * 
 * @fileoverview This Express.js application demonstrates basic HTTP server setup
 * with two GET endpoints. It showcases the testable design pattern using module.exports
 * to allow testing without port binding.
 * 
 * @description
 * Features:
 * - Two GET endpoints: / (returns "Hello, World!") and /evening (returns "Good evening")
 * - Testable design: exports Express app for supertest integration
 * - Conditional server startup: only binds to port when run directly
 * 
 * Technology Stack:
 * - Express.js 5.1.0
 * - Node.js v18.20.8+
 * 
 * @module server
 * @requires express
 */

const express = require('express');

// Server binding address - defaults to localhost (127.0.0.1)
// Can be overridden via environment variable: process.env.HOST
const hostname = '127.0.0.1';

// Server listening port - defaults to 3000
// Can be overridden via environment variable: process.env.PORT
const port = 3000;

/**
 * Express application instance
 * 
 * @type {Object}
 * @description Creates and configures the Express application with route handlers.
 * This app instance is exported to enable testing without port binding, allowing
 * supertest to perform HTTP assertions without actually starting the server.
 * 
 * The app is configured with two route handlers:
 * - GET / - Returns "Hello, World!" greeting
 * - GET /evening - Returns "Good evening" greeting
 * 
 * @see {@link https://expressjs.com/en/5x/api.html#app|Express Application API}
 * 
 * Usage in tests:
 * - Imported by tests/server.test.js for endpoint testing
 * - Imported by tests/server.lifecycle.test.js for lifecycle testing
 */
const app = express();

// Export app for testing (allows supertest to test without starting server)
module.exports = app;

/**
 * Root endpoint handler - Returns "Hello, World!" greeting
 * 
 * @route GET /
 * @param {Object} req - Express request object containing HTTP request information
 * @param {Object} res - Express response object for sending HTTP response
 * @returns {void}
 * 
 * @description
 * Returns a simple "Hello, World!\n" greeting message as plain text.
 * 
 * Response Details:
 * - Content-Type: text/html; charset=utf-8
 * - Content-Length: 14 bytes
 * - Status Code: 200 OK
 * - Response Body: "Hello, World!\n" (includes newline character)
 * 
 * @example
 * // Using curl:
 * curl http://127.0.0.1:3000/
 * // Returns: Hello, World!
 * 
 * @example
 * // Using fetch in JavaScript:
 * fetch('http://127.0.0.1:3000/')
 *   .then(response => response.text())
 *   .then(data => console.log(data)); // "Hello, World!\n"
 * 
 * @see Source: server.js:11-13
 * @see Validated by: tests/server.test.js:14-38
 */
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

/**
 * Evening greeting endpoint handler - Returns "Good evening" message
 * 
 * @route GET /evening
 * @param {Object} req - Express request object containing HTTP request information
 * @param {Object} res - Express response object for sending HTTP response
 * @returns {void}
 * 
 * @description
 * Returns a "Good evening" greeting message as plain text.
 * 
 * Response Details:
 * - Content-Type: text/html; charset=utf-8
 * - Content-Length: 12 bytes
 * - Status Code: 200 OK
 * - Response Body: "Good evening" (no trailing newline)
 * 
 * @example
 * // Using curl:
 * curl http://127.0.0.1:3000/evening
 * // Returns: Good evening
 * 
 * @example
 * // Using fetch in JavaScript:
 * fetch('http://127.0.0.1:3000/evening')
 *   .then(response => response.text())
 *   .then(data => console.log(data)); // "Good evening"
 * 
 * @see Source: server.js:15-17
 * @see Validated by: tests/server.test.js:41-50
 */
app.get('/evening', (req, res) => {
  res.send('Good evening');
});

/**
 * Conditional Server Startup
 * 
 * This block demonstrates the CommonJS module pattern for creating testable Node.js applications.
 * 
 * The condition `require.main === module` checks whether this file is being run directly
 * or imported as a module:
 * 
 * - When TRUE (file run directly with `node server.js`):
 *   The server starts and binds to the specified port and hostname, making it accessible
 *   via HTTP requests. This is the normal production/development server startup mode.
 * 
 * - When FALSE (file imported via `require('./server')` in tests):
 *   The server does NOT start or bind to any port. Only the Express app is exported,
 *   allowing test frameworks like supertest to make HTTP assertions without actual
 *   network operations. This prevents port conflicts and enables faster, isolated testing.
 * 
 * Testability Benefits:
 * - Tests can import the app without side effects (no port binding)
 * - Multiple test files can run concurrently without port conflicts
 * - Tests execute faster (no network I/O overhead)
 * - Tests remain isolated and deterministic
 * 
 * @see Source: server.js:20-24
 * @see Pattern Reference: CommonJS conditional execution for testability
 */
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
