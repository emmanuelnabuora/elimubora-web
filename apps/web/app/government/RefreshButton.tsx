'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefreshButton({ academicYear }: { academicYear: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/government/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ academicYear })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not refresh statistics. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="auth-error">{error}</p>}
      <button type="button" className="admin-submit" onClick={handleRefresh} disabled={loading}>
        {loading ? 'Refreshing…' : `Refresh ${academicYear} statistics`}
      </button>
    </div>
  );
}
