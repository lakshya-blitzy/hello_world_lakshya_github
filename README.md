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

## API Documentation

This Flask application provides multiple HTTP endpoints for arithmetic operations and a simple greeting message.

### Base URL
```
http://127.0.0.1:3000
```

### Endpoints

#### 1. Root Endpoint - Hello World
```
GET /
```

Returns a simple "Hello, World!" plain text greeting.

**Response:**
- **Content-Type:** `text/plain`
- **Status Code:** 200 OK
- **Body:** `Hello, World!\n`

**Example Request:**
```bash
curl http://127.0.0.1:3000/
```

**Example Response:**
```
Hello, World!
```

---

#### 2. Add Two Numbers
```
GET /add2?a=<number>&b=<number>
```

Adds two numbers together and returns the result in JSON format.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `a` | float | No | 0 | First number to add |
| `b` | float | No | 0 | Second number to add |

**Response:**
- **Content-Type:** `application/json`
- **Status Code:** 200 OK (success), 400 Bad Request (invalid input)

**Success Response Body:**
```json
{
  "result": 8.0,
  "operation": "add2",
  "inputs": [5.0, 3.0]
}
```

**Example Requests:**
```bash
# Add 5 + 3
curl "http://127.0.0.1:3000/add2?a=5&b=3"

# Add decimals: 2.5 + 7.3
curl "http://127.0.0.1:3000/add2?a=2.5&b=7.3"

# Default values (0 + 0)
curl "http://127.0.0.1:3000/add2"
```

**Error Response Example:**
```bash
curl "http://127.0.0.1:3000/add2?a=invalid&b=5"
```
```json
{
  "error": "Invalid input parameters",
  "message": "could not convert string to float: 'invalid'"
}
```

---

#### 3. Add Three Numbers
```
GET /add3?a=<number>&b=<number>&c=<number>
```

Adds three numbers together.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `a` | float | No | 0 | First number |
| `b` | float | No | 0 | Second number |
| `c` | float | No | 0 | Third number |

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add3?a=5&b=3&c=2"
```

**Example Response:**
```json
{
  "result": 10.0,
  "operation": "add3",
  "inputs": [5.0, 3.0, 2.0]
}
```

---

#### 4. Add Four Numbers
```
GET /add4?a=<number>&b=<number>&c=<number>&d=<number>
```

Adds four numbers together.

**Query Parameters:**
| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `a, b, c, d` | float | No | 0 |

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add4?a=5&b=3&c=2&d=1"
```

**Example Response:**
```json
{
  "result": 11.0,
  "operation": "add4",
  "inputs": [5.0, 3.0, 2.0, 1.0]
}
```

---

#### 5. Add Five Numbers
```
GET /add5?a=<number>&b=<number>&c=<number>&d=<number>&e=<number>
```

Adds five numbers together.

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add5?a=10&b=20&c=30&d=40&e=50"
```

**Example Response:**
```json
{
  "result": 150.0,
  "operation": "add5",
  "inputs": [10.0, 20.0, 30.0, 40.0, 50.0]
}
```

---

#### 6. Add Six Numbers
```
GET /add6?a=<number>&b=<number>&c=<number>&d=<number>&e=<number>&f=<number>
```

Adds six numbers together.

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add6?a=1&b=2&c=3&d=4&e=5&f=6"
```

**Example Response:**
```json
{
  "result": 21.0,
  "operation": "add6",
  "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
}
```

---

#### 7. Add Seven Numbers
```
GET /add7?a=<number>&b=<number>&c=<number>&d=<number>&e=<number>&f=<number>&g=<number>
```

Adds seven numbers together.

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add7?a=1&b=2&c=3&d=4&e=5&f=6&g=7"
```

**Example Response:**
```json
{
  "result": 28.0,
  "operation": "add7",
  "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0]
}
```

---

#### 8. Add Eight Numbers
```
GET /add8?a=<number>&b=<number>&c=<number>&d=<number>&e=<number>&f=<number>&g=<number>&h=<number>
```

Adds eight numbers together.

**Example Request:**
```bash
curl "http://127.0.0.1:3000/add8?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8"
```

**Example Response:**
```json
{
  "result": 36.0,
  "operation": "add8",
  "inputs": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
}
```

---

### Error Handling

All addition endpoints (`/add2` through `/add8`) follow the same error handling pattern:

**Error Response Structure:**
```json
{
  "error": "Invalid input parameters",
  "message": "<detailed error message>"
}
```

**Common Error Scenarios:**
1. **Non-numeric input**: Status 400
   ```bash
   curl "http://127.0.0.1:3000/add2?a=abc&b=5"
   ```

2. **Special characters**: Status 400
   ```bash
   curl "http://127.0.0.1:3000/add3?a=5&b=%23&c=3"
   ```

### Using the API with Different Tools

#### Using curl (Command Line)
```bash
# Simple GET request
curl "http://127.0.0.1:3000/add2?a=10&b=20"

