export type PlantStatus =
  | "NORMAL"
  | "WARNING"
  | "CRITICAL";

export type AssetStatus =
  | "NORMAL"
  | "WARNING"
  | "CRITICAL";

export interface PlantTelemetry {
  timestamp: string;
  current_power_kw: number;
  average_panel_temperature_c: number;
  maximum_panel_temperature_c: number;
  average_efficiency_pct: number;
  plant_status: PlantStatus;
}

export interface AssetTelemetry {
  timestamp: string;
  asset_id: string;
  asset_type: string;
  capacity_kw: number;
  power_kw: number;
  panel_temperature_c: number;
  ambient_temperature_c: number;
  voltage_v: number;
  current_a: number;
  efficiency_pct: number;
  status: string;
}

export interface AssetState {
  asset_id: string;
  status: AssetStatus;
  power_kw: number;
  panel_temperature_c: number;
  efficiency_pct: number;
}

export interface Alert {
  id: string;
  asset_id: string;
  timestamp: string;
  severity: "WARNING" | "CRITICAL";
  type: string;
  message: string;
  recommendation: string;
}

export interface TelemetryMessage {
  type: "telemetry";
  timestamp: string;
  plant: PlantTelemetry;
  assets: AssetTelemetry[];
  states: AssetState[];
  alerts: Alert[];
}
