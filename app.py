"""
Flask HTTP Server Application

This module implements a lightweight Flask web server that provides multiple endpoints
for basic arithmetic operations and a simple "Hello, World!" greeting.

The application was migrated from Node.js to Python 3 Flask while maintaining
100% functional equivalence with the original implementation.

Configuration:
    hostname (str): Server bind address, defaults to '127.0.0.1' (localhost only)
    port (int): Server port number, defaults to 3000

Usage:
    Run directly: python app.py
    The server will start at http://127.0.0.1:3000/

Author:
    hxu

License:
    MIT
"""

from flask import Flask, request, jsonify

# Initialize Flask application instance
app = Flask(__name__)

# Server configuration - hardcoded for simplicity (matching original Node.js behavior)
hostname = '127.0.0.1'  # Bind to localhost only for security
port = 3000             # Default port matching original Node.js implementation


@app.route('/')
def hello():
    """
    Root endpoint that returns a simple 'Hello, World!' greeting.
    
    This endpoint responds to all HTTP methods (GET, POST, etc.) and returns
    a plain text greeting message, matching the exact behavior of the original
    Node.js implementation.
    
    Returns:
        tuple: A tuple containing:
            - str: The greeting message 'Hello, World!\n' (with newline)
            - int: HTTP status code 200 (OK)
            - dict: Response headers with Content-Type set to 'text/plain'
    
    Example:
        >>> # Using curl:
        >>> curl http://127.0.0.1:3000/
        Hello, World!
        
        >>> # Using Python requests:
        >>> import requests
        >>> response = requests.get('http://127.0.0.1:3000/')
        >>> print(response.text)
        Hello, World!
    
    Notes:
        - The response includes a newline character (\n) to match the original Node.js behavior
        - Content-Type is explicitly set to 'text/plain' for plain text response
        - Returns status code 200 for all successful requests
    """
    return 'Hello, World!\n', 200, {'Content-Type': 'text/plain'}

