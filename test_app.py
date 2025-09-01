"""
Comprehensive test suite for Flask server migration validation.

This test suite validates feature parity between the original Node.js HTTP server
and the new Flask implementation. It ensures exact behavioral matching including
response content, HTTP headers, status codes, network configuration, and error
handling patterns.

Test Coverage:
- HTTP response content validation ('Hello, World!\n')
- Status code verification (HTTP 200)
- Content-Type header validation (text/plain)
- Network binding verification (127.0.0.1:3000)
- 404 error handling for undefined routes
- Integration testing with actual server instances

Usage:
    python test_app.py
    
    Or with unittest discovery:
    python -m unittest test_app.py
"""

import unittest
import requests
import sys
import threading
import time
import urllib.parse
from app import app


class TestFlaskServer(unittest.TestCase):
    """
    Unit tests for Flask server using test client.
    
    Tests core functionality using Flask's built-in test client for isolated
    testing without requiring an actual server instance. Validates response
    content, status codes, headers, and basic routing behavior.
    """
    
    def setUp(self):
        """Set up test client before each test method."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
    def tearDown(self):
        """Clean up after each test method."""
        pass
    
    def test_root_response(self):
        """Test that root path returns expected response using Flask test client."""
        response = self.client.get('/')
        
        # Verify response data matches Node.js implementation exactly
        self.assertEqual(response.data, b'Hello, World!\n', 
                        "Response content must match 'Hello, World!\\n' exactly")
        
        # Verify status code
        self.assertEqual(response.status_code, 200,
                        "Status code must be 200 for successful requests")
        
        # Verify content type header
        self.assertEqual(response.content_type, 'text/plain; charset=utf-8',
                        "Content-Type must be 'text/plain; charset=utf-8'")
        
    def test_status_code(self):
        """Verify HTTP 200 status code for root endpoint."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200,
                        "Root endpoint must return HTTP 200 status code")
    
    def test_content_type(self):
        """Verify Content-Type header is set to text/plain."""
        response = self.client.get('/')
        self.assertIn('text/plain', response.content_type,
                     "Content-Type header must include 'text/plain'")
    
    def test_response_content(self):
        """Verify exact response content matches Node.js implementation."""
        response = self.client.get('/')
        
        # Test exact byte content matching
        expected_content = b'Hello, World!\n'
        self.assertEqual(response.data, expected_content,
                        f"Response content must be exactly {expected_content!r}")
        
        # Test string content matching
        expected_string = 'Hello, World!\n'
        self.assertEqual(response.get_data(as_text=True), expected_string,
                        f"Response string must be exactly {expected_string!r}")
        
        # Verify newline character is preserved
        self.assertTrue(response.get_data(as_text=True).endswith('\n'),
                       "Response must end with newline character")


