from copy import deepcopy

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry
from backend.simulator.scenario import ScenarioConfig


class ScenarioInjector:
    def __init__(self, config: ScenarioConfig):
        self.config = config

    def apply(
        self,
        plant: PlantTelemetry,
        assets: list[Telemetry],
        tick_index: int,
    ) -> tuple[PlantTelemetry, list[Telemetry]]:

        if not self.config.enabled:
            return plant, assets

        modified_assets = deepcopy(assets)
        modified_plant = deepcopy(plant)

        temperature = None

        if tick_index >= self.config.critical_after_ticks:
            temperature = self.config.critical_temperature_c

        elif tick_index >= self.config.warning_after_ticks:
            temperature = self.config.warning_temperature_c

        if temperature is None:
            return modified_plant, modified_assets

        for asset in modified_assets:
            if asset.asset_id == self.config.asset_id:
                asset.panel_temperature_c = temperature

        modified_plant.maximum_panel_temperature_c = temperature

        return modified_plant, modified_assets
