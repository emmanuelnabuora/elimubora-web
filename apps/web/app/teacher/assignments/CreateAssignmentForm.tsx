'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function CreateAssignmentForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          instructions: instructions || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          maxScore: Number(maxScore)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this assignment. Try again.');
        return;
      }
      setSuccess(`"${data.title}" created.`);
      setTitle('');
      setInstructions('');
      setDueAt('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Due date (optional)</span>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Max score</span>
          <input
            type="number"
            min="1"
            max="1000"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Instructions (optional)</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
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
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create assignment'}
      </button>
    </form>
  );
}
