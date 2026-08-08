'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RequestImpersonationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/access/impersonation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId, reason, ticketReference: ticketReference || undefined })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not submit that request.');
        return;
      }
      setOpen(false);
      setTargetUserId('');
      setReason('');
      setTicketReference('');
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
        style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' }}
      >
        + Request impersonation
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'grid', gap: 10, maxWidth: 480 }}>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Target user ID
        <input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Reason (required, min 15 characters)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Support ticket reference (optional)
        <input value={ticketReference} onChange={(e) => setTicketReference(e.target.value)} style={{ padding: '6px 10px' }} />
      </label>
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          {loading ? 'Submitting…' : 'Submit request'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 13, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
