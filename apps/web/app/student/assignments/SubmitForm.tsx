'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function SubmitForm({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { answer } })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not submit your work. Try again.');
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
    <form onSubmit={handleSubmit}>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Your answer</span>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
          rows={4}
          style={{
            fontFamily: 'var(--eb-font-body)',
            fontSize: 14,
            padding: '9px 10px',
            borderRadius: 'var(--eb-radius-sm)',
            border: '1px solid var(--eb-line)',
            background: 'var(--eb-bg)',
            color: 'var(--eb-fg)',
            resize: 'vertical'
          }}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
