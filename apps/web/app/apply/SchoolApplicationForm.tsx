'use client';

import { useState, type FormEvent } from 'react';
import { KENYA_COUNTIES } from '../../lib/kenya-counties';

interface FormState {
  schoolName: string;
  countyCode: string;
  subCounty: string;
  physicalAddress: string;
  registrationNumber: string;
  educationLevel: string;
  ownership: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  notes: string;
}

const EMPTY: FormState = {
  schoolName: '',
  countyCode: '',
  subCounty: '',
  physicalAddress: '',
  registrationNumber: '',
  educationLevel: '',
  ownership: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  notes: ''
};

const EDUCATION_LEVELS = ['Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'TVET', 'University'];
const OWNERSHIP_TYPES = ['Public', 'Private', 'Faith-based', 'Community'];

/**
 * The public-facing counterpart to OnboardTenantForm.tsx's 9-step
 * wizard -- deliberately much shorter. That wizard is run by a
 * platform_admin actually provisioning a live tenant right now; this
 * form is filled in by an unauthenticated school representative who
 * is asking to be considered, not configuring anything yet. No slug,
 * no admin password, no branding/technology/finance profile -- see
 * submitSchoolApplicationSchema (school-applications.dto.ts) for the
 * exact rationale, mirrored here on the client.
 */
export function SchoolApplicationForm() {
  const [s, setS] = useState<FormState>(EMPTY);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school-applications/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolName: s.schoolName,
          countyCode: s.countyCode || undefined,
          subCounty: s.subCounty || undefined,
          physicalAddress: s.physicalAddress || undefined,
          registrationNumber: s.registrationNumber || undefined,
          educationLevel: s.educationLevel || undefined,
          ownership: s.ownership || undefined,
          adminFullName: s.adminFullName,
          adminEmail: s.adminEmail,
          adminPhone: s.adminPhone || undefined,
          notes: s.notes || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not submit your application. Please check the form and try again.');
        return;
      }
      // statusUrl is only echoed outside production (see
      // SchoolApplicationsService.submit) -- in production the
      // confirmation email is the only place it appears, matching how
      // invitation accept links already behave.
      setStatusUrl(data.statusUrl ?? null);
      setSubmitted(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="auth-card">
        <h2>Application received</h2>
        <p className="auth-desc">
          Thanks for applying to bring <strong>{s.schoolName}</strong> onto ElimuBora. Our team will review your
          application and reach out to {s.adminEmail}. We&rsquo;ve also emailed a link you can use to check its
          status any time.
        </p>
        {statusUrl && (
          <p className="auth-desc">
            (Development only — in production this link is emailed, not shown here:){' '}
            <a href={statusUrl}>{statusUrl}</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
      <div>
        <h2>Bring your school onto ElimuBora</h2>
        <p className="auth-welcome">
          Tell us about your school. Our team reviews every application before setting up full access.
        </p>
      </div>

      <label className="auth-field">
        <span>School name</span>
        <input value={s.schoolName} onChange={(e) => update('schoolName', e.target.value)} required minLength={2} autoFocus />
      </label>

      <label className="auth-field">
        <span>County</span>
        <select value={s.countyCode} onChange={(e) => update('countyCode', e.target.value)}>
          <option value="">Select a county (optional)</option>
          {KENYA_COUNTIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="auth-field">
        <span>Your full name</span>
        <input value={s.adminFullName} onChange={(e) => update('adminFullName', e.target.value)} required minLength={2} />
      </label>

      <label className="auth-field">
        <span>Your email</span>
        <input
          type="email"
          value={s.adminEmail}
          onChange={(e) => update('adminEmail', e.target.value)}
          required
        />
        <span style={{ fontWeight: 400, fontSize: 12, color: '#8a91a3' }}>
          If approved, we&rsquo;ll send your account setup link here.
        </span>
      </label>

      <label className="auth-field">
        <span>Phone number (optional)</span>
        <input value={s.adminPhone} onChange={(e) => update('adminPhone', e.target.value)} />
      </label>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        style={{
          alignSelf: 'flex-start',
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--eb-primary)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {showMore ? 'Hide additional details' : 'Add additional details (optional)'}
      </button>

      {showMore && (
        <>
          <label className="auth-field">
            <span>Sub-county (optional)</span>
            <input value={s.subCounty} onChange={(e) => update('subCounty', e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Physical address (optional)</span>
            <input value={s.physicalAddress} onChange={(e) => update('physicalAddress', e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Registration / NEMIS number (optional)</span>
            <input value={s.registrationNumber} onChange={(e) => update('registrationNumber', e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Education level (optional)</span>
            <select value={s.educationLevel} onChange={(e) => update('educationLevel', e.target.value)}>
              <option value="">Select (optional)</option>
              {EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-field">
            <span>Ownership (optional)</span>
            <select value={s.ownership} onChange={(e) => update('ownership', e.target.value)}>
              <option value="">Select (optional)</option>
              {OWNERSHIP_TYPES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-field">
            <span>Anything else we should know? (optional)</span>
            <textarea
              value={s.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              style={{ fontFamily: 'inherit', fontSize: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e8f2' }}
            />
          </label>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit application'}
      </button>

      <p className="auth-desc">
        Already applied?{' '}
        <a href="/apply/status" style={{ color: 'var(--eb-primary)' }}>
          Check your application status
        </a>
        .
      </p>
    </form>
  );
}
