const { createServer } = require('../../app');
const http = require('http');

describe('Server Unit Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createServer('127.0.0.1', 0); // Use port 0 to avoid conflicts
  });

  afterEach(async () => {
    if (app && app.getServer && app.getServer().listening) {
      await app.close();
    }
  });

  test('createServer returns server instance with correct properties', () => {
    expect(app).toBeDefined();
    expect(app.getServer).toBeDefined();
    expect(app.getServer()).toBeInstanceOf(http.Server);
    expect(typeof app.start).toBe('function');
    expect(typeof app.close).toBe('function');
  });

  test('createServer accepts custom configuration', () => {
    const customApp = createServer('localhost', 8080);
    expect(customApp).toBeDefined();
    expect(customApp.getServer()).toBeInstanceOf(http.Server);
    expect(typeof customApp.start).toBe('function');
    expect(typeof customApp.close).toBe('function');
  });

  test('server can be started and stopped programmatically', async () => {
    // Test starting
    const server = await app.start();
    expect(server).toBeInstanceOf(http.Server);
    expect(app.getServer().listening).toBe(true);
    
    // Test stopping
    await app.close();
    expect(app.getServer().listening).toBe(false);
  });

  test('server handles errors during startup', async () => {
    // Try to start server on an invalid port
    const badApp = createServer('127.0.0.1', -1);
    
    await expect(badApp.start()).rejects.toThrow();
  });

  test('server handles port already in use error', async () => {
    // Start first server on a specific port
    const firstApp = createServer('127.0.0.1', 0);
    const server1 = await firstApp.start();
    const port = server1.address().port;

    try {
      // Try to start second server on same port (should fail)
      const secondApp = createServer('127.0.0.1', port);
      await expect(secondApp.start()).rejects.toThrow();
    } finally {
      // Clean up first server
      await firstApp.close();
    }
  });

  test('server.js module can be required and exports app instance', () => {
    // Import server.js module for coverage (won't auto-start in test mode)
    const serverModule = require('../../server.js');
    expect(serverModule).toBeDefined();
    expect(typeof serverModule.start).toBe('function');
    expect(typeof serverModule.close).toBe('function');
    expect(typeof serverModule.getServer).toBe('function');
    expect(serverModule.getServer().listening).toBe(false); // Should not be started when imported
  });

  test('server.js handleStartupError function coverage', () => {
    const serverModule = require('../../server.js');
    
    // Test that handleStartupError function exists
    expect(typeof serverModule.handleStartupError).toBe('function');
    
    // Mock console.error and process.exit to test the function without actually exiting
    const originalConsoleError = console.error;
    const originalProcessExit = process.exit;
    
    console.error = jest.fn();
    process.exit = jest.fn();
    
    try {
      // Call the handleStartupError function
      const testError = new Error('Test startup error');
      serverModule.handleStartupError(testError);
      
      // Verify console.error was called with the error
      expect(console.error).toHaveBeenCalledWith('Failed to start server:', testError);
      
      // Verify process.exit was called with code 1
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      // Restore original functions
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    }
  });

  test('server.js autoStart function coverage', () => {
    const serverModule = require('../../server.js');
    
    // Test that autoStart function exists and is callable
    expect(typeof serverModule.autoStart).toBe('function');
    expect(() => serverModule.autoStart()).not.toThrow();
  });
});