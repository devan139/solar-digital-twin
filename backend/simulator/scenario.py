from dataclasses import dataclass


@dataclass
class ScenarioConfig:
    enabled: bool = False
    asset_id: str = "ARRAY_04"

    warning_temperature_c: float = 72.0
    critical_temperature_c: float = 77.0

    warning_after_ticks: int = 30
    critical_after_ticks: int = 60
