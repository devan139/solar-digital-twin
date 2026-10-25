import asyncio
from datetime import datetime, timezone
from pathlib import Path
import re
import unittest

from fastapi import Response

from backend.app.main import (
    ALLOWED_ORIGINS,
    app,
    health,
    health_live,
    health_ready,
    simulation_manager,
)
from backend.app.services.simulation_manager import SimulationManager
from backend.app.services.telemetry_service import TelemetryService


class MockWebSocket:
    def __init__(self):
        self.accepted = False
        self.closed = False
        self.sent_messages = []

    async def accept(self):
        self.accepted = True

    async def send_json(self, data):
        if self.closed:
            raise ConnectionResetError("Socket closed")
        self.sent_messages.append(data)

    async def close(self):
        self.closed = True


class LifecycleAndHealthTests(unittest.TestCase):
    def setUp(self):
        self.base_dir = Path(__file__).resolve().parents[2]
        self.data_file = self.base_dir / "data" / "solar_plant_sample_data.xlsx"

    # 1. Liveness endpoint test
    def test_liveness_endpoint(self):
        result = health_live()
        self.assertEqual(result["status"], "alive")
        self.assertEqual(result["service"], "solar-digital-twin-backend")
        self.assertIn("timestamp", result)

    # 2. Legacy /health endpoint test
    def test_legacy_health_endpoint(self):
        result = health()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["service"], "solar-digital-twin-backend")

    # 3. Readiness before first valid telemetry tick (not ready -> HTTP 503)
    def test_readiness_before_first_tick(self):
        manager = SimulationManager(self.data_file)
        # Initially stopped, 0 ticks
        is_ready, details = manager.get_readiness_info()
        self.assertFalse(is_ready)
        self.assertEqual(details["ticks_processed"], 0)
        self.assertEqual(details["simulator_status"], "STOPPED")

    # 4. Readiness after valid tick processed (ready -> HTTP 200)
    def test_readiness_after_valid_tick(self):
        manager = SimulationManager(self.data_file)
        # Simulate successful startup and tick execution
        manager.status = "RUNNING"
        manager.total_ticks_processed = 1
        manager.last_tick_time = datetime.now(timezone.utc)
        manager.fatal_error = None

        is_ready, details = manager.get_readiness_info()
        self.assertTrue(is_ready)
        self.assertEqual(details["simulator_status"], "RUNNING")
        self.assertEqual(details["ticks_processed"], 1)

    # 5. Readiness when simulator task has failed (HTTP 503)
    def test_readiness_when_simulator_failed(self):
        manager = SimulationManager(self.data_file)
        manager.status = "ERROR"
        manager.fatal_error = "Simulation loop crashed due to unhandled pipeline failure"

        is_ready, details = manager.get_readiness_info()
        self.assertFalse(is_ready)
        self.assertEqual(details["simulator_status"], "ERROR")
        self.assertIsNotNone(details["fatal_error"])

    # 6. Readiness when dataset failed to load (HTTP 503)
    def test_readiness_when_dataset_missing(self):
        bad_path = self.base_dir / "data" / "non_existent_file.xlsx"
        manager = SimulationManager(bad_path)
        self.assertFalse(manager.dataset_loaded)
        is_ready, details = manager.get_readiness_info()
        self.assertFalse(is_ready)
        self.assertFalse(details["dataset_loaded"])

    # 7. Graceful application shutdown and task cancellation
    def test_graceful_shutdown(self):
        async def run_shutdown_test():
            manager = SimulationManager(self.data_file)
            task = asyncio.create_task(manager.run())
            # Give task brief execution tick
            await asyncio.sleep(0.05)
            self.assertTrue(manager.running)
            self.assertEqual(manager.status, "RUNNING")

            # Shutdown cleanly
            manager.stop()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            self.assertFalse(manager.running)
            self.assertEqual(manager.status, "STOPPED")

        asyncio.run(run_shutdown_test())

    # 8. WebSocket client registration and removal
    def test_websocket_client_registration_and_removal(self):
        async def run_ws_test():
            manager = SimulationManager(self.data_file)
            client1 = MockWebSocket()
            client2 = MockWebSocket()

            # Connect clients
            await manager.connect(client1)
            await manager.connect(client2)
            self.assertEqual(len(manager.clients), 2)
            self.assertTrue(client1.accepted)
            self.assertTrue(client2.accepted)

            # Broadcast state
            test_state = {"type": "telemetry", "test": True}
            await manager.broadcast(test_state)
            self.assertEqual(len(client1.sent_messages), 1)
            self.assertEqual(len(client2.sent_messages), 1)

            # Disconnect client1
            manager.disconnect(client1)
            self.assertEqual(len(manager.clients), 1)
            self.assertNotIn(client1, manager.clients)
            self.assertIn(client2, manager.clients)

            # Client2 connection drops unexpectedly during broadcast
            client2.closed = True
            await manager.broadcast(test_state)
            # Dead client automatically pruned
            self.assertEqual(len(manager.clients), 0)

        asyncio.run(run_ws_test())

    # 9. Empty client set is valid and does not mark simulator unhealthy
    def test_empty_client_set_is_healthy(self):
        manager = SimulationManager(self.data_file)
        manager.status = "RUNNING"
        manager.total_ticks_processed = 5
        self.assertEqual(len(manager.clients), 0)

        is_ready, details = manager.get_readiness_info()
        self.assertTrue(is_ready)
        self.assertEqual(details["active_clients"], 0)

    # 10. /health/ready endpoint response contract when ready (HTTP 200)
    def test_readiness_endpoint_ready_contract(self):
        orig_status = simulation_manager.status
        orig_ticks = simulation_manager.total_ticks_processed
        orig_time = simulation_manager.last_tick_time
        orig_error = simulation_manager.fatal_error
        try:
            simulation_manager.status = "RUNNING"
            simulation_manager.total_ticks_processed = 42
            simulation_manager.last_tick_time = datetime.now(timezone.utc)
            simulation_manager.fatal_error = None

            res = Response()
            payload = health_ready(res)

            self.assertEqual(res.status_code, 200)
            self.assertTrue(payload["ready"])
            self.assertEqual(payload["status"], "ready")
            self.assertEqual(payload["service"], "solar-digital-twin-backend")
            self.assertIn("timestamp", payload)
            self.assertIn("details", payload)
            self.assertTrue(payload["details"]["dataset_loaded"])
            self.assertEqual(payload["details"]["simulator_status"], "RUNNING")
            self.assertEqual(payload["details"]["ticks_processed"], 42)
            self.assertIn("last_tick_time", payload["details"])
            self.assertIn("active_clients", payload["details"])
            self.assertNotIn("reason", payload)
        finally:
            simulation_manager.status = orig_status
            simulation_manager.total_ticks_processed = orig_ticks
            simulation_manager.last_tick_time = orig_time
            simulation_manager.fatal_error = orig_error

    # 11. /health/ready endpoint response contract when not ready (HTTP 503)
    def test_readiness_endpoint_not_ready_contract(self):
        orig_status = simulation_manager.status
        orig_ticks = simulation_manager.total_ticks_processed
        orig_time = simulation_manager.last_tick_time
        orig_error = simulation_manager.fatal_error
        try:
            simulation_manager.status = "STOPPED"
            simulation_manager.total_ticks_processed = 0
            simulation_manager.last_tick_time = None
            simulation_manager.fatal_error = None

            res = Response()
            payload = health_ready(res)

            self.assertEqual(res.status_code, 503)
            self.assertFalse(payload["ready"])
            self.assertEqual(payload["status"], "not_ready")
            self.assertEqual(payload["service"], "solar-digital-twin-backend")
            self.assertIn("timestamp", payload)
            self.assertIn("reason", payload)
            self.assertTrue(len(payload["reason"]) > 0)
            self.assertIn("details", payload)
            self.assertEqual(payload["details"]["simulator_status"], "STOPPED")
        finally:
            simulation_manager.status = orig_status
            simulation_manager.total_ticks_processed = orig_ticks
            simulation_manager.last_tick_time = orig_time
            simulation_manager.fatal_error = orig_error

    # 12. CORS explicit origins and security policy test
    def test_cors_configuration(self):
        # 1. Deployed GitHub Pages origin
        self.assertIn("https://devan139.github.io", ALLOWED_ORIGINS)
        # 2. Local development origins
        self.assertIn("http://localhost:5173", ALLOWED_ORIGINS)
        self.assertIn("http://127.0.0.1:5173", ALLOWED_ORIGINS)
        self.assertIn("http://localhost:3000", ALLOWED_ORIGINS)
        self.assertIn("http://127.0.0.1:3000", ALLOWED_ORIGINS)
        self.assertIn("http://localhost:4173", ALLOWED_ORIGINS)
        self.assertIn("http://127.0.0.1:4173", ALLOWED_ORIGINS)

        # 3. Wildcard origin must not be present
        self.assertNotIn("*", ALLOWED_ORIGINS)

        # 4. Check CORSMiddleware options on FastAPI app
        cors_middlewares = [
            m for m in app.user_middleware if "CORSMiddleware" in str(m.cls)
        ]
        self.assertTrue(len(cors_middlewares) > 0)
        options = cors_middlewares[0].kwargs

        # Credentials must be disabled unless demonstrably needed
        self.assertFalse(options["allow_credentials"])

        # Allowed origin regex matches GitHub Pages pattern securely
        origin_regex = options.get("allow_origin_regex")
        self.assertIsNotNone(origin_regex)
        compiled = re.compile(origin_regex)
        self.assertTrue(bool(compiled.match("https://devan139.github.io")))
        self.assertTrue(bool(compiled.match("https://any-fork.github.io")))
        self.assertFalse(bool(compiled.match("https://malicious.com")))
        self.assertFalse(bool(compiled.match("http://devan139.github.io")))


if __name__ == "__main__":
    unittest.main()
