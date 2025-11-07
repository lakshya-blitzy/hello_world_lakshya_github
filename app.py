from flask import Flask, request, jsonify

app = Flask(__name__)
hostname = '127.0.0.1'
port = 3000

@app.route('/')
def hello():
    return 'Hello, World!\n', 200, {'Content-Type': 'text/plain'}

@app.route('/add2')
def add_2_numbers():
    """Add 2 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        result = a + b
        return jsonify({'result': result, 'operation': 'add2', 'inputs': [a, b]}), 200
    except (TypeError, ValueError) as e:
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add3')
def add_3_numbers():
    """Add 3 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        result = a + b + c
        return jsonify({'result': result, 'operation': 'add3', 'inputs': [a, b, c]}), 200
    except (TypeError, ValueError) as e:
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add4')
def add_4_numbers():
    """Add 4 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        result = a + b + c + d
        return jsonify({'result': result, 'operation': 'add4', 'inputs': [a, b, c, d]}), 200
    except (TypeError, ValueError) as e:
        return jsonify({'error': 'Invalid input parameters', 'message': str(e)}), 400

@app.route('/add5')
def add_5_numbers():
    """Add 5 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        result = a + b + c + d + e
        return jsonify({'result': result, 'operation': 'add5', 'inputs': [a, b, c, d, e]}), 200
    except (TypeError, ValueError) as ex:
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add6')
def add_6_numbers():
    """Add 6 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        result = a + b + c + d + e + f
        return jsonify({'result': result, 'operation': 'add6', 'inputs': [a, b, c, d, e, f]}), 200
    except (TypeError, ValueError) as ex:
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add7')
def add_7_numbers():
    """Add 7 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        g = float(request.args.get('g', 0))
        result = a + b + c + d + e + f + g
        return jsonify({'result': result, 'operation': 'add7', 'inputs': [a, b, c, d, e, f, g]}), 200
    except (TypeError, ValueError) as ex:
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

@app.route('/add8')
def add_8_numbers():
    """Add 8 numbers together."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        c = float(request.args.get('c', 0))
        d = float(request.args.get('d', 0))
        e = float(request.args.get('e', 0))
        f = float(request.args.get('f', 0))
        g = float(request.args.get('g', 0))
        h = float(request.args.get('h', 0))
        result = a + b + c + d + e + f + g + h
        return jsonify({'result': result, 'operation': 'add8', 'inputs': [a, b, c, d, e, f, g, h]}), 200
    except (TypeError, ValueError) as ex:
        return jsonify({'error': 'Invalid input parameters', 'message': str(ex)}), 400

if __name__ == '__main__':
    print(f'Server running at http://{hostname}:{port}/')
    app.run(host=hostname, port=port)
