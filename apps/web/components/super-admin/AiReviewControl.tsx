'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AiReviewControl({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(newStatus: 'resolved' | 'dismissed') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/intelligence/ai/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update review.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!['open', 'reviewing'].includes(status)) {
    return <span style={{ fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{status}</span>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => decide('resolved')} disabled={loading} style={{ fontSize: 12, background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
          Resolve
        </button>
        <button type="button" onClick={() => decide('dismissed')} disabled={loading} style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
          Dismiss
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
    </div>
  );
}
