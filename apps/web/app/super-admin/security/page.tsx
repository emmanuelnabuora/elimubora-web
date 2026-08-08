import { apiFetch } from '../../../lib/api-client';
import { AcknowledgeAlertControl } from '../../../components/super-admin/AcknowledgeAlertControl';

interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: '#3B82F6',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#B91C1C'
};

export default async function SecurityPage() {
  const alerts = await apiFetch<SecurityAlert[]>('/v1/platform-admin/security/alerts');
  const open = alerts.filter((a) => a.status === 'open');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Security</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>{open.length} open of {alerts.length} total</p>

      {alerts.length === 0 ? (
        <p style={{ color: '#98a2b3' }}>No security alerts.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {alerts.map((a) => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: SEVERITY_COLORS[a.severity], padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
                    {a.severity}
                  </span>
                  <strong style={{ color: '#1f2437', fontSize: 14 }}>{a.title}</strong>
                </div>
                {a.detail && <p style={{ margin: 0, fontSize: 13, color: '#6b7285' }}>{a.detail}</p>}
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{new Date(a.created_at).toLocaleString()}</p>
              </div>
              {a.status === 'open' ? (
                <AcknowledgeAlertControl alertId={a.id} />
              ) : (
                <span style={{ fontSize: 12, color: '#22C55E', textTransform: 'capitalize' }}>{a.status}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
