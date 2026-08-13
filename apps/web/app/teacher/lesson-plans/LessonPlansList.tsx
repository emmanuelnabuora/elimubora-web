'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LessonPlan {
  id: string;
  weekOf: string;
  objectives: string | null;
  resources: string | null;
  status: string;
  aiGenerated: boolean;
}

const NEXT_STATUS: Record<string, string | null> = {
  draft: 'submitted',
  submitted: null,
  approved: null
};

const ACTION_LABEL: Record<string, string> = {
  draft: 'Submit for review'
};

export function LessonPlansList({ plans }: { plans: LessonPlan[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function advance(id: string, nextStatus: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lesson-plans/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not update this plan. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {plans
          .slice()
          .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
          .map((plan) => {
            const next = NEXT_STATUS[plan.status];
            return (
              <div key={plan.id} className="admin-section" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>Week of {plan.weekOf}</p>
                    {plan.objectives && (
                      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', margin: '0 0 4px', maxWidth: 500 }}>
                        {plan.objectives}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {plan.aiGenerated && <span className="status-pill pending">AI draft</span>}
                    <span
                      className={`status-pill ${plan.status === 'approved' ? 'active' : plan.status === 'submitted' ? 'pending' : 'inactive'}`}
                    >
                      {plan.status}
                    </span>
                  </div>
                </div>
                {next && (
                  <button
                    type="button"
                    className="admin-submit"
                    style={{ marginTop: 10, fontSize: 13, padding: '6px 14px' }}
                    disabled={pendingId === plan.id}
                    onClick={() => advance(plan.id, next)}
                  >
                    {pendingId === plan.id ? 'Updating…' : ACTION_LABEL[plan.status]}
                  </button>
                )}
                {plan.status === 'submitted' && (
                  <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', marginTop: 10, marginBottom: 0 }}>
                    Awaiting approval from school administration.
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}
