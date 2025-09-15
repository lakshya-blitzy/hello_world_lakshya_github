const { createServer } = require('../../app');

// Test that server.js can be required (for coverage)
let serverModule;

describe('Server Unit Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createServer();
  });

  afterEach(async () => {
    if (app && app.server && app.server.listening) {
      await app.stop();
    }
  });

  test('createServer returns server instance with correct properties', () => {
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
    expect(app.hostname).toBe('127.0.0.1');
    expect(app.port).toBe(3000);
    expect(typeof app.start).toBe('function');
    expect(typeof app.stop).toBe('function');
  });

  test('createServer accepts custom configuration', () => {
    const customApp = createServer({ hostname: 'localhost', port: 8080 });
    expect(customApp.hostname).toBe('localhost');
    expect(customApp.port).toBe(8080);
  });

  test('server can be started and stopped programmatically', async () => {
    // Use port 0 for testing to avoid conflicts
    const testApp = createServer({ port: 0 });
    
    // Test starting
    const result = await testApp.start();
    expect(result.server).toBeDefined();
    expect(testApp.server.listening).toBe(true);
    
    // Test stopping
    await testApp.stop();
    expect(testApp.server.listening).toBe(false);
  });

  test('server handles errors during startup', async () => {
    // Try to start server on an invalid port
    const badApp = createServer({ port: -1 });
    
    await expect(badApp.start()).rejects.toThrow();
  });
});