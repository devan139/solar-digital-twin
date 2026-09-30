from pathlib import Path

from backend.simulator.data_loader import TelemetryDataLoader
from backend.simulator.simulator import TelemetrySimulator


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_FILE = (
    BASE_DIR
    / "data"
    / "solar_plant_sample_data.xlsx"
)


def main():
    loader = TelemetryDataLoader(DATA_FILE)

    sensor_records = loader.load_sensor_telemetry()
    plant_records = loader.load_plant_telemetry()

    simulator = TelemetrySimulator(
        sensor_records=sensor_records,
        plant_records=plant_records,
        mode="demo",
        speed_multiplier=1.0,
        loop=True,
    )

    print("Solar Plant Telemetry Simulator")
    print("--------------------------------")
    print("Mode: DEMO")
    print("Speed: 1x")
    print("Interval: 1 second")
    print("Press CTRL+C to stop.")
    print()

    try:
        while True:
            state = simulator.get_current_state()

            plant = state["plant"]
            assets = state["assets"]

            print(
                f"[{plant.timestamp}] "
                f"Power: {plant.current_power_kw:.2f} kW | "
                f"Avg Temp: "
                f"{plant.average_panel_temperature_c:.2f} °C | "
                f"Max Temp: "
                f"{plant.maximum_panel_temperature_c:.2f} °C | "
                f"Efficiency: "
                f"{plant.average_efficiency_pct:.2f}% | "
                f"Status: {plant.plant_status}"
            )

            print(
                "Assets:",
                ", ".join(
                    f"{asset.asset_id}="
                    f"{asset.power_kw:.1f}kW"
                    for asset in assets
                ),
            )

            print()

            simulator.advance()

            import time

            time.sleep(
                simulator.get_interval_seconds()
            )

    except KeyboardInterrupt:
        print()
        print("Simulator stopped.")


if __name__ == "__main__":
    main()
