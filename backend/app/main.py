import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket
from backend.app.services.telemetry_service import TelemetryService
from backend.app.services.simulation_manager import SimulationManager


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = BASE_DIR / "data" / "solar_plant_sample_data.xlsx"

telemetry_service = TelemetryService(DATA_FILE)
simulation_manager = SimulationManager(DATA_FILE)

app = FastAPI(
    title="Solar Plant Digital Twin API",
    version="0.1.0",
)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(
        simulation_manager.run()
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "solar-digital-twin-backend",
    }


@app.get("/assets")
def get_assets():
    return {
        "assets": telemetry_service.get_asset_ids()
    }


@app.get("/telemetry/latest")
def get_latest_telemetry():
    return telemetry_service.get_latest()


@app.get("/telemetry/{asset_id}")
def get_asset_telemetry(asset_id: str):
    return telemetry_service.get_asset_telemetry(asset_id)


@app.get("/assets/{asset_id}")
def get_asset(asset_id: str):
    asset = telemetry_service.get_asset(asset_id)

    if asset is None:
        raise HTTPException(
            status_code=404,
            detail=f"Asset '{asset_id}' not found",
        )

    return asset


@app.get("/telemetry/plant/latest")
def get_latest_plant_telemetry():
    return telemetry_service.get_latest_plant_telemetry()


@app.get("/telemetry/plant")
def get_plant_telemetry():
    return telemetry_service.get_plant_telemetry()


@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await simulation_manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()

    except Exception:
        simulation_manager.disconnect(websocket)
