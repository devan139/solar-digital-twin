import asyncio
from pathlib import Path

from backend.app.services.alert_service import AlertService
from backend.app.services.plant_state_service import (
    PlantStateService,
)
from backend.app.services.state_service import StateService
from backend.app.services.telemetry_service import TelemetryService
from backend.simulator.scenario import ScenarioConfig
from backend.simulator.simulator import TelemetrySimulator


class SimulationManager:
    def __init__(self, data_path: str | Path):
        telemetry_service = TelemetryService(data_path)

        scenario = ScenarioConfig(
            enabled=True,
            asset_id="ARRAY_04",
            warning_after_ticks=2,
            critical_after_ticks=4,
        )

        self.simulator = TelemetrySimulator(
            sensor_records=telemetry_service.records,
            plant_records=telemetry_service.plant_records,
            mode="demo",
            speed_multiplier=1.0,
            loop=True,
            scenario=scenario,
        )

        self.state_service = StateService()
        self.alert_service = AlertService()
        self.plant_state_service = PlantStateService()

        self.clients: set = set()
        self.running = False

    async def connect(self, websocket):
        await websocket.accept()
        self.clients.add(websocket)

    def disconnect(self, websocket):
        self.clients.discard(websocket)

    async def broadcast(self, state: dict):
        disconnected = set()

        for websocket in self.clients:
            try:
                await websocket.send_json(state)
            except Exception:
                disconnected.add(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)

    def serialize_state(
        self,
        state: dict,
        evaluated_states: list,
        alerts: list,
    ) -> dict:

        return {
            "type": "telemetry",
            "timestamp": state["timestamp"].isoformat(),

            "plant": state["plant"].model_dump(
                mode="json"
            ),

            "assets": [
                asset.model_dump(mode="json")
                for asset in state["assets"]
            ],

            "states": [
                asset_state.model_dump(mode="json")
                for asset_state in evaluated_states
            ],

            "alerts": [
                alert.model_dump(mode="json")
                for alert in alerts
            ],
        }

    async def run(self):
        if self.running:
            return

        self.running = True

        while self.running:
            state = self.simulator.get_current_state()

            evaluated_states = (
                self.state_service.evaluate_assets(
                    state["assets"]
                )
            )

            plant_status = (
                self.plant_state_service.evaluate_plant_status(
                    evaluated_states
                )
            )

            state["plant"].plant_status = plant_status

            alerts = self.alert_service.evaluate(
                evaluated_states,
                state["timestamp"],
            )

            serialized_state = self.serialize_state(
                state,
                evaluated_states,
                alerts,
            )

            await self.broadcast(serialized_state)

            self.simulator.advance()

            await asyncio.sleep(
                self.simulator.get_interval_seconds()
            )

    def stop(self):
        self.running = False
