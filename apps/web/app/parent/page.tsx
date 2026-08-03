import Link from 'next/link';
import { apiFetch } from '../../lib/api-client';

interface Child {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
}

export default async function ParentOverviewPage() {
  const children = await apiFetch<Child[]>('/v1/parent-portal/children');

  return (
    <div>
      <h1 className="admin-page-title">My Children</h1>

      {children.length === 0 ? (
        <p className="admin-empty">
          No children are linked to your account yet. Contact your child&rsquo;s school administrator.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--eb-space-4)' }}>
          {children.map((c) => (
            <Link
              key={c.studentId}
              href={`/parent/children/${c.studentId}`}
              className="admin-section"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
                margin: 0
              }}
            >
              <div>
                <h2 className="admin-section-title" style={{ marginBottom: 4 }}>
                  {c.fullName}
                </h2>
                <p style={{ color: 'var(--eb-fg-muted)', fontSize: 13, margin: 0 }}>
                  Admission #{c.admissionNumber}
                </p>
              </div>
              <span className={`status-pill ${c.status === 'active' ? 'active' : 'inactive'}`}>{c.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