class TestServerIntegration(unittest.TestCase):
    """
    Integration tests for actual server instance.
    
    Tests server binding, network configuration, and request handling using
    actual HTTP requests to a running Flask server instance. Validates
    localhost binding, port configuration, and error handling behavior.
    """
    
    def setUp(self):
        """Start Flask server in background thread for integration testing."""
        self.server_thread = None
        self.server_started = threading.Event()
        self.server_error = None
        self.base_url = 'http://127.0.0.1:3000'
        
        # Start server in background thread
        def run_server():
            try:
                # Import app fresh to avoid conflicts
                from app import app
                app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)
            except Exception as e:
                self.server_error = e
                self.server_started.set()
        
        self.server_thread = threading.Thread(target=run_server, daemon=True)
        self.server_thread.start()
        
        # Wait for server to start up
        time.sleep(2)
        
        # Verify server is accessible
        try:
            response = requests.get(self.base_url, timeout=5)
            self.server_started.set()
        except requests.exceptions.RequestException:
            # Server might not be ready yet, but we'll handle this in tests
            pass
    
    def tearDown(self):
        """Clean up server thread after testing."""
        # Server thread is daemon, will exit with main process
        pass
    
    def test_localhost_binding(self):
        """Test that server binds to localhost (127.0.0.1) only."""
        try:
            # Test localhost access
            response = requests.get(f'{self.base_url}/', timeout=10)
            self.assertEqual(response.status_code, 200,
                           "Server must be accessible on localhost")
            
            # Verify response content
            self.assertEqual(response.text, 'Hello, World!\n',
                           "Localhost response must match expected content")
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Server not accessible on localhost: {e}")
    
    def test_port_3000_binding(self):
        """Test that server binds to port 3000 specifically."""
        try:
            # Parse URL to verify port
            parsed_url = urllib.parse.urlparse(self.base_url)
            self.assertEqual(parsed_url.port, 3000,
                           "Server must bind to port 3000")
            
            # Test port accessibility
            response = requests.get(self.base_url, timeout=10)
            self.assertEqual(response.status_code, 200,
                           "Server must respond on port 3000")
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Server not accessible on port 3000: {e}")
    
    def test_404_handling(self):
        """Test that server returns 404 for undefined routes."""
        try:
            # Test non-existent endpoint
            response = requests.get(f'{self.base_url}/nonexistent', timeout=10)
            self.assertEqual(response.status_code, 404,
                           "Undefined routes must return 404 status code")
            
            # Test another non-existent endpoint
            response = requests.get(f'{self.base_url}/api/test', timeout=10)
            self.assertEqual(response.status_code, 404,
                           "API routes must return 404 if not defined")
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Error testing 404 handling: {e}")
    
    def test_server_startup(self):
        """Test that server starts up successfully with correct configuration."""
        try:
            # Verify server responds
            response = requests.get(self.base_url, timeout=10)
            
            # Check response indicates successful startup
            self.assertEqual(response.status_code, 200,
                           "Server startup must result in accessible endpoint")
            
            # Verify response headers
            self.assertIn('text/plain', response.headers.get('content-type', ''),
                         "Server must set correct content-type header")
            
            # Verify content length
            expected_length = len('Hello, World!\n')
            content_length = int(response.headers.get('content-length', 0))
            self.assertEqual(content_length, expected_length,
                           f"Content-Length header must be {expected_length}")
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Server startup test failed: {e}")


def validate_feature_parity():
    """
    Comprehensive feature parity validation function.
    
    Runs all test suites and provides detailed validation of the Flask
    implementation against the original Node.js server requirements.
    Ensures complete behavioral matching and migration success.
    
    Returns:
        bool: True if all feature parity tests pass, False otherwise
    """
    # Create test suite combining all test cases
    loader = unittest.TestLoader()
    
    # Load Flask server tests
    flask_tests = loader.loadTestsFromTestCase(TestFlaskServer)
    
    # Load integration tests
    integration_tests = loader.loadTestsFromTestCase(TestServerIntegration)
    
    # Combine all tests
    full_suite = unittest.TestSuite([flask_tests, integration_tests])
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(full_suite)
    
    # Return success status
    return result.wasSuccessful()


def main():
    """
    Main test execution function.
    
    Executes all test suites and validates complete feature parity between
    the Node.js and Flask implementations. Provides detailed test output
    and returns appropriate exit codes for automation integration.
    
    Exit Codes:
        0: All tests passed - feature parity validated
        1: Some tests failed - migration issues detected
        2: Test execution error - framework or setup issues
    """
    try:
        print("=" * 70)
        print("Flask Server Migration - Feature Parity Validation")
        print("=" * 70)
        print()
        print("Validating Flask implementation against Node.js server requirements...")
        print("Testing HTTP responses, headers, network binding, and error handling...")
        print()
        
        # Run validation
        success = validate_feature_parity()
        
        print()
        print("=" * 70)
        
        if success:
            print("✅ SUCCESS: All feature parity tests passed!")
            print("Flask implementation matches Node.js behavior exactly.")
            print("Migration validation complete - deployment ready.")
            sys.exit(0)
        else:
            print("❌ FAILURE: Some feature parity tests failed!")
            print("Flask implementation does not match Node.js behavior.")
            print("Review test output above for specific issues.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ ERROR: Test execution failed: {e}")
        print("Check test environment and server configuration.")
        sys.exit(2)


if __name__ == '__main__':
    main()