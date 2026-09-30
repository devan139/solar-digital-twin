from backend.app.models.asset_state import AssetState
from backend.app.models.telemetry import Telemetry


class StateService:
    WARNING_TEMPERATURE_C = 70.0
    CRITICAL_TEMPERATURE_C = 75.0

    def evaluate_asset(
        self,
        telemetry: Telemetry,
    ) -> AssetState:

        if (
            telemetry.panel_temperature_c
            >= self.CRITICAL_TEMPERATURE_C
        ):
            status = "CRITICAL"

        elif (
            telemetry.panel_temperature_c
            >= self.WARNING_TEMPERATURE_C
        ):
            status = "WARNING"

        else:
            status = "NORMAL"

        return AssetState(
            asset_id=telemetry.asset_id,
            status=status,
            power_kw=telemetry.power_kw,
            panel_temperature_c=telemetry.panel_temperature_c,
            efficiency_pct=telemetry.efficiency_pct,
        )

    def evaluate_assets(
        self,
        telemetry_records: list[Telemetry],
    ) -> list[AssetState]:

        return [
            self.evaluate_asset(record)
            for record in telemetry_records
        ]
