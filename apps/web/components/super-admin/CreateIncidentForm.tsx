'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateIncidentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('sev3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/command/incidents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, severity })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not create that incident.');
        return;
      }
      setOpen(false);
      setTitle('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 13, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' }}>
        + Declare incident
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 480 }}>
      <label style={{ fontSize: 13, display: 'grid', gap: 4, flex: 1 }}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Severity
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ padding: '6px 10px' }}>
          <option value="sev1">Sev1</option>
          <option value="sev2">Sev2</option>
          <option value="sev3">Sev3</option>
          <option value="sev4">Sev4</option>
        </select>
      </label>
      <button type="submit" disabled={loading} style={{ fontSize: 13, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
        {loading ? 'Creating…' : 'Declare'}
      </button>
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
    </form>
  );
}
