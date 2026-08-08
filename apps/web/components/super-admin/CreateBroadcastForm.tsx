'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateBroadcastForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('in_app');
  const [audienceType, setAudienceType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/business/broadcasts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, channel, audienceType })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not create that broadcast.');
        return;
      }
      setOpen(false);
      setTitle('');
      setBody('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' }}
      >
        + New broadcast
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'grid', gap: 10, maxWidth: 480 }}>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ padding: '6px 10px' }} />
      </label>
      <label style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        Message
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} style={{ padding: '6px 10px' }} />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ fontSize: 13, display: 'grid', gap: 4, flex: 1 }}>
          Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ padding: '6px 10px' }}>
            <option value="in_app">In-app</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
          </select>
        </label>
        <label style={{ fontSize: 13, display: 'grid', gap: 4, flex: 1 }}>
          Audience
          <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)} style={{ padding: '6px 10px' }}>
            <option value="all">All institutions</option>
            <option value="county">By county</option>
            <option value="institution_type">By institution type</option>
            <option value="institution">Specific institution</option>
            <option value="role">By role</option>
          </select>
        </label>
      </div>
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{ fontSize: 13, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          {loading ? 'Creating…' : 'Submit for approval'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 13, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
