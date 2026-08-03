'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface StudentOption {
  studentId: string;
  fullName: string;
}

interface FeeStructureOption {
  id: string;
  gradeLevel: string;
  academicYear: number;
  term: number;
  amount: string;
}

export function CreateInvoiceForm({
  students,
  feeStructures
}: {
  students: StudentOption[];
  feeStructures: FeeStructureOption[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId, feeStructureId, dueDate: dueDate || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not issue that invoice. Try again.');
        return;
      }
      setSuccess(`Invoice issued — KES ${data.amountDue} due.`);
      setStudentId('');
      setFeeStructureId('');
      setDueDate('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (students.length === 0 || feeStructures.length === 0) {
    return (
      <p className="admin-empty">
        {students.length === 0
          ? 'Enrol a student before issuing invoices.'
          : 'Create a fee structure above before issuing invoices.'}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Student</span>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="" disabled>
              Select a student
            </option>
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Fee structure</span>
          <select value={feeStructureId} onChange={(e) => setFeeStructureId(e.target.value)} required>
            <option value="" disabled>
              Select a fee structure
            </option>
            {feeStructures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.gradeLevel} T{f.term} {f.academicYear} — KES {f.amount}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)', maxWidth: 200 }}>
        <span>Due date (optional)</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Issuing…' : 'Issue invoice'}
      </button>
    </form>
  );
}
