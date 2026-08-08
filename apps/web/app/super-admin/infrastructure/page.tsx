import { apiFetch } from '../../../lib/api-client';
import { RestoreApprovalControl } from '../../../components/super-admin/RestoreApprovalControl';

interface Deployment {
  id: string;
  service_code: string;
  environment: string;
  version: string;
  status: string;
  started_at: string;
}

interface ReadinessCheck {
  id: string;
  check_code: string;
  category: string;
  status: string;
  checked_at: string;
}

interface RestoreRequest {
  id: string;
  environment: string;
  status: string;
  reason: string;
  requested_at: string;
}

const READINESS_COLORS: Record<string, string> = { pass: '#22C55E', warn: '#F59E0B', fail: '#EF4444', not_run: '#98A2B3' };

export default async function InfrastructurePage() {
  const [deployments, readiness, restores] = await Promise.all([
    apiFetch<Deployment[]>('/v1/platform-admin/command/deployments'),
    apiFetch<ReadinessCheck[]>('/v1/platform-admin/command/readiness'),
    apiFetch<RestoreRequest[]>('/v1/platform-admin/command/recovery/restores')
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 28, color: '#1f2437' }}>Infrastructure</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Production readiness</h2>
        {readiness.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No readiness checks recorded yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {readiness.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#1f2437' }}>{r.check_code}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: READINESS_COLORS[r.status], padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Restore requests</h2>
        <p style={{ fontSize: 13, color: '#98a2b3', marginBottom: 10 }}>
          Requesting a restore only creates a tracking record awaiting approval — nothing here triggers an actual
          infrastructure restore. Approving requires a different platform administrator than whoever requested it.
        </p>
        {restores.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No restore requests.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {restores.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14, color: '#1f2437', textTransform: 'capitalize' }}>{r.environment}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{r.reason}</p>
                </div>
                <RestoreApprovalControl restoreId={r.id} status={r.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Recent deployments</h2>
        {deployments.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No deployments recorded yet.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Service</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Version</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Environment</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{d.service_code}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{d.version}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{d.environment}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
