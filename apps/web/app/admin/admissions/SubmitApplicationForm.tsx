'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

export function SubmitApplicationForm() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [gradeLevelApplied, setGradeLevelApplied] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/admissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidateName, guardianName, guardianPhone, gradeLevelApplied })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not submit this application. Try again.');
        return;
      }
      setSuccess(`Application submitted for ${candidateName}.`);
      setCandidateName('');
      setGuardianName('');
      setGuardianPhone('');
      setGradeLevelApplied('');
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
          <span>Candidate name</span>
          <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Grade applying for</span>
          <select value={gradeLevelApplied} onChange={(e) => setGradeLevelApplied(e.target.value)} required>
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
          <span>Guardian name</span>
          <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Guardian phone</span>
          <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} required minLength={7} />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
