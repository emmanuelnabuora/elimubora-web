'use client';

import { useEffect } from 'react';

/**
 * Rarer fallback: only used when the ROOT LAYOUT ITSELF throws (not
 * covered by error.tsx, which assumes the root layout is still
 * intact). Needs its own <html>/<body> and can't safely assume
 * global.css loaded, since the thing that might have failed is the
 * very layout that would normally provide both.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Uncaught root-layout error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F6F7FC' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div
            style={{
              maxWidth: 440,
              width: '100%',
              background: '#ffffff',
              border: '1px solid #E6E8F2',
              borderRadius: 12,
              padding: 32,
              textAlign: 'center'
            }}
          >
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#6B7285', margin: '0 0 24px' }}>
              This has been logged. Please try again shortly.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: '#5B4CF5',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Try again
            </button>
            {error.digest && (
              <p style={{ fontSize: 11, color: '#98A2B3', marginTop: 20 }}>Reference: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
