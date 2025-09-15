const { createServer } = require('./app');

// Create server instance
const app = createServer();

// Error handler function for testability
const handleStartupError = (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
};

// Auto-start function for testability
const autoStart = () => {
  if (require.main === module) {
    app.start().catch(handleStartupError);
  }
};

// Execute auto-start
autoStart();

// Export the app instance for testing
// This provides access to server lifecycle methods: start(), close(), getServer()
// The getServer() method returns the native HTTP server instance with methods: listen(), close(), address(), listening
// Also export internal functions for testing
module.exports = app;
module.exports.handleStartupError = handleStartupError;
module.exports.autoStart = autoStart;
