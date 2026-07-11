'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Props {
  headers: string[];
  rows: Record<string, string>[];
  mapping?: Record<string, string | null>;
}

export default function HorizontalView({ headers, rows, mapping }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  if (rows.length === 0) {
    return <div className="message info">No data rows to display</div>;
  }

  return (
    <div className="table-wrapper" ref={parentRef} style={{ maxHeight: 600, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {headers.map((h) => (
              <th key={h}>
                {h}
                {mapping && mapping[h] && (
                  <span className="schema-hint">→ {mapping[h]}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            return (
              <tr
                key={virtualItem.index}
                style={{
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                  position: 'absolute',
                  width: '100%',
                }}
              >
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{virtualItem.index + 1}</td>
                {headers.map((h) => (
                  <td key={h} title={row[h] || ''}>{row[h] || '—'}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }} />
      )}
    </div>
  );
}
