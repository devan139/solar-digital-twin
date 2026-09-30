from typing import Iterator

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry
from backend.simulator.scenario import ScenarioConfig
from backend.simulator.scenario_injector import ScenarioInjector


class TelemetrySimulator:
    def __init__(
        self,
        sensor_records: list[Telemetry],
        plant_records: list[PlantTelemetry],
        mode: str = "demo",
        speed_multiplier: float = 1.0,
        loop: bool = True,
        scenario: ScenarioConfig | None = None,
    ):
        self.sensor_records = sensor_records
        self.plant_records = plant_records

        self.mode = mode
        self.speed_multiplier = speed_multiplier
        self.loop = loop

        self.index = 0

        self.scenario_injector = ScenarioInjector(
            scenario or ScenarioConfig()
        )

    def reset(self):
        self.index = 0

    def has_next(self) -> bool:
        return self.index < len(self.plant_records)

    def get_current_plant(self) -> PlantTelemetry:
        return self.plant_records[self.index]

    def get_current_sensor_records(self) -> list[Telemetry]:
        timestamp = self.plant_records[self.index].timestamp

        return [
            record
            for record in self.sensor_records
            if record.timestamp == timestamp
        ]

    def get_interval_seconds(self) -> float:
        if self.mode == "demo":
            base_interval = 1.0

        elif self.mode == "realtime":
            base_interval = 300.0

        else:
            raise ValueError(
                f"Unsupported simulator mode: {self.mode}"
            )

        return base_interval / self.speed_multiplier

    def advance(self):
        self.index += 1

        if self.index >= len(self.plant_records):
            if self.loop:
                self.index = 0
            else:
                self.index = len(self.plant_records) - 1

    def get_current_state(self) -> dict:
        plant = self.get_current_plant()
        assets = self.get_current_sensor_records()

        plant, assets = self.scenario_injector.apply(
            plant=plant,
            assets=assets,
            tick_index=self.index,
        )

        return {
            "timestamp": plant.timestamp,
            "plant": plant,
            "assets": assets,
        }
