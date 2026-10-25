import { describe, it } from "node:test";
import assert from "node:assert";

import {
  calculateBackoffWithJitter,
  deriveApiBaseUrl,
  TelemetrySocket,
} from "../src/services/telemetrySocket.ts";

describe("TelemetrySocket Reconnection and Backoff", () => {
  it("calculates exponential backoff progression deterministically when jitter is zero", () => {
    // Fake random that returns 0.5 -> jitter is exactly 0
    const zeroJitter = () => 0.5;

    const b0 = calculateBackoffWithJitter(0, 1000, 15000, 1.5, 0.2, zeroJitter);
    const b1 = calculateBackoffWithJitter(1, 1000, 15000, 1.5, 0.2, zeroJitter);
    const b2 = calculateBackoffWithJitter(2, 1000, 15000, 1.5, 0.2, zeroJitter);
    const b3 = calculateBackoffWithJitter(3, 1000, 15000, 1.5, 0.2, zeroJitter);

    assert.strictEqual(b0, 1000);
    assert.strictEqual(b1, 1500);
    assert.strictEqual(b2, 2250);
    assert.strictEqual(b3, 3375);
  });

  it("caps backoff delay at maxDelayMs", () => {
    const zeroJitter = () => 0.5;
    // High attempt number (e.g. 20)
    const b20 = calculateBackoffWithJitter(20, 1000, 15000, 1.5, 0.2, zeroJitter);
    assert.strictEqual(b20, 15000);
  });

  it("applies jitter within specified bounds", () => {
    // Min jitter (random = 0.0 -> -20% jitter)
    const minJitter = () => 0.0;
    const bMin = calculateBackoffWithJitter(2, 1000, 15000, 1.5, 0.2, minJitter);
    // 2250 - (0.2 * 2250) = 1800
    assert.strictEqual(bMin, 1800);

    // Max jitter (random = 1.0 -> +20% jitter)
    const maxJitter = () => 1.0;
    const bMax = calculateBackoffWithJitter(2, 1000, 15000, 1.5, 0.2, maxJitter);
    // 2250 + (0.2 * 2250) = 2700
    assert.strictEqual(bMax, 2700);
  });

  it("initializes with DISCONNECTED state and 0 reconnect attempts", () => {
    const socket = new TelemetrySocket({ url: "ws://127.0.0.1:9999/ws/mock" });
    assert.strictEqual(socket.getConnectionState(), "DISCONNECTED");
    assert.strictEqual(socket.getReconnectAttempts(), 0);
  });

  it("intentional disconnect leaves socket in DISCONNECTED state", () => {
    const socket = new TelemetrySocket({ url: "ws://127.0.0.1:9999/ws/mock" });
    socket.disconnect();
    assert.strictEqual(socket.getConnectionState(), "DISCONNECTED");
  });
});

describe("API Base URL Derivation", () => {
  it("derives http:// from local ws:// telemetry URL", () => {
    const url = deriveApiBaseUrl("ws://127.0.0.1:8000/ws/telemetry");
    assert.strictEqual(url, "http://127.0.0.1:8000");
  });

  it("derives https:// from production Render wss:// telemetry URL", () => {
    const url = deriveApiBaseUrl(
      "wss://solar-digital-twin-api.onrender.com/ws/telemetry",
    );
    assert.strictEqual(url, "https://solar-digital-twin-api.onrender.com");
  });

  it("strips trailing slashes from ws URL paths", () => {
    const url = deriveApiBaseUrl(
      "wss://solar-digital-twin-api.onrender.com/ws/telemetry///",
    );
    assert.strictEqual(url, "https://solar-digital-twin-api.onrender.com");
  });

  it("prefers explicit API URL over WebSocket URL and trims trailing slashes", () => {
    const url = deriveApiBaseUrl(
      "ws://127.0.0.1:8000/ws/telemetry",
      "https://custom-api.example.com///",
    );
    assert.strictEqual(url, "https://custom-api.example.com");
  });

  it("handles whitespace in inputs safely", () => {
    const url = deriveApiBaseUrl(
      "  ws://localhost:8000/ws/telemetry  ",
    );
    assert.strictEqual(url, "http://localhost:8000");
  });
});
