import { apiFetch } from '../../../lib/api-client';
import { AiModelControl } from '../../../components/super-admin/AiModelControl';
import { AiReviewControl } from '../../../components/super-admin/AiReviewControl';

interface AiModel {
  id: string;
  code: string;
  display_name: string;
  provider: string;
  status: string;
  active: boolean;
  data_classification: string;
}

interface AiPolicy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

interface AiReview {
  id: string;
  feature_code: string;
  risk_category: string;
  severity: string;
  status: string;
  reason_code: string;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = { low: '#3B82F6', medium: '#F59E0B', high: '#EF4444', critical: '#B91C1C' };

export default async function AiGovernancePage() {
  const [models, policies, reviews] = await Promise.all([
    apiFetch<AiModel[]>('/v1/platform-admin/intelligence/ai/models'),
    apiFetch<AiPolicy[]>('/v1/platform-admin/intelligence/ai/policies'),
    apiFetch<AiReview[]>('/v1/platform-admin/intelligence/ai/reviews')
  ]);
  const openReviews = reviews.filter((r) => ['open', 'reviewing'].includes(r.status));

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>AI Governance</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>
        Private student AI conversations are never accessible here — this covers policy, models, and aggregate usage only.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Models</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {models.map((m) => (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 14, color: '#1f2437' }}>{m.display_name}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>
                  {m.provider} · {m.data_classification}
                </p>
              </div>
              <AiModelControl modelId={m.id} status={m.status} active={m.active} />
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Policies</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {policies.map((p) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: '#1f2437' }}>{p.name}</strong>
                <span style={{ fontSize: 12, color: p.enabled ? '#22C55E' : '#98A2B3' }}>{p.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              {p.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{p.description}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Review queue ({openReviews.length} open)</h2>
        {reviews.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No flagged AI activity.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: SEVERITY_COLORS[r.severity], padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
                      {r.severity}
                    </span>
                    <strong style={{ fontSize: 14, color: '#1f2437' }}>{r.feature_code}</strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>{r.reason_code}</p>
                </div>
                <AiReviewControl reviewId={r.id} status={r.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
