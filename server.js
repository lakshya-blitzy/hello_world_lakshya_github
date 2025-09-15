const { createServer } = require('./app');

// Create server instance
const app = createServer();

// Get the underlying HTTP server instance for export
const server = app.getServer();

// Only start the server if this module is run directly (not imported)
if (require.main === module) {
  app.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Export the server instance for testing
// This provides access to native HTTP server methods: listen(), close(), address(), listening
module.exports = { server };
