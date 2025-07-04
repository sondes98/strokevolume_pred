import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  MoonIcon, SunIcon, PlayIcon, StopIcon,
} from "@heroicons/react/24/solid";
import LVADImage from './assets/corwave-lvad-insertion.png';

export default function App() {
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [labelType, setLabelType] = useState("activity");
  const [labelValue, setLabelValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const stepRef = useRef(0);
  const socketRef = useRef(null);

  const activityOptions = ["exercising", "sitting", "sleeping", "walking"];
  const emotionOptions = ["drowsy", "normal", "relaxed", "stressed_angry"];
  const labelOptions = labelType === "activity" ? activityOptions : emotionOptions;

  const signals = [
    "Solar8000/HR", "Solar8000/RR_CO2", "Solar8000/NIBP_MBP",
    "Solar8000/PLETH_SPO2", "Solar8000/PLETH_HR", "EV1000/ART_MBP",
    "stroke_volume"
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
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#06b6d4", "#ec4899"
  ];

  // WebSocket setup
  useEffect(() => {
    socketRef.current = io("http://localhost:5050", {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    const socket = socketRef.current;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("new_prediction", ({ value }) => {
      setLatestPrediction(value);
      stepRef.current = +(stepRef.current + 0.5).toFixed(1);
      const point = { step: stepRef.current, stroke_volume: value };
      setWaveformData(prev => {
        const last = prev[prev.length - 1] || {};
        const merged = { ...last, ...point };
        const arr = [...prev.slice(0, -1), merged];
        return arr.length > 60 ? arr.slice(-60) : arr;
      });
    });

    socket.on("new_signal", data => {
      stepRef.current = +(stepRef.current + 0.5).toFixed(1);
      const enriched = { ...data, step: stepRef.current };
      setWaveformData(prev => {
        const arr = [...prev, enriched];
        return arr.length > 60 ? arr.slice(-60) : arr;
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    setLabelValue(labelOptions[0]);
  }, [labelType]);

  async function handleSimulate() {
    if (!labelValue) return alert("Select a label");
    setSimulating(true);
    try {
      await axios.post("http://localhost:5050/simulate", {
        type: labelType,
        label: labelValue
      });
    } catch {
      alert("Failed to simulate");
      setSimulating(false);
    }
  }

  async function handleStop() {
    setSimulating(false);
    try {
      await axios.post("http://localhost:5050/stop");
    } catch {
      alert("Failed to stop");
    }
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="app-container">
        {/* HEADER */}
        <header className="header">
          <h1>LVAD Monitoring</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="icon-btn"
            aria-label="Toggle theme"
            title="Toggle light/dark mode"
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        {/* CONTROLS */}
        <section className="controls">
          <div className="control-group">
            <label>Type:</label>
            <select value={labelType} onChange={e => setLabelType(e.target.value)}>
              <option value="activity">Activity</option>
              <option value="emotion">Emotion</option>
            </select>
          </div>

          <div className="control-group">
            <label>{labelType === "activity" ? "Activity" : "Emotion"}:</label>
            <select value={labelValue} onChange={e => setLabelValue(e.target.value)}>
              {labelOptions.map(opt => (
                <option key={opt} value={opt}>{opt.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <button onClick={handleSimulate} disabled={simulating} className="main-btn">
            <PlayIcon /> {simulating ? "Simulating..." : "Simulate"}
          </button>

          <button onClick={handleStop} disabled={!simulating} className="main-btn stop">
            <StopIcon /> Stop
          </button>

          <button onClick={() => setShowTable(!showTable)} className="main-btn toggle">
            {showTable ? "📈 Show Chart" : "📋 Show Table"}
          </button>

          <span className={`status ${connected ? "online" : "offline"}`}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </section>

        {/* STROKE VOLUME */}
        <section className="stroke-vol lvad-section">
          <div className="lvad-content">
            <div className="lvad-image">
              <img src={LVADImage} alt="LVAD" />
            </div>
            <div className="lvad-info">
              <h2>Stroke Volume</h2>
              <p>Real-time Monitoring</p>
              <div className="sv-value">
                {latestPrediction?.toFixed(2) ?? "--"}<span>mL/beat</span>
              </div>
              <span className={`sv-status ${latestPrediction != null ? "active" : "inactive"}`}>
                {latestPrediction != null ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </section>

        {/* VITALS OVERVIEW */}
        <section className="overview">
          <h2>Vitals Overview</h2>
          {showTable ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Time (s)</th>
                    {signals.map(s => (
                      <th key={s}>{signalNames[s]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waveformData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.step.toFixed(1)}</td>
                      {signals.map(s => (
                        <td key={s}>
                          {row[s] != null ? row[s].toFixed(2) : "--"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={waveformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="step"
                  type="number"
                  domain={[Math.max(0, stepRef.current - 30), stepRef.current]}
                  tickFormatter={t => `${t.toFixed(1)}s`}
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
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  );
}
