import { apiFetch } from '../../../lib/api-client';
import { CreateIncidentForm } from '../../../components/super-admin/CreateIncidentForm';
import { IncidentStatusControl } from '../../../components/super-admin/IncidentStatusControl';

interface ServiceHealth {
  service_code: string;
  environment: string;
  status: string;
  latency_ms: number | null;
  error_rate: number | null;
  observed_at: string;
}

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
}

const HEALTH_COLORS: Record<string, string> = { healthy: '#22C55E', degraded: '#F59E0B', down: '#EF4444', maintenance: '#3B82F6', unknown: '#98A2B3' };

export default async function OperationsPage() {
  const [health, incidents] = await Promise.all([
    apiFetch<ServiceHealth[]>('/v1/platform-admin/command/infrastructure/health'),
    apiFetch<Incident[]>('/v1/platform-admin/command/incidents')
  ]);
  const openIncidents = incidents.filter((i) => !['resolved', 'closed'].includes(i.status));

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 28, color: '#1f2437' }}>Platform Operations</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Service health</h2>
        {health.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>
            No service health data recorded yet — this requires a monitoring job that hasn&rsquo;t been built.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {health.map((h) => (
              <div key={`${h.service_code}-${h.environment}`} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: '#1f2437' }}>{h.service_code}</strong>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: HEALTH_COLORS[h.status], padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>{h.status}</span>
                </div>
                {h.latency_ms !== null && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#98a2b3' }}>{h.latency_ms}ms latency</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, color: '#1f2437', margin: 0 }}>Incidents ({openIncidents.length} open)</h2>
        </div>
        <div style={{ marginBottom: 16 }}>
          <CreateIncidentForm />
        </div>
        {incidents.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No incidents recorded.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {incidents.map((i) => (
              <div key={i.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 11, color: '#98a2b3', marginRight: 8 }}>{i.incident_number}</span>
                  <strong style={{ fontSize: 14, color: '#1f2437' }}>{i.title}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3', textTransform: 'uppercase' }}>{i.severity}</p>
                </div>
                <IncidentStatusControl incidentId={i.id} status={i.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
