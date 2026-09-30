from backend.app.models.alert import Alert
from backend.app.models.asset_state import AssetState


class AlertService:

    def create_alert(
        self,
        state: AssetState,
        timestamp,
    ) -> Alert | None:

        if state.status == "CRITICAL":
            return Alert(
                id=f"{state.asset_id}-high-temp-critical",
                asset_id=state.asset_id,
                timestamp=timestamp,
                severity="CRITICAL",
                type="HIGH_TEMPERATURE",
                message=(
                    f"{state.asset_id} panel temperature "
                    f"has reached "
                    f"{state.panel_temperature_c:.1f}°C."
                ),
                recommendation=(
                    "Inspect the affected array and "
                    "check for abnormal thermal conditions."
                ),
            )

        if state.status == "WARNING":
            return Alert(
                id=f"{state.asset_id}-high-temp-warning",
                asset_id=state.asset_id,
                timestamp=timestamp,
                severity="WARNING",
                type="HIGH_TEMPERATURE",
                message=(
                    f"{state.asset_id} panel temperature "
                    f"is above the warning threshold "
                    f"at {state.panel_temperature_c:.1f}°C."
                ),
                recommendation=(
                    "Monitor the array and inspect "
                    "temperature trends."
                ),
            )

        return None

    def evaluate(
        self,
        states: list[AssetState],
        timestamp,
    ) -> list[Alert]:

        alerts = []

        for state in states:
            alert = self.create_alert(
                state,
                timestamp,
            )

            if alert is not None:
                alerts.append(alert)

        return alerts
