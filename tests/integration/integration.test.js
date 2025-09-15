const { createServer } = require('../../app');
const request = require('supertest');

describe('HTTP Server Integration Tests', () => {
    let serverInstance;
    let server;

    beforeAll(async () => {
        // Create server instance using dynamic port allocation for test isolation
        serverInstance = createServer('127.0.0.1', 0);  // Port 0 for automatic assignment
        
        // Start the server and get the underlying HTTP server
        server = await serverInstance.start();
    });

    afterAll(async () => {
        // Clean shutdown of server after all tests complete
        if (serverInstance) {
            await serverInstance.close();
        }
    });

    describe('GET Request Testing', () => {
        it('should return 200 status code and correct response for GET requests', async () => {
            const response = await request(server)
                .get('/')
                .expect(200)
                .expect('Content-Type', 'text/plain');
                
            expect(response.text).toEqual('Hello, World!\n');
        });

        it('should handle GET requests to any path with same response', async () => {
            const response = await request(server)
                .get('/any/random/path')
                .expect(200)
                .expect('Content-Type', 'text/plain');
                
            expect(response.text).toContain('Hello, World!');
        });
    });

    describe('Multiple HTTP Methods Testing', () => {
        it('should return identical response for POST requests', async () => {
            const response = await request(server)
                .post('/')
                .expect(200)
                .expect('Content-Type', 'text/plain');
                
            expect(response.text).toBe('Hello, World!\n');
        });

        it('should return identical response for PUT requests', async () => {
            const response = await request(server)
                .put('/test')
                .expect(200)
                .expect('Content-Type', 'text/plain');
                
            expect(response.text).toBe('Hello, World!\n');
        });

        it('should return identical response for DELETE requests', async () => {
            const response = await request(server)
                .delete('/api/resource')
                .expect(200)
                .expect('Content-Type', 'text/plain');
                
            expect(response.text).toBe('Hello, World!\n');
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should handle multiple concurrent requests correctly', async () => {
            // Create array of concurrent request promises
            const concurrentRequests = Array(5).fill(null).map((_, index) => 
                request(server)
                    .get(`/concurrent/${index}`)
                    .expect(200)
                    .expect('Content-Type', 'text/plain')
            );

            // Execute all requests concurrently and wait for completion
            const responses = await Promise.all(concurrentRequests);
            
            // Validate that all responses are consistent (stateless operation)
            responses.forEach((response, index) => {
                expect(response.text).toBe('Hello, World!\n');
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Response Header Validation', () => {
        it('should set correct Content-Type header for all requests', async () => {
            const methods = ['get', 'post', 'put', 'delete'];
            
            for (const method of methods) {
                const response = await request(server)[method]('/header-test')
                    .expect(200);
                
                expect(response.headers['content-type']).toBe('text/plain');
                expect(response.text).toBe('Hello, World!\n');
            }
        });
    });
});