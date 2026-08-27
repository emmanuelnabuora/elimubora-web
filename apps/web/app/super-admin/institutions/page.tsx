import { apiFetch } from '../../../lib/api-client';
import { InstitutionStatusControl } from '../../../components/super-admin/InstitutionStatusControl';
import { DeleteInstitutionControl } from '../../../components/super-admin/DeleteInstitutionControl';

interface PlatformInstitution {
  id: string;
  name: string;
  slug: string;
  kind: string;
  countyCode: string | null;
  nemisCode: string | null;
  status: string;
  createdAt: string;
}

export default async function InstitutionsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  const result = await apiFetch<{ rows: PlatformInstitution[]; total: number }>(`/v1/platform-admin/institutions${query}`);

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Institutions</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>{result.total} total</p>

      <form method="get" style={{ marginBottom: 16 }}>
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, slug, or NEMIS code…"
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e6e8f2', width: 320, fontSize: 14 }}
        />
      </form>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Kind</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>County</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#98a2b3' }}>
                  No institutions found.
                </td>
              </tr>
            ) : (
              result.rows.map((inst) => (
                <tr key={inst.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>
                    {inst.name}
                    <div style={{ fontSize: 12, color: '#98a2b3' }}>{inst.slug}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{inst.kind}</td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>{inst.countyCode ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>{new Date(inst.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <InstitutionStatusControl institutionId={inst.id} status={inst.status} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <DeleteInstitutionControl institutionId={inst.id} institutionName={inst.name} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
