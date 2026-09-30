import type { Alert } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

interface AIInsightProps {
  alert: Alert | undefined;
}

export function AIInsight({
  alert,
}: AIInsightProps) {
  if (!alert) {
    return (
      <section className="ai-insight">
        <div className="section-heading">
          <span>AI-ASSISTED ANALYSIS</span>
          <h2>Operational Insight</h2>
        </div>

        <div className="ai-empty">
          No active operational anomaly detected.
        </div>
      </section>
    );
  }

  const metadata =
    ASSET_METADATA[alert.asset_id];

  return (
    <section className="ai-insight">
      <div className="section-heading">
        <span>AI-ASSISTED ANALYSIS</span>
        <h2>Operational Insight</h2>
      </div>

      <div className="ai-content">
        <div className="ai-badge">
          AI
        </div>

        <div>
          <h3>
            {metadata?.displayName ??
              alert.asset_id}
          </h3>

          <p>
            {alert.message}
          </p>

          <div className="ai-detail">
            <span>Potential impact</span>

            <strong>
              Elevated panel temperature may
              reduce generation efficiency.
            </strong>
          </div>

          <div className="ai-detail">
            <span>Recommended action</span>

            <strong>
              {alert.recommendation}
            </strong>
          </div>
        </div>
      </div>

      <small className="ai-disclaimer">
        Insight generated from deterministic
        telemetry and operational rules.
      </small>
    </section>
  );
}
