'use client';

import { useState } from 'react';

interface LibraryResource {
  id: string;
  title: string;
  resourceType: string;
  subject: string;
  gradeLevel: string | null;
  description: string | null;
  tags: string[];
}

export function ResourceCard({ resource }: { resource: LibraryResource }) {
  const [expanded, setExpanded] = useState(false);
  const [logged, setLogged] = useState(false);

  async function handleView() {
    setExpanded((prev) => !prev);
    if (!logged) {
      setLogged(true);
      await fetch(`/api/student/library/${resource.id}/access`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'viewed' })
      }).catch(() => undefined);
    }
  }

  return (
    <div className="admin-section" style={{ margin: 0 }}>
      <span className="status-pill pending" style={{ marginBottom: 8, display: 'inline-block' }}>
        {resource.resourceType.replace('_', ' ')}
      </span>
      <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>{resource.title}</p>
      <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', margin: '0 0 8px' }}>
        {resource.subject}
        {resource.gradeLevel ? ` \u00b7 ${resource.gradeLevel}` : ''}
      </p>
      {expanded && resource.description && <p style={{ fontSize: 13, margin: '0 0 8px' }}>{resource.description}</p>}
      {expanded && resource.tags.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', margin: '0 0 8px' }}>{resource.tags.join(', ')}</p>
      )}
      <button type="button" className="admin-submit" style={{ fontSize: 13, padding: '6px 14px' }} onClick={handleView}>
        {expanded ? 'Hide details' : 'View details'}
      </button>
    </div>
  );
}
