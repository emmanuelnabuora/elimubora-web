'use client';

import { useState, type FormEvent } from 'react';
import { KENYA_COUNTIES } from '../../lib/kenya-counties';

interface ContactRow {
  role: string;
  fullName: string;
  phone: string;
  email: string;
  preferredChannel: '' | 'EMAIL' | 'PHONE' | 'SMS';
}

interface FormState {
  // Step 0 -- School identity
  schoolName: string;
  shortName: string;
  motto: string;
  yearEstablished: string;
  educationLevel: string;
  ownership: string;
  registrationNumber: string;

  // Step 1 -- Location
  countyCode: string;
  subCounty: string;
  ward: string;
  physicalAddress: string;

  // Step 2 -- Academic setup (optional; drives auto-created class streams on approval)
  academicYear: string;
  gradeLevels: string[];
  streamsText: string;

  // Step 3 -- Administrator
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;

  // Step 4 -- Additional contacts + notes
  contacts: ContactRow[];
  notes: string;
}

const EMPTY_CONTACT: ContactRow = { role: '', fullName: '', phone: '', email: '', preferredChannel: '' };

const EMPTY: FormState = {
  schoolName: '',
  shortName: '',
  motto: '',
  yearEstablished: '',
  educationLevel: '',
  ownership: '',
  registrationNumber: '',
  countyCode: '',
  subCounty: '',
  ward: '',
  physicalAddress: '',
  academicYear: '',
  gradeLevels: [],
  streamsText: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  contacts: [],
  notes: ''
};

