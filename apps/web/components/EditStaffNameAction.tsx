'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function EditStaffNameAction({ userId, fullName }: { userId: string; fullName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fullName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (value.trim().length < 2) {
      setError('Name is too short.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/staff/${userId}/name`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: value.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not save. Try again.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {fullName}
        <button
          type="button"
          onClick={() => {
            setValue(fullName);
            setEditing(true);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--eb-primary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          style={{
            fontSize: 14,
            padding: '5px 8px',
            borderRadius: 8,
            border: '1px solid var(--eb-line)',
            minWidth: 160
          }}
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="admin-nav-link"
          style={{ padding: '5px 10px', fontSize: 12 }}
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={loading}
          style={{ background: 'none', border: 'none', color: 'var(--eb-fg-muted)', fontSize: 12, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="auth-error" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
