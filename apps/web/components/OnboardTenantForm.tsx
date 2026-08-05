'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const KINDS = ['school', 'county', 'university', 'tvet', 'ministry', 'partner'] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function OnboardTenantForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('school');
  const [countyCode, setCountyCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tenantId: string; adminRole: string } | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          kind,
          countyCode: countyCode || undefined,
          adminEmail,
          adminFullName,
          adminPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this organization. Try again.');
        return;
      }
      setSuccess({ tenantId: data.tenantId, adminRole: data.adminRole });
      setName('');
      setSlug('');
      setSlugTouched(false);
      setCountyCode('');
      setAdminEmail('');
      setAdminFullName('');
      setAdminPassword('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
        Creates a real tenant and its first admin account together — that account can log in immediately, no
        separate invitation step.
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Name</span>
          <input value={name} onChange={(e) => handleNameChange(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            required
            minLength={2}
            pattern="[a-z0-9-]+"
            title="Lowercase letters, numbers, and hyphens only"
          />
        </label>
        <label className="admin-field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      {kind === 'county' && (
        <label className="admin-field" style={{ marginBottom: 'var(--eb-space-3)', maxWidth: 200 }}>
          <span>County code</span>
          <input value={countyCode} onChange={(e) => setCountyCode(e.target.value)} placeholder="e.g. 047" />
        </label>
      )}

      <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8, marginBottom: 8 }}>First admin account</p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Full name</span>
          <input value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} required minLength={2} />
        </label>
        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="text"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            minLength={12}
            placeholder="At least 12 characters"
          />
        </label>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          Created — admin role assigned: {success.adminRole}. That account can log in immediately.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create organization'}
      </button>
    </form>
  );
}
