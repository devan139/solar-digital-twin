from datetime import datetime, timedelta, timezone
import unittest

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry
from backend.app.models.asset_state import AssetState
from backend.app.services.freshness_service import (
    FreshnessService,
    DEFAULT_STALE_THRESHOLD_SECONDS,
)
from backend.app.services.plant_state_service import PlantStateService
from backend.app.services.state_service import StateService
from backend.app.services.simulation_manager import SimulationManager
from backend.app.services.telemetry_validator import KNOWN_ASSET_IDS


class DeterministicClock:
    def __init__(self, start_time: datetime):
        self.current_time = start_time

    def __call__(self) -> datetime:
        return self.current_time

    def advance(self, seconds: float):
        self.current_time += timedelta(seconds=seconds)


class FreshnessServiceTests(unittest.TestCase):
    def setUp(self):
        self.t0 = datetime(2026, 10, 22, 10, 0, 0, tzinfo=timezone.utc)
        self.clock = DeterministicClock(self.t0)
        self.freshness = FreshnessService(
            stale_threshold_seconds=3.0, clock=self.clock
        )
        self.historical_measurement_time = datetime(2026, 9, 27, 6, 0, 0, tzinfo=timezone.utc)

    def _make_telemetry(self, asset_id: str = "ARRAY_01", temp: float = 40.0) -> Telemetry:
        return Telemetry(
            timestamp=self.historical_measurement_time,
            asset_id=asset_id,
            asset_type="SOLAR_ARRAY",
            capacity_kw=920.0,
            power_kw=400.0,
            panel_temperature_c=temp,
            ambient_temperature_c=25.0,
            voltage_v=600.0,
            current_a=666.7,
            efficiency_pct=92.0,
            status="NORMAL",
        )

    # 1. Initial state before any valid telemetry
    def test_initial_state_unavailable(self):
        freshness_map = self.freshness.evaluate_freshness()
        self.assertEqual(len(freshness_map), len(KNOWN_ASSET_IDS))
        for asset_id in KNOWN_ASSET_IDS:
            rec = freshness_map[asset_id]
            self.assertEqual(rec.data_condition, "UNAVAILABLE")
            self.assertEqual(rec.equipment_condition, "UNKNOWN")
            self.assertIsNone(rec.age_seconds)
            self.assertFalse(rec.has_valid_reading)

    # 2. Freshness after a valid reading
    def test_valid_reading_becomes_fresh(self):
        t1 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry(
            asset_id="ARRAY_01",
            telemetry=t1,
            equipment_condition="NORMAL",
        )
        freshness_map = self.freshness.evaluate_freshness()
        rec = freshness_map["ARRAY_01"]
        self.assertEqual(rec.data_condition, "FRESH")
        self.assertEqual(rec.equipment_condition, "NORMAL")
        self.assertEqual(rec.age_seconds, 0.0)
        self.assertTrue(rec.has_valid_reading)
        # Verify original measurement timestamp is preserved
        self.assertEqual(rec.last_valid_measurement_time, self.historical_measurement_time)
        self.assertEqual(rec.last_receipt_time, self.t0)

    # 3. Transition from fresh to stale
    def test_transition_from_fresh_to_stale(self):
        t1 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry(
            asset_id="ARRAY_01",
            telemetry=t1,
            equipment_condition="NORMAL",
        )
        # Advance 2.5 seconds (under 3.0s threshold) -> still FRESH
        self.clock.advance(2.5)
        freshness_map = self.freshness.evaluate_freshness()
        self.assertEqual(freshness_map["ARRAY_01"].data_condition, "FRESH")
        self.assertEqual(freshness_map["ARRAY_01"].age_seconds, 2.5)

        # Advance another 0.6 seconds (total 3.1s > 3.0s threshold) -> becomes STALE
        self.clock.advance(0.6)
        freshness_map = self.freshness.evaluate_freshness()
        self.assertEqual(freshness_map["ARRAY_01"].data_condition, "STALE")
        self.assertEqual(freshness_map["ARRAY_01"].age_seconds, 3.1)
        # Last known equipment condition preserved for diagnosis
        self.assertEqual(freshness_map["ARRAY_01"].equipment_condition, "NORMAL")

    # 4. Recovery from stale to fresh
    def test_recovery_from_stale_to_fresh(self):
        t1 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry("ARRAY_01", t1, "NORMAL")
        self.clock.advance(5.0)  # Make stale
        self.assertEqual(self.freshness.evaluate_freshness()["ARRAY_01"].data_condition, "STALE")

        # New valid reading arrives
        t2 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry("ARRAY_01", t2, "NORMAL")
        self.assertEqual(self.freshness.evaluate_freshness()["ARRAY_01"].data_condition, "FRESH")
        self.assertEqual(self.freshness.evaluate_freshness()["ARRAY_01"].age_seconds, 0.0)

    # 5. Unavailable data for an asset with no valid readings
    def test_unavailable_for_unreported_asset(self):
        t1 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry("ARRAY_01", t1, "NORMAL")
        freshness_map = self.freshness.evaluate_freshness()
        self.assertEqual(freshness_map["ARRAY_01"].data_condition, "FRESH")
        self.assertEqual(freshness_map["ARRAY_02"].data_condition, "UNAVAILABLE")
        self.assertEqual(freshness_map["ARRAY_02"].equipment_condition, "UNKNOWN")

    # 6. Rejected telemetry not refreshing freshness
    def test_rejected_telemetry_does_not_refresh_freshness(self):
        t1 = self._make_telemetry("ARRAY_01")
        self.freshness.record_valid_telemetry("ARRAY_01", t1, "NORMAL")
        self.clock.advance(2.0)

        # Corrupt reading arrives and is rejected
        self.freshness.record_invalid_telemetry("ARRAY_01", "Negative power")
        self.clock.advance(1.5)  # Total 3.5s since last valid reading

        rec = self.freshness.evaluate_freshness()["ARRAY_01"]
        self.assertEqual(rec.data_condition, "STALE")
        self.assertEqual(rec.age_seconds, 3.5)
        self.assertEqual(rec.last_error, "Negative power")

    # 7. Missing assets in a batch
    def test_missing_asset_expires_independently(self):
        for aid in ["ARRAY_01", "ARRAY_02"]:
            self.freshness.record_valid_telemetry(aid, self._make_telemetry(aid), "NORMAL")

        self.clock.advance(2.0)
        # Batch arrives with ARRAY_01 only; ARRAY_02 is missing
        self.freshness.record_valid_telemetry("ARRAY_01", self._make_telemetry("ARRAY_01"), "NORMAL")
        self.clock.advance(1.5)

        freshness_map = self.freshness.evaluate_freshness()
        # ARRAY_01 age is 1.5s -> FRESH
        self.assertEqual(freshness_map["ARRAY_01"].data_condition, "FRESH")
        # ARRAY_02 age is 3.5s -> STALE
        self.assertEqual(freshness_map["ARRAY_02"].data_condition, "STALE")

    # 8. Historical replay timestamps do not cause immediate staleness
    def test_historical_replay_timestamps_do_not_cause_staleness(self):
        # Measurement timestamp is from months/years ago
        hist_time = datetime(2020, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t = self._make_telemetry("ARRAY_01")
        object.__setattr__(t, "timestamp", hist_time)

        self.freshness.record_valid_telemetry("ARRAY_01", t, "NORMAL")
        rec = self.freshness.evaluate_freshness()["ARRAY_01"]
        # Freshness is based on server receipt time, NOT historical measurement time
        self.assertEqual(rec.data_condition, "FRESH")
        self.assertEqual(rec.last_valid_measurement_time, hist_time)

    # 9. Plant aggregation when all assets are fresh
    def test_plant_aggregation_all_fresh(self):
        plant_service = PlantStateService()
        states = [
            AssetState(
                asset_id=aid,
                status="NORMAL",
                power_kw=100.0,
                panel_temperature_c=40.0,
                efficiency_pct=90.0,
                data_condition="FRESH",
                equipment_condition="NORMAL",
            )
            for aid in sorted(KNOWN_ASSET_IDS)
        ]
        plant_status = plant_service.evaluate_plant_status(states)
        data_health = plant_service.evaluate_plant_data_health(states)
        self.assertEqual(plant_status, "NORMAL")
        self.assertEqual(data_health, "HEALTHY")

    # 10. Plant aggregation when one asset is stale
    def test_plant_aggregation_one_stale(self):
        plant_service = PlantStateService()
        states = [
            AssetState(
                asset_id=aid,
                status="NORMAL",
                power_kw=100.0,
                panel_temperature_c=40.0,
                efficiency_pct=90.0,
                data_condition="FRESH" if aid != "ARRAY_02" else "STALE",
                equipment_condition="NORMAL" if aid != "ARRAY_02" else "UNKNOWN",
            )
            for aid in sorted(KNOWN_ASSET_IDS)
        ]
        plant_status = plant_service.evaluate_plant_status(states)
        data_health = plant_service.evaluate_plant_data_health(states)
        # Data health is degraded
        self.assertEqual(data_health, "DEGRADED")
        # Plant status is UNKNOWN (cannot confirm full normality)
        self.assertEqual(plant_status, "UNKNOWN")

    # 11. Plant aggregation when one asset is unavailable
    def test_plant_aggregation_one_unavailable(self):
        plant_service = PlantStateService()
        states = [
            AssetState(
                asset_id=aid,
                status="NORMAL",
                power_kw=100.0,
                panel_temperature_c=40.0,
                efficiency_pct=90.0,
                data_condition="FRESH" if aid != "ARRAY_06" else "UNAVAILABLE",
                equipment_condition="NORMAL" if aid != "ARRAY_06" else "UNKNOWN",
            )
            for aid in sorted(KNOWN_ASSET_IDS)
        ]
        self.assertEqual(plant_service.evaluate_plant_data_health(states), "DEGRADED")
        self.assertEqual(plant_service.evaluate_plant_status(states), "UNKNOWN")

    # 12. Separation of equipment condition from data condition
    def test_equipment_condition_separated_from_data_condition(self):
        plant_service = PlantStateService()
        # Case A: Critical equipment condition with FRESH data
        states_crit = [
            AssetState(
                asset_id=aid,
                status="CRITICAL" if aid == "ARRAY_04" else "NORMAL",
                power_kw=100.0,
                panel_temperature_c=77.0 if aid == "ARRAY_04" else 40.0,
                efficiency_pct=90.0,
                data_condition="FRESH",
                equipment_condition="CRITICAL" if aid == "ARRAY_04" else "NORMAL",
            )
            for aid in sorted(KNOWN_ASSET_IDS)
        ]
        self.assertEqual(plant_service.evaluate_plant_status(states_crit), "CRITICAL")
        self.assertEqual(plant_service.evaluate_plant_data_health(states_crit), "HEALTHY")

        # Case B: Stale telemetry does not produce fake high-temperature alarm
        states_stale = [
            AssetState(
                asset_id=aid,
                status="UNKNOWN",
                power_kw=0.0,
                panel_temperature_c=0.0,
                efficiency_pct=0.0,
                data_condition="STALE",
                equipment_condition="UNKNOWN",
            )
            for aid in sorted(KNOWN_ASSET_IDS)
        ]
        self.assertEqual(plant_service.evaluate_plant_status(states_stale), "UNKNOWN")
        self.assertEqual(plant_service.evaluate_plant_data_health(states_stale), "UNAVAILABLE")

    # 13. Backward compatibility of WebSocket serialized payload
    def test_websocket_serialized_payload_compatibility(self):
        from pathlib import Path
        base_dir = Path(__file__).resolve().parents[2]
        data_file = base_dir / "data" / "solar_plant_sample_data.xlsx"

        manager = SimulationManager(data_file)
        state = manager.simulator.get_current_state()
        evaluated_states = manager.state_service.evaluate_assets(state["assets"])
        alerts = manager.alert_service.evaluate(evaluated_states, state["timestamp"])
        health_payload = {
            "server_time": datetime.now(timezone.utc).isoformat(),
            "simulator_status": "RUNNING",
            "plant_data_health": "HEALTHY",
            "plant_equipment_condition": "NORMAL",
            "assets": {},
        }

        serialized = manager.serialize_state(
            state, evaluated_states, alerts, health=health_payload
        )

        # Core payload keys required by existing frontend
        self.assertIn("type", serialized)
        self.assertIn("timestamp", serialized)
        self.assertIn("plant", serialized)
        self.assertIn("assets", serialized)
        self.assertIn("states", serialized)
        self.assertIn("alerts", serialized)
        # New health metadata key
        self.assertIn("health", serialized)
        self.assertEqual(serialized["health"]["simulator_status"], "RUNNING")
        self.assertEqual(serialized["type"], "telemetry")


if __name__ == "__main__":
    unittest.main()
