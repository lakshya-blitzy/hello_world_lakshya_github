/**
 * Simple Express.js HTTP server demonstrating basic routing and request handling.
 * This server binds to localhost and provides two GET endpoints for testing.
 * 
 * @module server
 * @requires express
 * @author hxu
 * @license MIT
 */

const express = require('express');

/**
 * Server hostname using loopback address for local-only access.
 * This restricts the server to accept connections only from the local machine,
 * preventing external network access for security in development environments.
 * 
 * @const {string}
 * @default '127.0.0.1'
 */
const hostname = '127.0.0.1';

/**
 * HTTP server port number.
 * Port 3000 is a standard development port commonly used for Node.js applications.
 * This value is configurable and can be changed to avoid conflicts with other services.
 * 
 * @const {number}
 * @default 3000
 */
const port = 3000;

/**
 * Main Express application instance.
 * This object handles all routing, middleware, and HTTP request/response processing.
 * Initialized with default Express configuration.
 * 
 * @const {express.Application}
 */
const app = express();

/**
 * Root endpoint returning a welcome message.
 * Handles GET requests to the root path and responds with a plain text greeting.
 * 
 * @name GET_root
 * @route {GET} /
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} Sends plain text string "Hello, World!\n"
 * @example
 * curl http://127.0.0.1:3000/
 */
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

/**
 * Greeting endpoint returning a time-of-day message.
 * Handles GET requests to the /evening path and responds with an evening greeting.
 * 
 * @name GET_evening
 * @route {GET} /evening
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} Sends plain text string "Good evening"
 * @example
 * curl http://127.0.0.1:3000/evening
 */
app.get('/evening', (req, res) => {
  res.send('Good evening');
});

/**
 * Start the HTTP server and bind to the specified host and port.
 * Logs the server URL to the console once the server is successfully listening.
 * 
 * @param {number} port - The port number on which the server listens
 * @param {string} hostname - The hostname/IP address to bind the server to
 * @param {Function} callback - Function invoked when the server starts successfully
 */
app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
