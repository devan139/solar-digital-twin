import type { PlantTelemetry } from "../telemetry/types";

interface KpiCardsProps {
  plant: PlantTelemetry | null;
}

export function KpiCards({
  plant,
}: KpiCardsProps) {
  if (!plant) {
    return null;
  }

  const powerMw =
    plant.current_power_kw / 1000;

  return (
    <div className="kpi-grid">

      <div className="kpi-card">
        <span>Current Power</span>
        <strong>
          {powerMw.toFixed(2)} MW
        </strong>
      </div>

      <div className="kpi-card">
        <span>Average Temperature</span>
        <strong>
          {plant.average_panel_temperature_c.toFixed(1)}
          °C
        </strong>
      </div>

      <div className="kpi-card">
        <span>Maximum Temperature</span>
        <strong>
          {plant.maximum_panel_temperature_c.toFixed(1)}
          °C
        </strong>
      </div>

      <div className="kpi-card">
        <span>Plant Status</span>
        <strong
          className={`status-${plant.plant_status.toLowerCase()}`}
        >
          {plant.plant_status}
        </strong>
      </div>

    </div>
  );
}
