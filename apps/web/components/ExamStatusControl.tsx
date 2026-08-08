'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const NEXT_STATUS: Record<string, { label: string; status: string } | null> = {
  draft: { label: 'Publish', status: 'published' },
  published: { label: 'Close', status: 'closed' },
  closed: null
};

export function ExamStatusControl({ examId, status }: { examId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUS[status];

  async function advance() {
    if (!next) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next.status })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update status.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="status-pill pending" style={{ textTransform: 'capitalize' }}>
        {status}
      </span>
      {next && (
        <button type="button" className="admin-nav-link" style={{ padding: '5px 12px', fontSize: 12 }} onClick={advance} disabled={loading}>
          {loading ? 'Updating…' : next.label}
        </button>
      )}
      {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
    </div>
  );
}
