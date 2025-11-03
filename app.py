from flask import Flask

app = Flask(__name__)
hostname = '127.0.0.1'
port = 3000

@app.route('/')
def hello():
    return 'Hello, World!\n', 200, {'Content-Type': 'text/plain'}

if __name__ == '__main__':
    print(f'Server running at http://{hostname}:{port}/')
    app.run(host=hostname, port=port)
