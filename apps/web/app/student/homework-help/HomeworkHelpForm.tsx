'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

export function HomeworkHelpForm() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch('/api/student/homework-help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, gradeLevel, question })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not get an answer. Try again.');
        return;
      }
      setAnswer(data.answer);
      setQuestion('');
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
          <span>Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="e.g. Mathematics"
          />
        </label>
        <label className="admin-field">
          <span>Grade level</span>
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} required>
            <option value="" disabled>
              Select grade
            </option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Your question</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
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
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Asking…' : 'Ask'}
      </button>
      {answer && (
        <div
          style={{
            marginTop: 'var(--eb-space-4)',
            padding: 'var(--eb-space-4)',
            background: 'var(--eb-green-100)',
            borderRadius: 'var(--eb-radius-sm)',
            fontSize: 14
          }}
        >
          {answer}
        </div>
      )}
    </form>
  );
}
