'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface Segment {
  name: string;
  value: number;
  color: string;
}

export function CompositionDonut({
  segments,
  centerValue,
  centerLabel
}: {
  segments: Segment[];
  centerValue: number;
  centerLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="sa-empty">No data yet.</p>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={segments} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
              {segments.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1F2437' }}>{centerValue}</span>
          <span style={{ fontSize: 11, color: '#6B7285', textAlign: 'center' }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        {segments.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#6B7285' }}>{s.name}</span>
            <span style={{ fontWeight: 700, color: '#1F2437' }}>
              {s.value} ({Math.round((s.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
