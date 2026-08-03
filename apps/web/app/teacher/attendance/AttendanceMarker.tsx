'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;

interface RosterEntry {
  studentId: string;
  fullName: string;
  existingStatus: string;
}

export function AttendanceMarker({
  classStreamId,
  date,
  roster
}: {
  classStreamId: string;
  date: string;
  roster: RosterEntry[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(roster.map((r) => [r.studentId, r.existingStatus]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await Promise.all(
        roster.map((r) =>
          fetch('/api/teacher/attendance', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              classStreamId,
              learnerId: r.studentId,
              attendanceDate: date,
              status: statuses[r.studentId]
            })
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(`${failed} of ${roster.length} records could not be saved. Try again.`);
        return;
      }
      setSuccess(`Attendance saved for ${roster.length} students.`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 'var(--eb-space-4)' }}>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.studentId}>
              <td>{r.fullName}</td>
              <td>
                <select
                  value={statuses[r.studentId]}
                  onChange={(e) => setStatuses((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="admin-submit"
        style={{ marginTop: 'var(--eb-space-4)' }}
        disabled={loading}
        onClick={handleSave}
      >
        {loading ? 'Saving…' : 'Save attendance'}
      </button>
    </div>
  );
}
