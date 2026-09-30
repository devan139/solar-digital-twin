from pathlib import Path

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry
from backend.simulator.data_loader import TelemetryDataLoader


class TelemetryService:
    def __init__(self, data_path: str | Path):
        loader = TelemetryDataLoader(data_path)
        
        self.records: list[Telemetry] = (
            loader.load_sensor_telemetry()
        )
        
        self.plant_records: list[PlantTelemetry] = (
            loader.load_plant_telemetry()
        )

    def get_latest(self) -> Telemetry:
        return max(
            self.records,
            key=lambda record: record.timestamp,
        )

    def get_asset_ids(self) -> list[str]:
        return sorted(
            {record.asset_id for record in self.records}
        )

    def get_asset_telemetry(
        self,
        asset_id: str,
    ) -> list[Telemetry]:

        return [
            record
            for record in self.records
            if record.asset_id == asset_id
        ]

    def get_asset(self, asset_id: str) -> dict | None:
        records = self.get_asset_telemetry(asset_id)

        if not records:
            return None

        first = records[0]

        return {
            "asset_id": first.asset_id,
            "asset_type": first.asset_type,
            "capacity_kw": first.capacity_kw,
        }

    def get_latest_plant_telemetry(self) -> PlantTelemetry:
        return max(
            self.plant_records,
            key=lambda record: record.timestamp,
        )

    def get_plant_telemetry(self) -> list[PlantTelemetry]:
        return self.plant_records
