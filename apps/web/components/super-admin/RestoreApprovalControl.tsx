'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RestoreApprovalControl({ restoreId, status }: { restoreId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/command/recovery/restores/${restoreId}/approve`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not approve that restore.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (status !== 'pending_approval') {
    return <span style={{ fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={approve}
        disabled={loading}
        style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
      >
        {loading ? 'Working…' : 'Approve'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4, maxWidth: 220 }}>
          {error.includes('same person') ? 'A different platform admin must approve this restore.' : error}
        </p>
      )}
    </div>
  );
}
