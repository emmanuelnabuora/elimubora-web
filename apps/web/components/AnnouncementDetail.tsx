import Link from 'next/link';

interface Announcement {
  id: string;
  title: string;
  body: string;
  gradeLevel: string | null;
  createdAt: string;
}

export function AnnouncementDetail({ announcement, backHref }: { announcement: Announcement; backHref: string }) {
  return (
    <div>
      <Link href={backHref} style={{ fontSize: 13, color: 'var(--eb-primary)', textDecoration: 'none' }}>
        ← Back to announcements
      </Link>
      <div className="admin-section" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h1 className="admin-page-title" style={{ margin: 0 }}>
            {announcement.title}
          </h1>
          <span style={{ fontSize: 13, color: 'var(--eb-fg-muted)' }}>
            {new Date(announcement.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
        {announcement.gradeLevel && (
          <span className="status-pill pending" style={{ marginBottom: 16, display: 'inline-block' }}>
            {announcement.gradeLevel}
          </span>
        )}
        <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
      </div>
    </div>
  );
}
