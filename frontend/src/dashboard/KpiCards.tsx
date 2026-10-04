import type { PlantTelemetry } from "../telemetry/types";

interface KpiCardsProps {
  plant: PlantTelemetry | null;
}

export function KpiCards({ plant }: KpiCardsProps) {
  const powerMw = plant ? plant.current_power_kw / 1000 : null;
  const avgTemp = plant ? plant.average_panel_temperature_c : null;
  const maxTemp = plant ? plant.maximum_panel_temperature_c : null;
  const status = plant ? plant.plant_status : "CONNECTING";
  const efficiency = plant ? plant.average_efficiency_pct : null;

  return (
    <section className="kpi-section" aria-label="Plant Operational Metrics">
      <div className="kpi-grid">
        <div className="kpi-card kpi-card-power">
          <div className="kpi-header">
            <span className="kpi-label">Current Power</span>
            <span className="kpi-tag kpi-tag-gold">MW GEN</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {powerMw !== null ? powerMw.toFixed(2) : "--.--"}
            </span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">Active Generation</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-temp">
          <div className="kpi-header">
            <span className="kpi-label">Average Panel Temp</span>
            <span className="kpi-tag kpi-tag-amber">MEAN</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {avgTemp !== null ? avgTemp.toFixed(1) : "--.-"}
            </span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">Across 6 Arrays</span>
          </div>
        </div>

        <div
          className={`kpi-card ${
            maxTemp && maxTemp >= 70
              ? "kpi-card-critical"
              : "kpi-card-temp"
          }`}
        >
          <div className="kpi-header">
            <span className="kpi-label">Maximum Panel Temp</span>
            <span
              className={`kpi-tag ${
                maxTemp && maxTemp >= 70
                  ? "tag-critical"
                  : "tag-warning"
              }`}
            >
              PEAK
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {maxTemp !== null ? maxTemp.toFixed(1) : "--.-"}
            </span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">Threshold: 70.0°C</span>
          </div>
        </div>

        <div className={`kpi-card kpi-card-status status-${status.toLowerCase()}`}>
          <div className="kpi-header">
            <span className="kpi-label">Plant Status</span>
            <span
              className={`status-indicator-dot status-${status.toLowerCase()}`}
            />
          </div>
          <div className="kpi-body">
            <span
              className={`kpi-value status-text status-${status.toLowerCase()}`}
            >
              {status}
            </span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">
              {status === "CRITICAL"
                ? "Immediate Action Required"
                : status === "WARNING"
                ? "Thermal Advisory Active"
                : "Nominal Operating State"}
            </span>
          </div>
        </div>

        <div className="kpi-card kpi-card-efficiency">
          <div className="kpi-header">
            <span className="kpi-label">Average Efficiency</span>
            <span className="kpi-tag kpi-tag-neutral">SYSTEM</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {efficiency !== null ? efficiency.toFixed(1) : "--.-"}
            </span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">PV Conversion Rate</span>
          </div>
        </div>
      </div>
    </section>
  );
}
