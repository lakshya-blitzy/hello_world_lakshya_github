from flask import Flask, Response

app = Flask(__name__)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
def hello_world(path):
    """
    Request handler that responds to all HTTP methods and all URL paths.
    Replicates Node.js http.createServer() behavior with static response.
    
    Args:
        path: URL path component (captured by Flask routing)
    
    Returns:
        Flask Response object with 'Hello, World!' content, 200 status, and text/plain Content-Type
    """
    return Response('Hello, World!\n', status=200, mimetype='text/plain')

if __name__ == '__main__':
    hostname = '127.0.0.1'
    port = 3000
    print(f'Server running at http://{hostname}:{port}/')
    app.run(host=hostname, port=port)
