'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

export function CreateQuestionBankForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('G4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/question-banks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, subject, gradeLevel })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create that question bank. Try again.');
        return;
      }
      setTitle('');
      setSubject('');
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
        + New question bank
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label className="admin-field">
          <span>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={100} />
        </label>
        <label className="admin-field">
          <span>Grade level</span>
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create bank'}
        </button>
        <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
