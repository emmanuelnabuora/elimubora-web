'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GradeAttemptForm({ attemptId, autoScore }: { attemptId: string; autoScore: string }) {
  const router = useRouter();
  const [manualScore, setManualScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exam-attempts/${attemptId}/grade`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manualScore: Number(manualScore) })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save that grade.');
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--eb-fg-muted)' }}>Auto: {autoScore} +</span>
      <input
        type="number"
        min={0}
        step="0.5"
        value={manualScore}
        onChange={(e) => setManualScore(e.target.value)}
        placeholder="Manual marks"
        required
        style={{ width: 110, padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--eb-line)' }}
      />
      <button type="submit" className="admin-nav-link" style={{ padding: '6px 12px', fontSize: 12 }} disabled={loading}>
        {loading ? 'Saving…' : 'Save grade'}
      </button>
      {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
    </form>
  );
}
