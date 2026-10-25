export type PlantStatus =
  | "NORMAL"
  | "WARNING"
  | "CRITICAL"
  | "UNKNOWN";

export type AssetStatus =
  | "NORMAL"
  | "WARNING"
  | "CRITICAL"
  | "UNKNOWN";

export type EquipmentCondition =
  | "NORMAL"
  | "WARNING"
  | "CRITICAL"
  | "UNKNOWN";

export type DataCondition =
  | "FRESH"
  | "STALE"
  | "UNAVAILABLE";

export type PlantDataHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE";

export type SimulatorState =
  | "RUNNING"
  | "STOPPED"
  | "ERROR"
  | "UNKNOWN";

export type ConnectionState =
  | "CONNECTED"
  | "RECONNECTING"
  | "DISCONNECTED";

export interface AssetHealth {
  asset_id: string;
  data_condition: DataCondition;
  equipment_condition: EquipmentCondition;
  last_valid_measurement_time: string | null;
  last_receipt_time: string | null;
  age_seconds: number | null;
  has_valid_reading: boolean;
  last_error?: string | null;
}

export interface SystemHealth {
  server_time: string;
  simulator_status: SimulatorState;
  plant_data_health: PlantDataHealth;
  plant_equipment_condition: EquipmentCondition;
  assets: Record<string, AssetHealth>;
}

export interface PlantTelemetry {
  timestamp: string;
  current_power_kw: number;
  average_panel_temperature_c: number;
  maximum_panel_temperature_c: number;
  average_efficiency_pct: number;
  plant_status: PlantStatus;
  data_health?: PlantDataHealth;
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
  ingested_at?: string | null;
}

export interface AssetState {
  asset_id: string;
  status: AssetStatus;
  power_kw: number;
  panel_temperature_c: number;
  efficiency_pct: number;
  data_condition?: DataCondition;
  equipment_condition?: EquipmentCondition;
  age_seconds?: number | null;
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
  health?: SystemHealth;
}
