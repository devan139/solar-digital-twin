import asyncio
import json

import websockets


async def main():
    uri = "ws://127.0.0.1:8000/ws/telemetry"

    async with websockets.connect(uri) as websocket:

        for _ in range(5):
            message = await websocket.recv()

            data = json.loads(message)

            print("=" * 60)

            print("Message type:", data["type"])
            print("Timestamp:", data["timestamp"])

            print(
                "Plant power:",
                data["plant"]["current_power_kw"],
                "kW",
            )

            print(
                "Average temperature:",
                data["plant"][
                    "average_panel_temperature_c"
                ],
                "°C",
            )

            print(
                "Maximum temperature:",
                data["plant"][
                    "maximum_panel_temperature_c"
                ],
                "°C",
            )

            print(
                "Plant efficiency:",
                data["plant"][
                    "average_efficiency_pct"
                ],
                "%",
            )

            print(
                "Plant status:",
                data["plant"]["plant_status"],
            )

            print(
                "Assets:",
                len(data["assets"]),
            )

            print(
                "States:",
                len(data["states"]),
            )

            print(
                "Alerts:",
                len(data["alerts"]),
            )

            for state in data["states"]:
                print(
                    state["asset_id"],
                    "|",
                    state["status"],
                )

            for alert in data["alerts"]:
                print(
                    "ALERT:",
                    alert["severity"],
                    "|",
                    alert["asset_id"],
                    "|",
                    alert["type"],
                )


if __name__ == "__main__":
    asyncio.run(main())
