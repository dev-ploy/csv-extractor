'use client';

interface Props {
  headers: string[];
  rows: Record<string, string>[];
  mapping?: Record<string, string | null>;
}

export default function VerticalView({ headers, rows, mapping }: Props) {
  if (rows.length === 0) {
    return <div className="message info">No data rows to display</div>;
  }

  return (
    <div className="vertical-view">
      {rows.map((row, i) => (
        <div className="record-card" key={i}>
          <div className="row-num">Record #{i + 1}</div>
          {headers.map((h) => (
            <div className="field-row" key={h}>
              <span className="field-label">
                {h}
                {mapping?.[h] && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> → {mapping[h]}</span>}
              </span>
              <span className="field-value">{row[h] || '—'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
