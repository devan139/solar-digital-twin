import asyncio
from pathlib import Path

from backend.app.services.telemetry_service import TelemetryService
from backend.simulator.scenario import ScenarioConfig
from backend.simulator.simulator import TelemetrySimulator


class SimulationService:
    def __init__(self, data_path: str | Path):
        telemetry_service = TelemetryService(data_path)

        scenario = ScenarioConfig(
            enabled=False,
        )

        self.simulator = TelemetrySimulator(
            sensor_records=telemetry_service.records,
            plant_records=telemetry_service.plant_records,
            mode="demo",
            speed_multiplier=1.0,
            loop=True,
            scenario=scenario,
        )

    async def stream(self):
        while True:
            state = self.simulator.get_current_state()

            yield state

            self.simulator.advance()

            await asyncio.sleep(
                self.simulator.get_interval_seconds()
            )
