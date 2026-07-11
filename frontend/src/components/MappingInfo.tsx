'use client';

interface Props {
  mapping: Record<string, string | null>;
  strategy: string;
}

export default function MappingInfo({ mapping, strategy }: Props) {
  const mapped = Object.entries(mapping).filter(([, v]) => v !== null);
  const unmapped = Object.entries(mapping).filter(([, v]) => v === null);

  return (
    <div style={{ margin: '12px 0' }}>
      <div className="message info">
        Mapping completed via <strong>{strategy}</strong> strategy &middot; {mapped.length} headers mapped, {unmapped.length} unmapped
      </div>
      {unmapped.length > 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Unmapped columns: {unmapped.map(([h]) => h).join(', ')}
        </div>
      )}
    </div>
  );
}
