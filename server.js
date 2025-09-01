/**
 * @fileoverview Simple HTTP server test fixture implementation
 * @module server
 * @description A minimal HTTP server that responds with "Hello, World!" to all requests.
 *              Designed as a test fixture for integration testing and development purposes.
 *              Uses zero external dependencies, relying only on Node.js built-in modules.
 *              Binds to localhost (127.0.0.1) for security, preventing external network access.
 * @version 1.0.0
 * @author Generated for hao-backprop-test project
 * @since Node.js ES2015+
 */

const http = require('http');

/**
 * Server configuration constants
 * @description Localhost binding for security - prevents external network access
 * @constant {string} hostname - IPv4 localhost address for local development only
 */
const hostname = '127.0.0.1';

/**
 * @description Standard HTTP port for development server
 * @constant {number} port - TCP port number for HTTP server binding
 */
const port = 3000;

/**
 * HTTP server instance with request handler callback
 * @description Creates HTTP server that responds to all requests with "Hello, World!" message
 * @type {http.Server}
 */
const server = http.createServer(
  /**
   * HTTP request handler callback function
   * @description Processes all incoming HTTP requests and returns a plain text response.
   *              Sets appropriate HTTP headers and status codes for successful responses.
   *              Does not differentiate between request methods (GET, POST, etc.) or paths.
   * @param {http.IncomingMessage} req - HTTP request object containing client request data
   * @param {http.ServerResponse} res - HTTP response object for sending data back to client
   * @returns {void} No return value - response is sent via res.end()
   * @example
   * // All requests receive the same response:
   * // HTTP/1.1 200 OK
   * // Content-Type: text/plain
   * // 
   * // Hello, World!
   */
  (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
  }
);

/**
 * Start HTTP server and bind to configured hostname and port
 * @description Begins listening for HTTP connections on the specified interface and port.
 *              Uses callback to confirm successful server startup and log access URL.
 */
server.listen(port, hostname, 
  /**
   * Server startup callback function
   * @description Executed when server successfully binds to the specified port and hostname.
   *              Logs the server URL to console for development convenience.
   *              Indicates server is ready to accept HTTP requests.
   * @returns {void} No return value - outputs to console only
   * @example
   * // Console output when server starts:
   * // Server running at http://127.0.0.1:3000/
   */
  () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  }
);
