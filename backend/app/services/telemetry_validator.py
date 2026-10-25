import logging
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from backend.app.models.plant_telemetry import PlantTelemetry
from backend.app.models.telemetry import Telemetry

logger = logging.getLogger("solar_twin.telemetry_validator")

# Known physical asset IDs in the solar plant
KNOWN_ASSET_IDS: frozenset[str] = frozenset(
    {
        "ARRAY_01",
        "ARRAY_02",
        "ARRAY_03",
        "ARRAY_04",
        "ARRAY_05",
        "ARRAY_06",
    }
)

VALID_STATUSES: frozenset[str] = frozenset({"NORMAL", "WARNING", "CRITICAL"})


@dataclass(frozen=True)
class TelemetryLimits:
    """Documented physical sanity limits for solar plant telemetry.

    These represent physically plausible sensor reading boundaries,
    distinct from operational/equipment alarm thresholds (e.g. 70°C warning, 75°C critical).
    """

    # Photovoltaic panel temperature (°C)
    # Physical basis: Terrestrial PV modules operate down to -40°C in winter and
    # can reach 90-100°C under extreme irradiance. Upper sanity boundary 120°C.
    panel_temp_min_c: float = -40.0
    panel_temp_max_c: float = 120.0

    # Ambient weather temperature (°C)
    # Physical basis: Earth surface ambient record bounds (-50°C to +60°C). Upper sanity boundary 65°C.
    ambient_temp_min_c: float = -50.0
    ambient_temp_max_c: float = 65.0

    # Power generation (kW)
    # Physical basis: Power generation cannot be negative. Valid zero readings occur during darkness.
    power_min_kw: float = 0.0
    power_max_kw: float = 2500.0

    # Direct current string voltage (V)
    # Physical basis: Standard commercial PV string inverters operate up to 1000V-1500V DC.
    voltage_min_v: float = 0.0
    voltage_max_v: float = 1500.0

    # Direct current (A)
    # Physical basis: Non-negative string current. Upper boundary 3000 A.
    current_min_a: float = 0.0
    current_max_a: float = 3000.0

    # Efficiency (%)
    # Physical basis: Thermodynamic efficiency ratio between 0.0% and 100.0%.
    efficiency_min_pct: float = 0.0
    efficiency_max_pct: float = 100.0

    # Capacity (kW)
    capacity_min_kw: float = 1.0
    capacity_max_kw: float = 5000.0


DEFAULT_LIMITS = TelemetryLimits()


