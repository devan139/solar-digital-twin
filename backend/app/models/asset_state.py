from pydantic import BaseModel


class AssetState(BaseModel):
    asset_id: str
    status: str
    power_kw: float
    panel_temperature_c: float
    efficiency_pct: float
    data_condition: str = "FRESH"  # FRESH, STALE, UNAVAILABLE
    equipment_condition: str = "NORMAL"  # NORMAL, WARNING, CRITICAL, UNKNOWN
    age_seconds: float | None = None
