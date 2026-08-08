'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FeatureFlagControl({
  flagKey,
  enabled,
  rolloutPercentage
}: {
  flagKey: string;
  enabled: boolean;
  rolloutPercentage: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(enabled);
  const [rollout, setRollout] = useState(rolloutPercentage);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/feature-flags/${flagKey}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled, rolloutPercentage: rollout, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not update flag.');
        return;
      }
      setOpen(false);
      setReason('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: enabled ? '#22C55E' : '#98A2B3' }}>
          {enabled ? `On · ${rolloutPercentage}%` : 'Off'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={nextEnabled} onChange={(e) => setNextEnabled(e.target.checked)} />
        Enabled
      </label>
      <label style={{ fontSize: 12 }}>
        Rollout: {rollout}%
        <input
          type="range"
          min={0}
          max={100}
          value={rollout}
          onChange={(e) => setRollout(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, min 5 characters)"
        style={{ fontSize: 13, padding: '4px 8px' }}
      />
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          style={{ fontSize: 12, background: '#5B4CF5', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
