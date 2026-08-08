'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AcknowledgeAlertControl({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/security/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not acknowledge alert.');
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
    <div>
      <button
        type="button"
        onClick={acknowledge}
        disabled={loading}
        style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
      >
        {loading ? 'Saving…' : 'Acknowledge'}
      </button>
      {error && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
