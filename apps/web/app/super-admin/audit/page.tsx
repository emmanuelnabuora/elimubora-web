import { apiFetch } from '../../../lib/api-client';
import { CreateComplianceRequestForm } from '../../../components/super-admin/CreateComplianceRequestForm';

interface ComplianceRequest {
  id: string;
  request_number: string;
  request_type: string;
  subject_type: string;
  subject_reference: string;
  status: string;
  priority: string;
  created_at: string;
}

export default async function AuditCompliancePage() {
  const requests = await apiFetch<ComplianceRequest[]>('/v1/platform-admin/command/compliance/requests');
  const open = requests.filter((r) => !['completed', 'rejected', 'cancelled'].includes(r.status));

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Audit &amp; Compliance</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>
        {open.length} open of {requests.length} data subject requests
      </p>

      <div style={{ marginBottom: 16 }}>
        <CreateComplianceRequestForm />
      </div>

      {requests.length === 0 ? (
        <p style={{ color: '#98a2b3', fontSize: 14 }}>No compliance requests recorded.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Reference</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Type</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Subject</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Priority</th>
                <th style={{ padding: '10px 16px', color: '#6b7285' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '10px 16px', color: '#1f2437' }}>{r.request_number}</td>
                  <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{r.request_type.replace('_', ' ')}</td>
                  <td style={{ padding: '10px 16px', color: '#1f2437' }}>
                    {r.subject_type}: {r.subject_reference}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{r.priority}</td>
                  <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
