'use client';

import { useState } from 'react';
import HorizontalView from './HorizontalView';
import VerticalView from './VerticalView';

interface Props {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  mapping?: Record<string, string | null>;
}

type ViewMode = 'horizontal' | 'vertical';

export default function CSVPreview({ headers, rows, totalRows, mapping }: Props) {
  const [view, setView] = useState<ViewMode>('horizontal');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Showing {rows.length} of {totalRows} records · {headers.length} columns
        </div>
        <div className="view-toggle">
          <button className={view === 'horizontal' ? 'active' : ''} onClick={() => setView('horizontal')}>
            📋 Table
          </button>
          <button className={view === 'vertical' ? 'active' : ''} onClick={() => setView('vertical')}>
            📇 Cards
          </button>
        </div>
      </div>

      {view === 'horizontal' ? (
        <HorizontalView headers={headers} rows={rows} mapping={mapping} />
      ) : (
        <VerticalView headers={headers} rows={rows} mapping={mapping} />
      )}
    </div>
  );
}
