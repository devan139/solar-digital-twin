import type { Alert } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

interface AlertCenterProps {
  alerts: Alert[];
}

export function AlertCenter({
  alerts,
}: AlertCenterProps) {
  return (
    <section className="alert-center">
      <div className="section-heading">
        <span>OPERATIONS</span>
        <h2>Active Alerts</h2>
      </div>

      {alerts.length === 0 ? (
        <div className="alert-empty">
          No active alerts
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
                      ).toLocaleTimeString()}
                    </span>
                  </div>

                  <h3>
                    {metadata?.displayName ??
                      alert.asset_id}
                  </h3>

                  <p>
                    {alert.message}
                  </p>

                  <small>
                    {alert.recommendation}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
