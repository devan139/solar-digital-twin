import type { Alert } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

interface AlertCenterProps {
  alerts: Alert[];
}

export function AlertCenter({ alerts }: AlertCenterProps) {
  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");

  return (
    <section className="alert-center" aria-label="Operational Alert Log">
      <div className="section-heading alert-header">
        <div>
          <span className="section-eyebrow">OPERATIONS MONITOR</span>
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
          <div className="empty-text-wrap">
            <strong>ALL SYSTEMS NOMINAL</strong>
            <p>Plant operating within safe parameters. No active alerts.</p>
          </div>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => {
            const metadata = ASSET_METADATA[alert.asset_id];

            return (
              <article
                key={alert.id}
                className={`alert-item alert-${alert.severity.toLowerCase()}`}
              >
                <div className="alert-topline">
                  <span
                    className={`alert-severity-badge severity-${alert.severity.toLowerCase()}`}
                  >
                    <span className="severity-dot" />
                    {alert.severity}
                  </span>

                  <span className="alert-time">
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>

                <div className="alert-body">
                  <div className="alert-asset-line">
                    <span className="alert-asset-id">
                      {alert.asset_id}
                    </span>
                    <h3 className="alert-asset-name">
                      {metadata?.displayName ?? alert.asset_id}
                    </h3>
                  </div>

                  <p className="alert-message">{alert.message}</p>

                  <div className="alert-recommendation">
                    <span className="rec-prefix">RECOMMENDATION</span>
                    <p className="rec-text">{alert.recommendation}</p>
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
