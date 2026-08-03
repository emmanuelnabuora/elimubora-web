'use client';

import { useRouter } from 'next/navigation';

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
}

export function ClassDateSelector({
  classStreams,
  selectedClassStreamId,
  date
}: {
  classStreams: ClassStream[];
  selectedClassStreamId?: string;
  date: string;
}) {
  const router = useRouter();

  function navigate(nextClassStreamId: string, nextDate: string) {
    if (!nextClassStreamId) {
      router.push('/teacher/attendance');
      return;
    }
    router.push(`/teacher/attendance?classStreamId=${nextClassStreamId}&date=${nextDate}`);
  }

  return (
    <div className="admin-form-row" style={{ marginBottom: 'var(--eb-space-2)' }}>
      <label className="admin-field">
        <span>Class</span>
        <select value={selectedClassStreamId ?? ''} onChange={(e) => navigate(e.target.value, date)}>
          <option value="">Select a class…</option>
          {classStreams.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.gradeLevel})
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => selectedClassStreamId && navigate(selectedClassStreamId, e.target.value)}
          disabled={!selectedClassStreamId}
        />
      </label>
    </div>
  );
}
