'use client';

import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  title: string;
}

export function CourseSelector({ courses, selected }: { courses: Course[]; selected?: string }) {
  const router = useRouter();

  return (
    <label className="admin-field" style={{ maxWidth: 320 }}>
      <span>Course</span>
      <select
        value={selected ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/student/assignments?courseId=${id}` : '/student/assignments');
        }}
      >
        <option value="">Select a course…</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
