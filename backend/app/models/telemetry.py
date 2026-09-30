from datetime import datetime

from pydantic import BaseModel


class Telemetry(BaseModel):
    timestamp: datetime
    asset_id: str
    asset_type: str
    capacity_kw: float
    power_kw: float
    panel_temperature_c: float
    ambient_temperature_c: float
    voltage_v: float
    current_a: float
    efficiency_pct: float
    status: str