# With verbose output
curl -v "http://127.0.0.1:3000/add2?a=10&b=20"

# Save response to file
curl "http://127.0.0.1:3000/add5?a=1&b=2&c=3&d=4&e=5" -o result.json
```

#### Using Python requests
```python
import requests

# Simple request
response = requests.get('http://127.0.0.1:3000/add2', params={'a': 10, 'b': 20})
print(response.json())  # {'result': 30.0, 'operation': 'add2', 'inputs': [10.0, 20.0]}

# Handle errors
response = requests.get('http://127.0.0.1:3000/add3', params={'a': 'invalid', 'b': 5, 'c': 3})
if response.status_code == 400:
    print(f"Error: {response.json()['error']}")
```

#### Using JavaScript fetch
```javascript
// Async/await pattern
async function addNumbers() {
  const response = await fetch('http://127.0.0.1:3000/add2?a=5&b=10');
  const data = await response.json();
  console.log(data.result);  // 15.0
}

// Promise pattern
fetch('http://127.0.0.1:3000/add4?a=1&b=2&c=3&d=4')
  .then(response => response.json())
  .then(data => console.log(data.result));  // 10.0
```

## Deployment Guide

This section provides comprehensive instructions for deploying the Flask application in various environments.

### Development Deployment

For local development and testing:

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Set up Python virtual environment:**
   ```bash
   python3.9 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the development server:**
   ```bash
   python app.py
   ```

5. **Verify the server is running:**
   ```bash
   curl http://127.0.0.1:3000/
   ```

### Production Deployment

#### Option 1: Using Gunicorn (Linux/Unix)

Gunicorn is a production-grade WSGI HTTP server for Python applications.

1. **Install Gunicorn:**
   ```bash
   pip install gunicorn
   ```

2. **Run with Gunicorn:**
   ```bash
   # Basic usage (4 worker processes)
   gunicorn -w 4 -b 127.0.0.1:3000 app:app
   
   # With access logging
   gunicorn -w 4 -b 127.0.0.1:3000 --access-logfile access.log --error-logfile error.log app:app
   
   # Bind to all interfaces (use with caution)
   gunicorn -w 4 -b 0.0.0.0:3000 app:app
   ```

3. **Recommended worker count:**
   ```
   workers = (2 × number_of_cpu_cores) + 1
   ```

4. **Run as a systemd service:**
   
   Create `/etc/systemd/system/flask-app.service`:
   ```ini
   [Unit]
   Description=Flask Application
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/path/to/app
   Environment="PATH=/path/to/app/venv/bin"
   ExecStart=/path/to/app/venv/bin/gunicorn -w 4 -b 127.0.0.1:3000 app:app

   [Install]
   WantedBy=multi-user.target
   ```
   
   Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable flask-app
   sudo systemctl start flask-app
   sudo systemctl status flask-app
   ```

#### Option 2: Using Waitress (Cross-Platform)

Waitress is a production-quality pure-Python WSGI server that works on Windows, Linux, and macOS.

1. **Install Waitress:**
   ```bash
   pip install waitress
   ```

2. **Run with Waitress:**
   ```bash
   waitress-serve --host=127.0.0.1 --port=3000 app:app
   ```

3. **Create a production startup script:**
   
   Create `start_production.py`:
   ```python
   from waitress import serve
   from app import app
   
   if __name__ == '__main__':
       print('Starting production server on http://127.0.0.1:3000/')
       serve(app, host='127.0.0.1', port=3000, threads=4)
   ```
   
   Run:
   ```bash
   python start_production.py
   ```

#### Option 3: Docker Deployment

Deploy the application in a Docker container for consistency across environments.

1. **Create `Dockerfile`:**
   ```dockerfile
   FROM python:3.9-slim
   
   WORKDIR /app
   
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt gunicorn
   
   COPY app.py .
   
   EXPOSE 3000
   
   CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:3000", "app:app"]
   ```

2. **Create `.dockerignore`:**
   ```
   venv/
   __pycache__/
   *.pyc
   .git/
   .gitignore
   README.md
   ```

3. **Build Docker image:**
   ```bash
   docker build -t flask-hello-world .
   ```

4. **Run container:**
   ```bash
   docker run -d -p 3000:3000 --name flask-app flask-hello-world
   ```

5. **Using Docker Compose:**
   
   Create `docker-compose.yml`:
   ```yaml
   version: '3.8'
   services:
     web:
       build: .
       ports:
         - "3000:3000"
       restart: unless-stopped
       environment:
         - FLASK_ENV=production
   ```
   
   Deploy:
   ```bash
   docker-compose up -d
   ```

#### Option 4: Cloud Platform Deployment

##### Heroku
```bash
# Install Heroku CLI and login
heroku login

