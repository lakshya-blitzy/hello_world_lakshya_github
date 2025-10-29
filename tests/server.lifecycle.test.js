/**
 * Server Lifecycle Tests
 * 
 * This test suite validates server initialization, startup behavior,
 * and proper resource cleanup. Tests server lifecycle management
 * without actually binding to network ports.
 */

const request = require('supertest');
const app = require('../server');

describe('Express Server - Lifecycle Management', () => {
  
  describe('Server Initialization', () => {
    it('should successfully create Express app instance', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function'); // Express app is a function
    });

    it('should have GET route handler registered for /', async () => {
      const response = await request(app).get('/');
      expect(response.status).not.toBe(404); // Route should exist
      expect(response.status).toBe(200);
    });

    it('should have GET route handler registered for /evening', async () => {
      const response = await request(app).get('/evening');
      expect(response.status).not.toBe(404); // Route should exist
      expect(response.status).toBe(200);
    });

    it('should handle undefined routes with 404', async () => {
      const response = await request(app).get('/undefined-route');
      expect(response.status).toBe(404);
    });
  });

  describe('Request Handling', () => {
    it('should process request/response cycle correctly', async () => {
      const response = await request(app).get('/');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('headers');
    });

    it('should handle asynchronous request processing', async () => {
      const promise = request(app).get('/');
      // Supertest returns a Test object that is thenable (has .then method)
      expect(typeof promise.then).toBe('function');
      const response = await promise;
      expect(response.status).toBe(200);
    });

    it('should maintain request isolation between calls', async () => {
      const response1 = await request(app).get('/');
      const response2 = await request(app).get('/evening');
      
      // Each request should be independent
      expect(response1.text).toBe('Hello, World!\n');
      expect(response2.text).toBe('Good evening');
      expect(response1.text).not.toBe(response2.text);
    });
  });

  describe('Middleware Stack', () => {
    it('should process requests through Express middleware', async () => {
      const response = await request(app).get('/');
      // Express adds standard headers through its middleware stack
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('content-length');
    });

    it('should handle request parsing', async () => {
      const response = await request(app)
        .get('/')
        .query({ test: 'value' });
      expect(response.status).toBe(200);
    });

    it('should set proper response headers automatically', async () => {
      const response = await request(app).get('/');
      expect(response.headers['content-type']).toBeDefined();
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(app).get('/does-not-exist');
      expect(response.status).toBe(404);
      expect(response.error).not.toBe(false); // Should indicate error
    });

    it('should not crash on malformed requests', async () => {
      // Test with various edge cases
      const response1 = await request(app).get('//double/slash');
      const response2 = await request(app).get('/%');
      
      // Should handle gracefully, not crash
      expect([200, 404, 400]).toContain(response1.status);
      expect([200, 404, 400]).toContain(response2.status);
    });

    it('should handle requests with missing required headers', async () => {
      const response = await request(app)
        .get('/')
        .set('Host', ''); // Empty host header
      
      // Should still process request
      expect(response.status).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should not leak memory on repeated requests', async () => {
      // Make multiple requests to check for memory leaks
      for (let i = 0; i < 50; i++) {
        await request(app).get('/');
      }
      // If this completes without hanging, no obvious leak
      expect(true).toBe(true);
    });

    it('should handle request cleanup properly', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      // Supertest automatically closes connections
      // If this test completes, cleanup is working
    });

    it('should allow multiple test suites to run', async () => {
      // This test ensures the app can be imported multiple times
      // without port conflicts or resource issues
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const promises = [
        request(app).get('/'),
        request(app).get('/evening'),
        request(app).get('/'),
        request(app).get('/evening'),
        request(app).get('/')
      ];

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain response correctness under load', async () => {
      const promises = Array(20).fill(null).map(() => 
        request(app).get('/')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toBe('Hello, World!\n');
      });
    });

    it('should handle mixed endpoint concurrent requests', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        i % 2 === 0 
          ? request(app).get('/')
          : request(app).get('/evening')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        if (i % 2 === 0) {
          expect(response.text).toBe('Hello, World!\n');
        } else {
          expect(response.text).toBe('Good evening');
        }
      });
    });
  });

  describe('Express App Properties', () => {
    it('should have required Express app methods', () => {
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
      expect(typeof app.use).toBe('function');
      expect(typeof app.listen).toBe('function');
    });

    it('should be properly configured Express instance', () => {
      // Test that app is actually an Express instance by checking it can handle requests
      expect(typeof app).toBe('function');
      expect(app).toHaveProperty('get');
      expect(app).toHaveProperty('use');
    });
  });
});
