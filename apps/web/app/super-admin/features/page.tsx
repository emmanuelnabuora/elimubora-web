import { apiFetch } from '../../../lib/api-client';
import { FeatureFlagControl } from '../../../components/super-admin/FeatureFlagControl';

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
}

export default async function FeaturesPage() {
  const flags = await apiFetch<FeatureFlag[]>('/v1/platform-admin/feature-flags');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Feature Management</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>{flags.length} flags</p>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Feature</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Description</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key} style={{ borderTop: '1px solid #e6e8f2' }}>
                <td style={{ padding: '12px 16px', color: '#1f2437', fontWeight: 600 }}>{f.key}</td>
                <td style={{ padding: '12px 16px', color: '#6b7285' }}>{f.description}</td>
                <td style={{ padding: '12px 16px' }}>
                  <FeatureFlagControl flagKey={f.key} enabled={f.enabled} rolloutPercentage={f.rollout_percentage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
