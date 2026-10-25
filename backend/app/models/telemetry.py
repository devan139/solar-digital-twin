import math
from datetime import datetime, timezone
from typing import Self
from pydantic import BaseModel, Field, field_validator, model_validator


KNOWN_ASSETS: frozenset[str] = frozenset({
    "ARRAY_01",
    "ARRAY_02",
    "ARRAY_03",
    "ARRAY_04",
    "ARRAY_05",
    "ARRAY_06",
})


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
    ingested_at: datetime | None = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @field_validator(
        "capacity_kw",
        "power_kw",
        "panel_temperature_c",
        "ambient_temperature_c",
        "voltage_v",
        "current_a",
        "efficiency_pct",
        mode="before",
    )
    @classmethod
    def validate_finite_number(cls, v: float, info) -> float:
        if v is None:
            raise ValueError(f"Field '{info.field_name}' cannot be None")
        try:
            num = float(v)
        except (TypeError, ValueError) as err:
            raise ValueError(f"Field '{info.field_name}' must be numeric: {err}") from err
        if math.isnan(num):
            raise ValueError(f"Field '{info.field_name}' cannot be NaN")
        if math.isinf(num):
            raise ValueError(f"Field '{info.field_name}' cannot be infinite")
        return num

    @model_validator(mode="after")
    def validate_physical_ranges(self) -> Self:
        # Non-negative checks (valid zero readings allowed)
        if self.power_kw < 0.0:
            raise ValueError(f"power_kw cannot be negative ({self.power_kw})")
        if self.voltage_v < 0.0:
            raise ValueError(f"voltage_v cannot be negative ({self.voltage_v})")
        if self.current_a < 0.0:
            raise ValueError(f"current_a cannot be negative ({self.current_a})")
        if self.capacity_kw <= 0.0:
            raise ValueError(f"capacity_kw must be positive ({self.capacity_kw})")

        # Efficiency range 0.0 - 100.0%
        if not (0.0 <= self.efficiency_pct <= 100.0):
            raise ValueError(
                f"efficiency_pct must be between 0.0 and 100.0 ({self.efficiency_pct})"
            )

        # Documented thermal sanity limits
        if not (-40.0 <= self.panel_temperature_c <= 120.0):
            raise ValueError(
                f"panel_temperature_c out of physical sanity limits [-40.0, 120.0] ({self.panel_temperature_c})"
            )
        if not (-50.0 <= self.ambient_temperature_c <= 65.0):
            raise ValueError(
                f"ambient_temperature_c out of physical sanity limits [-50.0, 65.0] ({self.ambient_temperature_c})"
            )

        return self
