/**
 * Express.js Tutorial Server
 * 
 * A simple HTTP server demonstrating Express.js routing capabilities
 * with two endpoints:
 * - GET / : Returns "Hello, World!" (original functionality)
 * - GET /evening : Returns "Good evening" (new endpoint)
 * 
 * Server Configuration:
 * - Hostname: 127.0.0.1
 * - Port: 3000
 */

const express = require('express');

// Server configuration constants (preserved from original implementation)
const hostname = '127.0.0.1';
const port = 3000;

// Initialize Express application
const app = express();

/**
 * Root endpoint - maintains original "Hello, World!" functionality
 * GET /
 * Returns: "Hello, World!\n" with Content-Type: text/plain
 */
app.get('/', (req, res) => {
  res.type('text/plain').send('Hello, World!\n');
});

/**
 * Evening endpoint - new endpoint per requirements
 * GET /evening
 * Returns: "Good evening" with Content-Type: text/plain
 */
app.get('/evening', (req, res) => {
  res.type('text/plain').send('Good evening');
});

// Start the server with the same configuration as original implementation
app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
