import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import sys
import threading

# Extend path to access modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.streaming.producer import stream_csv, stop_streaming

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

streaming_thread = None

@app.route("/")
def home():
    return "✅ Stroke Volume Prediction API with WebSocket is live!"

@app.route("/simulate", methods=["POST"])
def simulate():
    global streaming_thread

    data = request.get_json()
    label_type = data.get("type")
    label_value = data.get("label")

    if not label_type or not label_value:
        return jsonify({"error": "Missing type or label"}), 400

    safe_label = label_value.replace("/", "_")
    file_path = f"data/labeled_{label_type}/{safe_label}.csv"
    if not os.path.exists(file_path):
        return jsonify({"error": f"{label_type}/{label_value} not found."}), 404

    try:
        streaming_thread = threading.Thread(target=stream_csv, args=(file_path,), kwargs={"delay": 0.5})
        streaming_thread.start()
        return jsonify({"status": f"✅ Streaming started for: {label_value}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stop", methods=["POST"])
def stop():
    stop_streaming()
    return jsonify({"status": "🛑 Streaming stopped."}), 200

@app.route("/emit", methods=["POST"])
def emit_from_spark():
    data = request.get_json()
    if not data or "prediction" not in data:
        return jsonify({"error": "Missing 'prediction' field"}), 400

    prediction = round(data["prediction"], 2)
    socketio.emit("new_prediction", {"value": prediction})
    print(f"📡 Emitted to frontend: {prediction} mL")
    return jsonify({"status": f"✅ Emitted {prediction} mL"}), 200

@app.route("/emit_waveform", methods=["POST"])
def emit_waveform():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing waveform data"}), 400

    socketio.emit("new_signal", data)
    print(f"📈 Emitted waveform: {data}")
    return jsonify({"status": "✅ Waveform emitted"}), 200


if __name__ == "__main__":
    socketio.run(app, host="localhost", port=5050)
