'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const PERMISSION_FIELDS: Array<{ key: string; label: string; defaultChecked: boolean }> = [
  { key: 'view_academics', label: 'View academics', defaultChecked: true },
  { key: 'view_attendance', label: 'View attendance', defaultChecked: true },
  { key: 'receive_announcements', label: 'Receive announcements', defaultChecked: true },
  { key: 'view_finance', label: 'View finance', defaultChecked: true },
  { key: 'pay_fees', label: 'Pay fees', defaultChecked: true },
  { key: 'authorize_student_changes', label: 'Authorize student changes', defaultChecked: false }
];

export function InviteGuardianForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [canPickup, setCanPickup] = useState(true);
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_FIELDS.map((f) => [f.key, f.defaultChecked]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function togglePermission(key: string) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/guardian-invitations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, relationship, isPrimary, canPickup, isEmergencyContact, permissions })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not send this invitation. Try again.');
        return;
      }
      setSuccess(`Invitation sent to ${email}. It'll show up below until they accept.`);
      setEmail('');
      setRelationship('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -4, marginBottom: 'var(--eb-space-3)' }}>
        Sends a real account-creation link. When they accept it, their account is created (or reused, if they
        already have one) and linked to this student in one step.
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Guardian&rsquo;s email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary guardian
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={canPickup} onChange={(e) => setCanPickup(e.target.checked)} />
          Authorized for pickup
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={isEmergencyContact}
            onChange={(e) => setIsEmergencyContact(e.target.checked)}
          />
          Emergency contact
        </label>
      </div>
      <div className="admin-field" style={{ marginBottom: 'var(--eb-space-3)' }}>
        <span>Portal access</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 8,
            marginTop: 6
          }}
        >
          {PERMISSION_FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={permissions[f.key]} onChange={() => togglePermission(f.key)} />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  );
}
