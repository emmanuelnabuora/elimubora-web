'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RevokeGrantControl({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/access/grants/${grantId}/revoke`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not revoke grant.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
      >
        Revoke
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" style={{ fontSize: 13, padding: '4px 8px' }} />
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={submit} disabled={loading} style={{ fontSize: 12, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
          {loading ? 'Revoking…' : 'Confirm'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
