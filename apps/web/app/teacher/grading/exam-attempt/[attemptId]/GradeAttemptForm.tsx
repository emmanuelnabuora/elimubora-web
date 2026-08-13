'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function GradeAttemptForm({ attemptId, maxManualScore }: { attemptId: string; maxManualScore: number }) {
  const router = useRouter();
  const [manualScore, setManualScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/exam-attempts/${attemptId}/grade`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manualScore: Number(manualScore) })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this grade. Try again.');
        return;
      }
      router.push('/teacher/grading');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form-row" style={{ alignItems: 'flex-end' }}>
      <label className="admin-field" style={{ maxWidth: 160 }}>
        <span>Manual marks (short-answer/essay)</span>
        <input
          type="number"
          min={0}
          max={maxManualScore}
          step="0.5"
          value={manualScore}
          onChange={(e) => setManualScore(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="admin-submit" disabled={loading || manualScore === ''}>
        {loading ? 'Saving…' : 'Save grade'}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
