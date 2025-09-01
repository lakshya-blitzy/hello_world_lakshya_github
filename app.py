"""
Flask web server implementation that replaces the Node.js HTTP server.

This module provides a Flask-based HTTP server that maintains exact feature parity
with the original Node.js server.js implementation. It binds to 127.0.0.1:3000
and returns 'Hello, World!\n' with text/plain content type for all GET requests
to the root path.

Key Features:
- Exact behavioral match with Node.js server
- Same network binding (127.0.0.1:3000)
- Identical response format and headers
- Console output matching original implementation
"""

from flask import Flask, Response


# Create Flask application instance
app = Flask(__name__)


@app.route('/')
def hello_world():
    """
    Handle GET requests to the root path ('/').
    
    Returns a plain text response containing 'Hello, World!\n' with HTTP 200
    status code and 'text/plain' content type, matching the exact behavior
    of the original Node.js server implementation.
    
    Returns:
        Response: Flask Response object with 'Hello, World!\n' and text/plain MIME type
    """
    return Response('Hello, World!\n', mimetype='text/plain')


if __name__ == '__main__':
    # Print startup message matching Node.js console.log format
    print('Server running at http://127.0.0.1:3000/')
    
    # Start Flask development server with same host and port as Node.js version
    # host='127.0.0.1' ensures localhost-only binding
    # port=3000 matches original Node.js configuration
    # debug=False for production-like behavior matching Node.js
    app.run(host='127.0.0.1', port=3000, debug=False)