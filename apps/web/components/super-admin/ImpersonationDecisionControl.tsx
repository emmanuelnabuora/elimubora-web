'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ImpersonationDecisionControl({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [action, setAction] = useState<'deny' | 'end' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!action) return;
    if (reason.trim().length < 8) {
      setError('Reason must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/access/impersonation/${requestId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not record decision.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  const isOpen = ['pending_step_up', 'approved', 'active'].includes(status);

  if (!isOpen) {
    return <span style={{ fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>;
  }

  if (!action) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setAction('deny')} style={{ fontSize: 12, background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
          Deny
        </button>
        <button type="button" onClick={() => setAction('end')} style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
          End
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" style={{ fontSize: 13, padding: '4px 8px' }} />
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={submit} disabled={loading} style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
          {loading ? 'Saving…' : 'Confirm'}
        </button>
        <button type="button" onClick={() => setAction(null)} style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
