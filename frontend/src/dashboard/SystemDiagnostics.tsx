import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../services/telemetrySocket";
import type { ConnectionState, SimulatorState } from "../telemetry/types";

interface SystemDiagnosticsProps {
  connectionState: ConnectionState;
  simulatorStatus?: SimulatorState;
  tickIntervalMs: number | null;
  lastTickTime: string | null;
  freshCount: number;
  staleCount: number;
  unavailCount: number;
  onViewOverview?: () => void;
}

type ReadinessState = "READY" | "INITIALIZING" | "UNAVAILABLE";

export function SystemDiagnostics({
  connectionState,
  simulatorStatus = "UNKNOWN",
  tickIntervalMs,
  lastTickTime,
  freshCount,
  staleCount,
  unavailCount,
  onViewOverview,
}: SystemDiagnosticsProps) {
  const [readiness, setReadiness] = useState<ReadinessState>("UNAVAILABLE");
  const [readinessNote, setReadinessNote] = useState<string>("Checking readiness...");

  useEffect(() => {
    let isMounted = true;
    const apiBase = getApiBaseUrl();

    async function checkReadiness() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const response = await fetch(`${apiBase}/health/ready`, {
          signal: controller.signal,
        });

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (!data) {
            setReadiness("UNAVAILABLE");
            setReadinessNote("Readiness probe returned malformed JSON");
            return;
          }
          if (data.ready === true || data.status === "ready") {
            setReadiness("READY");
            setReadinessNote("Pipeline actively ingesting & serving telemetry");
            return;
          }
          setReadiness("UNAVAILABLE");
          setReadinessNote(data.reason ?? "Readiness probe reported not ready");
          return;
        }

        if (response.status === 503) {
          const data = await response.json().catch(() => null);
          const reason =
            data?.reason ??
            (Array.isArray(data?.reasons) ? data.reasons.join(", ") : undefined);

          if (
            data?.details?.simulator_status === "ERROR" ||
            data?.details?.fatal_error ||
            reason?.toLowerCase().includes("fatal")
          ) {
            setReadiness("UNAVAILABLE");
            setReadinessNote(reason ?? "Simulator encountered fatal error");
            return;
          }

          setReadiness("INITIALIZING");
          setReadinessNote(
            reason ?? "Initial telemetry tick still processing",
          );
          return;
        }

        setReadiness("UNAVAILABLE");
        setReadinessNote(`Readiness probe returned HTTP ${response.status}`);
      } catch (err) {
        if (!isMounted) return;
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          setReadiness("UNAVAILABLE");
          setReadinessNote("Readiness probe timed out (no response within 4s)");
        } else {
          setReadiness("UNAVAILABLE");
          setReadinessNote("Readiness probe unreachable (network error)");
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    checkReadiness();
    const interval = setInterval(checkReadiness, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const rateDisplay =
    tickIntervalMs !== null && tickIntervalMs > 0
      ? `${(1000 / tickIntervalMs).toFixed(1)} Hz (${Math.round(tickIntervalMs)}ms)`
      : "—";

  const formattedLastTick = lastTickTime
    ? new Date(lastTickTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <section
      className="system-diagnostics"
      aria-label="System Diagnostics and Telemetry Health"
    >
      <div className="section-heading diag-header">
        <div>
          <span className="section-eyebrow">
            SYSTEM DIAGNOSTICS &bull; RUNTIME
          </span>
          <h2 className="section-title">Backend &amp; Ingestion Health</h2>
        </div>
        <div className="diag-header-actions">
          {onViewOverview && (
            <button
              type="button"
              className="diag-arch-btn"
              onClick={onViewOverview}
              title="Inspect End-to-End System Architecture (Alt+2)"
            >
              <span className="btn-icon">⎇</span>
              <span>Overview</span>
            </button>
          )}
          <span
            className={`diag-status-chip chip-${readiness.toLowerCase()}`}
          >
            {readiness}
          </span>
        </div>
      </div>

      <div className="diag-content">
        <div className="diag-grid">
          {/* 1. API Readiness */}
          <div className="diag-metric-item">
            <span className="diag-label">API Readiness</span>
            <div className="diag-val-row">
              <span
                className={`diag-dot dot-${readiness.toLowerCase()}`}
              />
              <strong className="diag-value">{readiness}</strong>
            </div>
            <small className="diag-subtext">{readinessNote}</small>
          </div>

          {/* 2. Simulator Task */}
          <div className="diag-metric-item">
            <span className="diag-label">Simulation Engine</span>
            <div className="diag-val-row">
              <span
                className={`diag-dot dot-${simulatorStatus.toLowerCase()}`}
              />
              <strong className="diag-value">{simulatorStatus}</strong>
            </div>
            <small className="diag-subtext">
              {simulatorStatus === "RUNNING"
                ? "Physical model background task active"
                : simulatorStatus === "ERROR"
                ? "Simulator encountered fatal exception"
                : "Simulation loop paused or stopped"}
            </small>
          </div>

          {/* 3. WebSocket Session */}
          <div className="diag-metric-item">
            <span className="diag-label">WebSocket Transport</span>
            <div className="diag-val-row">
              <span
                className={`diag-dot dot-${connectionState.toLowerCase()}`}
              />
              <strong className="diag-value">{connectionState}</strong>
            </div>
            <small className="diag-subtext">
              {connectionState === "CONNECTED"
                ? "Full-duplex telemetry socket open"
                : connectionState === "RECONNECTING"
                ? "Exponential backoff active"
                : "Socket closed / idle"}
            </small>
          </div>

          {/* 4. Telemetry Tick Cadence */}
          <div className="diag-metric-item">
            <span className="diag-label">Observed Cadence</span>
            <div className="diag-val-row">
              <strong className="diag-value font-mono">{rateDisplay}</strong>
            </div>
            <small className="diag-subtext">
              Last tick: {formattedLastTick}
            </small>
          </div>
        </div>

        {/* Fleet Freshness Summary */}
        <div className="diag-freshness-summary">
          <span className="summary-title">Fleet Freshness Breakdown:</span>
          <div className="summary-pills">
            <span className="freshness-pill pill-fresh">
              {freshCount} FRESH
            </span>
            <span className="freshness-pill pill-stale">
              {staleCount} STALE
            </span>
            <span className="freshness-pill pill-unavail">
              {unavailCount} UNAVAILABLE
            </span>
          </div>
        </div>
      </div>

      <div className="diag-footer">
        <span>PROBE: /health/ready</span>
        <span>AUTH: PUBLIC</span>
        <span>RATE: DERIVED</span>
      </div>
    </section>
  );
}
