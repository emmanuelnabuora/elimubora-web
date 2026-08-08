'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Option {
  id: string;
  text: string;
}

export function AddQuestionForm({ bankId }: { bankId: string }) {
  const router = useRouter();
  const [questionType, setQuestionType] = useState<'mcq' | 'short_answer' | 'essay'>('mcq');
  const [prompt, setPrompt] = useState('');
  const [marks, setMarks] = useState(10);
  const [options, setOptions] = useState<Option[]>([
    { id: 'a', text: '' },
    { id: 'b', text: '' }
  ]);
  const [correctOptionId, setCorrectOptionId] = useState('a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function updateOption(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function addOption() {
    if (options.length >= 10) return;
    const nextLetter = String.fromCharCode(97 + options.length); // a, b, c, ...
    setOptions((prev) => [...prev, { id: nextLetter, text: '' }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    const remaining = options.filter((o) => o.id !== id);
    setOptions(remaining);
    if (correctOptionId === id && remaining[0]) setCorrectOptionId(remaining[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { questionType, prompt, marks, competencyIds: [] };
      if (questionType === 'mcq') {
        body.options = options;
        body.correctOptionId = correctOptionId;
      }
      const res = await fetch(`/api/admin/question-banks/${bankId}/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not add that question. Try again.');
        return;
      }
      setPrompt('');
      setOptions([
        { id: 'a', text: '' },
        { id: 'b', text: '' }
      ]);
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
      <button type="button" className="admin-submit" onClick={() => setOpen(true)}>
        + Add question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Question type</span>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value as typeof questionType)}>
            <option value="mcq">Multiple choice</option>
            <option value="short_answer">Short answer</option>
            <option value="essay">Essay</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Marks</span>
          <input type="number" min={1} max={1000} value={marks} onChange={(e) => setMarks(Number(e.target.value))} required />
        </label>
      </div>
      <label className="admin-field">
        <span>Question prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={3}
          style={{
            fontFamily: 'var(--eb-font-body)',
            fontSize: 14,
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid var(--eb-line)'
          }}
        />
      </label>

      {questionType === 'mcq' && (
        <div className="admin-field">
          <span>Options — select the correct one</span>
          {options.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="radio"
                name="correctOption"
                checked={correctOptionId === o.id}
                onChange={() => setCorrectOptionId(o.id)}
              />
              <input
                value={o.text}
                onChange={(e) => updateOption(o.id, e.target.value)}
                placeholder={`Option ${o.id.toUpperCase()}`}
                required
                style={{ flex: 1 }}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(o.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--eb-fg-muted)', cursor: 'pointer', fontSize: 13 }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              style={{ background: 'none', border: 'none', color: 'var(--eb-primary)', cursor: 'pointer', fontSize: 13, marginTop: 8, padding: 0 }}
            >
              + Add another option
            </button>
          )}
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Adding…' : 'Add question'}
        </button>
        <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
