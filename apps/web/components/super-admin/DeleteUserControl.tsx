'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Soft delete (see PlatformAdminService.deleteUser). Less friction
 * than DeleteInstitutionControl's type-to-confirm -- one user, not an
 * entire institution's membership, and the browser confirm() dialog
 * is the same bar RevokeSessionsControl already uses for a comparable
 * action right next to this one.
 */
export function DeleteUserControl({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    if (!confirm(`Delete ${userName}? They will be signed out everywhere and unable to log in again.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/users/${userId}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not delete this user.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
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
          disabled={loading}
          style={{ fontSize: 12, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Deleting\u2026' : 'Confirm delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
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
