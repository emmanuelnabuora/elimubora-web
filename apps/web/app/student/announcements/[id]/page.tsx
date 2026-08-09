import { apiFetch, ApiError } from '../../../../lib/api-client';
import { AnnouncementDetail } from '../../../../components/AnnouncementDetail';

interface Announcement {
  id: string;
  title: string;
  body: string;
  gradeLevel: string | null;
  createdAt: string;
}

export default async function StudentAnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const announcement = await apiFetch<Announcement>(`/v1/announcements/${id}`);
    return <AnnouncementDetail announcement={announcement} backHref="/student/announcements" />;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Could not load this announcement.';
    return (
      <div className="admin-section">
        <p className="auth-error">{message}</p>
      </div>
    );
  }
}
