'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BroadcastActionControl({ broadcastId, status }: { broadcastId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'approve' | 'publish') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/business/broadcasts/${broadcastId}/${action}`, {
        method: action === 'approve' ? 'PATCH' : 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? `Could not ${action} that broadcast.`);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'pending_approval') {
    return (
      <div>
        <button
          type="button"
          onClick={() => act('approve')}
          disabled={loading}
          style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Working…' : 'Approve'}
        </button>
        {error && (
          <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4, maxWidth: 220 }}>
            {error.includes('same person') ? 'A different platform admin must approve this broadcast.' : error}
          </p>
        )}
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div>
        <button
          type="button"
          onClick={() => act('publish')}
          disabled={loading}
          style={{ fontSize: 12, background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Working…' : 'Publish'}
        </button>
        {error && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</p>}
      </div>
    );
  }

  return <span style={{ fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{status}</span>;
}
