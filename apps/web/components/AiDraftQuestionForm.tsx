'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AiDraftQuestionForm({ bankId }: { bankId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [marks, setMarks] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/question-banks/${bankId}/questions/ai-draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, marks })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not draft that question. Try again.');
        return;
      }
      setTopic('');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(true)}>
        {'\u2728'} AI-draft a question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0 }}>
        Drafts a question for you to review \u2014 it won&rsquo;t be usable in an exam until you approve it below.
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Topic</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} required maxLength={500} />
        </label>
        <label className="admin-field">
          <span>Marks</span>
          <input type="number" min={1} max={1000} value={marks} onChange={(e) => setMarks(Number(e.target.value))} required />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Drafting…' : 'Draft with AI'}
        </button>
        <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
