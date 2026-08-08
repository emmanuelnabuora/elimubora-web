'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = ['new', 'assigned', 'waiting', 'escalated', 'resolved', 'closed'];

export function SupportTicketStatusControl({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(newStatus: string) {
    setValue(newStatus);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/support/tickets/${ticketId}/status`, {
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
      <select value={value} onChange={(e) => save(e.target.value)} disabled={loading} style={{ fontSize: 13, padding: '4px 8px', textTransform: 'capitalize' }}>
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