# Create Procfile
echo "web: gunicorn app:app" > Procfile

# Create runtime.txt
echo "python-3.9.19" > runtime.txt

# Deploy
heroku create
git push heroku main
```

##### AWS Elastic Beanstalk
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init -p python-3.9 flask-app

# Create environment and deploy
eb create flask-env
eb deploy
```

##### Google Cloud Platform (App Engine)
Create `app.yaml`:
```yaml
runtime: python39
entrypoint: gunicorn -b :$PORT app:app

instance_class: F2

automatic_scaling:
  max_instances: 10
```

Deploy:
```bash
gcloud app deploy
```

### Reverse Proxy Configuration (Nginx)

For production, run the application behind Nginx for HTTPS, load balancing, and static file serving.

1. **Install Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Configure Nginx:**
   
   Create `/etc/nginx/sites-available/flask-app`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Enable the site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/flask-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Add HTTPS with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Environment Variables

For production, externalize configuration using environment variables:

**Create `.env` file:**
```bash
FLASK_HOST=127.0.0.1
FLASK_PORT=3000
FLASK_ENV=production
```

**Update `app.py` to use environment variables:**
```python
import os
from dotenv import load_dotenv

load_dotenv()

hostname = os.getenv('FLASK_HOST', '127.0.0.1')
port = int(os.getenv('FLASK_PORT', 3000))
```

**Install python-dotenv:**
```bash
pip install python-dotenv
```

### Monitoring and Logging

#### Application Logging
Configure Python logging in production:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

#### System Monitoring
- Use **htop** for system resource monitoring
- Use **netstat** or **ss** to monitor network connections
- Use **journalctl** to view systemd service logs

```bash
# View application logs
sudo journalctl -u flask-app -f

# Monitor system resources
htop

# Check listening ports
sudo netstat -tlnp | grep 3000
```

### Performance Optimization

1. **Enable Gzip Compression** (Nginx):
   ```nginx
   gzip on;
   gzip_types application/json text/plain;
   ```

2. **Use Connection Pooling** for databases (if added)

3. **Implement Caching** with Redis or Memcached

4. **Load Balancing** with multiple Gunicorn workers:
   ```bash
   gunicorn -w 8 --worker-class gevent -b 127.0.0.1:3000 app:app
   ```

### Health Checks

Add a health check endpoint to `app.py`:
```python
@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'service': 'flask-app'}), 200
```

Configure monitoring tools (e.g., Nagios, Prometheus) to poll this endpoint.

### Backup and Recovery

1. **Version Control**: Ensure all code is committed to Git
2. **Database Backups**: If using a database, automate regular backups
3. **Configuration Backups**: Store environment configurations securely

### Troubleshooting

**Common Issues:**

1. **Port already in use:**
   ```bash
   # Find process using port 3000
   sudo lsof -i :3000
   # Kill the process
   sudo kill -9 <PID>
   ```

2. **Permission denied:**
   ```bash
   # Run with appropriate user permissions
   sudo chown -R www-data:www-data /path/to/app
   ```

3. **Module not found:**
   ```bash
   # Ensure virtual environment is activated
   source venv/bin/activate
   pip install -r requirements.txt
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