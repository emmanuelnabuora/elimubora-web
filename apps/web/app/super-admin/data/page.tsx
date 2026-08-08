import { apiFetch } from '../../../lib/api-client';
import { RequestExportForm } from '../../../components/super-admin/RequestExportForm';

interface QualityIssue {
  id: string;
  domain: string;
  issue_code: string;
  severity: string;
  summary: string;
  status: string;
}

interface DataExport {
  id: string;
  export_type: string;
  format: string;
  status: string;
  row_count: number | null;
  created_at: string;
}

interface RetentionPolicy {
  id: string;
  domain: string;
  retention_days: number;
  legal_hold: boolean;
}

export default async function DataManagementPage() {
  const [quality, exports, retention] = await Promise.all([
    apiFetch<QualityIssue[]>('/v1/platform-admin/intelligence/data/quality'),
    apiFetch<DataExport[]>('/v1/platform-admin/intelligence/data/exports'),
    apiFetch<RetentionPolicy[]>('/v1/platform-admin/intelligence/data/retention')
  ]);
  const openIssues = quality.filter((q) => q.status === 'open');

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 28, color: '#1f2437' }}>Data Management</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Data quality ({openIssues.length} open)</h2>
        {quality.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No data quality issues detected.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {quality.map((q) => (
              <div key={q.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 12, padding: 12, fontSize: 13 }}>
                <strong style={{ color: '#1f2437' }}>{q.domain}</strong>
                <span style={{ color: '#98a2b3', marginLeft: 8 }}>{q.summary}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Exports</h2>
        <div style={{ marginBottom: 12 }}>
          <RequestExportForm />
        </div>
        {exports.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No exports requested yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {exports.map((e) => (
              <div key={e.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 12, padding: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {e.export_type} ({e.format})
                </span>
                <span style={{ color: '#98a2b3', textTransform: 'capitalize' }}>{e.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Retention policies</h2>
        {retention.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No retention policies configured.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {retention.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 12, padding: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textTransform: 'capitalize' }}>{r.domain}</span>
                <span>
                  {r.retention_days} days{r.legal_hold && ' · legal hold'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
