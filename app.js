const http = require('http');

/**
 * Creates an HTTP server instance without starting it
 * @param {Object} options - Configuration options
 * @param {string} options.hostname - Server hostname (default: '127.0.0.1')
 * @param {number} options.port - Server port (default: 3000)
 * @returns {Object} - Object containing server instance and configuration
 */
function createServer(options = {}) {
  const hostname = options.hostname || '127.0.0.1';
  const port = options.port || 3000;

  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
  });

  return {
    server,
    hostname,
    port,
    start: () => {
      return new Promise((resolve, reject) => {
        server.listen(port, hostname, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`Server running at http://${hostname}:${port}/`);
            resolve({ server, hostname, port });
          }
        });
      });
    },
    stop: () => {
      return new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  };
}

module.exports = { createServer };