import type { PlantTelemetry } from "../telemetry/types";

interface KpiCardsProps {
  plant: PlantTelemetry | null;
  freshCount?: number;
  totalAssets?: number;
  dataHealth?: string;
  isStale?: boolean;
}

export function KpiCards({
  plant,
  freshCount = 0,
  totalAssets = 6,
  dataHealth = "UNKNOWN",
  isStale = false,
}: KpiCardsProps) {
  const powerMw = plant ? plant.current_power_kw / 1000 : null;
  const avgTemp = plant ? plant.average_panel_temperature_c : null;
  const maxTemp = plant ? plant.maximum_panel_temperature_c : null;
  const status = plant ? plant.plant_status : "CONNECTING";
  const efficiency = plant ? plant.average_efficiency_pct : null;

  const isPeakCritical = maxTemp !== null && maxTemp >= 75.0;
  const isPeakWarning = maxTemp !== null && maxTemp >= 70.0 && maxTemp < 75.0;

  return (
    <section className="kpi-section" aria-label="Plant Operational Metrics">
      <div className="kpi-grid">
        {/* 1. Active Generation */}
        <div className="kpi-card kpi-card-power">
          <div className="kpi-header">
            <span className="kpi-label">Current Power</span>
            <span className="kpi-tag kpi-tag-gold">
              {isStale ? "LAST KNOWN" : "MW GEN"}
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {powerMw !== null ? powerMw.toFixed(2) : "--.--"}
            </span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">
              {isStale ? "Cached reading (stale telemetry)" : "Active Generation"}
            </span>
          </div>
        </div>

        {/* 2. Mean Temperature */}
        <div className="kpi-card kpi-card-temp">
          <div className="kpi-header">
            <span className="kpi-label">Average Panel Temp</span>
            <span className="kpi-tag kpi-tag-amber">
              {isStale ? "LAST KNOWN" : "MEAN"}
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {avgTemp !== null ? avgTemp.toFixed(1) : "--.-"}
            </span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">Across {totalAssets} Arrays</span>
          </div>
        </div>

        {/* 3. Maximum Temperature (Thresholds: <70 Normal, 70-75 Warning, >=75 Critical) */}
        <div
          className={`kpi-card ${
            isPeakCritical
              ? "kpi-card-critical"
              : isPeakWarning
              ? "kpi-card-warning"
              : "kpi-card-temp"
          }`}
        >
          <div className="kpi-header">
            <span className="kpi-label">Maximum Panel Temp</span>
            <span
              className={`kpi-tag ${
                isPeakCritical
                  ? "tag-critical"
                  : isPeakWarning
                  ? "tag-warning"
                  : "tag-normal"
              }`}
            >
              {isPeakCritical
                ? "CRITICAL ≥75°C"
                : isPeakWarning
                ? "WARNING ≥70°C"
                : "NOMINAL <70°C"}
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {maxTemp !== null ? maxTemp.toFixed(1) : "--.-"}
            </span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">
              Thresholds: Warn 70.0°C | Crit 75.0°C
            </span>
          </div>
        </div>

        {/* 4. Plant Equipment Status */}
        <div
          className={`kpi-card kpi-card-status status-${status.toLowerCase()}`}
        >
          <div className="kpi-header">
            <span className="kpi-label">Plant Equipment</span>
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
                : status === "UNKNOWN"
                ? "Equipment State Unverified"
                : "Nominal Operating State"}
            </span>
          </div>
        </div>

        {/* 5. Average Efficiency */}
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

        {/* 6. Plant Telemetry Quality / Freshness */}
        <div
          className={`kpi-card kpi-card-freshness health-${dataHealth.toLowerCase()}`}
        >
          <div className="kpi-header">
            <span className="kpi-label">Telemetry Quality</span>
            <span
              className={`kpi-tag tag-${
                dataHealth === "HEALTHY"
                  ? "normal"
                  : dataHealth === "DEGRADED"
                  ? "warning"
                  : "critical"
              }`}
            >
              {dataHealth}
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">
              {freshCount} / {totalAssets}
            </span>
            <span className="kpi-unit">FRESH</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-context">
              {dataHealth === "HEALTHY"
                ? "All asset telemetry synchronized"
                : dataHealth === "DEGRADED"
                ? `${totalAssets - freshCount} asset(s) stale or degraded`
                : "Awaiting valid telemetry stream"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
