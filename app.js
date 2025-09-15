const http = require('http');

/**
 * Creates an HTTP server instance without starting it, enabling test isolation
 * and programmatic server control. This factory function separates server 
 * creation from server startup, allowing tests to control the server lifecycle.
 * 
 * @param {string} hostname - The hostname to bind the server to (default: 127.0.0.1 or HOST env var)
 * @param {number|string} port - The port to bind the server to (default: 3000 or PORT env var)
 * @returns {Object} An object with a start() method that returns a Promise
 */
function createServer(hostname = process.env.HOST || '127.0.0.1', port = process.env.PORT || 3000) {
    // Create the HTTP server with request handler that returns "Hello, World!" for all requests
    const server = http.createServer((req, res) => {
        // Set response status code to 200 (OK)
        res.statusCode = 200;
        
        // Set the Content-Type header to text/plain as required
        res.setHeader('Content-Type', 'text/plain');
        
        // Send the "Hello, World!" response body and end the response
        res.end('Hello, World!\n');
    });

    // Return an object with a start method for compatibility with server.js expectations
    return {
        /**
         * Starts the HTTP server and binds it to the specified hostname and port
         * @returns {Promise} A promise that resolves when the server starts successfully
         */
        start() {
            return new Promise((resolve, reject) => {
                // Handle server startup errors
                const errorHandler = (error) => {
                    server.removeListener('listening', successHandler);
                    reject(error);
                };

                // Handle successful server startup
                const successHandler = () => {
                    server.removeListener('error', errorHandler);
                    console.log(`Server running at http://${hostname}:${port}/`);
                    resolve(server);
                };

                // Add event listeners
                server.once('error', errorHandler);
                server.once('listening', successHandler);

                // Start listening on the specified hostname and port
                server.listen(port, hostname);
            });
        },

        /**
         * Gets the underlying HTTP server instance for direct access (useful for testing)
         * @returns {http.Server} The Node.js HTTP server instance
         */
        getServer() {
            return server;
        },

        /**
         * Closes the server gracefully
         * @returns {Promise} A promise that resolves when the server closes
         */
        close() {
            return new Promise((resolve) => {
                server.close(() => {
                    resolve();
                });
            });
        }
    };
}

// Export the createServer function using CommonJS module syntax for compatibility
module.exports = { createServer };