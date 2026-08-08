import Link from 'next/link';
import { apiFetch } from '../../lib/api-client';

interface PlatformStats {
  totalUsers: number;
  activatedUsers: number;
  totalSchools: number;
  byRole: Array<{ role: string; count: number }>;
  byTenant: Array<{ tenantId: string; tenantName: string; tenantKind: string; count: number }>;
}

interface AdminOverview {
  institutions: number;
  activeInstitutions: number;
  users: number;
  openSecurityAlerts: number;
  openSupportTickets: number;
}

function KpiCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: '20px 22px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#6b7285', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#1f2437' }}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function SuperAdminOverviewPage() {
  const [stats, overview] = await Promise.all([
    apiFetch<PlatformStats>('/v1/tenants/platform-stats'),
    apiFetch<AdminOverview>('/v1/platform-admin/overview')
  ]);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32
        }}
      >
        <KpiCard label="Total institutions" value={stats.totalSchools} href="/super-admin/institutions" />
        <KpiCard label="Active institutions" value={overview.activeInstitutions} href="/super-admin/institutions" />
        <KpiCard label="Total users" value={stats.totalUsers} href="/super-admin/users" />
        <KpiCard label="Activated accounts" value={stats.activatedUsers} />
        <KpiCard label="Open security alerts" value={overview.openSecurityAlerts} href="/super-admin/security" />
        <KpiCard label="Open support tickets" value={overview.openSupportTickets} href="/super-admin/support" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <section style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: '#1f2437' }}>Users by role</h2>
          {stats.byRole.length === 0 ? (
            <p style={{ color: '#98a2b3', fontSize: 14 }}>No users yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {stats.byRole.map((r) => (
                  <tr key={r.role} style={{ borderTop: '1px solid #e6e8f2' }}>
                    <td style={{ padding: '10px 0', color: '#1f2437', textTransform: 'capitalize' }}>
                      {r.role.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: '#1f2437' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: '#1f2437' }}>Users by institution</h2>
          {stats.byTenant.length === 0 ? (
            <p style={{ color: '#98a2b3', fontSize: 14 }}>No institutions yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {stats.byTenant.slice(0, 10).map((t) => (
                  <tr key={t.tenantId} style={{ borderTop: '1px solid #e6e8f2' }}>
                    <td style={{ padding: '10px 0', color: '#1f2437' }}>
                      {t.tenantName}
                      <span style={{ color: '#98a2b3', fontSize: 12, marginLeft: 6 }}>({t.tenantKind})</span>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: '#1f2437' }}>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
