'use client';

import type { AiSummary } from '@/types';

interface Props {
  data: AiSummary;
}

export default function AiSummaryCard({ data }: Props) {
  const qualityClass = data.datasetQuality?.toLowerCase().includes('messy') ? 'messy' : 'clean';

  return (
    <div className="ai-summary-card">
      <div className="ai-summary-header">
        <h3>AI Data Summary</h3>
        <span className={`ai-quality-badge ${qualityClass}`}>
          {data.datasetQuality || (data.dataQualityScore >= 70 ? 'CLEAN' : 'MESSY')}
        </span>
      </div>
      <p className="ai-summary-text">{data.overallSummary}</p>

      <div className="ai-summary-score">
        <div
          className="score-ring"
          style={{
            background: `conic-gradient(var(--primary) ${data.dataQualityScore}%, var(--bg) ${data.dataQualityScore}%)`,
          }}
        >
          <span>{data.dataQualityScore}</span>
        </div>
        <span className="score-label">Data Quality Score</span>
      </div>

      <div className="ai-columns">
        {data.columns.map((col) => (
          <div key={col.name} className="ai-column-row">
            <div className="ai-col-name">
              {col.name}
              {col.issues && <span className="ai-col-issues" title={col.issues}>⚠</span>}
            </div>
            <div className="ai-col-details">
              <span className={`ai-badge type-${col.type}`}>{col.type}</span>
              <span className="ai-badge">{col.completeness}% complete</span>
              <span className="ai-badge">{col.uniqueness}% unique</span>
              <span className={`ai-badge confidence-${col.mappingConfidence}`}>
                {col.mappingConfidence}
              </span>
            </div>
          </div>
        ))}
      </div>

      {data.recommendations.length > 0 && (
        <div className="ai-recommendations">
          <h4>Recommendations</h4>
          <ul>
            {data.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
