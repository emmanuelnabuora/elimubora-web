import { apiFetch } from '../../../lib/api-client';
import { ComposeAnnouncementForm } from '../../../components/ComposeAnnouncementForm';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  gradeLevel: string | null;
  targetStudents: boolean;
  targetParents: boolean;
  targetTeachers: boolean;
  createdAt: string;
}

function audienceLabel(a: AnnouncementItem): string {
  const parts: string[] = [];
  if (a.targetStudents) parts.push('Students');
  if (a.targetParents) parts.push('Parents');
  if (a.targetTeachers) parts.push('Teachers');
  return parts.length === 3 ? 'Everyone' : parts.join(', ');
}

export default async function AdminAnnouncementsPage() {
  const announcements = await apiFetch<AnnouncementItem[]>('/v1/announcements');

  return (
    <div>
      <h1 className="admin-page-title">Announcements</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Send an announcement</h2>
        <ComposeAnnouncementForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Sent announcements</h2>
        {announcements.length === 0 ? (
          <p className="admin-empty">No announcements sent yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--eb-space-4)' }}>
            {announcements.map((a) => (
              <div key={a.id} className="admin-section" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 className="admin-section-title" style={{ marginBottom: 4 }}>
                    {a.title}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--eb-fg-muted)' }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span className="status-pill pending">{audienceLabel(a)}</span>
                  {a.gradeLevel && <span className="status-pill pending">{a.gradeLevel}</span>}
                </div>
                <p style={{ fontSize: 14, margin: 0 }}>{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
