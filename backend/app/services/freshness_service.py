from dataclasses import dataclass, field
from datetime import datetime, timezone
import os
from typing import Callable

from backend.app.models.telemetry import Telemetry
from backend.app.services.telemetry_validator import KNOWN_ASSET_IDS


# Configurable freshness threshold with sensible default
# In demo mode, simulator ticks arrive every 1.0 second.
# Default 3.0s window allows 3 scheduled ticks to absorb asyncio scheduling jitter,
# while promptly identifying feeds that have stalled or disconnected.
DEFAULT_STALE_THRESHOLD_SECONDS = float(
    os.getenv("SOLAR_FRESHNESS_STALE_THRESHOLD_SECONDS", "3.0")
)


@dataclass
class AssetFreshnessRecord:
    asset_id: str
    data_condition: str = "UNAVAILABLE"  # FRESH, STALE, UNAVAILABLE
    equipment_condition: str = "UNKNOWN"  # NORMAL, WARNING, CRITICAL, UNKNOWN
    last_valid_measurement_time: datetime | None = None
    last_receipt_time: datetime | None = None
    age_seconds: float | None = None
    last_known_reading: Telemetry | None = None
    has_valid_reading: bool = False
    last_error: str | None = None

    def to_dict(self) -> dict:
        return {
            "asset_id": self.asset_id,
            "data_condition": self.data_condition,
            "equipment_condition": self.equipment_condition,
            "last_valid_measurement_time": (
                self.last_valid_measurement_time.isoformat()
                if self.last_valid_measurement_time
                else None
            ),
            "last_receipt_time": (
                self.last_receipt_time.isoformat()
                if self.last_receipt_time
                else None
            ),
            "age_seconds": self.age_seconds,
            "has_valid_reading": self.has_valid_reading,
            "last_error": self.last_error,
        }


class FreshnessService:
    """Tracks per-asset telemetry freshness and decouples data quality from equipment health."""

    def __init__(
        self,
        stale_threshold_seconds: float = DEFAULT_STALE_THRESHOLD_SECONDS,
        clock: Callable[[], datetime] | None = None,
    ):
        self.stale_threshold_seconds = stale_threshold_seconds
        self.clock = clock or (lambda: datetime.now(timezone.utc))

        # Initialize tracking for all 6 known assets to ensure all assets remain visible
        self.assets: dict[str, AssetFreshnessRecord] = {
            asset_id: AssetFreshnessRecord(asset_id=asset_id)
            for asset_id in sorted(KNOWN_ASSET_IDS)
        }

    def get_time(self) -> datetime:
        return self.clock()

    def record_valid_telemetry(
        self,
        asset_id: str,
        telemetry: Telemetry,
        equipment_condition: str,
        receipt_time: datetime | None = None,
    ) -> AssetFreshnessRecord:
        """Record newly validated telemetry for an asset.

        Updates measurement timestamp and receipt timestamp. Sets data_condition to FRESH.
        """
        now = receipt_time or self.get_time()
        record = self.assets.get(asset_id)
        if record is None:
            record = AssetFreshnessRecord(asset_id=asset_id)
            self.assets[asset_id] = record

        record.last_valid_measurement_time = telemetry.timestamp
        record.last_receipt_time = now
        record.last_known_reading = telemetry
        record.has_valid_reading = True
        record.equipment_condition = equipment_condition
        record.data_condition = "FRESH"
        record.last_error = None
        record.age_seconds = 0.0
        return record

    def record_invalid_telemetry(
        self,
        asset_id: str,
        error_msg: str,
    ) -> AssetFreshnessRecord | None:
        """Record a validation rejection.

        Preserves last valid reading and does NOT update receipt time, allowing freshness to expire.
        """
        record = self.assets.get(asset_id)
        if record is not None:
            record.last_error = error_msg
        return record

    def evaluate_freshness(
        self,
        current_time: datetime | None = None,
    ) -> dict[str, AssetFreshnessRecord]:
        """Evaluate freshness state for all assets against current clock."""
        now = current_time or self.get_time()

        for asset_id, record in self.assets.items():
            if not record.has_valid_reading or record.last_receipt_time is None:
                record.data_condition = "UNAVAILABLE"
                record.equipment_condition = "UNKNOWN"
                record.age_seconds = None
                continue

            age = (now - record.last_receipt_time).total_seconds()
            record.age_seconds = round(max(0.0, age), 2)

            if age <= self.stale_threshold_seconds:
                record.data_condition = "FRESH"
            else:
                record.data_condition = "STALE"
                # If telemetry is stale, last-known equipment condition is preserved for diagnosis,
                # but flagged as stale so it is never presented as a verified current state.

        return self.assets

    def evaluate_plant_health(
        self,
        freshness_map: dict[str, AssetFreshnessRecord],
    ) -> tuple[str, str]:
        """Determine plant equipment condition and plant data health separately.

        Returns (plant_equipment_condition, plant_data_health).

        Plant Data Health:
        - HEALTHY: All 6 known assets are FRESH.
        - UNAVAILABLE: All assets are UNAVAILABLE or STALE.
        - DEGRADED: At least one asset is STALE or UNAVAILABLE, but some fresh data remains.

        Plant Equipment Condition:
        - CRITICAL: Any asset with valid data is CRITICAL.
        - WARNING: Any asset with valid data is WARNING (and none CRITICAL).
        - UNKNOWN: Incomplete data (some assets stale/unavailable) and no active alarm.
        - NORMAL: All assets are FRESH and nominal.
        """
        records = list(freshness_map.values())
        fresh_count = sum(1 for r in records if r.data_condition == "FRESH")
        total_count = len(records)

        # 1. Plant Data Health
        if fresh_count == total_count and total_count > 0:
            data_health = "HEALTHY"
        elif fresh_count == 0:
            data_health = "UNAVAILABLE"
        else:
            data_health = "DEGRADED"

        # 2. Plant Equipment Condition
        # Active confirmed critical on any asset takes immediate precedence
        if any(r.equipment_condition == "CRITICAL" for r in records if r.data_condition == "FRESH"):
            equipment_condition = "CRITICAL"
        elif any(r.equipment_condition == "WARNING" for r in records if r.data_condition == "FRESH"):
            equipment_condition = "WARNING"
        elif data_health != "HEALTHY":
            # Cannot confirm full plant normality when telemetry is degraded or unavailable
            equipment_condition = "UNKNOWN"
        else:
            equipment_condition = "NORMAL"

        return equipment_condition, data_health