class TelemetryValidator:
    """Centralized telemetry validation and defensive ingestion layer."""

    def __init__(
        self,
        limits: TelemetryLimits = DEFAULT_LIMITS,
        log_suppression_window_s: float = 10.0,
    ):
        self.limits = limits
        self.log_suppression_window_s = log_suppression_window_s

        # Track previous timestamp per asset for duplicate and out-of-order detection
        self._last_timestamps: dict[str, datetime] = {}
        # Track whether a replay boundary just occurred
        self._replay_boundary_active: bool = False

        # Error suppression tracking: (key, error_type) -> (last_log_time, suppressed_count)
        self._suppressed_logs: dict[tuple[str, str], list[float | int]] = {}

    def notify_replay_boundary(self) -> None:
        """Explicitly notify the validator that the simulation loop has reset.

        This ensures repeating timestamps across replay cycles are recognized
        as intentional rather than out-of-order violations.
        """
        self._replay_boundary_active = True
        self._last_timestamps.clear()

    def reset_sequence_tracker(self) -> None:
        """Reset sequence history (e.g. on test setup or simulator restart)."""
        self._last_timestamps.clear()
        self._replay_boundary_active = False

    def check_sequence(
        self, asset_id: str, timestamp: datetime
    ) -> tuple[bool, str | None]:
        """Verify timestamp sequencing for an asset.

        Returns (is_valid, warning_message).
        """
        if self._replay_boundary_active:
            # Replay boundary acknowledged; clear flag once we receive fresh points
            pass

        prev_timestamp = self._last_timestamps.get(asset_id)
        if prev_timestamp is None:
            self._last_timestamps[asset_id] = timestamp
            return True, None

        if timestamp == prev_timestamp:
            msg = f"Duplicate timestamp {timestamp} detected for asset {asset_id}"
            return False, msg

        if timestamp < prev_timestamp:
            msg = (
                f"Out-of-order timestamp {timestamp} detected for asset {asset_id} "
                f"(previous was {prev_timestamp})"
            )
            return False, msg

        self._last_timestamps[asset_id] = timestamp
        return True, None

    def log_validation_error(
        self, context: str, asset_id: str, error_msg: str
    ) -> None:
        """Log validation failure with rate limiting and structured context."""
        now = time.monotonic()
        key = (asset_id, error_msg)

        entry = self._suppressed_logs.get(key)
        if entry is None:
            self._suppressed_logs[key] = [now, 0]
            logger.warning(
                "[%s] Validation rejected for asset %s: %s",
                context,
                asset_id,
                error_msg,
            )
            return

        last_time, count = entry
        if now - last_time >= self.log_suppression_window_s:
            suppressed_note = (
                f" (suppressed {int(count)} similar errors)" if count > 0 else ""
            )
            logger.warning(
                "[%s] Validation rejected for asset %s: %s%s",
                context,
                asset_id,
                error_msg,
                suppressed_note,
            )
            self._suppressed_logs[key] = [now, 0]
        else:
            self._suppressed_logs[key][1] = int(count) + 1

    def validate_asset_telemetry(
        self,
        record: Any,
        context: str = "ingestion",
        check_seq: bool = True,
    ) -> tuple[Telemetry | None, list[str]]:
        """Validate an asset telemetry record.

        Accepts either a dict or a Telemetry instance.
        Returns (validated_telemetry, list_of_errors).
        If validation fails, returns (None, errors).
        """
        errors: list[str] = []

        if record is None:
            return None, ["Telemetry record is None"]

        # Parse / extract fields
        if isinstance(record, dict):
            # Check required fields
            required_fields = [
                "timestamp",
                "asset_id",
                "asset_type",
                "capacity_kw",
                "power_kw",
                "panel_temperature_c",
                "ambient_temperature_c",
                "voltage_v",
                "current_a",
                "efficiency_pct",
                "status",
            ]
            for field in required_fields:
                if field not in record or record[field] is None:
                    errors.append(f"Missing required field: '{field}'")

            if errors:
                asset_id = str(record.get("asset_id", "UNKNOWN"))
                self.log_validation_error(context, asset_id, "; ".join(errors))
                return None, errors

            try:
                telemetry = Telemetry.model_validate(record)
            except Exception as exc:
                asset_id = str(record.get("asset_id", "UNKNOWN"))
                err_str = f"Model validation failed: {exc}"
                self.log_validation_error(context, asset_id, err_str)
                return None, [err_str]
        elif isinstance(record, Telemetry):
            telemetry = record
        else:
            return None, [f"Unsupported record type: {type(record)}"]

        asset_id = telemetry.asset_id

        # Asset ID verification
        if asset_id not in KNOWN_ASSET_IDS:
            errors.append(
                f"Unknown asset identifier '{asset_id}'. Expected one of {sorted(KNOWN_ASSET_IDS)}"
            )

        # Status validation
        if telemetry.status not in VALID_STATUSES:
            errors.append(
                f"Invalid status '{telemetry.status}'. Expected one of {sorted(VALID_STATUSES)}"
            )

        # Finite numeric checks & physical ranges
        num_checks = [
            (
                "power_kw",
                telemetry.power_kw,
                self.limits.power_min_kw,
                self.limits.power_max_kw,
            ),
            (
                "capacity_kw",
                telemetry.capacity_kw,
                self.limits.capacity_min_kw,
                self.limits.capacity_max_kw,
            ),
            (
                "voltage_v",
                telemetry.voltage_v,
                self.limits.voltage_min_v,
                self.limits.voltage_max_v,
            ),
            (
                "current_a",
                telemetry.current_a,
                self.limits.current_min_a,
                self.limits.current_max_a,
            ),
            (
                "efficiency_pct",
                telemetry.efficiency_pct,
                self.limits.efficiency_min_pct,
                self.limits.efficiency_max_pct,
            ),
            (
                "panel_temperature_c",
                telemetry.panel_temperature_c,
                self.limits.panel_temp_min_c,
                self.limits.panel_temp_max_c,
            ),
            (
                "ambient_temperature_c",
                telemetry.ambient_temperature_c,
                self.limits.ambient_temp_min_c,
                self.limits.ambient_temp_max_c,
            ),
        ]

        for field_name, val, min_val, max_val in num_checks:
            if not isinstance(val, (int, float)) or isinstance(val, bool):
                errors.append(f"Field '{field_name}' must be a numeric float")
                continue
            if math.isnan(val):
                errors.append(f"Field '{field_name}' is NaN")
                continue
            if math.isinf(val):
                errors.append(f"Field '{field_name}' is infinite")
                continue
            if val < min_val or val > max_val:
                errors.append(
                    f"Field '{field_name}' value {val} out of physical range [{min_val}, {max_val}]"
                )

        # Timestamp sequencing
        if check_seq and not errors:
            seq_ok, seq_msg = self.check_sequence(asset_id, telemetry.timestamp)
            if not seq_ok and seq_msg:
                errors.append(seq_msg)

        if errors:
            self.log_validation_error(context, asset_id, "; ".join(errors))
            return None, errors

        # Attach ingestion receipt time if not set
        if getattr(telemetry, "ingested_at", None) is None:
            object.__setattr__(
                telemetry, "ingested_at", datetime.now(timezone.utc)
            )

        return telemetry, []

    def validate_plant_telemetry(
        self,
        record: Any,
        context: str = "plant_ingestion",
    ) -> tuple[PlantTelemetry | None, list[str]]:
        """Validate plant-level summary telemetry."""
        errors: list[str] = []

        if record is None:
            return None, ["Plant telemetry record is None"]

        if isinstance(record, dict):
            required = [
                "timestamp",
                "current_power_kw",
                "average_panel_temperature_c",
                "maximum_panel_temperature_c",
                "average_efficiency_pct",
                "plant_status",
            ]
            for f in required:
                if f not in record or record[f] is None:
                    errors.append(f"Missing required plant field: '{f}'")

            if errors:
                self.log_validation_error(context, "PLANT", "; ".join(errors))
                return None, errors

            try:
                plant = PlantTelemetry.model_validate(record)
            except Exception as exc:
                err_str = f"Plant model validation failed: {exc}"
                self.log_validation_error(context, "PLANT", err_str)
                return None, [err_str]
        elif isinstance(record, PlantTelemetry):
            plant = record
        else:
            return None, [f"Unsupported plant record type: {type(record)}"]

        if plant.plant_status not in VALID_STATUSES:
            errors.append(
                f"Invalid plant_status '{plant.plant_status}'. Expected one of {sorted(VALID_STATUSES)}"
            )

        num_checks = [
            (
                "current_power_kw",
                plant.current_power_kw,
                0.0,
                self.limits.power_max_kw * 10,
            ),
            (
                "average_panel_temperature_c",
                plant.average_panel_temperature_c,
                self.limits.panel_temp_min_c,
                self.limits.panel_temp_max_c,
            ),
            (
                "maximum_panel_temperature_c",
                plant.maximum_panel_temperature_c,
                self.limits.panel_temp_min_c,
                self.limits.panel_temp_max_c,
            ),
            (
                "average_efficiency_pct",
                plant.average_efficiency_pct,
                0.0,
                100.0,
            ),
        ]

        for field_name, val, min_val, max_val in num_checks:
            if not isinstance(val, (int, float)) or isinstance(val, bool):
                errors.append(f"Field '{field_name}' must be numeric")
                continue
            if math.isnan(val):
                errors.append(f"Plant field '{field_name}' is NaN")
                continue
            if math.isinf(val):
                errors.append(f"Plant field '{field_name}' is infinite")
                continue
            if val < min_val or val > max_val:
                errors.append(
                    f"Plant field '{field_name}' value {val} out of range [{min_val}, {max_val}]"
                )

        if errors:
            self.log_validation_error(context, "PLANT", "; ".join(errors))
            return None, errors

        return plant, []
