'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export function CreateCourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [learningArea, setLearningArea] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, learningArea, gradeLevel })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this course. Try again.');
        return;
      }
      setSuccess(`"${data.title}" created.`);
      setTitle('');
      setLearningArea('');
      setGradeLevel('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
        Subjects above are grouped automatically from your courses — create one here and it appears wherever a
        course selector is used (Timetable, Lesson Plans, Assignments, Grading).
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Course title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} placeholder="e.g. Mathematics" />
        </label>
        <label className="admin-field">
          <span>Learning area / subject</span>
          <input
            value={learningArea}
            onChange={(e) => setLearningArea(e.target.value)}
            required
            minLength={2}
            placeholder="e.g. Mathematics"
          />
        </label>
        <label className="admin-field">
          <span>Grade level</span>
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} required>
            <option value="" disabled>
              Select a grade
            </option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create course'}
      </button>
    </form>
  );
}
