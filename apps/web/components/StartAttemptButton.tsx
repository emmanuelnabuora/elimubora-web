'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function StartAttemptButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/exams/${examId}/attempts`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not start this exam.');
        return;
      }
      router.push(`/student/exams/attempt/${data.id}`);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="admin-submit" style={{ padding: '8px 16px', fontSize: 13 }} onClick={start} disabled={loading}>
        {loading ? 'Starting…' : 'Start exam'}
      </button>
      {error && <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}
