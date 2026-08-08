import { apiFetch } from '../../../lib/api-client';
import { RevokeSessionsControl } from '../../../components/super-admin/RevokeSessionsControl';

interface PlatformUserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  totpEnabled: boolean;
  roles: Array<{ tenantId: string; tenantName: string; role: string; status: string }>;
  createdAt: string;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  const result = await apiFetch<{ rows: PlatformUserRow[]; total: number }>(`/v1/platform-admin/users${query}`);

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Users &amp; Identity</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>{result.total} total</p>

      <form method="get" style={{ marginBottom: 16 }}>
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or email…"
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e6e8f2', width: 320, fontSize: 14 }}
        />
      </form>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Roles</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>MFA</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#98a2b3' }}>
                  No users found.
                </td>
              </tr>
            ) : (
              result.rows.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>
                    {u.fullName}
                    <div style={{ fontSize: 12, color: '#98a2b3' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437', fontSize: 13 }}>
                    {u.roles.map((r) => `${r.role.replace('_', ' ')} @ ${r.tenantName}`).join(', ') || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.totpEnabled ? (
                      <span style={{ color: '#22C55E', fontSize: 13 }}>Enabled</span>
                    ) : (
                      <span style={{ color: '#98a2b3', fontSize: 13 }}>Not set up</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437', textTransform: 'capitalize', fontSize: 13 }}>{u.status}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <RevokeSessionsControl userId={u.id} />
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
