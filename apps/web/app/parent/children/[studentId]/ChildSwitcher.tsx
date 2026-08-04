import Link from 'next/link';

interface Child {
  studentId: string;
  fullName: string;
}

export function ChildSwitcher({ children, currentId }: { children: Child[]; currentId: string }) {
  if (children.length <= 1) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--eb-space-4)', flexWrap: 'wrap' }}>
      {children.map((c) => {
        const initials = c.fullName
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        const active = c.studentId === currentId;
        return (
          <Link
            key={c.studentId}
            href={`/parent/children/${c.studentId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px 6px 6px',
              borderRadius: 999,
              border: active ? '1px solid var(--eb-primary)' : '1px solid var(--eb-line)',
              background: active ? 'var(--eb-green-100)' : 'var(--eb-bg)',
              textDecoration: 'none',
              color: 'var(--eb-fg)',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: 'var(--eb-primary)',
                color: 'var(--eb-primary-contrast, #fff)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {initials}
            </span>
            {c.fullName}
          </Link>
        );
      })}
    </div>
  );
}
