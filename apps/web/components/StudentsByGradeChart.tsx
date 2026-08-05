'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const GRADE_ORDER = ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export function StudentsByGradeChart({ counts }: { counts: Record<string, number> }) {
  const data = GRADE_ORDER.filter((g) => (counts[g] ?? 0) > 0).map((grade) => ({
    grade,
    count: counts[grade] ?? 0
  }));

  if (data.length === 0) {
    return <p className="sa-empty">No students enrolled with a class assignment yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E8F2" />
        <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#687089' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#687089' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Bar dataKey="count" fill="#5B4CF5" radius={[6, 6, 0, 0]}>
          <LabelList dataKey="count" position="top" style={{ fill: '#12182a', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
