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
      <section className="ai-insight" aria-label="AI-Assisted Operational Diagnostics">
        <div className="section-heading ai-header">
          <div>
            <span className="section-eyebrow">DIAGNOSTIC ENGINE</span>
            <h2 className="section-title">Operational Insight</h2>
          </div>
          <span className="ai-chip ai-chip-standby">STANDBY</span>
        </div>

        <div className="ai-empty">
          <span className="empty-ai-icon">⚡</span>
          <div>
            <strong>DIAGNOSTIC MONITOR ACTIVE</strong>
            <p>No operational anomalies detected across telemetry streams.</p>
          </div>
        </div>

        <small className="ai-disclaimer">
          Automated reasoning based on real-time sensor limits and operational rules.
        </small>
      </section>
    );
  }

  const metadata =
    ASSET_METADATA[alert.asset_id];

  return (
    <section className="ai-insight" aria-label="AI-Assisted Operational Diagnostics">
      <div className="section-heading ai-header">
        <div>
          <span className="section-eyebrow">DIAGNOSTIC ENGINE</span>
          <h2 className="section-title">Operational Insight</h2>
        </div>
        <span className="ai-chip ai-chip-active">AI ACTIVE</span>
      </div>

      <div className="ai-content">
        <div className="ai-badge">
          AI
        </div>

        <div className="ai-body">
          <div className="ai-target-asset">
            <span className="ai-asset-tag">{alert.asset_id}</span>
            <h3 className="ai-asset-name">
              {metadata?.displayName ??
                alert.asset_id}
            </h3>
          </div>

          <p className="ai-message">
            {alert.message}
          </p>

          <div className="ai-callout-grid">
            <div className="ai-detail ai-impact">
              <span className="ai-detail-label">Potential impact</span>
              <strong className="ai-detail-text">
                Elevated panel temperature may reduce generation efficiency.
              </strong>
            </div>

            <div className="ai-detail ai-action">
              <span className="ai-detail-label">Recommended action</span>
              <strong className="ai-detail-text">
                {alert.recommendation}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <small className="ai-disclaimer">
        Insight generated from deterministic telemetry and operational rules.
      </small>
    </section>
  );
}
