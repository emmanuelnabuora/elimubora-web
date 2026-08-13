'use client';

import { useState } from 'react';

interface PendingLessonPlan {
  id: string;
  weekOf: string;
  objectives: string | null;
  resources: string | null;
  status: string;
  aiGenerated: boolean;
  courseTitle: string;
  teacherName: string;
}

export function LessonPlanReviewTable({ initialPlans }: { initialPlans: PendingLessonPlan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, status: 'approved' | 'draft') {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lesson-plans/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not record that decision. Try again.');
        return;
      }
      // Decided plans leave the "pending" list — remove locally
      // rather than refetching, since we already have the confirmed result.
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPendingId(null);
    }
  }

  if (plans.length === 0) {
    return <p className="admin-empty">No lesson plans are awaiting approval.</p>;
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Course</th>
            <th>Teacher</th>
            <th>Week of</th>
            <th>Objectives</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td>{p.courseTitle}</td>
              <td>{p.teacherName}</td>
              <td>{p.weekOf}</td>
              <td style={{ maxWidth: 400 }}>
                {p.objectives ?? '—'}
                {p.aiGenerated && (
                  <span className="status-pill pending" style={{ marginLeft: 8 }}>
                    AI draft
                  </span>
                )}
              </td>
              <td>
                <div className="admin-action-row">
                  <button
                    type="button"
                    className="admin-btn-approve"
                    disabled={pendingId === p.id}
                    onClick={() => decide(p.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-btn-deny"
                    disabled={pendingId === p.id}
                    onClick={() => decide(p.id, 'draft')}
                  >
                    Send back
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
