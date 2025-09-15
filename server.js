const { createServer } = require('./app');

// Create server instance
const app = createServer();

// Only start the server if this module is run directly (not imported)
if (require.main === module) {
  app.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Export for testing
module.exports = app;
