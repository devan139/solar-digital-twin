import type { Alert } from "../telemetry/types";
import { ASSET_METADATA } from "../telemetry/assets";

interface AIInsightProps {
  alert: Alert | undefined;
}

export function AIInsight({ alert }: AIInsightProps) {
  if (!alert) {
    return (
      <section
        className="ai-insight"
        aria-label="AI Operational Intelligence"
      >
        <div className="section-heading ai-header">
          <div>
            <span className="section-eyebrow">
              AI / OPERATIONAL INSIGHT
            </span>
            <h2 className="section-title">
              Operational Insight
            </h2>
          </div>
          <span className="ai-status-chip chip-standby">STANDBY</span>
        </div>

        <div className="ai-empty">
          <span className="empty-ai-icon">⬡</span>
          <div className="empty-ai-text">
            <strong>SYSTEM STATUS</strong>
            <p>No active operational anomaly detected.</p>
          </div>
        </div>

        <div className="ai-disclaimer">
          <span>
            Insight generated from deterministic telemetry and operational rules.
          </span>
        </div>
      </section>
    );
  }

  const metadata = ASSET_METADATA[alert.asset_id];

  return (
    <section
      className="ai-insight"
      aria-label="AI Operational Intelligence"
    >
      <div className="section-heading ai-header">
        <div>
          <span className="section-eyebrow">
            AI / OPERATIONAL INSIGHT
          </span>
          <h2 className="section-title">
            Operational Insight
          </h2>
        </div>
        <span className="ai-status-chip chip-active">AI ACTIVE</span>
      </div>

      <div className="ai-content">
        <div className="ai-target-header">
          <span className="ai-asset-pill">{alert.asset_id}</span>
          <span className="ai-asset-name">
            {metadata?.displayName ?? alert.asset_id}
          </span>
        </div>

        <div className="ai-blocks">
          <div className="ai-block ai-block-observation">
            <span className="ai-block-label">OBSERVATION</span>
            <p className="ai-block-text">{alert.message}</p>
          </div>

          <div className="ai-block ai-block-impact">
            <span className="ai-block-label">IMPACT</span>
            <p className="ai-block-text">
              Elevated panel temperature may reduce generation efficiency.
            </p>
          </div>

          <div className="ai-block ai-block-recommendation">
            <span className="ai-block-label">RECOMMENDATION</span>
            <p className="ai-block-text">{alert.recommendation}</p>
          </div>
        </div>
      </div>

      <div className="ai-disclaimer">
        <span>
          Insight generated from deterministic telemetry and operational rules.
        </span>
      </div>
    </section>
  );
}
