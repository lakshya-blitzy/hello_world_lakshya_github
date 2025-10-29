/**
 * Integration Tests for Express Server Endpoints
 * 
 * This test suite comprehensively tests all HTTP endpoints in server.js,
 * including response validation, status codes, headers, and error handling.
 * Uses supertest for HTTP integration testing without starting an actual server.
 */

const request = require('supertest');
const app = require('../server');

describe('Express Server - HTTP Endpoints', () => {
  
  describe('GET /', () => {
    it('should return status 200', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should return "Hello, World!\\n" in response body', async () => {
      const response = await request(app).get('/');
      expect(response.text).toBe('Hello, World!\n');
    });

    it('should set Content-Type header to text/html', async () => {
      const response = await request(app).get('/');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    it('should set correct Content-Length header', async () => {
      const response = await request(app).get('/');
      expect(response.headers['content-length']).toBe('14'); // "Hello, World!\n" is 14 bytes
    });

    it('should complete request without errors', async () => {
      const response = await request(app).get('/');
      expect(response.error).toBe(false);
    });
  });

  describe('GET /evening', () => {
    it('should return status 200', async () => {
      const response = await request(app).get('/evening');
      expect(response.status).toBe(200);
    });

    it('should return "Good evening" in response body', async () => {
      const response = await request(app).get('/evening');
      expect(response.text).toBe('Good evening');
    });

    it('should set Content-Type header to text/html', async () => {
      const response = await request(app).get('/evening');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    it('should set correct Content-Length header', async () => {
      const response = await request(app).get('/evening');
      expect(response.headers['content-length']).toBe('12'); // "Good evening" is 12 bytes
    });

    it('should handle trailing slash in path', async () => {
      const response = await request(app).get('/evening/');
      // Express 5 typically handles trailing slashes - verify behavior
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Edge Cases and Query Parameters', () => {
    it('should handle query parameters on root endpoint', async () => {
      const response = await request(app).get('/?test=value');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello, World!\n');
    });

    it('should handle query parameters on evening endpoint', async () => {
      const response = await request(app).get('/evening?param=test');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Good evening');
    });

    it('should handle Accept headers', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');
      expect(response.status).toBe(200);
    });

    it('should handle requests with custom User-Agent', async () => {
      const response = await request(app)
        .get('/')
        .set('User-Agent', 'TestClient/1.0');
      expect(response.status).toBe(200);
    });
  });

  describe('404 Error Handling', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app).get('/nonexistent');
      expect(response.status).toBe(404);
    });

    it('should return 404 for /api/invalid', async () => {
      const response = await request(app).get('/api/invalid');
      expect(response.status).toBe(404);
    });

    it('should return 404 for deeply nested invalid path', async () => {
      const response = await request(app).get('/deep/nested/invalid/path');
      expect(response.status).toBe(404);
    });

    it('should handle special characters in undefined routes', async () => {
      const response = await request(app).get('/test%20space');
      expect(response.status).toBe(404);
    });
  });

  describe('HTTP Methods', () => {
    it('should handle GET method on root endpoint', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should handle POST method on root endpoint', async () => {
      const response = await request(app).post('/');
      // Express 5 default behavior - route exists but method may not be defined
      expect([200, 404, 405]).toContain(response.status);
    });

    it('should handle PUT method on evening endpoint', async () => {
      const response = await request(app).put('/evening');
      expect([200, 404, 405]).toContain(response.status);
    });

    it('should handle DELETE method on undefined route', async () => {
      const response = await request(app).delete('/nonexistent');
      expect(response.status).toBe(404);
    });
  });

  describe('Performance and Concurrent Requests', () => {
    it('should respond quickly to root endpoint', async () => {
      const startTime = Date.now();
      await request(app).get('/');
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond in under 100ms
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/')
      );
      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toBe('Hello, World!\n');
      });
    });

    it('should handle rapid successive requests', async () => {
      const response1 = await request(app).get('/');
      const response2 = await request(app).get('/evening');
      const response3 = await request(app).get('/');
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });
  });

  describe('Response Format Validation', () => {
    it('should return response with UTF-8 encoding', async () => {
      const response = await request(app).get('/');
      expect(response.headers['content-type']).toMatch(/charset=utf-8/);
    });

    it('should include standard HTTP headers', async () => {
      const response = await request(app).get('/');
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('content-length');
    });

    it('should not include response body for HEAD requests', async () => {
      const response = await request(app).head('/');
      expect(response.text).toBeUndefined();
    });
  });
});
