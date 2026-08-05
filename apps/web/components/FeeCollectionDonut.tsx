'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export function FeeCollectionDonut({ collected, outstanding }: { collected: number; outstanding: number }) {
  const total = collected + outstanding;
  if (total === 0) {
    return <p className="sa-empty">No invoices issued yet this year.</p>;
  }

  const data = [
    { name: 'Collected', value: collected, color: '#22C55E' },
    { name: 'Outstanding', value: outstanding, color: '#3B82F6' }
  ];

  const formatKes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n.toLocaleString());

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={60} outerRadius={85} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
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
          <span style={{ fontSize: 11, color: '#6B7285', fontWeight: 600 }}>KES</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1F2437' }}>{formatKes(collected)}</span>
          <span style={{ fontSize: 11, color: '#6B7285' }}>Collected</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: d.color, flexShrink: 0 }} />
            <span style={{ color: '#6B7285' }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: '#1F2437' }}>
              KES {d.value.toLocaleString()} ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid #E6E8F2' }}>
          <span style={{ color: '#6B7285' }}>Total Invoiced</span>
          <span style={{ fontWeight: 700, color: '#1F2437' }}>KES {total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
