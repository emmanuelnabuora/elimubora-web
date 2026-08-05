'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const ROOM_TYPES = ['classroom', 'lab', 'hall', 'office', 'other'] as const;

export function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>('classroom');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, roomType, capacity: capacity ? Number(capacity) : undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this room. Try again.');
        return;
      }
      setSuccess(`"${data.name}" created.`);
      setName('');
      setCapacity('');
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
          <span>Room name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} placeholder="e.g. Room 12" />
        </label>
        <label className="admin-field">
          <span>Type</span>
          <select value={roomType} onChange={(e) => setRoomType(e.target.value as (typeof ROOM_TYPES)[number])}>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Capacity (optional)</span>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create room'}
      </button>
    </form>
  );
}
