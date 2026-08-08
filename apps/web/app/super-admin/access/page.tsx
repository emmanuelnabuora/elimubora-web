import { apiFetch } from '../../../lib/api-client';
import { RevokeGrantControl } from '../../../components/super-admin/RevokeGrantControl';
import { ImpersonationDecisionControl } from '../../../components/super-admin/ImpersonationDecisionControl';
import { RequestImpersonationForm } from '../../../components/super-admin/RequestImpersonationForm';

interface RoleRow {
  id: string;
  key: string;
  name: string;
  riskLevel: string;
  isSystem: boolean;
  permissions: string[];
}

interface GrantRow {
  id: string;
  full_name: string;
  email: string;
  role_key: string;
  role_name: string;
  status: string;
  expires_at: string | null;
  reason: string;
}

interface ImpersonationRow {
  id: string;
  actor_name: string;
  target_name: string;
  tenant_name: string | null;
  reason: string;
  status: string;
  created_at: string;
}

export default async function AccessPage() {
  const [roles, grants, impersonation] = await Promise.all([
    apiFetch<RoleRow[]>('/v1/platform-admin/access/roles'),
    apiFetch<GrantRow[]>('/v1/platform-admin/access/grants'),
    apiFetch<ImpersonationRow[]>('/v1/platform-admin/access/impersonation')
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 28, color: '#1f2437' }}>Roles &amp; Access</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Roles</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {roles.map((r) => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#1f2437', fontSize: 14 }}>{r.name}</strong>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7285' }}>{r.riskLevel} risk</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#98a2b3' }}>
                {r.permissions.length > 0 ? r.permissions.join(', ') : 'No permissions assigned'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Active grants</h2>
        {grants.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No grants issued.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {grants.map((g) => (
              <div key={g.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14, color: '#1f2437' }}>{g.full_name}</strong>
                  <span style={{ fontSize: 12, color: '#6b7285', marginLeft: 8 }}>{g.role_name}</span>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{g.reason}</p>
                </div>
                {g.status === 'active' ? <RevokeGrantControl grantId={g.id} /> : <span style={{ fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{g.status}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, color: '#1f2437', margin: 0 }}>Impersonation requests</h2>
        </div>
        <div style={{ marginBottom: 16 }}>
          <RequestImpersonationForm />
        </div>
        {impersonation.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No impersonation requests.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {impersonation.map((i) => (
              <div key={i.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14, color: '#1f2437' }}>
                    {i.actor_name} → {i.target_name}
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{i.reason}</p>
                </div>
                <ImpersonationDecisionControl requestId={i.id} status={i.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
