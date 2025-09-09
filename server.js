// Security hardened Node.js server with Express.js framework
// Implements OWASP security controls per Section 0.4 Implementation Mapping

// Core framework and security middleware imports
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// Built-in modules for HTTPS support
const https = require('https');
const fs = require('fs');
const http = require('http');

// Server configuration constants
const hostname = '127.0.0.1';
const httpPort = 3000;
const httpsPort = 3443;

// Initialize Express application
const app = express();

// Security Headers Implementation (Section 0.4.1)
// Configure helmet with comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Policy Implementation (Section 0.4.5)
// Configure CORS with whitelisted origins and restricted methods
app.use(cors({
  origin: ['http://localhost:3000', 'https://localhost:3443'],
  methods: ['GET', 'POST'],
  credentials: false,
  maxAge: 86400, // 24 hours in seconds
  optionsSuccessStatus: 200
}));

// Rate Limiting Implementation (Section 0.4.3)
// Configure rate limiter for DDoS protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Apply rate limiting to all routes
app.use(limiter);

// Input Validation Implementation (Section 0.4.2)
// Configure request body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP to HTTPS redirect middleware
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(301, `https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});

// Input validation chains for all endpoints
const validateInput = [
  body('*').trim().escape(), // Sanitize all input fields
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }
];

// Core application route - preserving original "Hello, World!" functionality
app.get('/', validateInput, (req, res) => {
  res.status(200).type('text/plain').send('Hello, World!\n');
});

// Health check endpoint
app.get('/health', validateInput, (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle all other routes
app.use('*', (req, res) => {
  res.status(404).type('text/plain').send('Not Found\n');
});

// HTTPS Support Implementation (Section 0.4.4)
// Create self-signed certificates for development
let httpsOptions = {};

try {
  // Try to read existing certificates
  httpsOptions = {
    key: fs.readFileSync('server-key.pem'),
    cert: fs.readFileSync('server-cert.pem')
  };
} catch (err) {
  // Generate self-signed certificates if they don't exist
  console.log('Creating self-signed certificates for HTTPS...');
  
  // Note: In production, use proper certificates from a CA
  // For development, create with: openssl req -x509 -newkey rsa:4096 -keyout server-key.pem -out server-cert.pem -days 365 -nodes
  const { execSync } = require('child_process');
  try {
    execSync('openssl req -x509 -newkey rsa:2048 -keyout server-key.pem -out server-cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"', { stdio: 'ignore' });
    httpsOptions = {
      key: fs.readFileSync('server-key.pem'),
      cert: fs.readFileSync('server-cert.pem')
    };
    console.log('Self-signed certificates created successfully');
  } catch (certErr) {
    console.warn('Could not create self-signed certificates. HTTPS will be disabled.');
    console.warn('To enable HTTPS, install OpenSSL and restart the server.');
  }
}

// Create HTTP server
const httpServer = http.createServer(app);

// Create HTTPS server if certificates are available
let httpsServer = null;
if (httpsOptions.key && httpsOptions.cert) {
  httpsServer = https.createServer(httpsOptions, app);
}

// Start HTTP server
httpServer.listen(httpPort, hostname, () => {
  console.log(`HTTP Server running at http://${hostname}:${httpPort}/`);
});

// Start HTTPS server if available
if (httpsServer) {
  httpsServer.listen(httpsPort, hostname, () => {
    console.log(`HTTPS Server running at https://${hostname}:${httpsPort}/`);
  });
}
