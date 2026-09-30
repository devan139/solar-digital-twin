import type { TelemetryMessage } from "../telemetry/types";

export class TelemetrySocket {
  private socket: WebSocket | null = null;

  connect(
    onMessage: (message: TelemetryMessage) => void,
    onStatusChange?: (connected: boolean) => void,
  ) {
    this.socket = new WebSocket(
      "ws://127.0.0.1:8000/ws/telemetry",
    );

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
