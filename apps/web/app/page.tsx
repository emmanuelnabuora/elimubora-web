interface Health {
  status: string;
  db: { status: string; latencyMs: number };
  version: string;
}

async function fetchHealth(): Promise<Health | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await fetchHealth();
  const up = health?.status === 'ok';

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--eb-space-6)'
      }}
    >
      <section
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--eb-surface)',
          border: '1px solid var(--eb-line)',
          borderRadius: 'var(--eb-radius-md)',
          padding: 'var(--eb-space-8)'
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--eb-fg-muted)'
          }}
        >
          Platform status
        </p>
        <h1 style={{ fontFamily: 'var(--eb-font-display)', margin: '8px 0 4px', fontSize: 32 }}>
          ElimuBora
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--eb-fg-muted)' }}>
          Kenya&rsquo;s National Digital Education Platform — Sprint 1 foundation.
        </p>
        <dl style={{ display: 'grid', gap: 12, margin: 0 }}>
          <Row label="API" value={up ? 'Operational' : 'Unreachable'} ok={up} />
          <Row
            label="Database"
            value={up ? `Connected · ${health!.db.latencyMs} ms` : 'Unknown'}
            ok={up}
          />
          <Row label="Version" value={health?.version ?? '—'} ok={up} neutral />
        </dl>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  ok,
  neutral
}: {
  label: string;
  value: string;
  ok: boolean;
  neutral?: boolean;
}) {
  const color = neutral ? 'var(--eb-fg)' : ok ? 'var(--eb-primary)' : 'var(--eb-danger)';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--eb-line)',
        paddingTop: 12
      }}
    >
      <dt style={{ color: 'var(--eb-fg-muted)' }}>{label}</dt>
      <dd style={{ margin: 0, color, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
