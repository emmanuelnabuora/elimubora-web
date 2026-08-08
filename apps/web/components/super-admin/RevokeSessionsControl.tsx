'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RevokeSessionsControl({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function revoke() {
    if (!confirm('Revoke all active sessions for this user? They will be signed out everywhere immediately.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/users/${userId}/revoke-sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Revoked via Super Admin console' })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not revoke sessions.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span style={{ fontSize: 12, color: '#22C55E' }}>Sessions revoked</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={revoke}
        disabled={loading}
        style={{ fontSize: 12, background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
      >
        {loading ? 'Revoking…' : 'Revoke sessions'}
      </button>
      {error && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
