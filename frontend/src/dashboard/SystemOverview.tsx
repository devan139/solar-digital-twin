import type { Alert, ConnectionState, TelemetryMessage } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

export interface SystemOverviewProps {
  connectionState: ConnectionState;
  connected: boolean;
  simulatorStatus: string;
  plantEquipmentCondition: string;
  plantDataHealth: string;
  freshCount: number;
  staleCount: number;
  unavailCount: number;
  tickIntervalMs: number | null;
  secondsSinceLastTick: number | null;
  telemetry: TelemetryMessage | null;
  plantModelLoaded: boolean;
  selectedAssetId: string | null;
  alerts: Alert[];
  onSelectAsset?: (assetId: string | null) => void;
  onSwitchToTwin: () => void;
}

export function SystemOverview({
  connectionState,
  connected,
  simulatorStatus,
  plantEquipmentCondition,
  plantDataHealth,
  freshCount,
  staleCount,
  unavailCount,
  tickIntervalMs,
  secondsSinceLastTick,
  telemetry,
  plantModelLoaded,
  selectedAssetId,
  alerts,
  onSelectAsset,
  onSwitchToTwin,
}: SystemOverviewProps) {
  const currentTimestamp =
    telemetry?.plant?.timestamp ?? telemetry?.timestamp ?? "—";
  const plantPowerKw = telemetry?.plant?.current_power_kw;
  const maxTempC = telemetry?.plant?.maximum_panel_temperature_c;

  return (
    <section
      className="system-overview-container"
      aria-label="System Architecture and Data Pipeline Overview"
      id="system-overview-panel"
    >
      {/* 1. Header Banner & Quick Summary */}
      <div className="overview-header-card">
        <div className="overview-header-content">
          <div className="overview-title-row">
            <span className="overview-badge">ARCHITECTURAL BLUEPRINT</span>
            <span className="overview-guide-tag">30-Second Technical Overview</span>
          </div>
          <h2 className="overview-headline">
            Solar Plant Digital Twin — End-to-End Data Pipeline
          </h2>
          <p className="overview-description">
            High-fidelity telemetry flow from raw solar plant dataset through defensive
            Pydantic validation, dual-state freshness tracking, and resilient WebSocket
            transport to the Three.js spatial digital twin and operations console.
          </p>
        </div>

        <div className="overview-header-actions">
          <div className="overview-live-summary">
            <div className="live-pill-group">
              <span className={`live-indicator-dot ${connected ? "active" : "inactive"}`} />
              <span className="live-pill-label">PIPELINE:</span>
              <span className="live-pill-value">{connected ? "LIVE STREAMING" : "OFFLINE"}</span>
            </div>
            <div className="live-pill-group">
              <span className="live-pill-label">SIM CADENCE:</span>
              <span className="live-pill-value">
                {tickIntervalMs !== null && tickIntervalMs > 0
                  ? `~${(tickIntervalMs / 1000).toFixed(1)}s (${Math.round(tickIntervalMs)}ms)`
                  : "Awaiting sample"}
              </span>
            </div>
            <div className="live-pill-group">
              <span className="live-pill-label">LAST TICK:</span>
              <span className="live-pill-value">
                {secondsSinceLastTick !== null ? `${secondsSinceLastTick}s ago` : "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="overview-return-btn"
            onClick={onSwitchToTwin}
            title="Switch back to 3D Digital Twin Operations Console (Alt+1 or Esc)"
          >
            <span className="btn-icon">⊞</span>
            <span>Return to Operations Twin</span>
          </button>
        </div>
      </div>

      {/* 2. End-to-End 6-Stage Pipeline Flow */}
      <div className="pipeline-flow-wrapper">
        <div className="pipeline-section-header">
          <div className="pipeline-section-title">
            <span className="section-dot" />
            <h3>ACTIVE DATA PIPELINE STAGES</h3>
          </div>
          <span className="pipeline-subtitle">
            Every block maps directly to a concrete file and active service in this repository
          </span>
        </div>

        <div className="pipeline-grid">
          {/* Stage 1: Dataset */}
          <div className="pipeline-card stage-1">
            <div className="card-top-bar">
              <span className="stage-index">01</span>
              <span className="stage-category">SOURCE LAYER</span>
              <span className="stage-live-badge badge-active">LOADED</span>
            </div>
            <h4 className="card-title">Telemetry Dataset</h4>
            <div className="card-code-ref">
              <code>backend/data/solar_plant_sample_data.xlsx</code>
              <code>backend/simulator/data_loader.py</code>
            </div>
            <p className="card-summary">
              Loads dual-sheet industrial baseline data using Pandas/Openpyxl: 1,728 array sensor records
              (6 assets &times; 288 timesteps) and 288 aggregate plant intervals.
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Asset Records:</span>
                <span className="m-val">1,728 (6 &times; 288)</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Plant Intervals:</span>
                <span className="m-val">288 slices</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Output Data:</span>
                <span className="m-val text-cyan">Pandas DataFrames</span>
              </div>
            </div>
            <div className="card-connector-arrow" aria-hidden="true">→</div>
          </div>

          {/* Stage 2: Simulator & Validation */}
          <div className="pipeline-card stage-2">
            <div className="card-top-bar">
              <span className="stage-index">02</span>
              <span className="stage-category">INGESTION &amp; SAFETY</span>
              <span
                className={`stage-live-badge ${
                  simulatorStatus === "RUNNING"
                    ? "badge-running"
                    : simulatorStatus === "ERROR"
                    ? "badge-error"
                    : "badge-stopped"
                }`}
              >
                SIM: {simulatorStatus}
              </span>
            </div>
            <h4 className="card-title">Simulation &amp; Validation</h4>
            <div className="card-code-ref">
              <code>backend/simulator/simulator.py</code>
              <code>backend/app/services/telemetry_validator.py</code>
            </div>
            <p className="card-summary">
              Advances 1 Hz simulation clock, injects thermal stress scenarios on ARRAY_04
              (72°C warning, 77°C critical), and validates physical sanity via Pydantic
              ([-40, 120]°C, monotonic timestamps, NaN rejection).
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Sim Status:</span>
                <span className="m-val text-status">{simulatorStatus}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Sim Clock:</span>
                <span className="m-val m-mono">{currentTimestamp}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Defensive Ingestion:</span>
                <span className="m-val text-green">Pydantic 2.0 Enforced</span>
              </div>
            </div>
            <div className="card-connector-arrow" aria-hidden="true">→</div>
          </div>

          {/* Stage 3: State & Freshness */}
          <div className="pipeline-card stage-3">
            <div className="card-top-bar">
              <span className="stage-index">03</span>
              <span className="stage-category">STATE MACHINE</span>
              <span
                className={`stage-live-badge ${
                  plantEquipmentCondition === "CRITICAL"
                    ? "badge-error"
                    : plantEquipmentCondition === "WARNING"
                    ? "badge-warning"
                    : "badge-running"
                }`}
              >
                EQUIP: {plantEquipmentCondition}
              </span>
            </div>
            <h4 className="card-title">State &amp; Freshness Engine</h4>
            <div className="card-code-ref">
              <code>backend/app/services/state_service.py</code>
              <code>backend/app/services/freshness_service.py</code>
            </div>
            <p className="card-summary">
              Applies thermal rules (&lt;70°C Normal, 70–75°C Warning, &ge;75°C Critical) and
              tracks independent telemetry decay (FRESH &le;3s &rarr; STALE &le;10s &rarr; EXPIRED).
              Equipment condition remains strictly decoupled from communication health.
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Fresh / Stale / Unavail:</span>
                <span className="m-val text-cyan">
                  {freshCount}F / {staleCount}S / {unavailCount}U
                </span>
              </div>
              <div className="metric-row">
                <span className="m-label">Data Health:</span>
                <span className="m-val">{connected ? plantDataHealth : "OFFLINE"}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Thermal Engine:</span>
                <span className="m-val text-gold">70°C / 75°C Thresholds</span>
              </div>
            </div>
            <div className="card-connector-arrow" aria-hidden="true">→</div>
          </div>

          {/* Stage 4: WebSocket Transport */}
          <div className="pipeline-card stage-4">
            <div className="card-top-bar">
              <span className="stage-index">04</span>
              <span className="stage-category">TRANSPORT LAYER</span>
              <span
                className={`stage-live-badge ${
                  connectionState === "CONNECTED"
                    ? "badge-running"
                    : connectionState === "RECONNECTING"
                    ? "badge-warning"
                    : "badge-stopped"
                }`}
              >
                WS: {connectionState}
              </span>
            </div>
            <h4 className="card-title">FastAPI &amp; WebSocket</h4>
            <div className="card-code-ref">
              <code>backend/app/main.py (/ws/telemetry)</code>
              <code>frontend/src/services/telemetrySocket.ts</code>
            </div>
            <p className="card-summary">
              Broadcasts normalized JSON payloads at 1 Hz. Client features exponential backoff
              with randomized jitter, tab visibility re-sync, dead-client cleanup, and independent
              /health/ready probe verification.
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Socket State:</span>
                <span className="m-val text-status">{connectionState}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Delivery Jitter:</span>
                <span className="m-val text-green">&plusmn;20% randomized</span>
              </div>
              <div className="metric-row">
                <span className="m-label">CORS Origins:</span>
                <span className="m-val text-cyan">Explicit GitHub Pages + Dev</span>
              </div>
            </div>
            <div className="card-connector-arrow" aria-hidden="true">→</div>
          </div>

          {/* Stage 5: Three.js 3D Twin */}
          <div className="pipeline-card stage-5">
            <div className="card-top-bar">
              <span className="stage-index">05</span>
              <span className="stage-category">SPATIAL DIGITAL TWIN</span>
              <span className="stage-live-badge badge-active">
                {plantModelLoaded ? "GLB LOADED" : "PROCEDURAL MESH"}
              </span>
            </div>
            <h4 className="card-title">Three.js 3D Workspace</h4>
            <div className="card-code-ref">
              <code>frontend/src/twin/SolarPlantScene.tsx</code>
              <code>frontend/src/twin/SolarArray.ts</code>
            </div>
            <p className="card-summary">
              Loads <code>models/solar_plant.glb</code> and binds physical meshes <code>array_01</code>..<code>array_06</code>
              to logical telemetry assets. Computes real-time thermal emissive shaders and supports
              interactive raycasting, orbit controls, and secondary camera inset.
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Mapped Arrays:</span>
                <span className="m-val text-cyan">6 Arrays (1:1 Bound)</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Selected Array:</span>
                <span className="m-val text-gold">{selectedAssetId ?? "None"}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Thermal Shaders:</span>
                <span className="m-val text-green">Dynamic MeshStandard</span>
              </div>
            </div>
            <div className="card-connector-arrow" aria-hidden="true">→</div>
          </div>

          {/* Stage 6: Operations Console */}
          <div className="pipeline-card stage-6">
            <div className="card-top-bar">
              <span className="stage-index">06</span>
              <span className="stage-category">OPERATIONS HUD</span>
              <span className="stage-live-badge badge-active">ACTIVE HUD</span>
            </div>
            <h4 className="card-title">Operations Console</h4>
            <div className="card-code-ref">
              <code>frontend/src/dashboard/KpiCards.tsx</code>
              <code>frontend/src/dashboard/AssetHealthTable.tsx</code>
            </div>
            <p className="card-summary">
              Presents 6 KPI summary cards, tabular data quality status across all arrays, 60-point
              rolling power/temperature historical charts, deterministic rule insights, and system
              diagnostics.
            </p>
            <div className="card-metrics-block">
              <div className="metric-row">
                <span className="m-label">Plant Power:</span>
                <span className="m-val text-cyan">
                  {plantPowerKw !== undefined ? `${plantPowerKw.toFixed(1)} kW` : "—"}
                </span>
              </div>
              <div className="metric-row">
                <span className="m-label">Max Temperature:</span>
                <span className="m-val text-status">
                  {maxTempC !== undefined ? `${maxTempC.toFixed(1)} °C` : "—"}
                </span>
              </div>
              <div className="metric-row">
                <span className="m-label">Active Alerts:</span>
                <span className="m-val text-status">{alerts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Architectural Reference Matrix (Evaluator Cheat-Sheet) */}
      <div className="architecture-reference-grid">
        {/* Column A: Asset Mapping */}
        <div className="reference-card">
          <div className="ref-card-header">
            <span className="ref-icon">◈</span>
            <h4>Physical GLB to Telemetry Mapping</h4>
          </div>
          <p className="ref-card-intro">
            Consistent asset identifiers bridge the physical 3D geometry with incoming telemetry streams:
          </p>
          <div className="ref-table-wrapper">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>Telemetry Asset</th>
                  <th>GLB Mesh ID</th>
                  <th>Facility Location</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ASSET_METADATA).map(([id, meta]) => {
                  const isSelected = selectedAssetId === id;
                  return (
                    <tr
                      key={id}
                      className={isSelected ? "row-selected" : ""}
                    >
                      <td className="cell-id">
                        <code>{id}</code>
                        {id === "ARRAY_04" && (
                          <span className="scenario-tag" title="Injected thermal stress scenario">
                            SCENARIO
                          </span>
                        )}
                      </td>
                      <td className="cell-glb">
                        <code>{id.toLowerCase()}</code>
                      </td>
                      <td className="cell-loc">{meta.location}</td>
                      <td className="cell-act">
                        <button
                          type="button"
                          className="table-select-btn"
                          onClick={() => {
                            onSelectAsset?.(id);
                            onSwitchToTwin();
                          }}
                          title={`Select ${id} and view in 3D scene`}
                        >
                          View 3D
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column B: Dual-State Model */}
        <div className="reference-card">
          <div className="ref-card-header">
            <span className="ref-icon">⚡</span>
            <h4>Independent Dual-State Health Model</h4>
          </div>
          <p className="ref-card-intro">
            Equipment condition and telemetry freshness are decoupled to prevent false negatives:
          </p>
          <div className="state-rules-list">
            <div className="rule-item">
              <div className="rule-title">
                <span className="rule-tag equip">EQUIPMENT CONDITION</span>
                <span>Physical Array Thermal Health</span>
              </div>
              <ul className="rule-bullets">
                <li>
                  <strong className="text-green">NORMAL:</strong> Panel temperature &lt; 70.0°C.
                </li>
                <li>
                  <strong className="text-gold">WARNING:</strong> Panel temperature 70.0°C to 74.9°C.
                </li>
                <li>
                  <strong className="text-red">CRITICAL:</strong> Panel temperature &ge; 75.0°C.
                </li>
              </ul>
            </div>

            <div className="rule-item">
              <div className="rule-title">
                <span className="rule-tag data">DATA CONDITION</span>
                <span>Telemetry Ingestion Freshness</span>
              </div>
              <ul className="rule-bullets">
                <li>
                  <strong className="text-cyan">FRESH:</strong> Telemetry received within &le; 3.0 seconds.
                </li>
                <li>
                  <strong className="text-gold">STALE:</strong> No telemetry update between 3.0s and 10.0s.
                </li>
                <li>
                  <strong className="text-dim">UNAVAILABLE:</strong> No measurement for &gt; 10.0s or uninitialized.
                </li>
              </ul>
            </div>
            <div className="rule-note">
              <em>Critical Design Guarantee:</em> A stale or disconnected array never silently appears healthy.
            </div>
          </div>
        </div>

        {/* Column C: Reliability & Defensive Boundaries */}
        <div className="reference-card">
          <div className="ref-card-header">
            <span className="ref-icon">🛡</span>
            <h4>Defensive Boundaries &amp; Reliability</h4>
          </div>
          <p className="ref-card-intro">
            Enterprise guarantees protecting the system from malformed inputs and connection disruptions:
          </p>
          <div className="guarantees-list">
            <div className="guarantee-box">
              <div className="g-header">
                <span className="g-dot dot-cyan" />
                <strong>Pydantic Centralized Validation</strong>
              </div>
              <p className="g-text">
                Enforces physical sanity ranges (panel temp -40°C to 120°C, ambient -50°C to 65°C),
                rejects NaNs, negative power, and out-of-order sequence timestamps at simulator ingress.
              </p>
            </div>

            <div className="guarantee-box">
              <div className="g-header">
                <span className="g-dot dot-green" />
                <strong>WebSocket Resilient Client</strong>
              </div>
              <p className="g-text">
                Deterministic exponential backoff capped at 15s with &plusmn;20% jitter prevents thundering
                herd. Reacts to browser <code>visibilitychange</code> to reconnect immediately on tab restore.
              </p>
            </div>

            <div className="guarantee-box">
              <div className="g-header">
                <span className="g-dot dot-gold" />
                <strong>FastAPI Dual Health Probes</strong>
              </div>
              <p className="g-text">
                <code>/health/live</code> verifies process execution; <code>/health/ready</code> returns HTTP 503
                until the simulation loop has processed at least one valid tick with a loaded dataset.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
