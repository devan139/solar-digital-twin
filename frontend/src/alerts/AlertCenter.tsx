import type { Alert } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

interface AlertCenterProps {
  alerts: Alert[];
}

export function AlertCenter({
  alerts,
}: AlertCenterProps) {
  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");

  return (
    <section className="alert-center" aria-label="Active Facility Alerts">
      <div className="section-heading alert-header">
        <div>
          <span className="section-eyebrow">OPERATIONS LOG</span>
          <h2 className="section-title">Active Alerts</h2>
        </div>

        <span
          className={`alert-count-pill ${
            alerts.length === 0
              ? "count-nominal"
              : hasCritical
              ? "count-critical"
              : "count-warning"
          }`}
        >
          {alerts.length === 0 ? "0 ACTIVE" : `${alerts.length} ACTIVE`}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="alert-empty">
          <span className="empty-nominal-dot" />
          <div>
            <strong>ALL SYSTEMS NOMINAL</strong>
            <p>No active anomalies or threshold exceedances.</p>
          </div>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => {
            const metadata =
              ASSET_METADATA[alert.asset_id];

            return (
              <article
                key={alert.id}
                className={`alert-item ${alert.severity.toLowerCase()}`}
              >
                <div className="alert-indicator">
                  {alert.severity === "CRITICAL"
                    ? "●"
                    : "▲"}
                </div>

                <div className="alert-content">
                  <div className="alert-topline">
                    <span className="alert-severity">
                      {alert.severity}
                    </span>

                    <span className="alert-time">
                      {new Date(
                        alert.timestamp,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>

                  <h3 className="alert-asset-title">
                    {metadata?.displayName ??
                      alert.asset_id}
                  </h3>

                  <p className="alert-message">
                    {alert.message}
                  </p>

                  <div className="alert-recommendation">
                    <span className="rec-tag">ACTION</span>
                    <small>
                      {alert.recommendation}
                    </small>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
