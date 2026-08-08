import { apiFetch } from '../../../lib/api-client';

interface Integration {
  id: string;
  code: string;
  display_name: string;
  category: string;
  environment: string;
  status: string;
  enabled: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  latency_ms: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  not_configured: '#98A2B3',
  healthy: '#22C55E',
  degraded: '#F59E0B',
  down: '#EF4444'
};

export default async function IntegrationsPage() {
  const integrations = await apiFetch<Integration[]>('/v1/platform-admin/business/integrations');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Integrations</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>
        {integrations.filter((i) => i.enabled).length} enabled of {integrations.length}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {integrations.map((i) => (
          <div key={i.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <strong style={{ fontSize: 14, color: '#1f2437' }}>{i.display_name}</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  background: STATUS_COLORS[i.status] ?? '#98A2B3',
                  padding: '2px 8px',
                  borderRadius: 999,
                  textTransform: 'capitalize'
                }}
              >
                {i.status.replace('_', ' ')}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{i.category}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: i.enabled ? '#22C55E' : '#98A2B3' }}>{i.enabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
