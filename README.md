# hao-backprop-test

Test project for backprop integration. This repository demonstrates a complete language migration from Node.js to Python 3 Flask, maintaining 100% functional parity.

## Project Description

This project contains two implementations of a simple HTTP server that responds with "Hello, World!" to all requests:

### Original Implementation (Node.js)

The original `server.js` uses Node.js built-in `http` module to create a basic HTTP server with the following characteristics:
- Listens on `127.0.0.1:3000` (localhost)
- Responds to all HTTP requests (all methods, all paths)
- Returns static response: `Hello, World!\n`
- HTTP status code: `200 OK`
- Content-Type: `text/plain`
- Zero external dependencies

### Current Implementation (Python 3 Flask)

The current `app.py` is a Flask web application that replicates the Node.js server behavior exactly:
- Binds to `127.0.0.1:3000` (matching Node.js configuration)
- Accepts all HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
- Implements catch-all routing for all URL paths
- Returns identical response: `Hello, World!\n`
- HTTP status code: `200 OK`
- Content-Type: `text/plain; charset=utf-8`
- Flask 3.1.2 as primary dependency

## Requirements

- Python 3.12.3 or higher
- Flask 3.1.2 and dependencies (see `requirements.txt`)

## Setup

### Create Python Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Application

### Start Flask Server

```bash
python app.py
```

The server will start and display:
```
Server running at http://127.0.0.1:3000/
```

### Test the Server

Open another terminal and test with curl:

```bash
# Test GET request
curl http://127.0.0.1:3000/

# Test POST request
curl -X POST http://127.0.0.1:3000/

# Test arbitrary path
curl http://127.0.0.1:3000/some/path

# Expected output for all requests: Hello, World!
```

## Testing

Run the comprehensive unit test suite:

```bash
python test_app.py
```

Expected output:
```
........
----------------------------------------------------------------------
Ran 8 tests in 0.013s

OK
```

Test coverage:
- Response content verification
- HTTP status code validation
- Content-Type header checking
- Multiple HTTP methods (GET, POST, PUT, DELETE)
- Multiple URL paths (catch-all routing)
- Response length verification

## Project Structure

```
.
├── app.py                 # Flask application (Python 3)
├── test_app.py            # Comprehensive unit test suite
├── requirements.txt       # Python dependencies
├── server.js              # Original Node.js implementation (archived)
├── package.json           # Node.js package manifest (archived)
├── package-lock.json      # Node.js lockfile (archived)
├── README.md              # This file
├── .gitignore             # Git exclusions
└── venv/                  # Virtual environment (not committed)
```

## Migration Notes

The Flask implementation maintains exact functional parity with the Node.js original:
- **Behavioral Equivalence:** All HTTP methods and URL paths produce identical responses
- **Configuration Match:** Host (127.0.0.1) and port (3000) settings preserved
- **Response Identity:** Content, status code, and Content-Type header match exactly
- **Test Validation:** Comprehensive test suite verifies zero functional deviations

## Author

Generated as part of backprop integration testing

## License

MIT