import type {
  AssetState,
  AssetTelemetry,
} from "../telemetry/types";
import type { AssetMetadata } from "../telemetry/assets";

interface TwinWorkspaceProps {
  children: React.ReactNode;
  selectedAsset: AssetTelemetry | undefined;
  selectedAssetState: AssetState | undefined;
  selectedMetadata: AssetMetadata | undefined;
  onClearSelection?: () => void;
}

export function TwinWorkspace({
  children,
  selectedAsset,
  selectedAssetState,
  selectedMetadata,
  onClearSelection,
}: TwinWorkspaceProps) {
  const currentStatus =
    selectedAssetState?.status ??
    (selectedAsset ? selectedAsset.status : "NORMAL");

  const utilizationPct = selectedAsset
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (selectedAsset.power_kw /
              selectedAsset.capacity_kw) *
              100,
          ),
        ),
      )
    : 0;

  return (
    <section
      className="twin-workspace"
      aria-label="Interactive 3D Digital Twin and Telemetry"
    >
      <div className="twin-panel">
        <div className="section-heading twin-heading">
          <div>
            <span className="section-eyebrow">
              3D SPATIAL DIGITAL TWIN
            </span>
            <h2 className="section-title">
              Solar Plant Model
            </h2>
          </div>

          <div className="twin-legend">
            <span className="legend-item legend-normal">
              <span className="legend-dot" /> NORMAL
            </span>
            <span className="legend-item legend-warning">
              <span className="legend-dot" /> WARNING
            </span>
            <span className="legend-item legend-critical">
              <span className="legend-dot" /> CRITICAL
            </span>
            <span className="legend-item legend-selected">
              <span className="legend-dot" /> SELECTED
            </span>
          </div>
        </div>

        <div className="twin-viewport-container">
          {children}
          <div className="twin-viewport-overlay">
            <span>
              LMB Orbit &bull; RMB Pan &bull; Scroll Zoom &bull; Click Array to Inspect / Deselect
            </span>
          </div>
        </div>
      </div>

      <aside className="asset-panel">
        <div className="section-heading">
          <span className="section-eyebrow">
            ASSET TELEMETRY READOUT
          </span>
          <h2 className="section-title">Selected Asset</h2>
        </div>

        {!selectedAsset ? (
          <div className="asset-empty">
            <div className="asset-empty-reticle">
              <span className="reticle-icon">⌖</span>
            </div>
            <h3>NO ASSET SELECTED</h3>
            <p>
              Click any solar array (ARRAY_01 &ndash; ARRAY_06) in the 3D model to inspect string telemetry, voltage, and thermal status.
            </p>
          </div>
        ) : (
          <div className="asset-details-container">
            {/* Asset Identity Block */}
            <div className="selected-asset-header">
              <div className="asset-headline">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="asset-id-chip">
                    {selectedAsset.asset_id}
                  </span>
                  {onClearSelection && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      className="asset-deselect-btn"
                      title="Clear selection"
                      aria-label="Clear selection"
                    >
                      Deselect ✕
                    </button>
                  )}
                </div>
                <h2 className="selected-asset-title">
                  {selectedMetadata?.displayName ??
                    selectedAsset.asset_id}
                </h2>
                <p className="selected-asset-location">
                  {selectedMetadata?.location}
                </p>
              </div>
            </div>

            {/* Dominant Status & Temperature Operational Banner */}
            <div
              className={`asset-hero-banner status-${currentStatus.toLowerCase()}`}
            >
              <div className="hero-status-row">
                <span
                  className={`hero-status-badge status-${currentStatus.toLowerCase()}`}
                >
                  <span className="status-ping" />
                  {currentStatus}
                </span>
                <span className="hero-status-context">
                  {currentStatus === "CRITICAL"
                    ? "THERMAL LIMIT EXCEEDED"
                    : currentStatus === "WARNING"
                    ? "ELEVATED TEMPERATURE"
                    : "NOMINAL OPERATION"}
                </span>
              </div>

              <div className="hero-temp-row">
                <div className="hero-temp-label">
                  <span>PANEL TEMPERATURE</span>
                  <small>Real-Time Thermal</small>
                </div>
                <div className="hero-temp-value">
                  <strong>
                    {selectedAsset.panel_temperature_c.toFixed(1)}
                  </strong>
                  <span>&deg;C</span>
                </div>
              </div>
            </div>

            {/* Capacity Utilization Gauge */}
            <div className="utilization-box">
              <div className="utilization-header">
                <span>CAPACITY UTILIZATION</span>
                <strong>{utilizationPct}%</strong>
              </div>
              <div className="utilization-bar-track">
                <div
                  className="utilization-bar-fill"
                  style={{ width: `${utilizationPct}%` }}
                />
              </div>
            </div>

            {/* Secondary Operational Telemetry Grid */}
            <div className="asset-metrics">
              <div className="asset-metric">
                <span className="metric-label">Power</span>
                <strong className="metric-val">
                  {selectedAsset.power_kw.toFixed(1)}
                  <small>kW</small>
                </strong>
              </div>

              <div className="asset-metric">
                <span className="metric-label">Efficiency</span>
                <strong className="metric-val">
                  {selectedAsset.efficiency_pct.toFixed(1)}
                  <small>%</small>
                </strong>
              </div>

              <div className="asset-metric">
                <span className="metric-label">Capacity</span>
                <strong className="metric-val">
                  {selectedAsset.capacity_kw.toFixed(0)}
                  <small>kW</small>
                </strong>
              </div>

              <div className="asset-metric">
                <span className="metric-label">Voltage</span>
                <strong className="metric-val">
                  {selectedAsset.voltage_v.toFixed(1)}
                  <small>V</small>
                </strong>
              </div>

              <div className="asset-metric">
                <span className="metric-label">Current</span>
                <strong className="metric-val">
                  {selectedAsset.current_a.toFixed(1)}
                  <small>A</small>
                </strong>
              </div>

              <div className="asset-metric">
                <span className="metric-label">Panel Temp</span>
                <strong className="metric-val">
                  {selectedAsset.panel_temperature_c.toFixed(1)}
                  <small>&deg;C</small>
                </strong>
              </div>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
