'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Course {
  courseId: string;
  title: string;
}

interface Bank {
  id: string;
  title: string;
}

export function CreateExamForm({ courses, banks }: { courses: Course[]; banks: Bank[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [questionBankId, setQuestionBankId] = useState('');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, questionBankId, title, durationMinutes, questionCount })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create that exam. Try again.');
        return;
      }
      setTitle('');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (banks.length === 0) {
    return (
      <p className="admin-empty">Create a question bank with some approved questions first, then come back to create an exam.</p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="admin-submit" onClick={() => setOpen(true)}>
        + New exam
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="admin-field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </label>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Question bank</span>
          <select value={questionBankId} onChange={(e) => setQuestionBankId(e.target.value)} required>
            <option value="" disabled>
              Select a bank
            </option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Duration (minutes)</span>
          <input
            type="number"
            min={1}
            max={600}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />
        </label>
        <label className="admin-field">
          <span>Number of questions to draw</span>
          <input
            type="number"
            min={1}
            max={200}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            required
          />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create exam'}
        </button>
        <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
