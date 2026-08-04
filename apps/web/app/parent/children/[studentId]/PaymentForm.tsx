'use client';

import { useState, type FormEvent } from 'react';

interface Invoice {
  id: string;
  academicYear: number;
  term: number;
  amountDue: string;
  amountPaid: string;
  status: string;
}

export function PaymentForm({ invoices }: { invoices: Invoice[] }) {
  const payable = invoices.filter((inv) => inv.status !== 'paid');
  const [invoiceId, setInvoiceId] = useState(payable[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string } | null>(null);

  if (payable.length === 0) {
    return <p className="admin-empty">No outstanding invoices to pay.</p>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/parent/invoices/${invoiceId}/mpesa`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), phone })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not start this payment. Try again.');
        return;
      }
      setResult({ reference: data.reference });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div>
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)', marginBottom: 8 }}>
          Payment initiated — reference {result.reference}.
        </p>
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)' }}>
          This runs in a sandbox environment right now: no real M-Pesa STK push is sent and no money moves. In
          production this would prompt on your phone immediately. The payment will show as &ldquo;pending&rdquo;
          until confirmed — that confirmation isn&rsquo;t automatic in this sandbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
        Runs against a real sandbox payment gateway — no real M-Pesa charge occurs, and the resulting payment stays
        &ldquo;pending&rdquo; rather than auto-confirming.
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Invoice</span>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
            {payable.map((inv) => {
              const balance = Number(inv.amountDue) - Number(inv.amountPaid);
              return (
                <option key={inv.id} value={inv.id}>
                  {inv.academicYear} T{inv.term} — KES {balance.toLocaleString()} due
                </option>
              );
            })}
          </select>
        </label>
        <label className="admin-field">
          <span>Amount (KES)</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)', maxWidth: 240 }}>
        <span>M-Pesa phone number</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+254712345678"
          pattern="\+254\d{9}"
          required
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send STK push'}
      </button>
    </form>
  );
}
