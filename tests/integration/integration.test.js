const request = require('supertest');
const { createServer } = require('../../app');

describe('Server Integration Tests', () => {
  let app;
  
  beforeEach(() => {
    // Create server instance for testing (don't start it - supertest handles that)
    app = createServer({ port: 0 });
  });

  afterEach(async () => {
    if (app && app.server && app.server.listening) {
      await app.stop();
    }
  });

  test('GET request returns 200 status with Hello World message', async () => {
    const response = await request(app.server)
      .get('/')
      .expect(200);
    
    expect(response.text).toBe('Hello, World!\n');
  });

  test('GET request returns correct Content-Type header', async () => {
    await request(app.server)
      .get('/')
      .expect('Content-Type', 'text/plain')
      .expect(200);
  });

  test('Server handles multiple concurrent requests', async () => {
    const requests = [];
    
    // Create 5 concurrent requests
    for (let i = 0; i < 5; i++) {
      requests.push(
        request(app.server)
          .get('/')
          .expect(200)
          .expect('Hello, World!\n')
      );
    }
    
    // Wait for all requests to complete
    const responses = await Promise.all(requests);
    
    // Verify all responses are correct
    responses.forEach(response => {
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });
  });

  test('POST request returns 200 status (same handler)', async () => {
    const response = await request(app.server)
      .post('/')
      .expect(200);
    
    expect(response.text).toBe('Hello, World!\n');
  });

  test('Server responds to different HTTP methods', async () => {
    const methods = ['get', 'post', 'put', 'delete'];
    
    for (const method of methods) {
      const response = await request(app.server)[method]('/')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
    }
  });
});