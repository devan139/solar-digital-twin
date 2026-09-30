import type { TelemetryMessage } from "../telemetry/types";

const WS_URL =
  import.meta.env.PROD
    ? "wss://solar-digital-twin-api.onrender.com/ws/telemetry"
    : "ws://127.0.0.1:8000/ws/telemetry";

export class TelemetrySocket {
  private socket: WebSocket | null = null;

  connect(
    onMessage: (message: TelemetryMessage) => void,
    onStatusChange?: (connected: boolean) => void,
  ) {
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      onStatusChange?.(true);
    };

    this.socket.onmessage = (event) => {
      const data: TelemetryMessage = JSON.parse(
        event.data,
      );

      onMessage(data);
    };

    this.socket.onclose = () => {
      onStatusChange?.(false);
    };

    this.socket.onerror = () => {
      onStatusChange?.(false);
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}