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
  const [addParent, setAddParent] = useState(false);
  const [parentFullName, setParentFullName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhysicalAddress, setParentPhysicalAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName,
          gradeLevel,
          classStreamId: classStreamId || undefined,
          academicYear,
          ...(addParent
            ? {
                parentFullName,
                parentEmail,
                parentPhysicalAddress: parentPhysicalAddress || undefined
              }
            : {})
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not enrol this student. Try again.');
        return;
      }
      if (data.parentWarning) {
        setWarning(data.parentWarning);
      } else {
        setSuccess(
          addParent
            ? `Enrolled — admission number ${data.admissionNumber}. ${parentFullName} has been invited as their parent.`
            : `Enrolled — admission number ${data.admissionNumber}.`
        );
      }
      setFullName('');
      setGradeLevel('');
      setClassStreamId('');
      setAddParent(false);
      setParentFullName('');
      setParentEmail('');
      setParentPhysicalAddress('');
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 'var(--eb-space-3)' }}>
        <input type="checkbox" checked={addParent} onChange={(e) => setAddParent(e.target.checked)} />
        Invite a parent for this student
      </label>

      {addParent && (
        <div style={{ marginBottom: 'var(--eb-space-3)' }}>
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
            This creates a real guardian record linked to this student, and sends a real invitation to this email
            so the parent can set up their own login — the same invitation flow used for staff.
          </p>
          <div className="admin-form-row">
            <label className="admin-field">
              <span>Parent full name</span>
              <input
                value={parentFullName}
                onChange={(e) => setParentFullName(e.target.value)}
                required={addParent}
                minLength={2}
              />
            </label>
            <label className="admin-field">
              <span>Parent email</span>
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                required={addParent}
              />
            </label>
          </div>
          <label className="admin-field">
            <span>Physical address (optional)</span>
            <input value={parentPhysicalAddress} onChange={(e) => setParentPhysicalAddress(e.target.value)} />
          </label>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
      {warning && (
        <p className="auth-error" style={{ color: '#b45309', background: '#fff7e8' }}>
          {warning}
        </p>
      )}
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
