'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface ParentAccount {
  userId: string;
  fullName: string;
  email: string;
}

export function AddGuardianForm({
  studentId,
  parentAccounts
}: {
  studentId: string;
  parentAccounts: ParentAccount[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [canPickup, setCanPickup] = useState(true);
  const [linkToUserId, setLinkToUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/guardians`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
          relationship,
          isPrimary,
          canPickup,
          linkToUserId: linkToUserId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not add this guardian. Try again.');
        return;
      }
      setSuccess(
        linkToUserId ? `${data.fullName} added and linked to their portal account.` : `${data.fullName} added.`
      );
      setFullName('');
      setPhone('');
      setEmail('');
      setRelationship('');
      setLinkToUserId('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Relationship</span>
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            required
            placeholder="e.g. Mother, Father, Guardian"
          />
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Phone (optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <div className="admin-form-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary guardian
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={canPickup} onChange={(e) => setCanPickup(e.target.checked)} />
          Authorized for pickup
        </label>
      </div>
      <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Link to an existing parent portal account (optional)</span>
        <select value={linkToUserId} onChange={(e) => setLinkToUserId(e.target.value)}>
          <option value="">Don&rsquo;t link a portal account</option>
          {parentAccounts.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.fullName} ({p.email})
            </option>
          ))}
        </select>
      </label>
      {parentAccounts.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -8, marginBottom: 'var(--eb-space-3)' }}>
          No parent accounts exist yet — invite one from the Staff page (role: parent), or leave this unlinked for
          now.
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add guardian'}
      </button>
    </form>
  );
}
