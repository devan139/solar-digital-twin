import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.services.simulation_manager import SimulationManager
from backend.app.services.telemetry_service import TelemetryService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("solar_twin.api")

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = BASE_DIR / "data" / "solar_plant_sample_data.xlsx"

telemetry_service = TelemetryService(DATA_FILE)
simulation_manager = SimulationManager(DATA_FILE)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Solar Plant Digital Twin API (PID %d)...", os.getpid())
    sim_task = asyncio.create_task(simulation_manager.run())
    try:
        yield
    finally:
        logger.info("Shutting down Solar Plant Digital Twin API...")
        simulation_manager.stop()
        sim_task.cancel()
        try:
            await sim_task
        except (asyncio.CancelledError, Exception):
            pass
        logger.info("Simulator task terminated cleanly.")


app = FastAPI(
    title="Solar Plant Digital Twin API",
    version="0.2.0",
    lifespan=lifespan,
)

DEFAULT_ALLOWED_ORIGINS = [
    "https://devan139.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

# Allow runtime customization via environment variable (comma-separated origins)
extra_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ALLOWED_ORIGINS + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://[a-zA-Z0-9-]+\.github\.io$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health/live")
def health_live():
    """Process liveness probe.

    Confirms the API process is alive and able to accept HTTP connections.
    """
    return {
        "status": "alive",
        "service": "solar-digital-twin-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/ready")
def health_ready(response: Response):
    """Application readiness probe.

    Reports whether the service has successfully loaded its dataset and is actively
    processing and publishing real-time telemetry. Returns HTTP 503 if not ready.
    """
    is_ready, details = simulation_manager.get_readiness_info()
    payload = {
        "ready": is_ready,
        "status": "ready" if is_ready else "not_ready",
        "service": "solar-digital-twin-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {
            "dataset_loaded": details["dataset_loaded"],
            "simulator_status": details["simulator_status"],
            "ticks_processed": details["ticks_processed"],
            "last_tick_time": details["last_tick_time"],
            "active_clients": details["active_clients"],
        },
    }


    if not is_ready:
        response.status_code = 503
        if details.get("fatal_error"):
            payload["reason"] = "Simulator encountered fatal error"
        elif not details.get("dataset_loaded"):
            payload["reason"] = "Dataset failed to load"
        elif details.get("ticks_processed", 0) == 0:
            payload["reason"] = "Initial telemetry tick still processing"
        else:
            payload["reason"] = f"Simulator is {details.get('simulator_status', 'UNKNOWN')}"

    return payload


@app.get("/health")
def health():
    """Legacy shallow health check for backward compatibility."""
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
    except (WebSocketDisconnect, Exception) as exc:
        logger.debug("WebSocket client disconnected: %s", exc)
    finally:
        simulation_manager.disconnect(websocket)
