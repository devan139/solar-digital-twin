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

  const latestPoint =
    data.length > 0 ? data[data.length - 1] : null;

  return (
    <section
      className="plant-charts"
      aria-label="Operational Telemetry Trends"
    >
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span className="section-eyebrow">
              GENERATION TELEMETRY
            </span>
            <h2 className="section-title">
              Plant Power Output
            </h2>
          </div>

          <div className="chart-meta">
            {latestPoint && (
              <span className="chart-latest-val">
                {latestPoint.power.toFixed(2)}{" "}
                <small className="chart-unit">
                  MW
                </small>
              </span>
            )}
            <span className="chart-tag">
              60s BUFFER
            </span>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={data}
              margin={{
                top: 12,
                right: 16,
                left: -16,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1c2533"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                minTickGap={40}
                stroke="#475569"
                tick={{
                  fill: "#64748b",
                  fontSize: 10,
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#334155" }}
              />

              <YAxis
                stroke="#475569"
                tick={{
                  fill: "#64748b",
                  fontSize: 10,
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#334155" }}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  background: "#0c131a",
                  borderColor: "#263546",
                  borderRadius: "8px",
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,0.6)",
                  color: "#f1f5f9",
                  fontSize: "12px",
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                labelStyle={{
                  color: "#94a3b8",
                  marginBottom: "4px",
                }}
                formatter={(value: any) => [
                  `${value} MW`,
                  "Power Output",
                ]}
              />

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
            <span className="section-eyebrow">
              THERMAL MONITORING
            </span>
            <h2 className="section-title">
              Maximum Panel Temperature
            </h2>
          </div>

          <div className="chart-meta">
            {latestPoint && (
              <span className="chart-latest-val val-warning">
                {latestPoint.temperature.toFixed(1)}{" "}
                <small className="chart-unit">
                  °C
                </small>
              </span>
            )}
            <span className="chart-tag">
              60s BUFFER
            </span>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={data}
              margin={{
                top: 12,
                right: 16,
                left: -16,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1c2533"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                minTickGap={40}
                stroke="#475569"
                tick={{
                  fill: "#64748b",
                  fontSize: 10,
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#334155" }}
              />

              <YAxis
                stroke="#475569"
                tick={{
                  fill: "#64748b",
                  fontSize: 10,
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#334155" }}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  background: "#0c131a",
                  borderColor: "#263546",
                  borderRadius: "8px",
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,0.6)",
                  color: "#f1f5f9",
                  fontSize: "12px",
                  fontFamily:
                    "JetBrains Mono, monospace",
                }}
                labelStyle={{
                  color: "#94a3b8",
                  marginBottom: "4px",
                }}
                formatter={(value: any) => [
                  `${value} °C`,
                  "Max Temperature",
                ]}
              />

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
