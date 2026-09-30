from pathlib import Path

from backend.app.models.plant_telemetry import PlantTelemetry
from backend.app.models.telemetry import Telemetry
from backend.simulator.data_loader import TelemetryDataLoader
from backend.simulator.simulator import TelemetrySimulator
from backend.simulator.scenario import ScenarioConfig


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_FILE = (
    BASE_DIR
    / "data"
    / "solar_plant_sample_data.xlsx"
)


loader = TelemetryDataLoader(DATA_FILE)

sensor_records: list[Telemetry] = (
    loader.load_sensor_telemetry()
)

plant_records: list[PlantTelemetry] = (
    loader.load_plant_telemetry()
)


scenario = ScenarioConfig(
    enabled=True,
    asset_id="ARRAY_04",
    warning_after_ticks=2,
    critical_after_ticks=4,
)

simulator = TelemetrySimulator(
    sensor_records=sensor_records,
    plant_records=plant_records,
    mode="demo",
    speed_multiplier=1.0,
    loop=False,
    scenario=scenario,
)


for _ in range(5):
    state = simulator.get_current_state()

    plant = state["plant"]
    assets = state["assets"]

    print("=" * 60)

    print("Simulation timestamp:", plant.timestamp)
    print("Plant power:", plant.current_power_kw)
    print("Plant status:", plant.plant_status)
    print("Assets:", len(assets))
    print(
        "Next interval:",
        simulator.get_interval_seconds(),
        "seconds",
    )

    for asset in assets:
        print(
            asset.asset_id,
            "| Power:", asset.power_kw,
            "| Temp:", asset.panel_temperature_c,
            "| Status:", asset.status,
        )

    simulator.advance()
