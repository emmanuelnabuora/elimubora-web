'use client';

import { useEffect } from 'react';

/**
 * Primary error boundary for the whole app (root layout, global.css,
 * and every other still-intact ancestor keep rendering around this --
 * that's what distinguishes error.tsx from global-error.tsx, which is
 * reserved for the rarer case of the root layout itself failing).
 *
 * Genuinely missing until tonight: every uncaught exception anywhere
 * fell through to Next.js's default blank "Application error" screen
 * with nothing but a digest number, which is exactly what happened
 * here (digest 3154208102, traced via real Cloud Run logs to an
 * uncaught 401 "Not signed in" from apiFetch on /admin/timetable --
 * a session that looked valid to the layout's own auth check but
 * wasn't by the time the page's own data fetch ran).
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Uncaught error:', error);
  }, [error]);

  const isSessionExpired = error.message === 'Not signed in' || error.message.includes('signed in');

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="auth-card" style={{ textAlign: 'center', maxWidth: 440 }}>
        {isSessionExpired ? (
          <>
            <h2>Your session has expired</h2>
            <p className="auth-desc">Please sign in again to continue.</p>
            <a href="/login" className="auth-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <h2>Something went wrong</h2>
            <p className="auth-desc">This has been logged. You can try again, or head back to the homepage.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => reset()} className="auth-submit">
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--eb-line, #E6E8F2)',
                  color: 'inherit',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                Go home
              </a>
            </div>
            {error.digest && (
              <p style={{ fontSize: 11, color: 'var(--eb-fg-muted, #98A2B3)', marginTop: 20 }}>
                Reference: {error.digest}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
