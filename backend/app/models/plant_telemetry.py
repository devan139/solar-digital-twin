import math
from datetime import datetime
from typing import Self
from pydantic import BaseModel, field_validator, model_validator


class PlantTelemetry(BaseModel):
    timestamp: datetime
    current_power_kw: float
    average_panel_temperature_c: float
    maximum_panel_temperature_c: float
    average_efficiency_pct: float
    plant_status: str
    data_health: str = "HEALTHY"

    @field_validator(
        "current_power_kw",
        "average_panel_temperature_c",
        "maximum_panel_temperature_c",
        "average_efficiency_pct",
        mode="before",
    )
    @classmethod
    def validate_finite_number(cls, v: float, info) -> float:
        if v is None:
            raise ValueError(f"Plant field '{info.field_name}' cannot be None")
        try:
            num = float(v)
        except (TypeError, ValueError) as err:
            raise ValueError(f"Plant field '{info.field_name}' must be numeric: {err}") from err
        if math.isnan(num):
            raise ValueError(f"Plant field '{info.field_name}' cannot be NaN")
        if math.isinf(num):
            raise ValueError(f"Plant field '{info.field_name}' cannot be infinite")
        return num

    @model_validator(mode="after")
    def validate_plant_ranges(self) -> Self:
        if self.current_power_kw < 0.0:
            raise ValueError(f"current_power_kw cannot be negative ({self.current_power_kw})")
        if not (0.0 <= self.average_efficiency_pct <= 100.0):
            raise ValueError(f"average_efficiency_pct must be between 0.0 and 100.0 ({self.average_efficiency_pct})")
        if not (-40.0 <= self.average_panel_temperature_c <= 120.0):
            raise ValueError(f"average_panel_temperature_c out of range ({self.average_panel_temperature_c})")
        if not (-40.0 <= self.maximum_panel_temperature_c <= 120.0):
            raise ValueError(f"maximum_panel_temperature_c out of range ({self.maximum_panel_temperature_c})")
        return self
