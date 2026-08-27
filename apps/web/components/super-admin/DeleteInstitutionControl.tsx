'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Soft delete (see PlatformAdminService.deleteInstitution /
 * platform-admin.repository.ts) -- but it's still the single most
 * destructive-feeling action in this console: it locks out every
 * current member of the institution immediately, with no "undo"
 * button anywhere in the UI. Typing the exact institution name back
 * is friction on purpose, checked server-side (not just disabling a
 * button client-side) -- the same "type to confirm" pattern used for
 * genuinely irreversible-feeling actions elsewhere, here to catch
 * deleting the wrong row in a long list, not to be a puzzle.
 */
export function DeleteInstitutionControl({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
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
      const res = await fetch(`/api/super-admin/institutions/${institutionId}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmName, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not delete this institution.');
        return;
      }
      setOpen(false);
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
        Delete
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
      <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>
        This immediately locks out every current member. Type <strong>{institutionName}</strong> to confirm.
      </p>
      <input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder="Institution name"
        style={{ fontSize: 13, padding: '4px 8px' }}
      />
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
          disabled={loading || confirmName.trim().toLowerCase() !== institutionName.trim().toLowerCase()}
          style={{ fontSize: 12, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmName('');
            setReason('');
            setError(null);
          }}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
