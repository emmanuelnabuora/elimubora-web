import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';
import { KENYA_COUNTY_CODE_TO_NAME } from '../../../lib/kenya-counties';
import { SchoolApplicationReviewActions } from '../../../components/super-admin/SchoolApplicationReviewActions';

interface SchoolApplicationSummary {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  schoolName: string;
  countyCode: string | null;
  adminFullName: string;
  adminEmail: string;
  submittedAt: string;
  reviewedAt: string | null;
}

const TABS: Array<{ label: string; value: 'pending' | 'approved' | 'rejected' | undefined }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: undefined }
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444'
};

export default async function SchoolApplicationsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = status === 'approved' || status === 'rejected' ? status : status === 'all' ? undefined : 'pending';
  const query = activeStatus ? `?status=${activeStatus}` : '';
  const rows = await apiFetch<SchoolApplicationSummary[]>(`/v1/admin/school-applications${query}`);

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>School Applications</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>
        Self-serve onboarding requests, awaiting review before a tenant is created.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((tab) => {
          const isActive = tab.value === activeStatus || (tab.value === undefined && activeStatus === undefined);
          const href = tab.value ? `?status=${tab.value}` : '?status=all';
          return (
            <Link
              key={tab.label}
              href={href}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 999,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#6b7285',
                background: isActive ? '#5B4CF5' : '#f6f7fc'
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>School</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>County</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Contact</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Submitted</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#98a2b3' }}>
                  No applications found.
                </td>
              </tr>
            ) : (
              rows.map((app) => (
                <tr key={app.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>
                    <Link href={`/super-admin/school-applications/${app.id}`} style={{ color: '#1f2437', fontWeight: 600, textDecoration: 'none' }}>
                      {app.schoolName}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>
                    {app.countyCode ? (KENYA_COUNTY_CODE_TO_NAME[app.countyCode] ?? app.countyCode) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>
                    {app.adminFullName}
                    <div style={{ fontSize: 12, color: '#98a2b3' }}>{app.adminEmail}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>{new Date(app.submittedAt).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 999,
                        color: '#fff',
                        background: STATUS_COLORS[app.status] ?? '#98A2B3',
                        textTransform: 'capitalize'
                      }}
                    >
                      {app.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {app.status === 'pending' ? (
                      <SchoolApplicationReviewActions applicationId={app.id} schoolName={app.schoolName} />
                    ) : (
                      <span style={{ fontSize: 12, color: '#98a2b3' }}>
                        {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
