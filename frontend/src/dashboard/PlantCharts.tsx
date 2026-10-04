import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PlantCharts({ history }: PlantChartsProps) {
  const data = history.map((point) => ({
    time: formatTime(point.timestamp),
    power: Number((point.current_power_kw / 1000).toFixed(2)),
    temperature: Number(point.maximum_panel_temperature_c.toFixed(1)),
  }));

  const latestPoint = data.length > 0 ? data[data.length - 1] : null;
  const isCriticalTemp = latestPoint ? latestPoint.temperature >= 70 : false;
  const tempSeriesColor = isCriticalTemp ? "#FF5C5C" : "#F28C28";

  return (
    <section
      className="plant-charts"
      aria-label="Real-Time Telemetry Trends"
    >
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span className="section-eyebrow">
              TELEMETRY BUFFER &bull; 60 SECONDS
            </span>
            <h2 className="section-title">
              Plant Power Output
            </h2>
          </div>

          <div className="chart-meta">
            {latestPoint && (
              <div className="chart-hero-metric metric-power">
                <span className="chart-metric-value">
                  {latestPoint.power.toFixed(2)}
                </span>
                <span className="chart-metric-unit">MW</span>
              </div>
            )}
            <span className="chart-tag chart-tag-gold">ACTIVE MW</span>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 14,
                right: 18,
                left: -14,
                bottom: 2,
              }}
            >
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F6C453" stopOpacity={0.20} />
                  <stop offset="95%" stopColor="#F6C453" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="2 4"
                stroke="#172a2f"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                minTickGap={45}
                stroke="#20373C"
                tick={{
                  fill: "#849AA2",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#20373C" }}
              />

              <YAxis
                stroke="#20373C"
                tick={{
                  fill: "#849AA2",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#20373C" }}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  background: "#0D1B20",
                  borderColor: "#20373C",
                  borderRadius: "8px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                  color: "#EDF6F7",
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  color: "#849AA2",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
                formatter={(value: any) => [
                  `${value} MW`,
                  "Current Power",
                ]}
              />

              <Area
                type="monotone"
                dataKey="power"
                stroke="#F6C453"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#powerGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span className="section-eyebrow">
              THERMAL BUFFER &bull; 60 SECONDS
            </span>
            <h2 className="section-title">
              Maximum Panel Temperature
            </h2>
          </div>

          <div className="chart-meta">
            {latestPoint && (
              <div
                className={`chart-hero-metric ${
                  isCriticalTemp
                    ? "metric-critical"
                    : latestPoint.temperature >= 55
                    ? "metric-warning"
                    : "metric-warning"
                }`}
              >
                <span className="chart-metric-value">
                  {latestPoint.temperature.toFixed(1)}
                </span>
                <span className="chart-metric-unit">&deg;C</span>
              </div>
            )}
            <span
              className={`chart-tag ${
                isCriticalTemp ? "chart-tag-red" : "chart-tag-amber"
              }`}
            >
              PEAK TEMP
            </span>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 14,
                right: 18,
                left: -14,
                bottom: 2,
              }}
            >
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tempSeriesColor} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={tempSeriesColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="2 4"
                stroke="#172a2f"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                minTickGap={45}
                stroke="#20373C"
                tick={{
                  fill: "#849AA2",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#20373C" }}
              />

              <YAxis
                stroke="#20373C"
                tick={{
                  fill: "#849AA2",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickLine={{ stroke: "#20373C" }}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  background: "#0D1B20",
                  borderColor: "#20373C",
                  borderRadius: "8px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                  color: "#EDF6F7",
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  color: "#849AA2",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
                formatter={(value: any) => [
                  `${value} °C`,
                  "Max Temperature",
                ]}
              />

              <Area
                type="monotone"
                dataKey="temperature"
                stroke={tempSeriesColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#tempGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
