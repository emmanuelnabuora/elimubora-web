'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export function CreateClassStreamForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/class-streams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, gradeLevel, academicYear: Number(academicYear) })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this class. Try again.');
        return;
      }
      setSuccess(`"${data.name}" created.`);
      setName('');
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
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Class name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="e.g. Grade 4 Blue" />
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
        <label className="admin-field">
          <span>Academic year</span>
          <input
            type="number"
            min="2020"
            max="2100"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create class'}
      </button>
    </form>
  );
}