const EDUCATION_LEVELS = ['Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'TVET', 'University'];
const OWNERSHIP_TYPES = ['Public', 'Private', 'Faith-based', 'Community'];

// Matches the GRADE_LEVELS enum in submitSchoolApplicationSchema
// (school-applications.dto.ts) exactly, grouped for readability --
// the backend doesn't care about grouping, only the raw codes.
const GRADE_GROUPS: { label: string; levels: string[] }[] = [
  { label: 'Pre-Primary', levels: ['PP1', 'PP2'] },
  { label: 'Primary', levels: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
  { label: 'Junior Secondary', levels: ['G7', 'G8', 'G9'] },
  { label: 'Senior Secondary', levels: ['G10', 'G11', 'G12'] }
];

const CONTACT_ROLES = ['Deputy Principal', 'Bursar', 'Head of Academics', 'IT Contact', 'Other'];

const STEPS = ['School', 'Location', 'Academics', 'Administrator', 'Contacts & notes'];

function fieldStyle(): React.CSSProperties {
  return { fontFamily: 'inherit', fontSize: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e8f2' };
}

/**
 * Covers every field submitSchoolApplicationSchema accepts
 * (school-applications.dto.ts) -- the backend has supported all of
 * this since the feature shipped; only the form was ever shallower
 * than the API behind it. Academic setup (step 2) is the one section
 * that's genuinely functional rather than record-keeping: if grade
 * levels, streams, and an academic year are all present, approval
 * creates a real class stream per combination (see
 * SchoolApplicationsService.approve), the same as the
 * platform_admin wizard's own equivalent step.
 *
 * Still deliberately excludes what CreateTenantDto has that this
 * doesn't: a slug (chosen at approval, not by an unauthenticated
 * applicant) and an admin password (there's no account yet to set
 * one for -- approval sends a real invitation instead).
 */
export function SchoolApplicationForm() {
  const [s, setS] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function toggleGrade(level: string) {
    setS((prev) => ({
      ...prev,
      gradeLevels: prev.gradeLevels.includes(level)
        ? prev.gradeLevels.filter((g) => g !== level)
        : [...prev.gradeLevels, level]
    }));
  }

  function updateContact(index: number, patch: Partial<ContactRow>) {
    setS((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c))
    }));
  }

  function addContact() {
    setS((prev) => ({ ...prev, contacts: [...prev.contacts, { ...EMPTY_CONTACT }] }));
  }

  function removeContact(index: number) {
    setS((prev) => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }));
  }

  function canAdvance(): boolean {
    if (step === 0) return s.schoolName.trim().length >= 2;
    if (step === 3) return s.adminFullName.trim().length >= 2 && /\S+@\S+\.\S+/.test(s.adminEmail);
    return true;
  }

  function next() {
    if (!canAdvance()) return;
    setStep((v) => Math.min(STEPS.length - 1, v + 1));
  }
  function back() {
    setStep((v) => Math.max(0, v - 1));
  }

  const streams = s.streamsText
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canAdvance()) return;
    setLoading(true);
    setError(null);
    try {
      const contacts = s.contacts
        .filter((c) => c.fullName.trim().length > 0)
        .map((c) => ({
          role: c.role || 'Other',
          fullName: c.fullName,
          phone: c.phone || undefined,
          email: c.email || undefined,
          preferredChannel: c.preferredChannel || undefined
        }));

      const res = await fetch('/api/school-applications/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolName: s.schoolName,
          shortName: s.shortName || undefined,
          motto: s.motto || undefined,
          yearEstablished: s.yearEstablished || undefined,
          educationLevel: s.educationLevel || undefined,
          ownership: s.ownership || undefined,
          registrationNumber: s.registrationNumber || undefined,
          countyCode: s.countyCode || undefined,
          subCounty: s.subCounty || undefined,
          ward: s.ward || undefined,
          physicalAddress: s.physicalAddress || undefined,
          academicYear: s.academicYear ? Number(s.academicYear) : undefined,
          gradeLevels: s.gradeLevels.length ? s.gradeLevels : undefined,
          streams: streams.length ? streams : undefined,
          adminFullName: s.adminFullName,
          adminEmail: s.adminEmail,
          adminPhone: s.adminPhone || undefined,
          contacts: contacts.length ? contacts : undefined,
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
        <a
          href="/"
          className="auth-submit"
          style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}
        >
          Return home
        </a>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} style={{ maxWidth: 620 }}>
      <div>
        <h2>Bring your school onto ElimuBora</h2>
        <p className="auth-welcome">
          Tell us about your school. Our team reviews every application before setting up full access.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => (i <= step || canAdvance() ? setStep(i) : null)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 999,
              border: i === step ? '1.5px solid var(--eb-primary)' : '1px solid #e6e8f2',
              background: i === step ? '#f6f4ff' : 'transparent',
              color: i === step ? 'var(--eb-primary)' : '#8a91a3',
              cursor: 'pointer'
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <>
          <label className="auth-field">
            <span>School name</span>
            <input value={s.schoolName} onChange={(e) => update('schoolName', e.target.value)} required minLength={2} autoFocus />
          </label>
          <label className="auth-field">
            <span>Short name (optional)</span>
            <input value={s.shortName} onChange={(e) => update('shortName', e.target.value)} placeholder="e.g. how staff refer to the school day-to-day" />
          </label>
          <label className="auth-field">
            <span>Motto (optional)</span>
            <input value={s.motto} onChange={(e) => update('motto', e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="auth-field" style={{ flex: 1 }}>
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
            <label className="auth-field" style={{ flex: 1 }}>
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
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="auth-field" style={{ flex: 1 }}>
              <span>Year established (optional)</span>
              <input value={s.yearEstablished} onChange={(e) => update('yearEstablished', e.target.value)} maxLength={4} placeholder="e.g. 1998" />
            </label>
            <label className="auth-field" style={{ flex: 1 }}>
              <span>Registration / NEMIS number (optional)</span>
              <input value={s.registrationNumber} onChange={(e) => update('registrationNumber', e.target.value)} />
            </label>
          </div>
        </>
      )}

      {step === 1 && (
        <>
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
            <span>Sub-county (optional)</span>
            <input value={s.subCounty} onChange={(e) => update('subCounty', e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Ward (optional)</span>
            <input value={s.ward} onChange={(e) => update('ward', e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Physical address (optional)</span>
            <input value={s.physicalAddress} onChange={(e) => update('physicalAddress', e.target.value)} />
          </label>
        </>
      )}

      {step === 2 && (
        <>
          <p className="auth-desc" style={{ margin: 0 }}>
            Optional — but if you tell us your grade levels and streams, we&rsquo;ll set up your class list
            automatically the moment you&rsquo;re approved.
          </p>
          <label className="auth-field">
            <span>Current academic year (optional)</span>
            <input
              type="number"
              value={s.academicYear}
              onChange={(e) => update('academicYear', e.target.value)}
              placeholder="e.g. 2026"
              min={2020}
              max={2100}
            />
          </label>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Grade levels (optional)</span>
            {GRADE_GROUPS.map((group) => (
              <div key={group.label} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8a91a3', display: 'block', marginBottom: 4 }}>{group.label}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {group.levels.map((level) => (
                    <label
                      key={level}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 13,
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: s.gradeLevels.includes(level) ? '1.5px solid var(--eb-primary)' : '1px solid #e6e8f2',
                        color: s.gradeLevels.includes(level) ? 'var(--eb-primary)' : '#3a3f52',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={s.gradeLevels.includes(level)}
                        onChange={() => toggleGrade(level)}
                        style={{ margin: 0 }}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className="auth-field">
            <span>Streams (optional)</span>
            <input value={s.streamsText} onChange={(e) => update('streamsText', e.target.value)} placeholder="e.g. A, B, C" />
            <span style={{ fontWeight: 400, fontSize: 12, color: '#8a91a3' }}>Separate stream names with commas.</span>
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <label className="auth-field">
            <span>Your full name</span>
            <input value={s.adminFullName} onChange={(e) => update('adminFullName', e.target.value)} required minLength={2} />
          </label>
          <label className="auth-field">
            <span>Your email</span>
            <input type="email" value={s.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} required />
            <span style={{ fontWeight: 400, fontSize: 12, color: '#8a91a3' }}>
              If approved, we&rsquo;ll send your account setup link here.
            </span>
          </label>
          <label className="auth-field">
            <span>Phone number (optional)</span>
            <input value={s.adminPhone} onChange={(e) => update('adminPhone', e.target.value)} />
          </label>
        </>
      )}

      {step === 4 && (
        <>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>
              Additional contacts (optional)
            </span>
            {s.contacts.map((contact, i) => (
              <div key={i} style={{ border: '1px solid #e6e8f2', borderRadius: 12, padding: 12, marginBottom: 8, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={contact.role}
                    onChange={(e) => updateContact(i, { role: e.target.value })}
                    style={{ ...fieldStyle(), flex: 1 }}
                  >
                    <option value="">Role</option>
                    {CONTACT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={contact.fullName}
                  onChange={(e) => updateContact(i, { fullName: e.target.value })}
                  placeholder="Full name"
                  style={fieldStyle()}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={contact.email}
                    onChange={(e) => updateContact(i, { email: e.target.value })}
                    placeholder="Email (optional)"
                    style={{ ...fieldStyle(), flex: 1 }}
                  />
                  <input
                    value={contact.phone}
                    onChange={(e) => updateContact(i, { phone: e.target.value })}
                    placeholder="Phone (optional)"
                    style={{ ...fieldStyle(), flex: 1 }}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addContact}
              style={{
                fontSize: 13,
                fontWeight: 600,
                background: 'none',
                border: '1px dashed #c9cbe0',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                color: 'var(--eb-primary)',
                width: '100%'
              }}
            >
              + Add a contact
            </button>
          </div>

          <label className="auth-field">
            <span>Anything else we should know? (optional)</span>
            <textarea value={s.notes} onChange={(e) => update('notes', e.target.value)} rows={3} style={fieldStyle()} />
          </label>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: 'none',
            border: '1px solid #e6e8f2',
            borderRadius: 10,
            padding: '10px 16px',
            cursor: step === 0 ? 'default' : 'pointer',
            opacity: step === 0 ? 0.4 : 1
          }}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="auth-submit" onClick={next} disabled={!canAdvance()} style={{ flex: 1 }}>
            Continue
          </button>
        ) : (
          <button type="submit" className="auth-submit" disabled={loading || !canAdvance()} style={{ flex: 1 }}>
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        )}
      </div>

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
