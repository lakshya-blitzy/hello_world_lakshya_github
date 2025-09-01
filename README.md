# Hello World Flask Server

A simple Python Flask web application that serves a "Hello, World!" message. This project has been migrated from Node.js to Python 3 Flask while maintaining exact feature parity and behavior.

**Author:** hxu  
**Project Name:** hello_world

## Overview

This Flask application provides a minimal HTTP server that:
- Binds to `127.0.0.1:3000` (localhost only)
- Returns `Hello, World!\n` for all requests to the root path
- Serves responses with `text/plain` content type
- Maintains identical behavior to the original Node.js implementation

## Requirements

- Python 3.6 or higher (Python 3.12+ recommended)
- pip (Python package installer)
- Virtual environment support

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd hello_world
```

### 2. Set Up Virtual Environment

Create and activate a Python virtual environment to isolate dependencies:

```bash
# Create virtual environment
python3 -m venv flask_env

# Activate virtual environment
# On Linux/macOS:
source flask_env/bin/activate
# On Windows:
flask_env\Scripts\activate
```

### 3. Install Dependencies

Install Flask and all required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Development Server

Start the Flask development server:

```bash
python app.py
```

The server will start and display:
```
Server running at http://127.0.0.1:3000/
```

### Testing the Server

Open a web browser and navigate to `http://127.0.0.1:3000/` or use curl:

```bash
curl http://127.0.0.1:3000/
```

Expected response:
```
Hello, World!
```

## Development

### Project Structure

```
hello_world/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── setup.py           # Package configuration
├── wsgi.py            # WSGI entry point for production
├── test_app.py        # Unit tests
├── flask_env/         # Virtual environment (git-ignored)
├── README.md          # This documentation
└── .gitignore         # Python-specific exclusions
```

### Running Tests

Execute the test suite to validate functionality:

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run tests with pytest
pytest test_app.py -v
```

### Development Workflow

1. Ensure virtual environment is activated
2. Make changes to `app.py`
3. Test locally with `python app.py`
4. Run unit tests with `pytest`
5. Commit changes when tests pass

## Production Deployment

### WSGI Server

For production deployment, use a WSGI server like Gunicorn:

```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 127.0.0.1:3000 wsgi:application
```

### Docker Deployment

Build and run using Docker:

```bash
# Build Docker image
docker build -t hello-world-flask .

# Run container
docker run -p 3000:3000 hello-world-flask
```

### Docker Compose

Use Docker Compose for orchestration:

```bash
docker-compose up --build
```

## Migration Notes

This project was migrated from Node.js to Python Flask with the following key changes:

### Before (Node.js)
- `server.js` - Node.js HTTP server implementation
- `package.json` - NPM dependencies
- `npm install` - Dependency installation
- `node server.js` - Server startup

### After (Python Flask)
- `app.py` - Flask application implementation
- `requirements.txt` - Python dependencies
- `pip install -r requirements.txt` - Dependency installation
- `python app.py` - Server startup

### Preserved Behavior
- Same network binding (`127.0.0.1:3000`)
- Identical HTTP response (`Hello, World!\n`)
- Same content type (`text/plain`)
- Matching console output on startup

## Troubleshooting

### Common Issues

**Virtual Environment Not Activated:**
```bash
# Ensure you see (flask_env) in your terminal prompt
source flask_env/bin/activate  # Linux/macOS
flask_env\Scripts\activate     # Windows
```

**Port Already in Use:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9  # Linux/macOS
netstat -ano | findstr :3000   # Windows
```

**Flask Not Found:**
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

## License

This project maintains the same license terms as the original Node.js implementation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests to ensure they pass
5. Submit a pull request

## Support

For questions or issues, please refer to the Flask documentation at https://flask.palletsprojects.com/