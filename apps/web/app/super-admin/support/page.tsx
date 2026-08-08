import { apiFetch } from '../../../lib/api-client';
import { SupportTicketStatusControl } from '../../../components/super-admin/SupportTicketStatusControl';

interface SupportTicket {
  id: string;
  ticket_number: number;
  category: string;
  priority: string;
  subject: string;
  status: string;
  created_at: string;
}

export default async function SupportPage() {
  const tickets = await apiFetch<SupportTicket[]>('/v1/platform-admin/support/tickets');
  const open = tickets.filter((t) => !['resolved', 'closed'].includes(t.status));

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, color: '#1f2437' }}>Support</h1>
      <p style={{ color: '#6b7285', fontSize: 14, marginBottom: 20 }}>{open.length} open of {tickets.length} total</p>

      <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>#</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Subject</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Priority</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '12px 16px', color: '#6b7285', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#98a2b3' }}>
                  No support tickets.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                  <td style={{ padding: '12px 16px', color: '#98a2b3' }}>#{t.ticket_number}</td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>{t.subject}</td>
                  <td style={{ padding: '12px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{t.priority}</td>
                  <td style={{ padding: '12px 16px', color: '#1f2437' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <SupportTicketStatusControl ticketId={t.id} status={t.status} />
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
