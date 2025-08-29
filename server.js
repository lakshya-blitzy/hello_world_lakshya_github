const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

const app = express();

// Route handler for root endpoint - preserving original "Hello, World!\n" response
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

// Route handler for good evening endpoint
app.get('/good-evening', (req, res) => {
  res.send('Good evening');
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
