'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ParentAccount {
  userId: string;
  fullName: string;
  email: string;
}

export function LinkGuardianAccountAction({
  guardianId,
  parentAccounts
}: {
  guardianId: string;
  parentAccounts: ParentAccount[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (parentAccounts.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--eb-fg-muted)' }}>No parent accounts to link yet</span>;
  }

  async function handleLink() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/guardians/${guardianId}/link-account`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not link this account.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ fontSize: 12, padding: '4px 6px' }}>
        <option value="">Link to…</option>
        {parentAccounts.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.fullName} ({p.email})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleLink}
        disabled={!userId || loading}
        className="admin-nav-link"
        style={{ padding: '4px 8px', fontSize: 12 }}
      >
        {loading ? '…' : 'Link'}
      </button>
      {error && <span style={{ fontSize: 11, color: 'var(--eb-danger, #EF4444)' }}>{error}</span>}
    </div>
  );
}
