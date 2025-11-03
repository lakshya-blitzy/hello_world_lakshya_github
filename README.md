# hao-backprop-test
test project for backprop integration.

## Overview
This is a simple Python 3 Flask web application that serves "Hello, World!" on HTTP requests. This project has been migrated from Node.js to Python 3 Flask while maintaining 100% functional equivalence.

## Requirements
- Python 3.9 or higher
- Flask 3.1.2
- pip (Python package installer)

## Installation

### 1. Create a virtual environment (recommended)
```bash
python3.9 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

## Running the Server

### Start the Flask application
```bash
python app.py
```

The server will start at **http://127.0.0.1:3000/**

### Expected Output
```
Server running at http://127.0.0.1:3000/
```

### Testing the Server
Open a browser or use curl to test:
```bash
curl http://127.0.0.1:3000/
```

Expected response:
```
Hello, World!
```

## Security Considerations

### Development vs Production
⚠️ **IMPORTANT**: This application uses Flask's built-in development server, which is **NOT suitable for production use**.

### Security Best Practices

#### For Development:
1. **Virtual Environment**: Always use a virtual environment to isolate dependencies
   ```bash
   python3.9 -m venv venv
   source venv/bin/activate
   ```

2. **Localhost Binding**: The server binds to `127.0.0.1` (localhost only) by default, preventing external access during development

3. **Dependency Management**: Pin exact versions in `requirements.txt` to ensure reproducible builds and avoid supply chain attacks

4. **Keep Dependencies Updated**: Regularly update Flask and dependencies to receive security patches
   ```bash
   pip install --upgrade Flask
   pip freeze > requirements.txt
   ```

#### For Production Deployment:
If deploying this application to production, implement these critical security measures:

1. **Use a Production WSGI Server**: Replace Flask's development server with a production-grade WSGI server
   - **Gunicorn** (recommended for Unix/Linux):
     ```bash
     pip install gunicorn
     gunicorn -w 4 -b 127.0.0.1:3000 app:app
     ```
   - **Waitress** (cross-platform):
     ```bash
     pip install waitress
     waitress-serve --host=127.0.0.1 --port=3000 app:app
     ```

2. **Use a Reverse Proxy**: Deploy behind Nginx or Apache for:
   - HTTPS/TLS encryption
   - Rate limiting
   - Request filtering
   - Load balancing

3. **Enable HTTPS**: Never expose production applications over HTTP
   - Use Let's Encrypt for free SSL/TLS certificates
   - Configure proper TLS settings (TLS 1.2+)

4. **Environment Variables**: Externalize configuration (host, port, secret keys)
   ```python
   import os
   hostname = os.getenv('FLASK_HOST', '127.0.0.1')
   port = int(os.getenv('FLASK_PORT', 3000))
   ```

5. **Security Headers**: Add security headers to responses
   ```python
   @app.after_request
   def add_security_headers(response):
       response.headers['X-Content-Type-Options'] = 'nosniff'
       response.headers['X-Frame-Options'] = 'DENY'
       response.headers['X-XSS-Protection'] = '1; mode=block'
       response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
       return response
   ```

6. **Disable Debug Mode**: Ensure `debug=False` in production
   ```python
   app.run(host=hostname, port=port, debug=False)
   ```

7. **Input Validation**: Validate and sanitize all user inputs (if adding dynamic routes)

8. **Logging and Monitoring**: Implement proper logging for security events and anomaly detection

9. **Regular Security Audits**: Run security scanners
   ```bash
   pip install safety bandit
   safety check  # Check for known vulnerabilities
   bandit -r . # Static security analysis
   ```

10. **Firewall Configuration**: Use firewall rules to restrict access
    ```bash
    # Example: Allow only specific IPs
    ufw allow from 192.168.1.0/24 to any port 3000
    ```

### Common Security Vulnerabilities to Avoid
- **Directory Traversal**: Never serve files based on user input without validation
- **SQL Injection**: Use parameterized queries (not applicable to this simple app)
- **XSS Attacks**: Escape all user-generated content (not applicable to this static response app)
- **CSRF**: Implement CSRF tokens for forms (if adding form handling)
- **Denial of Service**: Implement rate limiting and request size limits

### Security Checklist for Production
- [ ] Using production WSGI server (Gunicorn/Waitress)
- [ ] HTTPS enabled with valid certificate
- [ ] Debug mode disabled (`debug=False`)
- [ ] Security headers configured
- [ ] Running behind reverse proxy (Nginx/Apache)
- [ ] Environment variables for configuration
- [ ] Logging and monitoring enabled
- [ ] Regular dependency updates scheduled
- [ ] Firewall rules configured
- [ ] Security audit completed

## Project Structure
```
.
├── app.py              # Flask application (main entry point)
├── requirements.txt    # Python dependencies
├── README.md          # This file
├── .gitignore         # Git ignore patterns
└── venv/              # Virtual environment (not tracked in git)
```

## Technology Stack
- **Language**: Python 3.9+
- **Framework**: Flask 3.1.2
- **WSGI Utility**: Werkzeug (Flask dependency)
- **Template Engine**: Jinja2 (Flask dependency)

## Migration Notes
This project was migrated from Node.js to Python 3 Flask with the following transformations:
- `server.js` → `app.py`
- `package.json` → `requirements.txt`
- Node.js `http` module → Flask framework
- Express-like routing using Flask decorators

## License
MIT

## Author
hxu