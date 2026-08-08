'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RequestExportForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState('');
  const [format, setFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/intelligence/data/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exportType, format })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not submit that request.');
        return;
      }
      setOpen(false);
      setExportType('');
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
        + Request export
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 480 }}>
      <label style={{ fontSize: 13, display: 'grid', gap: 4, flex: 1 }}>
        Export type
        <input value={exportType} onChange={(e) => setExportType(e.target.value)} required placeholder="e.g. institutions" style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Format
        <select value={format} onChange={(e) => setFormat(e.target.value)} style={{ padding: '6px 10px' }}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="xlsx">XLSX</option>
          <option value="parquet">Parquet</option>
        </select>
      </label>
      <button type="submit" disabled={loading} style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
        {loading ? 'Requesting…' : 'Request'}
      </button>
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
    </form>
  );
}
