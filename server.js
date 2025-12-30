/**
 * Express.js HTTP Server
 * 
 * This server provides two HTTP endpoints:
 * - GET / : Returns "Hello, World!" greeting
 * - GET /evening : Returns "Good evening" greeting
 * 
 * Server Configuration:
 * - Hostname: 127.0.0.1 (localhost only)
 * - Port: 3000
 */

const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

// Create Express application instance
const app = express();

/**
 * Root endpoint handler
 * @route GET /
 * @returns {string} "Hello, World!\n" - Plain text greeting
 */
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

/**
 * Evening greeting endpoint handler
 * @route GET /evening
 * @returns {string} "Good evening" - Plain text evening greeting
 */
app.get('/evening', (req, res) => {
  res.send('Good evening');
});

// Start the server and listen on configured hostname and port
app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
