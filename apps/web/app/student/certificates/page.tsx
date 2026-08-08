import { apiFetch } from '../../../lib/api-client';
import { getCurrentUser } from '../../../lib/get-current-user';

interface Certificate {
  id: string;
  title: string;
  certificateNumber: string;
  issuedAt: string;
}

export default async function StudentCertificatesPage() {
  const result = await getCurrentUser();
  const userId = result!.user.id;
  const certificates = await apiFetch<Certificate[]>(`/v1/certificates/student/${userId}`);

  return (
    <div>
      <h1 className="admin-page-title">Certificates</h1>

      <div className="admin-section">
        {certificates.length === 0 ? (
          <p className="admin-empty">No certificates issued yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {certificates.map((c) => (
              <div
                key={c.id}
                style={{
                  border: '1px solid var(--eb-line)',
                  borderRadius: 16,
                  padding: 16
                }}
              >
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{c.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--eb-fg-muted)' }}>
                  {c.certificateNumber} \u2022 Issued {new Date(c.issuedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
