'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface StudentOption {
  studentId: string;
  fullName: string;
}

export function StartConversationForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId, body })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not send that message.');
        return;
      }
      setSuccess(true);
      setBody('');
      setStudentId('');
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
      </div>
      <label className="admin-field">
        <span>Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
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
          Message sent.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
