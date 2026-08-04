import { apiFetch } from '../../../lib/api-client';

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
}

export default async function SystemLogsPage() {
  const entries = await apiFetch<AuditLogEntry[]>('/v1/audit-log?limit=200');

  return (
    <div>
      <h1 className="admin-page-title">System Logs</h1>
      <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginTop: -16, marginBottom: 'var(--eb-space-6)' }}>
        The most recent {entries.length} actions recorded for your school. Append-only — nothing here can be
        edited or deleted, including by an administrator.
      </p>

      <div className="admin-section">
        {entries.length === 0 ? (
          <p className="admin-empty">No activity recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>On</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(e.occurredAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td>
                    {e.actorName ?? (
                      <span style={{ color: 'var(--eb-fg-muted)', fontStyle: 'italic', textTransform: 'capitalize' }}>
                        {e.actorType}
                      </span>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{e.action}</code>
                  </td>
                  <td style={{ color: 'var(--eb-fg-muted)' }}>{e.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
