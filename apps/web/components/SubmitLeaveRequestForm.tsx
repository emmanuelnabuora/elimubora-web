'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick leave' },
  { value: 'annual', label: 'Annual leave' },
  { value: 'compassionate', label: 'Compassionate leave' },
  { value: 'maternity', label: 'Maternity leave' },
  { value: 'paternity', label: 'Paternity leave' },
  { value: 'unpaid', label: 'Unpaid leave' }
];

export function SubmitLeaveRequestForm() {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/teacher/leave-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leaveType, startDate, endDate, reason: reason || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not submit that request. Try again.');
        return;
      }
      setSuccess(true);
      setStartDate('');
      setEndDate('');
      setReason('');
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
          <span>Leave type</span>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Start date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>End date</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
      </div>
      <label className="admin-field">
        <span>Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          style={{
            fontFamily: 'var(--eb-font-body)',
            fontSize: 14,
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid var(--eb-line)'
          }}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          Request submitted — your school admin will review it.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
