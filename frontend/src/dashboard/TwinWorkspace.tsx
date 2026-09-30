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
}

export function TwinWorkspace({
  children,
  selectedAsset,
  selectedAssetState,
  selectedMetadata,
}: TwinWorkspaceProps) {
  return (
    <section className="twin-workspace">

      <div className="twin-panel">
        <div className="section-heading">
          <span>LIVE 3D MODEL</span>
          <h2>Digital Twin</h2>
        </div>

        {children}
      </div>

      <aside className="asset-panel">

        <div className="section-heading">
          <span>ASSET MONITORING</span>
          <h2>Selected Asset</h2>
        </div>

        {!selectedAsset ? (
          <div className="asset-empty">
            <p>Select a solar asset in the 3D model.</p>
          </div>
        ) : (
          <>
            <div className="selected-asset-header">
              <div>
                <h2>
                  {selectedMetadata?.displayName ??
                    selectedAsset.asset_id}
                </h2>

                <p>
                  {selectedMetadata?.location}
                </p>

                <small>
                  {selectedAsset.asset_id}
                </small>
              </div>

              {selectedAssetState && (
                <span
                  className={`asset-status ${selectedAssetState.status.toLowerCase()}`}
                >
                  {selectedAssetState.status}
                </span>
              )}
            </div>

            <div className="asset-metrics">

              <div className="asset-metric">
                <span>Power</span>
                <strong>
                  {selectedAsset.power_kw.toFixed(1)} kW
                </strong>
              </div>

              <div className="asset-metric">
                <span>Temperature</span>
                <strong>
                  {selectedAsset.panel_temperature_c.toFixed(1)}
                  °C
                </strong>
              </div>

              <div className="asset-metric">
                <span>Efficiency</span>
                <strong>
                  {selectedAsset.efficiency_pct.toFixed(1)}%
                </strong>
              </div>

              <div className="asset-metric">
                <span>Capacity</span>
                <strong>
                  {selectedAsset.capacity_kw.toFixed(0)} kW
                </strong>
              </div>

              <div className="asset-metric">
                <span>Voltage</span>
                <strong>
                  {selectedAsset.voltage_v.toFixed(1)} V
                </strong>
              </div>

              <div className="asset-metric">
                <span>Current</span>
                <strong>
                  {selectedAsset.current_a.toFixed(1)} A
                </strong>
              </div>

            </div>
          </>
        )}

      </aside>

    </section>
  );
}
