import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { KENYA_COUNTY_CODE_TO_NAME } from '../../../../lib/kenya-counties';
import { SchoolApplicationReviewActions } from '../../../../components/super-admin/SchoolApplicationReviewActions';
import { SchoolApplicationResendInvitation } from '../../../../components/super-admin/SchoolApplicationResendInvitation';

interface ContactRow {
  role?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
}

interface SchoolApplicationDetail {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  schoolName: string;
  countyCode: string | null;
  subCounty: string | null;
  ward: string | null;
  physicalAddress: string | null;
  shortName: string | null;
  registrationNumber: string | null;
  educationLevel: string | null;
  ownership: string | null;
  yearEstablished: string | null;
  motto: string | null;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string | null;
  contacts: ContactRow[] | null;
  academicYear: number | null;
  gradeLevels: string[] | null;
  streams: string[] | null;
  notes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  resultingTenantId: string | null;
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

export default async function SchoolApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await apiFetch<SchoolApplicationDetail>(`/v1/admin/school-applications/${id}`);

  return (
    <div>
      <Link href="/super-admin/school-applications" style={{ fontSize: 13, color: '#5B4CF5', textDecoration: 'none' }}>
        ← Back to applications
      </Link>
      <h1 style={{ margin: '8px 0 4px', fontSize: 28, color: '#1f2437' }}>{app.schoolName}</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20, textTransform: 'capitalize' }}>{app.status}</p>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Field label="County" value={app.countyCode ? (KENYA_COUNTY_CODE_TO_NAME[app.countyCode] ?? app.countyCode) : null} />
          <Field label="Sub-county" value={app.subCounty} />
          <Field label="Ward" value={app.ward} />
          <Field label="Physical address" value={app.physicalAddress} />
          <Field label="Short name" value={app.shortName} />
          <Field label="Registration / NEMIS number" value={app.registrationNumber} />
          <Field label="Education level" value={app.educationLevel} />
          <Field label="Ownership" value={app.ownership} />
          <Field label="Year established" value={app.yearEstablished} />
          <Field label="Motto" value={app.motto} />
        </div>

        {(app.academicYear || app.gradeLevels?.length || app.streams?.length) && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Field label="Academic year" value={app.academicYear ? String(app.academicYear) : null} />
              <Field label="Grade levels" value={app.gradeLevels?.length ? app.gradeLevels.join(', ') : null} />
              <Field label="Streams" value={app.streams?.length ? app.streams.join(', ') : null} />
            </div>
            {app.gradeLevels?.length && app.streams?.length && app.academicYear && (
              <p style={{ fontSize: 12, color: '#98a2b3', margin: 0 }}>
                Approving this application will automatically create {app.gradeLevels.length * app.streams.length} class
                stream{app.gradeLevels.length * app.streams.length === 1 ? '' : 's'} for academic year {app.academicYear}.
              </p>
            )}
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Field label="Contact name" value={app.adminFullName} />
          <Field label="Contact email" value={app.adminEmail} />
          <Field label="Contact phone" value={app.adminPhone} />
        </div>

        {app.contacts && app.contacts.length > 0 && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
            <div>
              <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 8 }}>Additional contacts</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {app.contacts.map((c, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#1f2437' }}>
                    <strong>{c.fullName ?? 'Unnamed'}</strong>
                    {c.role ? ` — ${c.role}` : ''}
                    {c.email ? ` · ${c.email}` : ''}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {app.notes && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
            <Field label="Notes from applicant" value={app.notes} />
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Field label="Submitted" value={new Date(app.submittedAt).toLocaleString()} />
          {app.reviewedAt && <Field label="Reviewed" value={new Date(app.reviewedAt).toLocaleString()} />}
          {app.rejectionReason && <Field label="Rejection reason" value={app.rejectionReason} />}
        </div>

        {app.status === 'pending' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
            <SchoolApplicationReviewActions applicationId={app.id} schoolName={app.schoolName} />
          </>
        )}

        {app.status === 'approved' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #e6e8f2' }} />
            <div>
              <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 8 }}>
                If {app.adminFullName}&rsquo;s invite link has expired or they never received it, send a new one.
              </div>
              <SchoolApplicationResendInvitation applicationId={app.id} adminFullName={app.adminFullName} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
