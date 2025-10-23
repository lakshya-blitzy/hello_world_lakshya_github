# hao-backprop-test

Test project for backprop integration - migrated from Node.js to Python Flask.

This repository contains both the original Node.js HTTP server implementation and the current Python Flask implementation with 100% functional parity.

## Original Node.js Implementation

The original implementation (`server.js`) was a minimal Node.js HTTP server with the following characteristics:

- **Framework:** Node.js built-in `http` module
- **Host:** 127.0.0.1 (localhost)
- **Port:** 3000
- **Response:** Returns "Hello, World!\n" for all requests
- **HTTP Methods:** Supports all methods (GET, POST, PUT, DELETE, etc.)
- **URL Paths:** Accepts all paths
- **Status Code:** 200 OK
- **Content-Type:** text/plain
- **Dependencies:** Zero external dependencies

## Current Flask Implementation

The current implementation (`app.py`) is a Python 3 Flask application that replicates the Node.js behavior exactly:

- **Framework:** Flask 3.1.2
- **Host:** 127.0.0.1 (localhost)
- **Port:** 3000
- **Response:** Returns "Hello, World!\n" for all requests
- **HTTP Methods:** Explicitly supports GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
- **URL Paths:** Catch-all routing accepts all paths
- **Status Code:** 200 OK
- **Content-Type:** text/plain

## Requirements

- Python 3.12.3 or higher
- Flask 3.1.2 and dependencies (listed in requirements.txt)

## Setup

1. Create a Python virtual environment:
```bash
python3 -m venv venv
```

2. Activate the virtual environment:
```bash
source venv/bin/activate  # On Linux/macOS
venv\Scripts\activate     # On Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Flask Server

Start the Flask application:
```bash
python app.py
```

The server will start on http://127.0.0.1:3000/

You can test it with:
```bash
curl http://127.0.0.1:3000/
```

## Testing

Run the comprehensive unit test suite:
```bash
python test_app.py
```

Expected output:
```
test_arbitrary_path_returns_hello_world ... ok
test_arbitrary_path_status_code ... ok
test_multiple_paths ... ok
test_post_request_returns_hello_world ... ok
test_response_length ... ok
test_root_path_content_type ... ok
test_root_path_returns_hello_world ... ok
test_root_path_status_code ... ok

----------------------------------------------------------------------
Ran 8 tests in 0.009s

OK
```

## Project Structure

```
.
├── README.md              # This file - project documentation
├── package.json           # Original Node.js project metadata (archived)
├── package-lock.json      # Original Node.js lockfile (archived)
├── server.js              # Original Node.js implementation (archived)
├── app.py                 # Current Flask implementation
├── requirements.txt       # Python dependencies
├── test_app.py            # Comprehensive unit test suite
└── venv/                  # Python virtual environment (not committed)
```

## Migration Notes

This Flask implementation maintains 100% functional parity with the original Node.js server:

- ✓ Identical response content: "Hello, World!\n" (14 bytes)
- ✓ Identical host:port binding: 127.0.0.1:3000
- ✓ Identical HTTP status code: 200 OK
- ✓ Identical Content-Type: text/plain
- ✓ All HTTP methods supported
- ✓ All URL paths accepted
- ✓ Startup message format preserved

## Author & License

MIT License
