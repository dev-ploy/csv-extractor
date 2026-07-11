'use client';

import type { SessionSummary } from '@/types';

interface Props {
  summary: SessionSummary;
  onReset: () => void;
}

export default function ImportSummary({ summary, onReset }: Props) {
  return (
    <div>
      <div className="summary-grid">
        <div className="stat-card total">
          <div className="stat-value">{summary.total}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-card imported">
          <div className="stat-value">{summary.imported}</div>
          <div className="stat-label">Imported</div>
        </div>
        <div className="stat-card skipped">
          <div className="stat-value">{summary.skipped}</div>
          <div className="stat-label">Skipped</div>
        </div>
        <div className="stat-card total">
          <div className="stat-value">{summary.parsed}</div>
          <div className="stat-label">Parsed</div>
        </div>
      </div>

      <div className="message success">
        Import completed for <strong>{summary.filename}</strong> — {summary.imported} records imported, {summary.skipped} skipped.
      </div>

      <div className="action-bar">
        <button className="btn btn-primary" onClick={onReset}>
          Upload Another CSV
        </button>
      </div>
    </div>
  );
}
