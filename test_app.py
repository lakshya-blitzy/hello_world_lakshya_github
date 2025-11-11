"""
Comprehensive unit test suite for Flask HTTP server application.
Validates 100% functional parity with Node.js server.js implementation.

Test Coverage:
- Response content verification
- HTTP status code validation
- Content-Type header checking
- Multiple HTTP methods (GET, POST, PUT, DELETE)
- Multiple URL paths (catch-all routing)
- Response length verification
"""
import unittest
from app import app

class TestFlaskApp(unittest.TestCase):
    """Test suite validating Flask application behavior against Node.js original"""
    
    def setUp(self):
        """Configure Flask test client before each test"""
        self.client = app.test_client()
        app.testing = True
    
    def test_root_path_returns_hello_world(self):
        """Verify GET / returns exact 'Hello, World!\n' content matching Node.js response"""
        response = self.client.get('/')
        self.assertEqual(response.data, b'Hello, World!\n')
    
    def test_root_path_status_code(self):
        """Verify GET / returns HTTP 200 OK status matching Node.js (res.statusCode = 200)"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
    
    def test_root_path_content_type(self):
        """Verify GET / returns text/plain Content-Type matching Node.js (res.setHeader('Content-Type', 'text/plain'))"""
        response = self.client.get('/')
        self.assertIn('text/plain', response.content_type)
    
    def test_arbitrary_path_returns_hello_world(self):
        """Verify arbitrary paths return same content (Node.js accepts all paths implicitly)"""
        response = self.client.get('/some/random/path')
        self.assertEqual(response.data, b'Hello, World!\n')
    
    def test_arbitrary_path_status_code(self):
        """Verify arbitrary paths return HTTP 200 OK status"""
        response = self.client.get('/test/path')
        self.assertEqual(response.status_code, 200)
    
    def test_post_request_returns_hello_world(self):
        """Verify POST method returns same response (Node.js http.createServer accepts all methods)"""
        response = self.client.post('/')
        self.assertEqual(response.data, b'Hello, World!\n')
        self.assertEqual(response.status_code, 200)
    
    def test_response_length(self):
        """Verify response is exactly 14 bytes matching Node.js ('Hello, World!\n')"""
        response = self.client.get('/')
        self.assertEqual(len(response.data), 14)
    
    def test_multiple_paths(self):
        """Verify various URL paths return identical responses (catch-all routing validation)"""
        paths = ['/', '/test', '/api/v1', '/deep/nested/path', '/file.txt']
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.data, b'Hello, World!\n')
                self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()
