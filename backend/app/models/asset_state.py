from pydantic import BaseModel


class AssetState(BaseModel):
    asset_id: str
    status: str
    power_kw: float
    panel_temperature_c: float
    efficiency_pct: float
