'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const GRADE_LEVELS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export function ComposeAnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [targetStudents, setTargetStudents] = useState(true);
  const [targetParents, setTargetParents] = useState(true);
  const [targetTeachers, setTargetTeachers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStudents && !targetParents && !targetTeachers) {
      setError('Select at least one audience — an announcement needs someone to reach.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          gradeLevel: gradeLevel || undefined,
          targetStudents,
          targetParents,
          targetTeachers
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not send that announcement. Try again.');
        return;
      }
      setSuccess(true);
      setTitle('');
      setBody('');
      setGradeLevel('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="admin-field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </label>
      <label className="admin-field">
        <span>Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          style={{
            fontFamily: 'var(--eb-font-body)',
            fontSize: 14,
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid var(--eb-line)'
          }}
        />
      </label>
      <label className="admin-field">
        <span>Grade level (optional — leave blank for whole school)</span>
        <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
          <option value="">Whole school</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-field">
        <span>Audience</span>
        <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, fontSize: 14 }}>
            <input type="checkbox" checked={targetStudents} onChange={(e) => setTargetStudents(e.target.checked)} />
            Students
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, fontSize: 14 }}>
            <input type="checkbox" checked={targetParents} onChange={(e) => setTargetParents(e.target.checked)} />
            Parents
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, fontSize: 14 }}>
            <input type="checkbox" checked={targetTeachers} onChange={(e) => setTargetTeachers(e.target.checked)} />
            Teachers
          </label>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          Announcement sent.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send announcement'}
      </button>
    </form>
  );
}
