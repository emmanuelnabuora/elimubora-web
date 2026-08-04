import { apiFetch } from '../../../lib/api-client';
import { LibraryFilters } from './LibraryFilters';
import { ResourceCard } from './ResourceCard';

interface LibraryResource {
  id: string;
  title: string;
  resourceType: string;
  subject: string;
  gradeLevel: string | null;
  description: string | null;
  tags: string[];
}

const RESOURCE_TYPES = ['book', 'video', 'simulation', 'past_paper', 'teacher_guide', 'interactive'];

export default async function LibraryPage({
  searchParams
}: {
  searchParams: Promise<{ subject?: string; resourceType?: string }>;
}) {
  const { subject, resourceType } = await searchParams;

  const query = new URLSearchParams();
  if (subject) query.set('subject', subject);
  if (resourceType) query.set('resourceType', resourceType);

  const [resources, recent] = await Promise.all([
    apiFetch<LibraryResource[]>(`/v1/library/resources${query.toString() ? `?${query.toString()}` : ''}`),
    apiFetch<LibraryResource[]>('/v1/library/resources/recent')
  ]);

  return (
    <div>
      <h1 className="admin-page-title">Library</h1>

      {recent.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Recently viewed</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {recent.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        </div>
      )}

      <div className="admin-section">
        <LibraryFilters resourceTypes={RESOURCE_TYPES} subject={subject} resourceType={resourceType} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Resources ({resources.length})</h2>
        {resources.length === 0 ? (
          <p className="admin-empty">No resources match these filters.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
