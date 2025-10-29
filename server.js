const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

const app = express();

// Export app for testing (allows supertest to test without starting server)
module.exports = app;

app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

app.get('/evening', (req, res) => {
  res.send('Good evening');
});

// Only start server if this file is run directly (not imported by tests)
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
