import type { ConnectionState, TelemetryMessage } from "../telemetry/types";

export interface TelemetrySocketOptions {
  url?: string;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterFactor?: number;
  stableConnectionMs?: number;
}

export function deriveApiBaseUrl(
  wsUrl: string,
  explicitApiUrl?: string,
): string {
  if (explicitApiUrl && explicitApiUrl.trim().length > 0) {
    return explicitApiUrl.trim().replace(/\/+$/, "");
  }
  return wsUrl
    .trim()
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/+$/, "")
    .replace(/\/ws\/telemetry$/i, "")
    .replace(/\/+$/, "");
}

export function getWebSocketUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.trim();
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    return "wss://solar-digital-twin-api.onrender.com/ws/telemetry";
  }
  return "ws://127.0.0.1:8000/ws/telemetry";
}

export function getApiBaseUrl(): string {
  const explicitApiUrl =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_API_URL
      : undefined;
  return deriveApiBaseUrl(getWebSocketUrl(), explicitApiUrl);
}


export function calculateBackoffWithJitter(
  attempt: number,
  initialDelayMs: number = 1000,
  maxDelayMs: number = 15000,
  backoffFactor: number = 1.5,
  jitterFactor: number = 0.2,
  randomFn: () => number = Math.random,
): number {
  const exponential = initialDelayMs * Math.pow(backoffFactor, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = (randomFn() * 2 - 1) * jitterFactor * capped;
  return Math.max(initialDelayMs, Math.round(capped + jitter));
}

export class TelemetrySocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private isExplicitlyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private connectionState: ConnectionState = "DISCONNECTED";

  private onMessageCallback: ((message: TelemetryMessage) => void) | null = null;
  private onStatusChangeCallback: ((connected: boolean) => void) | null = null;
  private onConnectionStateChangeCallback:
    | ((state: ConnectionState) => void)
    | null = null;
  private visibilityHandler: (() => void) | null = null;

  private options: Required<TelemetrySocketOptions>;

  constructor(options: TelemetrySocketOptions = {}) {
    this.options = {
      url: options.url ?? getWebSocketUrl(),
      initialDelayMs: options.initialDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 15000,
      backoffFactor: options.backoffFactor ?? 1.5,
      jitterFactor: options.jitterFactor ?? 0.2,
      stableConnectionMs: options.stableConnectionMs ?? 3000,
    };
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  private setConnectionState(state: ConnectionState) {
    if (this.connectionState === state) {
      return;
    }
    this.connectionState = state;
    this.onConnectionStateChangeCallback?.(state);
    this.onStatusChangeCallback?.(state === "CONNECTED");
  }

  connect(
    onMessage: (message: TelemetryMessage) => void,
    onStatusChange?: (connected: boolean) => void,
    onConnectionStateChange?: (state: ConnectionState) => void,
  ) {
    this.onMessageCallback = onMessage;
    if (onStatusChange) {
      this.onStatusChangeCallback = onStatusChange;
    }
    if (onConnectionStateChange) {
      this.onConnectionStateChangeCallback = onConnectionStateChange;
    }

    this.isExplicitlyClosed = false;

    // Browser tab visibility handling
    if (
      typeof document !== "undefined" &&
      !this.visibilityHandler
    ) {
      this.visibilityHandler = () => {
        if (
          !document.hidden &&
          !this.isExplicitlyClosed &&
          this.connectionState !== "CONNECTED"
        ) {
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.reconnectAttempts = 0;
          this.initiateConnection();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    this.initiateConnection();
  }

  private initiateConnection() {
    if (this.isExplicitlyClosed) {
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING ||
        this.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.cleanupSocket();

    try {
      this.socket = new WebSocket(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.setConnectionState("CONNECTED");

      // Mark connection stable after threshold
      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
      }
      this.stableTimer = setTimeout(() => {
        this.reconnectAttempts = 0;
      }, this.options.stableConnectionMs);
    };

    this.socket.onmessage = (event) => {
      try {
        const data: TelemetryMessage = JSON.parse(event.data);
        this.onMessageCallback?.(data);
      } catch {
        // Silently skip malformed JSON frame without crashing client
      }
    };

    this.socket.onclose = () => {
      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
        this.stableTimer = null;
      }

      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      } else {
        this.setConnectionState("DISCONNECTED");
      }
    };

    this.socket.onerror = () => {
      if (!this.isExplicitlyClosed) {
        this.setConnectionState("RECONNECTING");
      }
    };
  }

  private scheduleReconnect() {
    if (this.isExplicitlyClosed || this.reconnectTimer) {
      return;
    }

    this.setConnectionState("RECONNECTING");

    const delay = calculateBackoffWithJitter(
      this.reconnectAttempts,
      this.options.initialDelayMs,
      this.options.maxDelayMs,
      this.options.backoffFactor,
      this.options.jitterFactor,
    );

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initiateConnection();
    }, delay);
  }

  private cleanupSocket() {
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      try {
        this.socket.close();
      } catch {
        // Ignore close errors
      }
      this.socket = null;
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }

    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.cleanupSocket();
    this.setConnectionState("DISCONNECTED");
  }
}