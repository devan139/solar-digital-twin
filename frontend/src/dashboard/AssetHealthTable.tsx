import { ASSET_METADATA } from "../telemetry/assets";
import type {
  AssetState,
  AssetTelemetry,
  SystemHealth,
} from "../telemetry/types";

const ALL_ASSET_IDS = [
  "ARRAY_01",
  "ARRAY_02",
  "ARRAY_03",
  "ARRAY_04",
  "ARRAY_05",
  "ARRAY_06",
] as const;

interface AssetHealthTableProps {
  assets: AssetTelemetry[];
  assetStates: AssetState[];
  systemHealth?: SystemHealth;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
  connected: boolean;
}

export function AssetHealthTable({
  assets,
  assetStates,
  systemHealth,
  selectedAssetId,
  onSelectAsset,
  connected,
}: AssetHealthTableProps) {
  return (
    <section
      className="asset-table-section"
      aria-label="Asset Fleet Telemetry and Freshness Status"
    >
      <div className="section-heading asset-table-header">
        <div>
          <span className="section-eyebrow">
            FLEET TELEMETRY &bull; 6 ASSET STRINGS
          </span>
          <h2 className="section-title">Asset Freshness &amp; Operational Health</h2>
        </div>
        <div className="asset-table-hint">
          <span>Click any row to inspect &amp; focus 3D twin</span>
        </div>
      </div>

      <div className="table-responsive-wrapper">
        <table className="asset-health-table">
          <thead>
            <tr>
              <th scope="col">Asset String</th>
              <th scope="col">Location</th>
              <th scope="col">Equipment Condition</th>
              <th scope="col">Data Condition</th>
              <th scope="col" className="text-right">Power Output</th>
              <th scope="col" className="text-right">Panel Temp</th>
              <th scope="col" className="text-right">Data Age</th>
              <th scope="col">Diagnostic / Validation Note</th>
            </tr>
          </thead>
          <tbody>
            {ALL_ASSET_IDS.map((assetId) => {
              const metadata = ASSET_METADATA[assetId];
              const assetTelemetry = assets.find((a) => a.asset_id === assetId);
              const assetState = assetStates.find((s) => s.asset_id === assetId);
              const healthItem = systemHealth?.assets?.[assetId];

              // Decoupled Conditions
              const isSelected = selectedAssetId === assetId;

              const dataCondition =
                healthItem?.data_condition ??
                assetState?.data_condition ??
                (connected ? "UNAVAILABLE" : assetTelemetry ? "STALE" : "UNAVAILABLE");


              const equipmentCondition =
                healthItem?.equipment_condition ??
                assetState?.equipment_condition ??
                assetState?.status ??
                "UNKNOWN";

              const ageSeconds =
                healthItem?.age_seconds ?? assetState?.age_seconds;

              const isStale = dataCondition === "STALE";
              const isUnavailable = dataCondition === "UNAVAILABLE";

              // Unavailable readings are never represented as numbers or zero
              const hasReading = !isUnavailable && assetTelemetry !== undefined;


              // Thermal class based on backend rules
              const tempVal = assetTelemetry?.panel_temperature_c;
              const isTempCritical = tempVal !== undefined && tempVal >= 75.0;
              const isTempWarning =
                tempVal !== undefined && tempVal >= 70.0 && tempVal < 75.0;

              // Diagnostic Note determination
              let diagnosticNote = "Nominal PV conversion";
              if (healthItem?.last_error) {
                diagnosticNote = `Validation: ${healthItem.last_error}`;
              } else if (equipmentCondition === "CRITICAL") {
                diagnosticNote = "Thermal threshold exceeded (≥75.0°C)";
              } else if (equipmentCondition === "WARNING") {
                diagnosticNote = "Elevated panel temperature (≥70.0°C)";
              } else if (isStale) {
                diagnosticNote = `Heartbeat expired (${
                  ageSeconds ? ageSeconds.toFixed(1) : "?"
                }s) — displaying cached reading`;
              } else if (isUnavailable) {
                diagnosticNote = "No telemetry received for this asset";
              }

              return (
                <tr
                  key={assetId}
                  className={`asset-table-row ${
                    isSelected ? "table-row-selected" : ""
                  }`}
                  onClick={() =>
                    onSelectAsset(isSelected ? null : assetId)
                  }
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectAsset(isSelected ? null : assetId);
                    }
                  }}
                  aria-pressed={isSelected}
                >
                  {/* Asset ID & Display Name */}
                  <td className="cell-asset-id">
                    <div className="asset-id-group">
                      <span className="asset-chip-tag">{assetId}</span>
                      <span className="asset-display-name">
                        {metadata?.displayName ?? assetId}
                      </span>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="cell-location">
                    <span className="location-text">
                      {metadata?.location ?? "Facility"}
                    </span>
                  </td>

                  {/* Equipment Condition Badge */}
                  <td className="cell-equipment-status">
                    <span
                      className={`status-pill pill-${equipmentCondition.toLowerCase()}`}
                    >
                      <span className="pill-dot" />
                      {equipmentCondition}
                    </span>
                  </td>

                  {/* Data Condition Badge */}
                  <td className="cell-data-condition">
                    <span
                      className={`data-pill pill-data-${dataCondition.toLowerCase()}`}
                    >
                      {dataCondition}
                      {isStale && ageSeconds !== null && ageSeconds !== undefined
                        ? ` (${ageSeconds.toFixed(0)}s)`
                        : ""}
                    </span>
                  </td>

                  {/* Power Output */}
                  <td className="cell-power text-right">
                    {hasReading && assetTelemetry ? (
                      <span className="metric-cell-wrap">
                        <strong className="metric-number">
                          {assetTelemetry.power_kw.toFixed(1)}
                        </strong>
                        <span className="metric-unit">kW</span>
                        {isStale && (
                          <span className="last-known-badge" title="Cached reading">
                            LAST KNOWN
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="unavailable-dash">&mdash;</span>
                    )}
                  </td>

                  {/* Temperature */}
                  <td className="cell-temp text-right">
                    {hasReading && assetTelemetry ? (
                      <span
                        className={`metric-cell-wrap ${
                          isTempCritical
                            ? "temp-critical"
                            : isTempWarning
                            ? "temp-warning"
                            : "temp-normal"
                        }`}
                      >
                        <strong className="metric-number">
                          {assetTelemetry.panel_temperature_c.toFixed(1)}
                        </strong>
                        <span className="metric-unit">&deg;C</span>
                        {isStale && (
                          <span className="last-known-badge" title="Cached reading">
                            LAST KNOWN
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="unavailable-dash">&mdash;</span>
                    )}
                  </td>

                  {/* Data Age */}
                  <td className="cell-age text-right">
                    {ageSeconds !== null && ageSeconds !== undefined ? (
                      <span
                        className={`age-text ${
                          isStale ? "age-stale" : "age-fresh"
                        }`}
                      >
                        {ageSeconds < 1.0
                          ? "< 1.0s"
                          : `${ageSeconds.toFixed(1)}s`}
                      </span>
                    ) : (
                      <span className="unavailable-dash">&mdash;</span>
                    )}
                  </td>

                  {/* Diagnostic / Validation Note */}
                  <td className="cell-notes">
                    <span
                      className={`notes-text ${
                        healthItem?.last_error
                          ? "notes-error"
                          : isStale
                          ? "notes-stale"
                          : isUnavailable
                          ? "notes-muted"
                          : ""
                      }`}
                    >
                      {diagnosticNote}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