@app.route('/add2')
def add_2_numbers():
    """
    Addition endpoint that sums two numbers provided as query parameters.
    
    This endpoint accepts two numeric values via query string parameters and returns
    their sum in JSON format. It handles type conversion and validation automatically.
    
    Query Parameters:
        a (float, optional): First number to add. Defaults to 0 if not provided.
        b (float, optional): Second number to add. Defaults to 0 if not provided.
    
    Returns:
        tuple: A tuple containing:
            - JSON response (dict): Contains the following keys:
                - result (float): The sum of the input numbers
                - operation (str): The operation name ('add2')
                - inputs (list): Array of input values [a, b]
            - int: HTTP status code (200 for success, 400 for errors)
    
    Raises:
        400 Bad Request: If parameters cannot be converted to float values
    
    Example:
        >>> # Add 5 and 3:
        >>> curl "http://127.0.0.1:3000/add2?a=5&b=3"
        {"result": 8.0, "operation": "add2", "inputs": [5.0, 3.0]}
        
        >>> # Default values when parameters not provided:
        >>> curl "http://127.0.0.1:3000/add2"
        {"result": 0.0, "operation": "add2", "inputs": [0.0, 0.0]}
        
        >>> # Using Python requests:
        >>> import requests
        >>> response = requests.get('http://127.0.0.1:3000/add2', params={'a': 10, 'b': 20})
        >>> print(response.json())
        {'result': 30.0, 'operation': 'add2', 'inputs': [10.0, 20.0]}
    
    Error Response Example:
        >>> # Invalid parameter:
        >>> curl "http://127.0.0.1:3000/add2?a=invalid&b=5"
        {"error": "Invalid input parameters", "message": "could not convert string to float: 'invalid'"}
    
    Notes:
        - Supports integer and floating-point numbers
        - Missing parameters default to 0
        - Returns JSON with proper Content-Type header
        - Gracefully handles conversion errors with descriptive messages
    """
    try:
        # Extract query parameters with default value of 0
        # Using float() for type conversion to handle both integers and decimals
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        
        # Perform addition operation
        result = a + b
        
        # Return JSON response with result, operation name, and inputs
        return jsonify({'result': result, 'operation': 'add2', 'inputs': [a, b]}), 200
    except (TypeError, ValueError) as e:
        # Handle invalid input (non-numeric strings, None values, etc.)
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add3')
def add_3_numbers():
    """
    Addition endpoint that sums three numbers provided as query parameters.
    
    Query Parameters:
        a (float, optional): First number to add. Defaults to 0 if not provided.
        b (float, optional): Second number to add. Defaults to 0 if not provided.
        c (float, optional): Third number to add. Defaults to 0 if not provided.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add3?a=5&b=3&c=2"
        {"result": 10.0, "operation": "add3", "inputs": [5.0, 3.0, 2.0]}
    """
    try:
        # Extract and convert three query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        
        # Calculate sum of three numbers
        result = a + b + c
        
        # Return JSON response with result and metadata
        return jsonify({'result': result, 'operation': 'add3', 'inputs': [a, b, c]}), 200
    except (TypeError, ValueError) as e:
        # Handle type conversion errors
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add4')
def add_4_numbers():
    """
    Addition endpoint that sums four numbers provided as query parameters.
    
    Query Parameters:
        a (float, optional): First number. Defaults to 0.
        b (float, optional): Second number. Defaults to 0.
        c (float, optional): Third number. Defaults to 0.
        d (float, optional): Fourth number. Defaults to 0.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add4?a=5&b=3&c=2&d=1"
        {"result": 11.0, "operation": "add4", "inputs": [5.0, 3.0, 2.0, 1.0]}
    """
    try:
        # Extract and convert four query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        
        # Calculate sum of four numbers
        result = a + b + c + d
        
        # Return JSON response
        return jsonify({'result': result, 'operation': 'add4', 'inputs': [a, b, c, d]}), 200
    except (TypeError, ValueError) as e:
        # Handle invalid inputs
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add5')
def add_5_numbers():
    """
    Addition endpoint that sums five numbers provided as query parameters.
    
    Query Parameters:
        a (float, optional): First number. Defaults to 0.
        b (float, optional): Second number. Defaults to 0.
        c (float, optional): Third number. Defaults to 0.
        d (float, optional): Fourth number. Defaults to 0.
        e (float, optional): Fifth number. Defaults to 0.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add5?a=10&b=20&c=30&d=40&e=50"
        {"result": 150.0, "operation": "add5", "inputs": [10.0, 20.0, 30.0, 40.0, 50.0]}
    """
    try:
        # Extract and convert five query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        
        # Calculate sum of five numbers
        result = a + b + c + d + e
        
        # Return JSON response
        return jsonify({'result': result, 'operation': 'add5', 'inputs': [a, b, c, d, e]}), 200
    except (TypeError, ValueError) as ex:
        # Handle invalid inputs
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add6')
def add_6_numbers():
    """
    Addition endpoint that sums six numbers provided as query parameters.
    
    Query Parameters:
        a (float, optional): First number. Defaults to 0.
        b (float, optional): Second number. Defaults to 0.
        c (float, optional): Third number. Defaults to 0.
        d (float, optional): Fourth number. Defaults to 0.
        e (float, optional): Fifth number. Defaults to 0.
        f (float, optional): Sixth number. Defaults to 0.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add6?a=1&b=2&c=3&d=4&e=5&f=6"
        {"result": 21.0, "operation": "add6", "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]}
    """
    try:
        # Extract and convert six query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        
        # Calculate sum of six numbers
        result = a + b + c + d + e + f
        
        # Return JSON response
        return jsonify({'result': result, 'operation': 'add6', 'inputs': [a, b, c, d, e, f]}), 200
    except (TypeError, ValueError) as ex:
        # Handle invalid inputs
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add7')
def add_7_numbers():
    """
    Addition endpoint that sums seven numbers provided as query parameters.
    
    Query Parameters:
        a, b, c, d, e, f, g (float, optional): Numbers to sum. Each defaults to 0.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add7?a=1&b=2&c=3&d=4&e=5&f=6&g=7"
        {"result": 28.0, "operation": "add7", "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0]}
    """
    try:
        # Extract and convert seven query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        g = float(request.args.get('g', 0))
        
        # Calculate sum of seven numbers
        result = a + b + c + d + e + f + g
        
        # Return JSON response
        return jsonify({'result': result, 'operation': 'add7', 'inputs': [a, b, c, d, e, f, g]}), 200
    except (TypeError, ValueError) as ex:
        # Handle invalid inputs
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add8')
def add_8_numbers():
    """
    Addition endpoint that sums eight numbers provided as query parameters.
    
    Query Parameters:
        a, b, c, d, e, f, g, h (float, optional): Numbers to sum. Each defaults to 0.
    
    Returns:
        tuple: JSON response with result, operation name, and inputs; HTTP status code
    
    Example:
        >>> curl "http://127.0.0.1:3000/add8?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8"
        {"result": 36.0, "operation": "add8", "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]}
    """
    try:
        # Extract and convert eight query parameters to floats
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        g = float(request.args.get('g', 0))
        h = float(request.args.get('h', 0))
        
        # Calculate sum of eight numbers
        result = a + b + c + d + e + f + g + h
        
        # Return JSON response
        return jsonify({'result': result, 'operation': 'add8', 'inputs': [a, b, c, d, e, f, g, h]}), 200
    except (TypeError, ValueError) as ex:
        # Handle invalid inputs
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

if __name__ == '__main__':
    # Print startup message to console (matching original Node.js behavior)
    print(f'Server running at http://{hostname}:{port}/')
    
    # Start Flask development server
    # - host: Bind to localhost only (127.0.0.1) for security
    # - port: Use port 3000 to maintain compatibility with Node.js version
    # - debug: Not explicitly set (defaults to False in production)
    # 
    # WARNING: This uses Flask's built-in development server which is NOT
    # suitable for production deployment. For production, use a WSGI server
    # like Gunicorn or Waitress.
    app.run(host=hostname, port=port)
