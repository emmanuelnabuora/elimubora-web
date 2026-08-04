'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LibraryFilters({
  resourceTypes,
  subject,
  resourceType
}: {
  resourceTypes: string[];
  subject?: string;
  resourceType?: string;
}) {
  const router = useRouter();
  const [subjectInput, setSubjectInput] = useState(subject ?? '');

  function apply(nextSubject: string, nextType: string) {
    const query = new URLSearchParams();
    if (nextSubject) query.set('subject', nextSubject);
    if (nextType) query.set('resourceType', nextType);
    const qs = query.toString();
    router.push(qs ? `/student/library?${qs}` : '/student/library');
  }

  return (
    <div className="admin-form-row" style={{ marginBottom: 0 }}>
      <label className="admin-field">
        <span>Subject</span>
        <input
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply(subjectInput, resourceType ?? '')}
          placeholder="e.g. Mathematics"
        />
      </label>
      <label className="admin-field">
        <span>Type</span>
        <select value={resourceType ?? ''} onChange={(e) => apply(subjectInput, e.target.value)}>
          <option value="">All types</option>
          {resourceTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
