import { apiFetch } from '../../../lib/api-client';
import { ImageUploadField } from '../../../components/ImageUploadField';

interface CurrentTenant {
  id: string;
  name: string;
  slug: string;
  logoDataUrl: string | null;
}

export default async function SchoolSettingsPage() {
  const tenant = await apiFetch<CurrentTenant>('/v1/tenants/current');

  return (
    <div>
      <h1 className="admin-page-title">School Settings</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">{tenant.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 16 }}>
          This logo appears in the sidebar and header across the admin dashboard.
        </p>
        <ImageUploadField
          endpoint="/api/admin/school/logo"
          fieldName="logoDataUrl"
          currentImageUrl={tenant.logoDataUrl}
          label="logo"
          shape="square"
          maxDimension={400}
        />
      </div>
    </div>
  );
}
