import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function App() {
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [labelType, setLabelType] = useState("activity");
  const [labelValue, setLabelValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const stepRef = useRef(0);
  const socketRef = useRef(null);

  const activityOptions = ["exercising", "sitting", "sleeping", "walking"];
  const emotionOptions = ["drowsy", "normal", "relaxed", "stressed_angry"];
  const labelOptions = labelType === "activity" ? activityOptions : emotionOptions;

  const signals = [
    "Solar8000/HR",
    "Solar8000/RR_CO2",
    "Solar8000/NIBP_MBP",
    "Solar8000/PLETH_SPO2",
    "Solar8000/PLETH_HR",
    "EV1000/ART_MBP",
    "stroke_volume",
  ];

  const signalNames = {
    "Solar8000/HR": "Heart Rate",
    "Solar8000/RR_CO2": "CO₂ Resp. Rate",
    "Solar8000/NIBP_MBP": "NIBP Mean BP",
    "Solar8000/PLETH_SPO2": "SpO₂",
    "Solar8000/PLETH_HR": "Pleth HR",
    "EV1000/ART_MBP": "Art. Mean BP",
    "stroke_volume": "Stroke Volume",
  };

  const signalColors = [
    "#007bff", "#28a745", "#ffc107", "#dc3545",
    "#6f42c1", "#17a2b8", "#ff69b4" // Pink for Stroke Volume
  ];

  useEffect(() => {
    socketRef.current = io("http://localhost:5050", {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) =>
      console.error("🔌 WebSocket error:", err.message)
    );

    socket.on("new_prediction", (data) => {
      setLatestPrediction(data.value);
    
      stepRef.current = +(stepRef.current + 0.5).toFixed(1);
      const newPoint = {
        step: stepRef.current,
        stroke_volume: data.value,
      };
    
      setWaveformData((prev) => {
        const last = prev[prev.length - 1] || {};
        const combined = { ...last, ...newPoint }; // merge stroke with existing vitals
        const updated = [...prev.slice(0, -1), combined];
        return updated.length > 60 ? updated.slice(-60) : updated;
      });
    });
    

    socket.on("new_signal", (data) => {
      stepRef.current = +(stepRef.current + 0.5).toFixed(1);
      const enriched = { ...data, step: stepRef.current };

      setWaveformData((prev) => {
        const updated = [...prev, enriched];
        return updated.length > 60 ? updated.slice(-60) : updated;
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    setLabelValue(labelOptions[0]);
  }, [labelType]);

  const handleSimulate = async () => {
    if (!labelValue) return alert("❗ Select a valid label");
    try {
      setSimulating(true);
      await axios.post("http://localhost:5050/simulate", {
        type: labelType,
        label: labelValue,
      });
    } catch (err) {
      console.error(err);
      alert("❌ Failed to trigger simulation");
      setSimulating(false);
    }
  };

  const handleStop = async () => {
    try {
      await axios.post("http://localhost:5050/stop");
      setSimulating(false);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to stop simulation");
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-start">
      <div className="w-full max-w-6xl space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex gap-4">
            <select
              className="border rounded px-3 py-1"
              value={labelType}
              onChange={(e) => setLabelType(e.target.value)}
            >
              <option value="activity">Activity</option>
              <option value="emotion">Emotion</option>
            </select>

            <select
              className="border rounded px-3 py-1"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
            >
              {labelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1).replace("_", " ")}
                </option>
              ))}
            </select>

            <button
              onClick={handleSimulate}
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={simulating}
            >
              {simulating ? "⏳ Simulating..." : "🚀 Simulate"}
            </button>

            <button
              onClick={handleStop}
              className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 disabled:opacity-50"
              disabled={!simulating}
            >
              🛑 Stop
            </button>
          </div>

          <div className={`font-semibold text-lg ${connected ? "text-green-600" : "text-red-600"}`}>
            {connected ? "🟢 Connected" : "🔴 Not connected"}
          </div>
        </div>

        {/* Prediction display */}
        <div className="text-center text-xl font-semibold bg-white rounded shadow p-4">
          🔹 Latest Stroke Volume:{" "}
          <span className="text-blue-600">
            {latestPrediction !== null ? `${latestPrediction} mL` : "Waiting..."}
          </span>
        </div>

        {/* Combined Waveform */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-lg font-medium mb-2">📉 Combined Vitals</h2>
          <LineChart
            width={1100}
            height={280}
            data={waveformData}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="step"
              type="number"
              domain={[Math.max(0, stepRef.current - 30), stepRef.current]}
              tickFormatter={(tick) => `${tick.toFixed(1)}s`}
              label={{ value: "Time (s)", position: "insideBottom", offset: -4 }}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            {signals.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={signalColors[i]}
                name={signalNames[s]}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>

        {/* Individual Signals */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {signals.map((s, i) => (
            <div key={s} className="bg-white rounded shadow p-2">
              <h3 className="text-sm font-medium mb-1">{signalNames[s]}</h3>
              <LineChart
                width={500}
                height={150}
                data={waveformData}
                margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="step"
                  type="number"
                  domain={[Math.max(0, stepRef.current - 30), stepRef.current]}
                  tickFormatter={(tick) => `${tick.toFixed(1)}s`}
                />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={s}
                  stroke={signalColors[i]}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default App;
