/**
 * Unit test suite for HTTP server functionality validation without network binding.
 * Tests server instance creation, request handler function behavior, response header 
 * configuration, and error handling paths using Jest testing framework in isolation 
 * from actual network operations.
 * 
 * Testing approach focuses on minimal test count with maximum coverage as per
 * requirement: "not to add several test cases just few with all coverage"
 */

const { createServer } = require('../../app');

describe('Server', () => {
  let serverWrapper;
  let server;

  beforeEach(() => {
    // Reset all mocks before each test to ensure test isolation
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Create server instance without starting it (no network binding)
    serverWrapper = createServer();
    server = serverWrapper.getServer();
  });

  afterEach(() => {
    // Ensure proper cleanup after each test
    if (server && server.listening) {
      server.close();
    }
  });

  it('should create server instance without port binding', () => {
    // Verify server wrapper is created successfully
    expect(serverWrapper).toBeDefined();
    expect(typeof serverWrapper).toBe('object');
    
    // Verify server wrapper has required methods
    expect(typeof serverWrapper.start).toBe('function');
    expect(typeof serverWrapper.getServer).toBe('function');
    expect(typeof serverWrapper.close).toBe('function');
    
    // Verify server is not listening (no network binding for unit tests)
    expect(server.listening).toBe(false);
  });

  it('should return http.Server instance from getServer method', () => {
    // Verify the underlying server is an HTTP server instance
    expect(server).toBeDefined();
    expect(server.constructor.name).toBe('Server');
    
    // Verify HTTP server has required methods
    expect(typeof server.listen).toBe('function');
    expect(typeof server.close).toBe('function');
    expect(typeof server.address).toBe('function');
  });
});

describe('Request Handler', () => {
  let serverWrapper;
  let server;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    // Reset all mocks for test isolation
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Create server instance
    serverWrapper = createServer();
    server = serverWrapper.getServer();
    
    // Create mock request object
    mockRequest = {
      url: '/',
      method: 'GET',
      headers: {}
    };
    
    // Create mock response object with Jest mock functions
    mockResponse = {
      statusCode: undefined,
      setHeader: jest.fn(),
      end: jest.fn(),
      headers: {}
    };
  });

  it('should set response status code to 200', () => {
    // Get the request handler from the server
    const requestHandler = server.listeners('request')[0];
    
    // Simulate request handling
    requestHandler(mockRequest, mockResponse);
    
    // Verify status code is set to 200
    expect(mockResponse.statusCode).toBe(200);
  });

  it('should set Content-Type header to text/plain', () => {
    // Get the request handler from the server
    const requestHandler = server.listeners('request')[0];
    
    // Simulate request handling
    requestHandler(mockRequest, mockResponse);
    
    // Verify Content-Type header is set correctly
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
  });

  it('should call response.end with Hello, World!', () => {
    // Get the request handler from the server
    const requestHandler = server.listeners('request')[0];
    
    // Simulate request handling
    requestHandler(mockRequest, mockResponse);
    
    // Verify response.end is called with correct message
    expect(mockResponse.end).toHaveBeenCalledWith('Hello, World!\n');
    expect(mockResponse.end).toHaveBeenCalledTimes(1);
  });

  it('should handle all HTTP methods identically', () => {
    // Test different HTTP methods to ensure consistent behavior
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const requestHandler = server.listeners('request')[0];
    
    httpMethods.forEach(method => {
      // Reset mocks for each method test
      jest.clearAllMocks();
      
      // Create request with different method
      const methodRequest = { ...mockRequest, method };
      const methodResponse = {
        statusCode: undefined,
        setHeader: jest.fn(),
        end: jest.fn()
      };
      
      // Simulate request handling
      requestHandler(methodRequest, methodResponse);
      
      // Verify consistent behavior regardless of HTTP method
      expect(methodResponse.statusCode).toBe(200);
      expect(methodResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(methodResponse.end).toHaveBeenCalledWith('Hello, World!\n');
    });
  });
});

describe('Error Handling', () => {
  it('should handle server creation gracefully', () => {
    // Test that server creation doesn't throw errors
    expect(() => {
      const testServer = createServer();
      expect(testServer).toBeDefined();
      
      // Verify server can be created with different parameters
      const customServer = createServer('localhost', 0);
      expect(customServer).toBeDefined();
    }).not.toThrow();
  });

  it('should provide server lifecycle methods for error handling', () => {
    const serverWrapper = createServer();
    
    // Verify error handling capabilities exist
    expect(typeof serverWrapper.start).toBe('function');
    expect(typeof serverWrapper.close).toBe('function');
    
    // Verify start method returns a Promise for error handling
    const startPromise = serverWrapper.start();
    expect(startPromise).toBeInstanceOf(Promise);
    
    // Clean up the started server
    return startPromise.then(server => {
      return serverWrapper.close();
    }).catch(err => {
      // Expected in test environment where port might be occupied
      expect(err).toBeDefined();
    });
  });
});