import { apiFetch } from '../../../lib/api-client';

interface Plan {
  id: string;
  code: string;
  name: string;
  billing_interval: string;
  currency: string;
  price_minor: number;
  active: boolean;
}

interface Subscription {
  id: string;
  institution_id: string;
  plan_name: string;
  status: string;
  sponsor_name: string | null;
  starts_at: string;
}

interface Invoice {
  id: string;
  institution_id: string;
  invoice_number: string;
  currency: string;
  total_minor: number;
  amount_paid_minor: number;
  status: string;
  due_at: string | null;
}

function money(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function BillingPage() {
  const [plans, subscriptions, invoices] = await Promise.all([
    apiFetch<Plan[]>('/v1/platform-admin/business/plans'),
    apiFetch<Subscription[]>('/v1/platform-admin/business/subscriptions'),
    apiFetch<Invoice[]>('/v1/platform-admin/business/invoices')
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 28, color: '#1f2437' }}>Billing &amp; Plans</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Plans</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {plans.map((p) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 14, padding: 16 }}>
              <strong style={{ fontSize: 15, color: '#1f2437' }}>{p.name}</strong>
              <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700, color: '#1f2437' }}>
                {p.price_minor > 0 ? money(p.price_minor, p.currency) : 'Sponsored'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#98a2b3', textTransform: 'capitalize' }}>{p.billing_interval}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Subscriptions ({subscriptions.length})</h2>
        {subscriptions.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No subscriptions yet.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Plan</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Status</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Sponsor</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{s.plan_name}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{s.status}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{s.sponsor_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{new Date(s.starts_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, color: '#1f2437', marginBottom: 12 }}>Invoices ({invoices.length})</h2>
        {invoices.length === 0 ? (
          <p style={{ color: '#98a2b3', fontSize: 14 }}>No invoices yet.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f6f7fc', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Invoice</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Total</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Paid</th>
                  <th style={{ padding: '10px 16px', color: '#6b7285' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: '1px solid #e6e8f2' }}>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{money(inv.total_minor, inv.currency)}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437' }}>{money(inv.amount_paid_minor, inv.currency)}</td>
                    <td style={{ padding: '10px 16px', color: '#1f2437', textTransform: 'capitalize' }}>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
