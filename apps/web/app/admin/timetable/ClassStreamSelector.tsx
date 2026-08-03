'use client';

import { useRouter } from 'next/navigation';

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: number;
}

export function ClassStreamSelector({
  classStreams,
  selected
}: {
  classStreams: ClassStream[];
  selected?: string;
}) {
  const router = useRouter();

  return (
    <label className="admin-field" style={{ maxWidth: 320 }}>
      <span>Class</span>
      <select
        value={selected ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/admin/timetable?classStreamId=${id}` : '/admin/timetable');
        }}
      >
        <option value="">Select a class…</option>
        {classStreams.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.gradeLevel})
          </option>
        ))}
      </select>
    </label>
  );
}
