import { apiFetch } from '../../../lib/api-client';
import { CreateBroadcastForm } from '../../../components/super-admin/CreateBroadcastForm';
import { BroadcastActionControl } from '../../../components/super-admin/BroadcastActionControl';

interface Broadcast {
  id: string;
  title: string;
  channel: string;
  audience_type: string;
  status: string;
  created_at: string;
}

export default async function CommunicationsPage() {
  const broadcasts = await apiFetch<Broadcast[]>('/v1/platform-admin/business/broadcasts');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Communications</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 16 }}>
        Broadcasts require approval from a different platform administrator than the one who created them before they
        can be published.
      </p>

      <div style={{ marginBottom: 20 }}>
        <CreateBroadcastForm />
      </div>

      {broadcasts.length === 0 ? (
        <p style={{ color: '#98a2b3', fontSize: 14 }}>No broadcasts yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {broadcasts.map((b) => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 14, color: '#1f2437' }}>{b.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#98a2b3' }}>
                  {b.channel} · {b.audience_type.replace('_', ' ')} · {new Date(b.created_at).toLocaleDateString()}
                </p>
              </div>
              <BroadcastActionControl broadcastId={b.id} status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
