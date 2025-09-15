const { createServer } = require('./app');

// Create and start the server
const app = createServer();
app.start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Export for testing
module.exports = app;
