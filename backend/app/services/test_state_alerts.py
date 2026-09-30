from datetime import datetime

from backend.app.models.telemetry import Telemetry
from backend.app.services.alert_service import AlertService
from backend.app.services.state_service import StateService


timestamp = datetime(2026, 9, 27, 12, 0, 0)

state_service = StateService()
alert_service = AlertService()


def make_telemetry(
    temperature: float,
) -> Telemetry:

    return Telemetry(
        timestamp=timestamp,
        asset_id="ARRAY_04",
        asset_type="SOLAR_ARRAY",
        capacity_kw=920.0,
        power_kw=800.0,
        panel_temperature_c=temperature,
        ambient_temperature_c=35.0,
        voltage_v=430.0,
        current_a=1000.0,
        efficiency_pct=92.0,
        status="NORMAL",
    )


for temperature in [65.0, 72.0, 77.0]:

    telemetry = make_telemetry(temperature)

    state = state_service.evaluate_asset(
        telemetry
    )

    alert = alert_service.create_alert(
        state,
        timestamp,
    )

    print("=" * 60)
    print("Temperature:", temperature)
    print("Status:", state.status)

    if alert:
        print("Severity:", alert.severity)
        print("Type:", alert.type)
        print("Message:", alert.message)
        print(
            "Recommendation:",
            alert.recommendation,
        )
    else:
        print("Alert: None")
