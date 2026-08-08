import { apiFetch } from '../../../lib/api-client';

interface MetricRow {
  metric_date: string;
  metric_key: string;
  metric_value: number;
}

export default async function AnalyticsPage() {
  const national = await apiFetch<MetricRow[]>('/v1/platform-admin/intelligence/analytics/national?days=30');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>National Analytics</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>Last 30 days</p>

      {national.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 24 }}>
          <p style={{ color: '#98a2b3', fontSize: 14, margin: 0 }}>
            No analytics metrics have been recorded yet. This table is populated by a scheduled aggregation job that
            hasn&rsquo;t been built yet — this page shows real data once that job exists, not before.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Date</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Metric</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {national.map((m, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '10px 16px', color: '#1f2437' }}>{new Date(m.metric_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px', color: '#1f2437' }}>{m.metric_key}</td>
                  <td style={{ padding: '10px 16px', color: '#1f2437', fontWeight: 600 }}>{m.metric_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
