'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface School {
  id: string;
  name: string;
}

export function RequestTransferForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<School | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debounced search: only search once the person pauses typing, and
  // only once they've typed enough to meaningfully narrow the field
  // -- with potentially hundreds of schools on the platform, a
  // one-letter search isn't a useful result set.
  useEffect(() => {
    if (selected) return; // a school is already chosen; don't keep searching underneath it
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/admin/schools?search=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, selected]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Search for and select a destination school first.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/transfers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toTenantId: selected.id, reason: reason || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not submit that transfer request. Try again.');
        return;
      }
      setSuccess(true);
      setSelected(null);
      setQuery('');
      setReason('');
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
        <span>Destination school</span>
        {selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                background: 'var(--eb-bg-panel, #F5F4FF)',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {selected.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--eb-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a school name to search…"
            />
            {query.trim().length >= 2 && (
              <div
                style={{
                  border: '1px solid var(--eb-line)',
                  borderRadius: 12,
                  marginTop: 4,
                  maxHeight: 220,
                  overflowY: 'auto',
                  background: '#fff'
                }}
              >
                {searching ? (
                  <p style={{ padding: 12, fontSize: 13, color: 'var(--eb-fg-muted)', margin: 0 }}>Searching…</p>
                ) : results.length === 0 ? (
                  <p style={{ padding: 12, fontSize: 13, color: 'var(--eb-fg-muted)', margin: 0 }}>
                    No matching schools.
                  </p>
                ) : (
                  results.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelected(s);
                        setResults([]);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </label>
      <label className="admin-field">
        <span>Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
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
          Transfer request sent — the receiving school will review it.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Request transfer'}
      </button>
    </form>
  );
}
