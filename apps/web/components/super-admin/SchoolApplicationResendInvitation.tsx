'use client';

import { useState } from 'react';

/**
 * Shown on an approved application whose admin hasn't finished
 * account setup yet — the common case being an expired invite link.
 * Mirrors SchoolApplicationReviewActions.tsx's idle/confirm shape,
 * but there's only one action here, so no mode switching is needed.
 */
export function SchoolApplicationResendInvitation({
  applicationId,
  adminFullName
}: {
  applicationId: string;
  adminFullName: string;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submitResend() {
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch(`/api/admin/school-applications/${applicationId}/resend-invitation`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not resend the invitation.');
        setStatus('idle');
        return;
      }
      setStatus('sent');
    } catch {
      setError('Could not reach the server.');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return <span style={{ fontSize: 13, color: '#22C55E' }}>Invitation resent to {adminFullName}.</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={submitResend}
        disabled={status === 'sending'}
        style={{ fontSize: 12, background: 'none', color: '#5B4CF5', border: '1px solid #d9d5fb', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
      >
        {status === 'sending' ? 'Sending…' : 'Resend invitation'}
      </button>
      {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
    </div>
  );
}
