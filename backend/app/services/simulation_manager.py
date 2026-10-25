import asyncio
from datetime import datetime, timezone
import logging
from pathlib import Path

from backend.app.models.asset_state import AssetState
from backend.app.models.telemetry import Telemetry
from backend.app.services.alert_service import AlertService
from backend.app.services.freshness_service import FreshnessService
from backend.app.services.plant_state_service import PlantStateService
from backend.app.services.state_service import StateService
from backend.app.services.telemetry_service import TelemetryService
from backend.app.services.telemetry_validator import (
    KNOWN_ASSET_IDS,
    TelemetryValidator,
)
from backend.simulator.scenario import ScenarioConfig
from backend.simulator.simulator import TelemetrySimulator

logger = logging.getLogger("solar_twin.simulation_manager")


class SimulationManager:
    def __init__(self, data_path: str | Path):
        self.data_path = Path(data_path)
        self.dataset_loaded = False
        self.dataset_record_count = 0
        self.dataset_error: str | None = None

        try:
            telemetry_service = TelemetryService(self.data_path)
            self.dataset_loaded = True
            self.dataset_record_count = len(telemetry_service.records)
            sensor_records = telemetry_service.records
            plant_records = telemetry_service.plant_records
            logger.info(
                "Telemetry dataset loaded successfully (%d sensor records, %d plant records)",
                self.dataset_record_count,
                len(plant_records),
            )
        except Exception as exc:
            self.dataset_error = str(exc)
            sensor_records = []
            plant_records = []
            logger.exception("Failed to load telemetry dataset from %s: %s", self.data_path, exc)

        scenario = ScenarioConfig(
            enabled=True,
            asset_id="ARRAY_04",
            warning_after_ticks=2,
            critical_after_ticks=4,
        )

        self.simulator = TelemetrySimulator(
            sensor_records=sensor_records,
            plant_records=plant_records,
            mode="demo",
            speed_multiplier=1.0,
            loop=True,
            scenario=scenario,
        )

        self.validator = TelemetryValidator()
        self.freshness_service = FreshnessService()
        self.state_service = StateService()
        self.alert_service = AlertService()
        self.plant_state_service = PlantStateService()

        self.clients: set = set()
        self.running: bool = False
        self.status: str = "STOPPED"  # STOPPED, STARTING, RUNNING, ERROR
        self.started_at: datetime | None = None
        self.last_tick_time: datetime | None = None
        self.total_ticks_processed: int = 0
        self.fatal_error: str | None = None

    async def connect(self, websocket):
        await websocket.accept()
        self.clients.add(websocket)
        logger.info("WebSocket client connected. Active clients: %d", len(self.clients))

    def disconnect(self, websocket):
        self.clients.discard(websocket)
        logger.info("WebSocket client disconnected. Active clients: %d", len(self.clients))

    async def broadcast(self, state: dict):
        disconnected = set()

        for websocket in self.clients:
            try:
                await websocket.send_json(state)
            except Exception as exc:
                logger.debug("Failed sending frame to WebSocket client: %s", exc)
                disconnected.add(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)

    def serialize_state(
        self,
        state: dict,
        evaluated_states: list,
        alerts: list,
        health: dict | None = None,
    ) -> dict:
        payload = {
            "type": "telemetry",
            "timestamp": state["timestamp"].isoformat(),
            "plant": state["plant"].model_dump(mode="json"),
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
        if health is not None:
            payload["health"] = health
        return payload

    def get_readiness_info(self) -> tuple[bool, dict]:
        """Assess whether the service is ready to serve meaningful telemetry.

        Readiness requires:
        - Dataset successfully loaded
        - Simulator running
        - At least 1 tick successfully processed
        - No fatal unhandled error
        """
        is_ready = (
            self.dataset_loaded
            and self.status == "RUNNING"
            and self.total_ticks_processed > 0
            and self.fatal_error is None
        )
        info = {
            "ready": is_ready,
            "dataset_loaded": self.dataset_loaded,
            "dataset_records": self.dataset_record_count,
            "simulator_status": self.status,
            "ticks_processed": self.total_ticks_processed,
            "last_tick_time": (
                self.last_tick_time.isoformat() if self.last_tick_time else None
            ),
            "fatal_error": self.fatal_error,
            "active_clients": len(self.clients),
        }
        return is_ready, info

    async def run(self):
        if self.running:
            return

        self.running = True
        self.status = "RUNNING"
        self.started_at = datetime.now(timezone.utc)
        self.fatal_error = None
        logger.info(
            "Telemetry simulator run loop starting (mode=%s, interval=%.1fs)",
            self.simulator.mode,
            self.simulator.get_interval_seconds(),
        )

        try:
            while self.running:
                try:
                    receipt_time = datetime.now(timezone.utc)
                    state = self.simulator.get_current_state()

                    # Validate plant telemetry
                    validated_plant, plant_errors = (
                        self.validator.validate_plant_telemetry(
                            state["plant"], context="simulation_loop"
                        )
                    )
                    if validated_plant is not None:
                        state["plant"] = validated_plant
                    else:
                        logger.error(
                            "Plant telemetry failed validation in simulation loop: %s",
                            "; ".join(plant_errors),
                        )

                    # Validate asset telemetry defensively and update freshness tracker
                    for asset in state["assets"]:
                        val_asset, asset_errors = (
                            self.validator.validate_asset_telemetry(
                                asset,
                                context="simulation_loop",
                                check_seq=False,
                            )
                        )
                        if val_asset is not None:
                            eq_state = self.state_service.evaluate_asset(
                                val_asset
                            )
                            self.freshness_service.record_valid_telemetry(
                                asset_id=val_asset.asset_id,
                                telemetry=val_asset,
                                equipment_condition=eq_state.equipment_condition,
                                receipt_time=receipt_time,
                            )
                        else:
                            aid = getattr(asset, "asset_id", "UNKNOWN")
                            err_str = "; ".join(asset_errors)
                            self.freshness_service.record_invalid_telemetry(
                                asset_id=aid,
                                error_msg=err_str,
                            )
                            logger.warning(
                                "Dropped rejected asset %s from current tick: %s",
                                aid,
                                err_str,
                            )

                    # Evaluate freshness for all 6 known assets
                    freshness_map = self.freshness_service.evaluate_freshness(
                        receipt_time
                    )

                    # Build all 6 evaluated asset states & telemetry records (all 6 assets remain visible)
                    all_assets: list[Telemetry] = []
                    evaluated_states: list[AssetState] = []

                    for asset_id in sorted(KNOWN_ASSET_IDS):
                        rec = freshness_map[asset_id]
                        if (
                            rec.has_valid_reading
                            and rec.last_known_reading is not None
                        ):
                            reading = rec.last_known_reading
                            all_assets.append(reading)
                            evaluated_states.append(
                                AssetState(
                                    asset_id=asset_id,
                                    status=(
                                        rec.equipment_condition
                                        if rec.data_condition == "FRESH"
                                        else "UNKNOWN"
                                    ),
                                    power_kw=reading.power_kw,
                                    panel_temperature_c=reading.panel_temperature_c,
                                    efficiency_pct=reading.efficiency_pct,
                                    data_condition=rec.data_condition,
                                    equipment_condition=(
                                        rec.equipment_condition
                                        if rec.data_condition == "FRESH"
                                        else "UNKNOWN"
                                    ),
                                    age_seconds=rec.age_seconds,
                                )
                            )
                        else:
                            # Asset has never supplied a valid reading
                            placeholder = Telemetry(
                                timestamp=state["timestamp"],
                                asset_id=asset_id,
                                asset_type="SOLAR_ARRAY",
                                capacity_kw=920.0,
                                power_kw=0.0,
                                panel_temperature_c=25.0,
                                ambient_temperature_c=25.0,
                                voltage_v=0.0,
                                current_a=0.0,
                                efficiency_pct=0.0,
                                status="UNKNOWN",
                            )
                            all_assets.append(placeholder)
                            evaluated_states.append(
                                AssetState(
                                    asset_id=asset_id,
                                    status="UNKNOWN",
                                    power_kw=0.0,
                                    panel_temperature_c=0.0,
                                    efficiency_pct=0.0,
                                    data_condition="UNAVAILABLE",
                                    equipment_condition="UNKNOWN",
                                    age_seconds=None,
                                )
                            )

                    state["assets"] = all_assets

                    # Decoupled plant equipment condition and plant data health evaluation
                    plant_equipment_condition = (
                        self.plant_state_service.evaluate_plant_status(
                            evaluated_states
                        )
                    )
                    plant_data_health = (
                        self.plant_state_service.evaluate_plant_data_health(
                            evaluated_states
                        )
                    )

                    state["plant"].plant_status = plant_equipment_condition
                    state["plant"].data_health = plant_data_health

                    # Alerts triggered only for active FRESH equipment conditions
                    fresh_states = [
                        s
                        for s in evaluated_states
                        if s.data_condition == "FRESH"
                    ]
                    alerts = self.alert_service.evaluate(
                        fresh_states,
                        state["timestamp"],
                    )

                    # Structure health metadata payload
                    health_payload = {
                        "server_time": receipt_time.isoformat(),
                        "simulator_status": (
                            "RUNNING" if self.running else "STOPPED"
                        ),
                        "plant_data_health": plant_data_health,
                        "plant_equipment_condition": plant_equipment_condition,
                        "assets": {
                            aid: rec.to_dict()
                            for aid, rec in freshness_map.items()
                        },
                    }

                    serialized_state = self.serialize_state(
                        state,
                        evaluated_states,
                        alerts,
                        health=health_payload,
                    )

                    await self.broadcast(serialized_state)

                    self.total_ticks_processed += 1
                    self.last_tick_time = receipt_time

                    looped = self.simulator.advance()
                    if looped:
                        self.validator.notify_replay_boundary()

                except Exception as exc:
                    logger.exception(
                        "Recoverable error in simulation tick processing: %s",
                        exc,
                    )

                await asyncio.sleep(self.simulator.get_interval_seconds())

        except asyncio.CancelledError:
            logger.info("Simulation loop cancelled gracefully")
            self.status = "STOPPED"
            self.running = False
            raise
        except Exception as fatal_exc:
            self.status = "ERROR"
            self.fatal_error = str(fatal_exc)
            self.running = False
            logger.exception("Fatal error in simulation loop: %s", fatal_exc)
        finally:
            if self.status != "ERROR":
                self.status = "STOPPED"
            self.running = False
            logger.info(
                "SimulationManager run loop ended. Total ticks: %d",
                self.total_ticks_processed,
            )

    def stop(self):
        self.running = False
        if self.status != "ERROR":
            self.status = "STOPPED"
        logger.info("SimulationManager stopped")
