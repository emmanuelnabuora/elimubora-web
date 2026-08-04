'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface GradedPoint {
  gradedAt: string;
  percentage: number;
}

export function ClassPerformanceChart({ points }: { points: GradedPoint[] }) {
  if (points.length === 0) {
    return <p className="admin-empty">No graded work yet — the trend will appear once you grade some submissions.</p>;
  }

  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const p of points) {
    const key = p.gradedAt.slice(0, 7); // YYYY-MM
    const entry = byMonth.get(key) ?? { sum: 0, count: 0 };
    entry.sum += p.percentage;
    entry.count += 1;
    byMonth.set(key, entry);
  }

  const data = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, { sum, count }]) => ({
      month: new Date(month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' }),
      average: Math.round(sum / count)
    }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5546e8" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#5546e8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--eb-line)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--eb-fg-muted)' }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'var(--eb-fg-muted)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip formatter={(v) => [`${v}%`, 'Class average']} />
        <Area type="monotone" dataKey="average" stroke="#5546e8" strokeWidth={2} fill="url(#scoreFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
