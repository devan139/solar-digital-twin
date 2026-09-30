from datetime import datetime
from pydantic import BaseModel


class PlantTelemetry(BaseModel):
    timestamp: datetime
    current_power_kw: float
    average_panel_temperature_c: float
    maximum_panel_temperature_c: float
    average_efficiency_pct: float
    plant_status: str
