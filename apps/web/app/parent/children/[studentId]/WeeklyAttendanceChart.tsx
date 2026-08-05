'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AttendanceRecord {
  attendanceDate: string;
  status: string;
}

/** Monday of the week containing this date, as a stable grouping key. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabel(weekStartDate: string): string {
  const d = new Date(weekStartDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function WeeklyAttendanceChart({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return <p className="admin-empty">No attendance recorded yet.</p>;
  }

  const byWeek = new Map<string, { present: number; total: number }>();
  for (const r of records) {
    const key = weekStart(r.attendanceDate);
    const entry = byWeek.get(key) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (r.status === 'present') entry.present += 1;
    byWeek.set(key, entry);
  }

  const data = Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, { present, total }]) => ({
      week: weekLabel(week),
      rate: Math.round((present / total) * 100)
    }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--eb-line)" />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--eb-fg-muted)' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--eb-fg-muted)' }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} cursor={{ fill: 'var(--eb-line)' }} />
        <Bar dataKey="rate" fill="#22C55E" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
