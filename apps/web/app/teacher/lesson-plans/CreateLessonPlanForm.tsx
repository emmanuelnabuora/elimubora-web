'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function CreateLessonPlanForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [weekOf, setWeekOf] = useState('');
  const [objectives, setObjectives] = useState('');
  const [resources, setResources] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body =
        mode === 'manual'
          ? {
              courseId,
              weekOf,
              objectives: objectives || undefined,
              resources: resources || undefined,
              activities: []
            }
          : { courseId, weekOf, topic };
      const res = await fetch(`/api/teacher/lesson-plans${mode === 'ai' ? '?ai=1' : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this plan. Try again.');
        return;
      }
      setSuccess(mode === 'ai' ? 'AI draft created — review it below.' : 'Lesson plan created.');
      setWeekOf('');
      setObjectives('');
      setResources('');
      setTopic('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="admin-action-row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={mode === 'manual' ? 'admin-submit' : 'admin-btn-deny'}
          onClick={() => setMode('manual')}
        >
          Write manually
        </button>
        <button
          type="button"
          className={mode === 'ai' ? 'admin-submit' : 'admin-btn-deny'}
          onClick={() => setMode('ai')}
        >
          Draft with AI
        </button>
      </div>

      {mode === 'ai' && (
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -8, marginBottom: 16 }}>
          Runs in a sandbox environment right now — this produces a clearly-labeled placeholder, not a real
          AI-generated draft, until a production model is connected.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Week of</span>
            <input type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} required />
          </label>
          {mode === 'ai' && (
            <label className="admin-field">
              <span>Topic</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                minLength={2}
                placeholder="e.g. Fractions and decimals"
              />
            </label>
          )}
        </div>

        {mode === 'manual' && (
          <>
            <label className="admin-field" style={{ marginBottom: 12 }}>
              <span>Objectives (optional)</span>
              <textarea
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                rows={3}
                style={{
                  fontFamily: 'var(--eb-font-body)',
                  fontSize: 14,
                  padding: '9px 10px',
                  borderRadius: 'var(--eb-radius-sm)',
                  border: '1px solid var(--eb-line)',
                  background: 'var(--eb-bg)',
                  color: 'var(--eb-fg)',
                  resize: 'vertical'
                }}
              />
            </label>
            <label className="admin-field" style={{ marginBottom: 12 }}>
              <span>Resources (optional)</span>
              <input value={resources} onChange={(e) => setResources(e.target.value)} />
            </label>
          </>
        )}

        {error && <p className="auth-error">{error}</p>}
        {success && (
          <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
            {success}
          </p>
        )}
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Creating…' : mode === 'ai' ? 'Generate draft' : 'Create plan'}
        </button>
      </form>
    </div>
  );
}
