'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved', 'closed'];

export function IncidentStatusControl({ incidentId, status }: { incidentId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(newStatus: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/command/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update status.');
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
      <select value={status} disabled={loading} onChange={(e) => update(e.target.value)} style={{ fontSize: 13, padding: '4px 8px', textTransform: 'capitalize' }}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
