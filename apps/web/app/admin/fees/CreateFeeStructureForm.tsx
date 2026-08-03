'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];

export function CreateFeeStructureForm() {
  const router = useRouter();
  const [gradeLevel, setGradeLevel] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState(1);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/fee-structures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gradeLevel,
          academicYear,
          term,
          amount: Number(amount),
          description: description || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create that fee structure. Try again.');
        return;
      }
      setSuccess('Fee structure created.');
      setGradeLevel('');
      setAmount('');
      setDescription('');
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
        <label className="admin-field">
          <span>Term</span>
          <select value={term} onChange={(e) => setTerm(Number(e.target.value))} required>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Academic year</span>
          <input
            type="number"
            value={academicYear}
            onChange={(e) => setAcademicYear(Number(e.target.value))}
            required
          />
        </label>
        <label className="admin-field">
          <span>Amount (KES)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create fee structure'}
      </button>
    </form>
  );
}
