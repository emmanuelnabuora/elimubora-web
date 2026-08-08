'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReviewQuestionAction({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: 'approved' | 'rejected') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not record that decision.');
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
    <div>
      <div className="admin-action-row">
        <button type="button" className="admin-btn-approve" disabled={loading} onClick={() => decide('approved')}>
          Approve
        </button>
        <button type="button" className="admin-btn-deny" disabled={loading} onClick={() => decide('rejected')}>
          Reject
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}
