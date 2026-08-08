'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = ['disabled', 'sandbox', 'approved', 'restricted', 'retired'];

export function AiModelControl({ modelId, status, active }: { modelId: string; status: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(newStatus: string, newActive: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/intelligence/ai/models/${modelId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus, active: newActive })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update model.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <select
        value={status}
        disabled={loading}
        onChange={(e) => update(e.target.value, active)}
        style={{ fontSize: 13, padding: '4px 8px', textTransform: 'capitalize' }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 11, color: '#6b7285' }}>
        <input type="checkbox" checked={active} disabled={loading} onChange={(e) => update(status, e.target.checked)} /> Active
      </label>
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
    </div>
  );
}
