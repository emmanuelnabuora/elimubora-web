import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { KENYA_COUNTY_CODE_TO_NAME } from '../../../../lib/kenya-counties';

interface AdminContact { id: string; fullName: string; email: string; role: string; joinedAt: string; }
interface PendingInvite { id: string; email: string; role: string; expiresAt: string; createdAt: string; }
interface ClassStreamGroup { gradeLevel: string; academicYear: number; streamNames: string[]; streamCount: number; }

interface InstitutionOverview {
  id: string; name: string; slug: string; kind: string;
  countyCode: string | null; nemisCode: string | null; status: string; createdAt: string;
  settings: Record<string, unknown>;
  enrollment: { students: number; teachers: number; parents: number; schoolAdmins: number; principals: number };
  adminContacts: AdminContact[];
  pendingAdminInvites: PendingInvite[];
  classStreams: ClassStreamGroup[];
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1f2437' }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#f6f7fc', borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2437' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7285' }}>{label}</div>
    </div>
  );
}

export default async function InstitutionOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inst = await apiFetch<InstitutionOverview>(`/v1/platform-admin/institutions/${id}`);

  return (
    <div>
      <Link href="/super-admin/institutions" style={{ fontSize: 13, color: '#5B4CF5', textDecoration: 'none' }}>
        ← Back to institutions
      </Link>
      <h1 style={{ margin: '8px 0 4px', fontSize: 28, color: '#1f2437' }}>{inst.name}</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>
        <span style={{ textTransform: 'capitalize' }}>{inst.status}</span> · {inst.slug}
      </p>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Field label="Kind" value={inst.kind} />
          <Field label="County" value={inst.countyCode ? (KENYA_COUNTY_CODE_TO_NAME[inst.countyCode] ?? inst.countyCode) : null} />
          <Field label="NEMIS code" value={inst.nemisCode} />
          <Field label="Created" value={new Date(inst.createdAt).toLocaleDateString()} />
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
        <div>
          <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 8 }}>Enrollment</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <StatCard label="Students" value={inst.enrollment.students} />
            <StatCard label="Teachers" value={inst.enrollment.teachers} />
            <StatCard label="Parents" value={inst.enrollment.parents} />
            <StatCard label="School admins" value={inst.enrollment.schoolAdmins} />
            <StatCard label="Principals" value={inst.enrollment.principals} />
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
        <div>
          <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 8 }}>Admin contacts</div>
          {inst.adminContacts.length === 0 && inst.pendingAdminInvites.length === 0 ? (
            <p style={{ fontSize: 14, color: '#98a2b3', margin: 0 }}>No admin has been assigned yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {inst.adminContacts.map((c) => (
                <div key={c.id} style={{ fontSize: 14, color: '#1f2437' }}>
                  <strong>{c.fullName}</strong>
                  <span style={{ textTransform: 'capitalize' }}> — {c.role.replace('_', ' ')}</span> · {c.email}
                  <span style={{ color: '#98a2b3' }}> · joined {new Date(c.joinedAt).toLocaleDateString()}</span>
                </div>
              ))}
              {inst.pendingAdminInvites.map((inv) => (
                <div key={inv.id} style={{ fontSize: 14, color: '#98a2b3' }}>
                  {inv.email}
                  <span style={{ textTransform: 'capitalize' }}> — {inv.role.replace('_', ' ')}</span>
                  <span style={{ color: '#B45309' }}> · invitation pending, expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
        <div>
          <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 8 }}>Academic setup</div>
          {inst.classStreams.length === 0 ? (
            <p style={{ fontSize: 14, color: '#98a2b3', margin: 0 }}>No class streams have been set up yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {inst.classStreams.map((g) => (
                <div key={`${g.gradeLevel}-${g.academicYear}`} style={{ fontSize: 14, color: '#1f2437' }}>
                  <strong>{g.gradeLevel}</strong> ({g.academicYear}) — {g.streamCount} stream{g.streamCount === 1 ? '' : 's'}:{' '}
                  {g.streamNames.join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
