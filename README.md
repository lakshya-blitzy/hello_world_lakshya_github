# hao-backprop-test
test project for backprop integration.

## Testing

This project includes comprehensive unit and integration tests for the Express.js server using Jest and supertest.

### Prerequisites

- Node.js v18.20.8 or higher
- npm (comes with Node.js)
- All dependencies installed: `npm install`

### Running Tests

#### Run all tests once
```bash
npm test
```

#### Run tests with coverage report
```bash
npm run test:coverage
```
This generates coverage reports in multiple formats:
- Console output (text summary)
- HTML report in `coverage/` directory
- LCOV format for CI/CD tools

#### Run tests in watch mode (development)
```bash
npm run test:watch
```
Tests automatically re-run when source files change. Useful during development.

#### Run tests with verbose output
```bash
npm run test:verbose
```
Shows detailed information about each test case.

### Test Structure

The test suite is organized as follows:

- **`tests/server.test.js`**: Main integration tests for HTTP endpoints
  - Tests for GET / endpoint (response body, status codes, headers)
  - Tests for GET /evening endpoint
  - Edge cases and query parameters
  - 404 error handling
  - HTTP method testing
  - Performance and concurrent request handling
  - Response format validation

- **`tests/server.lifecycle.test.js`**: Server lifecycle and initialization tests
  - Server initialization and configuration
  - Request/response cycle handling
  - Middleware stack processing
  - Error handling and resilience
  - Resource management and memory leak prevention
  - Concurrent request handling
  - Express app property validation

### Coverage Requirements

The test suite targets the following coverage thresholds for `server.js`:

- **Line Coverage**: 83% minimum
- **Branch Coverage**: 50% minimum
- **Function Coverage**: 66% minimum
- **Statement Coverage**: 83% minimum

**Current Coverage Achieved**:
- Line Coverage: 83.33% (10 out of 12 lines covered) ✓ PASS
- Branch Coverage: 50% (1 out of 2 branches covered) ✓ PASS
- Function Coverage: 66.66% (2 out of 3 functions covered) ✓ PASS
- Statement Coverage: 83.33% (10 out of 12 statements covered) ✓ PASS

**Note**: The uncovered code (lines 21-22) is the `app.listen()` callback which is only executed when `server.js` is run directly (`node server.js`), not when imported for testing. This is intentional to prevent port conflicts during testing and represents expected behavior rather than a coverage gap.

### Viewing Coverage Reports

After running `npm run test:coverage`, open the HTML coverage report:

```bash
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

The HTML report provides detailed line-by-line coverage information.

### Writing New Tests

When adding new tests, follow these best practices:

1. **Test File Naming**: Use `.test.js` suffix (e.g., `feature.test.js`)
2. **Test Organization**: Group related tests using `describe()` blocks
3. **Test Structure**: Follow the AAA pattern (Arrange, Act, Assert)
4. **Async Testing**: Always use `async/await` with supertest
5. **Assertions**: Use Jest's built-in matchers (`expect().toBe()`, etc.)
6. **Independence**: Each test should be independent and not rely on others

Example test pattern:
```javascript
const request = require('supertest');
const app = require('../server');

describe('Feature Name', () => {
  it('should behave in a specific way', async () => {
    // Arrange: Set up test data
    
    // Act: Make request
    const response = await request(app).get('/endpoint');
    
    // Assert: Verify results
    expect(response.status).toBe(200);
    expect(response.text).toBe('Expected text');
  });
});
```

### Testing Framework

- **Jest 30.2.0**: Test runner, assertion library, and coverage tool
- **supertest 7.1.4**: HTTP integration testing for Express endpoints

### Troubleshooting

**Tests fail with "port already in use"**: This shouldn't happen as tests use supertest without binding to actual ports. If you see this, ensure `server.js` exports the app before calling `app.listen()`.

**Coverage thresholds not met**: Run `npm run test:coverage` to see which lines are uncovered. Remember that the server startup code is intentionally uncovered.

**Tests hang or timeout**: Check that all async operations use `await` and that no actual servers are being started in test code.