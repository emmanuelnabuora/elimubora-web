'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TYPES = ['access', 'correction', 'deletion', 'restriction', 'objection', 'portability', 'breach', 'legal_hold'];

export function CreateComplianceRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState('access');
  const [subjectType, setSubjectType] = useState('');
  const [subjectReference, setSubjectReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/command/compliance/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestType, subjectType, subjectReference })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not create that request.');
        return;
      }
      setOpen(false);
      setSubjectType('');
      setSubjectReference('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' }}>
        + New data subject request
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'grid', gap: 10, maxWidth: 480 }}>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Request type
        <select value={requestType} onChange={(e) => setRequestType(e.target.value)} style={{ padding: '6px 10px', textTransform: 'capitalize' }}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Subject type
        <input value={subjectType} onChange={(e) => setSubjectType(e.target.value)} required placeholder="e.g. student, parent" style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Subject reference
        <input value={subjectReference} onChange={(e) => setSubjectReference(e.target.value)} required placeholder="e.g. email or ID" style={{ padding: '6px 10px' }} />
      </label>
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          {loading ? 'Creating…' : 'Create request'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 13, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
