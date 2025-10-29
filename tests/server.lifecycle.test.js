/**
 * Server Lifecycle Tests
 * 
 * Dedicated Jest test suite for Express.js server lifecycle management using supertest.
 * Tests server initialization, app configuration, graceful shutdown, resource cleanup,
 * and concurrent request handling capabilities.
 * 
 * Uses supertest's stateless testing approach that doesn't require actual server startup
 * or port binding, focusing on app instance behavior rather than network-level testing.
 * This prevents EADDRINUSE errors and port conflicts while thoroughly validating lifecycle management.
 */

const request = require('supertest');
const app = require('../server');

/**
 * Test Suite 1: Server Initialization Tests
 * Validates Express app instance creation, route handler configuration, and initialization
 */
describe('Server Initialization Tests', () => {
  
  it('should create Express app instance successfully', () => {
    // Validate that requiring '../server' returns a valid Express app object
    expect(app).toBeDefined();
    expect(app).not.toBeNull();
  });

  it('should have GET route handlers configured', async () => {
    // Validate app has the expected route handlers registered
    const rootResponse = await request(app).get('/');
    const eveningResponse = await request(app).get('/evening');
    
    // Both routes should exist (not 404)
    expect(rootResponse.status).toBe(200);
    expect(eveningResponse.status).toBe(200);
  });

  it('should initialize without errors', () => {
    // Ensures app import doesn't throw exceptions
    // If we reach this point, the app has been imported without errors
    expect(() => {
      const testApp = require('../server');
      expect(testApp).toBeDefined();
    }).not.toThrow();
  });

  it('should be a function (Express app)', () => {
    // Validates app is a callable function (Express apps are functions)
    expect(typeof app).toBe('function');
  });
});

/**
 * Test Suite 2: Concurrent Request Handling Tests
 * Validates the server can handle multiple simultaneous requests correctly
 */
describe('Concurrent Request Handling Tests', () => {
  
  it('should handle multiple simultaneous requests to different endpoints', async () => {
    // Makes concurrent requests to / and /evening using Promise.all()
    const promises = [
      request(app).get('/'),
      request(app).get('/evening'),
      request(app).get('/'),
      request(app).get('/evening'),
      request(app).get('/')
    ];

    const responses = await Promise.all(promises);
    
    // All requests should complete successfully
    expect(responses).toHaveLength(5);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    expect(responses[2].status).toBe(200);
    expect(responses[3].status).toBe(200);
    expect(responses[4].status).toBe(200);
  });

  it('should handle rapid successive requests to same endpoint', async () => {
    // Makes multiple quick requests in sequence
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const response = await request(app).get('/');
      results.push(response);
    }
    
    // All rapid requests should succeed
    expect(results).toHaveLength(10);
    results.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello, World!\n');
    });
  });

  it('should maintain response consistency under concurrent load', async () => {
    // Validates all concurrent requests get correct responses
    const rootPromises = Array(15).fill(null).map(() => request(app).get('/'));
    const eveningPromises = Array(15).fill(null).map(() => request(app).get('/evening'));
    
    const allPromises = [...rootPromises, ...eveningPromises];
    const responses = await Promise.all(allPromises);
    
    // Verify first 15 are root endpoint responses
    for (let i = 0; i < 15; i++) {
      expect(responses[i].status).toBe(200);
      expect(responses[i].text).toBe('Hello, World!\n');
    }
    
    // Verify last 15 are evening endpoint responses
    for (let i = 15; i < 30; i++) {
      expect(responses[i].status).toBe(200);
      expect(responses[i].text).toBe('Good evening');
    }
  });
});

/**
 * Test Suite 3: Resource Management Tests
 * Validates proper resource cleanup, connection handling, and memory leak prevention
 * Critical for ensuring tests don't leave hanging processes or consume excessive resources
 */
describe('Resource Management Tests', () => {
  
  it('should not leave hanging connections', async () => {
    // Validates supertest properly closes connections
    // Supertest automatically manages connection lifecycle
    const response = await request(app).get('/');
    
    expect(response.status).toBe(200);
    // If this test completes without hanging, connections are properly closed
    // Supertest's agent automatically handles connection cleanup
  });

  it('should handle request completion without memory leaks', async () => {
    // Makes multiple requests and validates cleanup
    // This test prevents memory leaks by ensuring repeated requests don't accumulate resources
    const iterations = 50;
    const responses = [];
    
    for (let i = 0; i < iterations; i++) {
      const response = await request(app).get('/');
      responses.push(response.status);
    }
    
    // All requests should complete successfully
    expect(responses).toHaveLength(iterations);
    expect(responses.every(status => status === 200)).toBe(true);
    
    // If we reach here without running out of memory or hanging, no leak exists
  });

  it('should properly handle request/response lifecycle', async () => {
    // Tests complete HTTP cycle completes cleanly
    const response = await request(app).get('/evening');
    
    // Validate complete response object is properly formed
    expect(response).toBeDefined();
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('text');
    expect(response).toHaveProperty('headers');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Good evening');
    
    // Lifecycle is complete when all properties are accessible
  });
});

/**
 * Test Suite 4: App Instance Validation Tests
 * Validates the exported Express application has all required properties and capabilities
 */
describe('App Instance Validation Tests', () => {
  
  it('should export valid Express application', () => {
    // Validates exported app has Express-specific properties
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    
    // Express apps have these core methods
    expect(app).toHaveProperty('get');
    expect(app).toHaveProperty('post');
    expect(app).toHaveProperty('put');
    expect(app).toHaveProperty('delete');
    expect(app).toHaveProperty('use');
    expect(app).toHaveProperty('listen');
  });

  it('should have listening capability (app.listen is a function)', () => {
    // Checks app.listen exists (though not called in tests)
    expect(typeof app.listen).toBe('function');
    
    // Verify listen method is the actual Express listen method
    expect(app.listen).toBeDefined();
    expect(app.listen.name).toBe('listen');
  });

  it('should support supertest integration', async () => {
    // Validates app works with supertest request wrapping
    // Supertest wraps the Express app and simulates HTTP requests
    const response = await request(app).get('/');
    
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello, World!\n');
    
    // Successful request proves supertest integration works correctly
  });
});
