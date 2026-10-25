import logging
from pathlib import Path
import pandas as pd

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry

logger = logging.getLogger("solar_twin.data_loader")


class TelemetryDataLoader:
    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)

    def load_sensor_telemetry(self) -> list[Telemetry]:
        dataframe = pd.read_excel(
            self.file_path,
            sheet_name="SensorTelemetry",
        )

        dataframe["timestamp"] = pd.to_datetime(dataframe["timestamp"])
        records = dataframe.to_dict(orient="records")

        valid_records: list[Telemetry] = []
        for record in records:
            try:
                valid_records.append(Telemetry.model_validate(record))
            except Exception as exc:
                logger.warning(
                    "Rejected invalid sensor record during ingestion (asset=%s): %s",
                    record.get("asset_id", "UNKNOWN"),
                    exc,
                )

        return valid_records

    def load_plant_telemetry(self) -> list[PlantTelemetry]:
        dataframe = pd.read_excel(
            self.file_path,
            sheet_name="PlantTelemetry",
        )

        dataframe["timestamp"] = pd.to_datetime(
            dataframe["timestamp"]
        )

        records = dataframe.to_dict(orient="records")

        valid_records: list[PlantTelemetry] = []
        for record in records:
            try:
                valid_records.append(PlantTelemetry.model_validate(record))
            except Exception as exc:
                logger.warning(
                    "Rejected invalid plant telemetry record during ingestion: %s",
                    exc,
                )

        return valid_records
