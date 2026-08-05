'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: number;
}

export function AddStudentForm({ classStreams }: { classStreams: ClassStream[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [classStreamId, setClassStreamId] = useState('');
  const [academicYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName, gradeLevel, classStreamId: classStreamId || undefined, academicYear })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not enrol this student. Try again.');
        return;
      }
      setSuccess(`Enrolled — admission number ${data.admissionNumber}.`);
      setFullName('');
      setGradeLevel('');
      setClassStreamId('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const filteredStreams = gradeLevel
    ? classStreams.filter((c) => c.gradeLevel === gradeLevel)
    : classStreams;

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Grade level</span>
          <select
            value={gradeLevel}
            onChange={(e) => {
              setGradeLevel(e.target.value);
              setClassStreamId('');
            }}
            required
          >
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
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Class stream (optional)</span>
          <select value={classStreamId} onChange={(e) => setClassStreamId(e.target.value)} disabled={!gradeLevel}>
            <option value="">{gradeLevel ? 'Auto-assign (recommended)' : 'Choose a grade first'}</option>
            {filteredStreams.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Academic year</span>
          <input value={academicYear} disabled />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Enrolling…' : 'Enrol student'}
      </button>
    </form>
  );
}
