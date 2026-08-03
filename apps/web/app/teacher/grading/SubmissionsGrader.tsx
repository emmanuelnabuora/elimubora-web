'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SubmissionEntry {
  id: string;
  learnerName: string;
  status: string;
  score: string | null;
  feedback: string | null;
}

function GradeRow({ submission, maxScore }: { submission: SubmissionEntry; maxScore: number }) {
  const router = useRouter();
  const [score, setScore] = useState(submission.score ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/teacher/submissions/${submission.id}/grade`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          score: Number(score),
          feedback: feedback || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this grade. Try again.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr>
      <td>{submission.learnerName}</td>
      <td>
        <span className={`status-pill ${submission.status === 'graded' ? 'active' : 'pending'}`}>
          {submission.status}
        </span>
      </td>
      <td>
        <input
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          style={{ width: 70 }}
        />
        <span style={{ color: 'var(--eb-fg-muted)', marginLeft: 4 }}>/ {maxScore}</span>
      </td>
      <td>
        <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (optional)" />
      </td>
      <td>
        <button type="button" className="admin-submit" disabled={loading || score === ''} onClick={handleSave}>
          {loading ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
        {error && (
          <p className="auth-error" style={{ marginTop: 4 }}>
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function SubmissionsGrader({
  submissions,
  maxScore
}: {
  submissions: SubmissionEntry[];
  maxScore: number;
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Student</th>
          <th>Status</th>
          <th>Score</th>
          <th>Feedback</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((s) => (
          <GradeRow key={s.id} submission={s} maxScore={maxScore} />
        ))}
      </tbody>
    </table>
  );
}
