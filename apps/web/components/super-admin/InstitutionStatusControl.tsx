'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  suspended: '#F59E0B',
  archived: '#98A2B3'
};

export function InstitutionStatusControl({ institutionId, status }: { institutionId: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
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
      const res = await fetch(`/api/super-admin/institutions/${institutionId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: target, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update status.');
        return;
      }
      setOpen(false);
      setReason('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            color: '#fff',
            background: STATUS_COLORS[status] ?? '#98A2B3',
            textTransform: 'capitalize'
          }}
        >
          {status}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
      <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ fontSize: 13, padding: '4px 8px' }}>
        <option value="" disabled>
          New status
        </option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="archived">Archived</option>
      </select>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, min 5 characters)"
        style={{ fontSize: 13, padding: '4px 8px' }}
      />
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={submit}
          disabled={loading || !target}
          style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
