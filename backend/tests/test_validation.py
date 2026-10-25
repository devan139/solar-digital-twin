import copy
from datetime import datetime, timezone
import math
import unittest

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry
from backend.app.services.state_service import StateService
from backend.app.services.alert_service import AlertService
from backend.app.services.plant_state_service import PlantStateService
from backend.app.services.telemetry_validator import (
    TelemetryValidator,
    TelemetryLimits,
    DEFAULT_LIMITS,
)
from backend.simulator.scenario import ScenarioConfig
from backend.simulator.scenario_injector import ScenarioInjector


class TelemetryValidationTests(unittest.TestCase):
    def setUp(self):
        self.validator = TelemetryValidator(limits=DEFAULT_LIMITS)
        self.base_timestamp = datetime(2026, 9, 27, 12, 0, 0, tzinfo=timezone.utc)
        self.valid_record_dict = {
            "timestamp": self.base_timestamp,
            "asset_id": "ARRAY_01",
            "asset_type": "SOLAR_ARRAY",
            "capacity_kw": 920.0,
            "power_kw": 450.0,
            "panel_temperature_c": 45.0,
            "ambient_temperature_c": 28.0,
            "voltage_v": 620.0,
            "current_a": 725.8,
            "efficiency_pct": 92.5,
            "status": "NORMAL",
        }

    # 1. Valid existing telemetry record
    def test_valid_telemetry_acceptance(self):
        validated, errors = self.validator.validate_asset_telemetry(
            self.valid_record_dict
        )
        self.assertIsNotNone(validated)
        self.assertEqual(errors, [])
        self.assertEqual(validated.asset_id, "ARRAY_01")
        self.assertEqual(validated.power_kw, 450.0)
        self.assertIsNotNone(validated.ingested_at)

    # 2. Missing required fields
    def test_missing_required_fields(self):
        for field in ["power_kw", "panel_temperature_c", "asset_id", "timestamp"]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            del bad_dict[field]
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(
                any(field in err for err in errors),
                f"Expected error for missing field {field}",
            )

    # 3. Malformed timestamps
    def test_malformed_timestamp(self):
        bad_dict = copy.deepcopy(self.valid_record_dict)
        bad_dict["timestamp"] = "not-a-valid-datetime"
        validated, errors = self.validator.validate_asset_telemetry(bad_dict)
        self.assertIsNone(validated)
        self.assertTrue(len(errors) > 0)

    # 4. Unknown asset IDs
    def test_unknown_asset_id_rejected(self):
        bad_dict = copy.deepcopy(self.valid_record_dict)
        bad_dict["asset_id"] = "ARRAY_99_ROGUE"
        validated, errors = self.validator.validate_asset_telemetry(bad_dict)
        self.assertIsNone(validated)
        self.assertTrue(any("Unknown asset identifier" in err for err in errors))

    # 5. NaN and infinity
    def test_nan_rejected(self):
        for field in ["power_kw", "panel_temperature_c", "voltage_v", "efficiency_pct"]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict[field] = float("nan")
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(any("NaN" in err or "cannot be NaN" in err for err in errors))

    def test_infinity_rejected(self):
        for field in ["power_kw", "panel_temperature_c", "voltage_v", "efficiency_pct"]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict[field] = float("inf")
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(any("infinite" in err or "cannot be infinite" in err for err in errors))

    # 6. Negative power, voltage, current
    def test_negative_values_rejected(self):
        for field, neg_val in [
            ("power_kw", -1.0),
            ("voltage_v", -0.5),
            ("current_a", -10.0),
            ("capacity_kw", 0.0),  # capacity must be positive
        ]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict[field] = neg_val
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(len(errors) > 0)

    # 7. Efficiency outside 0-100%
    def test_efficiency_bounds(self):
        for bad_eff in [-0.1, 100.1, 150.0]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict["efficiency_pct"] = bad_eff
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(len(errors) > 0)

    # 8. Temperature values outside documented sanity limits
    def test_temperature_sanity_limits(self):
        # Panel temp sanity limits are [-40.0, 120.0]
        for bad_panel_temp in [-45.0, 125.0, 250.0]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict["panel_temperature_c"] = bad_panel_temp
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(len(errors) > 0)

        # Ambient temp sanity limits are [-50.0, 65.0]
        for bad_amb_temp in [-55.0, 70.0]:
            bad_dict = copy.deepcopy(self.valid_record_dict)
            bad_dict["ambient_temperature_c"] = bad_amb_temp
            validated, errors = self.validator.validate_asset_telemetry(bad_dict)
            self.assertIsNone(validated)
            self.assertTrue(len(errors) > 0)

    # 9. Legitimate zero readings
    def test_legitimate_zero_readings(self):
        night_dict = copy.deepcopy(self.valid_record_dict)
        night_dict["power_kw"] = 0.0
        night_dict["current_a"] = 0.0
        night_dict["efficiency_pct"] = 0.0

        validated, errors = self.validator.validate_asset_telemetry(night_dict)
        self.assertIsNotNone(validated)
        self.assertEqual(errors, [])
        self.assertEqual(validated.power_kw, 0.0)
        self.assertEqual(validated.current_a, 0.0)
        self.assertEqual(validated.efficiency_pct, 0.0)

    # 10. Existing normal, warning, and critical temperature behaviour
    def test_temperature_evaluation_rules(self):
        state_service = StateService()

        # Normal: 65°C (< 70°C)
        t_normal = Telemetry.model_validate(
            {**self.valid_record_dict, "panel_temperature_c": 65.0}
        )
        s_normal = state_service.evaluate_asset(t_normal)
        self.assertEqual(s_normal.status, "NORMAL")

        # Warning: 72°C (70°C <= temp < 75°C)
        t_warning = Telemetry.model_validate(
            {**self.valid_record_dict, "panel_temperature_c": 72.0}
        )
        s_warning = state_service.evaluate_asset(t_warning)
        self.assertEqual(s_warning.status, "WARNING")

        # Critical: 77°C (>= 75°C)
        t_critical = Telemetry.model_validate(
            {**self.valid_record_dict, "panel_temperature_c": 77.0}
        )
        s_critical = state_service.evaluate_asset(t_critical)
        self.assertEqual(s_critical.status, "CRITICAL")

    # 11. Scenario-injected high-temperature readings
    def test_scenario_injected_values_validate_successfully(self):
        scenario_config = ScenarioConfig(
            enabled=True,
            asset_id="ARRAY_04",
            warning_temperature_c=72.0,
            critical_temperature_c=77.0,
            warning_after_ticks=2,
            critical_after_ticks=4,
        )
        injector = ScenarioInjector(scenario_config)

        plant = PlantTelemetry(
            timestamp=self.base_timestamp,
            current_power_kw=1200.0,
            average_panel_temperature_c=45.0,
            maximum_panel_temperature_c=45.0,
            average_efficiency_pct=92.0,
            plant_status="NORMAL",
        )
        assets = [
            Telemetry.model_validate(
                {**self.valid_record_dict, "asset_id": "ARRAY_04"}
            )
        ]

        # Apply at tick 5 (critical)
        mod_plant, mod_assets = injector.apply(plant, assets, tick_index=5)
        self.assertEqual(mod_assets[0].panel_temperature_c, 77.0)
        self.assertEqual(mod_plant.maximum_panel_temperature_c, 77.0)

        # Ensure injected critical values pass telemetry validation cleanly
        val_asset, asset_errors = self.validator.validate_asset_telemetry(
            mod_assets[0], check_seq=False
        )
        self.assertIsNotNone(val_asset)
        self.assertEqual(asset_errors, [])

        val_plant, plant_errors = self.validator.validate_plant_telemetry(mod_plant)
        self.assertIsNotNone(val_plant)
        self.assertEqual(plant_errors, [])

    # 12. Invalid records rejected without terminating simulator processing
    def test_invalid_records_rejected_without_exception(self):
        mixed_batch = [
            # Valid record 1
            {**self.valid_record_dict, "asset_id": "ARRAY_01"},
            # Invalid record (corrupted voltage)
            {**self.valid_record_dict, "asset_id": "ARRAY_02", "voltage_v": -999.0},
            # Valid record 2
            {**self.valid_record_dict, "asset_id": "ARRAY_03"},
            # Invalid record (NaN temperature)
            {**self.valid_record_dict, "asset_id": "ARRAY_04", "panel_temperature_c": float("nan")},
        ]

        accepted = []
        rejected = []

        for item in mixed_batch:
            val, errs = self.validator.validate_asset_telemetry(item, check_seq=False)
            if val is not None:
                accepted.append(val)
            else:
                rejected.append(errs)

        self.assertEqual(len(accepted), 2)
        self.assertEqual(len(rejected), 2)
        self.assertEqual([a.asset_id for a in accepted], ["ARRAY_01", "ARRAY_03"])

    # 13. Duplicate and out-of-order timestamps, including replay boundary
    def test_sequence_tracking_and_replay_boundary(self):
        validator = TelemetryValidator(limits=DEFAULT_LIMITS)
        t1 = datetime(2026, 9, 27, 6, 0, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 9, 27, 6, 5, 0, tzinfo=timezone.utc)
        t3 = datetime(2026, 9, 27, 6, 10, 0, tzinfo=timezone.utc)

        # First reading ok
        val, errs = validator.validate_asset_telemetry(
            {**self.valid_record_dict, "timestamp": t1}, check_seq=True
        )
        self.assertIsNotNone(val)

        # Second advancing reading ok
        val, errs = validator.validate_asset_telemetry(
            {**self.valid_record_dict, "timestamp": t2}, check_seq=True
        )
        self.assertIsNotNone(val)

        # Duplicate reading detected
        val, errs = validator.validate_asset_telemetry(
            {**self.valid_record_dict, "timestamp": t2}, check_seq=True
        )
        self.assertIsNone(val)
        self.assertTrue(any("Duplicate timestamp" in e for e in errs))

        # Out-of-order reading detected (jumping backward from t2 to t1)
        val, errs = validator.validate_asset_telemetry(
            {**self.valid_record_dict, "timestamp": t1}, check_seq=True
        )
        self.assertIsNone(val)
        self.assertTrue(any("Out-of-order timestamp" in e for e in errs))

        # Replay loop boundary notification: loop resets to t1 intentionally
        validator.notify_replay_boundary()
        val, errs = validator.validate_asset_telemetry(
            {**self.valid_record_dict, "timestamp": t1}, check_seq=True
        )
        self.assertIsNotNone(val)
        self.assertEqual(errs, [])


if __name__ == "__main__":
    unittest.main()
