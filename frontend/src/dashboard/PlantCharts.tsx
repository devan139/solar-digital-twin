import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import type { PlantTelemetry } from "../telemetry/types";

interface PlantChartsProps {
  history: PlantTelemetry[];
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}

export function PlantCharts({
  history,
}: PlantChartsProps) {
  const data = history.map((point) => ({
    time: formatTime(point.timestamp),
    power: Number(
      (point.current_power_kw / 1000).toFixed(2),
    ),
    temperature: Number(
      point.maximum_panel_temperature_c.toFixed(1),
    ),
  }));

  return (
    <section className="plant-charts">

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span>GENERATION</span>
            <h2>Power Output</h2>
          </div>

          <strong>MW</strong>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="time"
                minTickGap={30}
              />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="power"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span>THERMAL MONITORING</span>
            <h2>Maximum Panel Temperature</h2>
          </div>

          <strong>°C</strong>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="time"
                minTickGap={30}
              />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </section>
  );
}
