from pathlib import Path

import pandas as pd

from backend.app.models.telemetry import Telemetry
from backend.app.models.plant_telemetry import PlantTelemetry


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

        return [
            Telemetry.model_validate(record)
            for record in records
        ]

    def load_plant_telemetry(self) -> list[PlantTelemetry]:
        dataframe = pd.read_excel(
            self.file_path,
            sheet_name="PlantTelemetry",
        )

        dataframe["timestamp"] = pd.to_datetime(
            dataframe["timestamp"]
        )

        records = dataframe.to_dict(orient="records")

        return [
            PlantTelemetry.model_validate(record)
            for record in records
        ]
