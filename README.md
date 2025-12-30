# hao-backprop-test

test project for backprop integration.

A simple Node.js HTTP server built with [Express.js](https://expressjs.com/) that demonstrates basic routing with multiple endpoints.

## Prerequisites

- Node.js version 18 or higher
- npm (Node Package Manager)

## Installation

Clone the repository and install the required dependencies:

```bash
npm install
```

This will install Express.js and all required dependencies defined in `package.json`.

## Usage

Start the server using one of the following commands:

```bash
# Using npm start script
npm start

# Or directly with Node.js
node server.js
```

The server will start and listen on `http://127.0.0.1:3000/`.

You should see the following message in your console:

```
Server running at http://127.0.0.1:3000/
```

## API Endpoints

The server exposes the following HTTP endpoints:

### GET /

Returns a "Hello, World!" greeting message.

**Request:**
```bash
curl http://127.0.0.1:3000/
```

**Response:**
```
Hello, World!
```

### GET /evening

Returns a "Good evening" greeting message.

**Request:**
```bash
curl http://127.0.0.1:3000/evening
```

**Response:**
```
Good evening
```

## License

MIT
