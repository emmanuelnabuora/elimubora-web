'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const GRADE_LEVELS = ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
const DEFAULT_SUBJECTS = ['English', 'Mathematics', 'Science', 'Geography'];

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AddCommonSubjectsForm({ gradeLevelsWithClasses }: { gradeLevelsWithClasses: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [customSubject, setCustomSubject] = useState('');
  const [gradeLevels, setGradeLevels] = useState<string[]>(gradeLevelsWithClasses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  function addCustomSubject() {
    const trimmed = customSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
    }
    setCustomSubject('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/courses/bulk-common', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjects, gradeLevels })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create these courses. Try again.');
        return;
      }
      setResult({ created: data.created, skipped: data.skipped, failed: data.failed.length });
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(true)}>
        + Add common subjects to all classes
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
        Creates a course for every subject below, across every grade level selected — e.g. English + Mathematics
        across G1–G3 creates 6 courses in one go. Any subject/grade combination that already exists is skipped, not
        duplicated.
      </p>

      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Subjects</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {subjects.map((s) => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <input
              type="checkbox"
              checked
              onChange={() => setSubjects(subjects.filter((x) => x !== s))}
            />
            {s}
          </label>
        ))}
      </div>
      <div className="admin-form-row" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <label className="admin-field">
          <span>Add another subject</span>
          <input
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSubject();
              }
            }}
            placeholder="e.g. Kiswahili"
          />
        </label>
        <button type="button" className="admin-nav-link" style={{ alignSelf: 'flex-end', padding: '9px 16px' }} onClick={addCustomSubject}>
          Add
        </button>
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Grade levels</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--eb-space-3)' }}>
        {GRADE_LEVELS.map((g) => (
          <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <input type="checkbox" checked={gradeLevels.includes(g)} onChange={() => setGradeLevels(toggleInArray(gradeLevels, g))} />
            {g}
          </label>
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}
      {result && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {result.created} course(s) created, {result.skipped} already existed and were skipped
          {result.failed > 0 ? `, ${result.failed} failed` : ''}.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          className="admin-submit"
          disabled={loading || subjects.length === 0 || gradeLevels.length === 0}
        >
          {loading ? 'Creating…' : `Create ${subjects.length * gradeLevels.length} course(s)`}
        </button>
        <button type="button" className="admin-nav-link" style={{ padding: '9px 16px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
