'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Inline approve/reject for one pending application, same
 * expand-in-place shape as InstitutionStatusControl.tsx. Approving
 * only ever creates a tenant + sends an admin invitation (see
 * SchoolApplicationsService.approve) -- there is deliberately no
 * password field here, because there is no account yet for a
 * platform_admin to set one for.
 */
export function SchoolApplicationReviewActions({ applicationId, schoolName }: { applicationId: string; schoolName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [slug, setSlug] = useState(slugify(schoolName));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/school-applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim() || undefined })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not approve this application.');
        return;
      }
      setMode('idle');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  async function submitReject() {
    if (reason.trim().length < 1) {
      setError('A reason is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/school-applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not reject this application.');
        return;
      }
      setMode('idle');
      setReason('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => setMode('approve')}
          style={{ fontSize: 12, background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode('reject')}
          style={{ fontSize: 12, background: 'none', color: '#EF4444', border: '1px solid #f3c6c6', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Reject
        </button>
      </div>
    );
  }

  if (mode === 'approve') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
        <label style={{ fontSize: 11, color: '#6b7285' }}>
          Tenant slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ display: 'block', fontSize: 13, padding: '4px 8px', width: '100%', marginTop: 2 }}
          />
        </label>
        {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={submitApprove}
            disabled={loading || !slug.trim()}
            style={{ fontSize: 12, background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
          >
            {loading ? 'Approving…' : 'Confirm approval'}
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for rejection (required)"
        style={{ fontSize: 13, padding: '4px 8px' }}
      />
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={submitReject}
          disabled={loading}
          style={{ fontSize: 12, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          {loading ? 'Rejecting…' : 'Confirm rejection'}
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          style={{ fontSize: 12, background: 'none', border: '1px solid #e6e8f2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
