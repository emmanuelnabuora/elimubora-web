import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';

interface Announcement {
  id: string;
  title: string;
  body: string;
  gradeLevel: string | null;
  createdAt: string;
}

export default async function TeacherAnnouncementsPage() {
  const announcements = await apiFetch<Announcement[]>('/v1/announcements');

  return (
    <div>
      <h1 className="admin-page-title">Announcements</h1>

      {announcements.length === 0 ? (
        <p className="admin-empty">No announcements yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--eb-space-4)' }}>
          {announcements.map((a) => (
            <div key={a.id} className="admin-section" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 className="admin-section-title" style={{ marginBottom: 4 }}>
                  <Link href={`/teacher/announcements/${a.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {a.title}
                  </Link>
                </h2>
                <span style={{ fontSize: 12, color: 'var(--eb-fg-muted)' }}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              {a.gradeLevel && (
                <span className="status-pill pending" style={{ marginBottom: 8, display: 'inline-block' }}>
                  {a.gradeLevel}
                </span>
              )}
              <p style={{ fontSize: 14, margin: 0 }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
