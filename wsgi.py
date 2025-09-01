"""
WSGI entry point for production server deployment.

This module provides the WSGI interface for deploying the Flask application
using production-grade WSGI servers such as Gunicorn, uWSGI, or mod_wsgi.

The 'application' object exposed by this module is the standard WSGI entry point
that production servers expect to find. It imports the Flask application instance
from app.py and exposes it with the conventional WSGI application name.

Usage Examples:
    # Gunicorn deployment
    gunicorn -w 4 -b 127.0.0.1:3000 wsgi:application
    
    # uWSGI deployment  
    uwsgi --module wsgi:application --http 127.0.0.1:3000
    
    # Direct import for testing
    from wsgi import application

Production Benefits:
- Multi-worker process management for scalability
- Enhanced performance over Flask development server
- Robust error handling and process monitoring
- Production-grade logging and metrics collection
- Graceful shutdown and reload capabilities
"""

from app import app

# WSGI application object for production server compatibility
# This is the standard WSGI entry point that production servers will import
# The name 'application' is the conventional WSGI variable name expected by
# Gunicorn, uWSGI, mod_wsgi, and other WSGI-compliant servers
application = app


# Configure production-specific settings if needed
# The application object inherits all Flask capabilities including:
# - run(): Start development server (inherited from Flask app)
# - route(): Define URL routes (inherited from Flask app) 
# - test_client(): Create test client for testing (inherited from Flask app)
# - __call__(environ, start_response): WSGI callable interface (inherited from Flask app)

# For production deployment, typical usage patterns:
# 1. Gunicorn: gunicorn -w 4 -b 127.0.0.1:3000 wsgi:application
# 2. uWSGI: uwsgi --module wsgi:application --http 127.0.0.1:3000
# 3. Apache mod_wsgi: WSGIScriptAlias / /path/to/wsgi.py

if __name__ == '__main__':
    # This block allows direct execution for testing the WSGI interface
    # In production, this code path is not executed as the WSGI server
    # imports the 'application' object directly
    print('WSGI interface loaded - starting Flask application directly')
    application.run(host='127.0.0.1', port=3000, debug=False)