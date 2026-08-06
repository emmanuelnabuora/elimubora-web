'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const KINDS = ['school', 'county', 'university', 'tvet', 'ministry', 'partner'] as const;
const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
];
const FACILITY_OPTIONS = [
  'Library', 'Computer Laboratory', 'Science Laboratory', 'Boarding', 'Transport',
  'School Clinic', 'Counselling Office', 'Dining Hall', 'Kitchen', 'Sports Ground',
  'Special Needs Facilities', 'Workshops'
];
const PAYMENT_METHOD_OPTIONS = ['M-Pesa', 'Bank Transfer', 'Cash', 'Cheque'];
// The 47 counties of Kenya. Stored by name in the countyCode field --
// deliberately, not the official numeric IEBC codes: maintaining an
// accurate 47-entry name-to-code mapping by hand risks quietly
// getting some wrong, which is worse than a plain, correct name. The
// column itself is free text with no format constraint, so this is
// safe.
const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay',
  'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii',
  'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi',
  'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta',
  'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga',
  'Wajir', 'West Pokot'
];

const STEPS = ['Institution', 'Location', 'Academics', 'Facilities', 'Technology', 'Finance', 'Branding', 'Administrator', 'Review'];

interface WizardState {
  name: string;
  slug: string;
  slugTouched: boolean;
  kind: (typeof KINDS)[number];
  countyCode: string;
  subCounty: string;
  ward: string;
  physicalAddress: string;
  academicYear: number;
  gradeLevels: string[];
  streamsText: string;
  facilities: string[];
  connectivityType: string;
  provider: string;
  bandwidthMbps: string;
  hasElectricity: boolean;
  hasBackupPower: boolean;
  computersCount: string;
  tabletsCount: string;
  wifiCoverage: 'None' | 'Partial' | 'Full';
  currency: string;
  paymentMethods: string[];
  invoicePrefix: string;
  receiptPrefix: string;
  mpesaNumber: string;
  primaryColor: string;
  secondaryColor: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const initialState: WizardState = {
  name: '',
  slug: '',
  slugTouched: false,
  kind: 'school',
  countyCode: '',
  subCounty: '',
  ward: '',
  physicalAddress: '',
  academicYear: new Date().getFullYear(),
  gradeLevels: [],
  streamsText: '',
  facilities: [],
  connectivityType: '4G / 5G',
  provider: '',
  bandwidthMbps: '',
  hasElectricity: true,
  hasBackupPower: false,
  computersCount: '',
  tabletsCount: '',
  wifiCoverage: 'Partial',
  currency: 'KES',
  paymentMethods: ['M-Pesa'],
  invoicePrefix: 'INV',
  receiptPrefix: 'RCT',
  mpesaNumber: '',
  primaryColor: '#5B4CF5',
  secondaryColor: '#23286B',
  adminFullName: '',
  adminEmail: '',
  adminPassword: ''
};

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function OnboardTenantForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<WizardState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tenantId: string; adminRole: string; classesCreated: number } | null>(null);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setS((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !prev.slugTouched) next.slug = slugify(value as string);
      return next;
    });
  }

  const stepErrors: string[] = [];
  if (step === 0) {
    if (!s.name.trim()) stepErrors.push('Name is required.');
    if (!/^[a-z0-9-]+$/.test(s.slug)) stepErrors.push('Slug must be lowercase letters, numbers, and hyphens only.');
  }
  if (step === 7) {
    if (!s.adminFullName.trim()) stepErrors.push('Administrator name is required.');
    if (!/^\S+@\S+\.\S+$/.test(s.adminEmail)) stepErrors.push('A valid administrator email is required.');
    if (s.adminPassword.length < 12) stepErrors.push('Password must be at least 12 characters.');
  }

  function goNext() {
    if (stepErrors.length) {
      setError(stepErrors.join(' '));
      return;
    }
    setError(null);
    setStep((v) => Math.min(STEPS.length - 1, v + 1));
  }
  function goBack() {
    setError(null);
    setStep((v) => Math.max(0, v - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (stepErrors.length) {
      setError(stepErrors.join(' '));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const streams = s.streamsText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: s.name,
          slug: s.slug,
          kind: s.kind,
          countyCode: s.countyCode || undefined,
          subCounty: s.subCounty || undefined,
          ward: s.ward || undefined,
          physicalAddress: s.physicalAddress || undefined,
          academicYear: s.gradeLevels.length && streams.length ? s.academicYear : undefined,
          gradeLevels: s.gradeLevels.length ? s.gradeLevels : undefined,
          streams: streams.length ? streams : undefined,
          facilities: s.facilities.length ? s.facilities : undefined,
          technology: {
            connectivityType: s.connectivityType || undefined,
            provider: s.provider || undefined,
            bandwidthMbps: s.bandwidthMbps ? Number(s.bandwidthMbps) : undefined,
            hasElectricity: s.hasElectricity,
            hasBackupPower: s.hasBackupPower,
            computersCount: s.computersCount ? Number(s.computersCount) : undefined,
            tabletsCount: s.tabletsCount ? Number(s.tabletsCount) : undefined,
            wifiCoverage: s.wifiCoverage
          },
          finance: {
            currency: s.currency || undefined,
            paymentMethods: s.paymentMethods.length ? s.paymentMethods : undefined,
            invoicePrefix: s.invoicePrefix || undefined,
            receiptPrefix: s.receiptPrefix || undefined,
            mpesaNumber: s.mpesaNumber || undefined
          },
          branding: { primaryColor: s.primaryColor, secondaryColor: s.secondaryColor },
          adminEmail: s.adminEmail,
          adminFullName: s.adminFullName,
          adminPassword: s.adminPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this organization. Try again.');
        return;
      }
      setSuccess({
        tenantId: data.tenantId,
        adminRole: data.adminRole,
        classesCreated: s.gradeLevels.length * streams.length
      });
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          Created — admin role assigned: {success.adminRole}.
          {success.classesCreated > 0 && ` ${success.classesCreated} class(es) created automatically.`} That account
          can log in immediately.
        </p>
        <button
          type="button"
          className="admin-submit"
          onClick={() => {
            setS(initialState);
            setStep(0);
            setSuccess(null);
          }}
        >
          Onboard another organization
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--eb-space-4)' }}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 999,
              border: i === step ? '1.5px solid var(--eb-primary)' : '1px solid var(--eb-line)',
              background: i === step ? 'var(--eb-bg-panel)' : 'transparent',
              color: i === step ? 'var(--eb-primary)' : 'var(--eb-fg-muted)',
              cursor: 'pointer'
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Name</span>
            <input value={s.name} onChange={(e) => update('name', e.target.value)} required minLength={2} />
          </label>
          <label className="admin-field">
            <span>Slug</span>
            <input
              value={s.slug}
              onChange={(e) => setS((p) => ({ ...p, slug: e.target.value, slugTouched: true }))}
              required
              minLength={2}
              pattern="[a-z0-9-]+"
            />
          </label>
          <label className="admin-field">
            <span>Type</span>
            <select value={s.kind} onChange={(e) => update('kind', e.target.value as WizardState['kind'])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>County (optional)</span>
            <select value={s.countyCode} onChange={(e) => update('countyCode', e.target.value)}>
              <option value="">Not set</option>
              {COUNTIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Sub-county (optional)</span>
            <input value={s.subCounty} onChange={(e) => update('subCounty', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Ward (optional)</span>
            <input value={s.ward} onChange={(e) => update('ward', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Physical address (optional)</span>
            <input value={s.physicalAddress} onChange={(e) => update('physicalAddress', e.target.value)} />
          </label>
        </div>
      )}

      {step === 2 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0 }}>
            Selecting grade levels and streams creates a real class for every combination automatically — e.g.
            Grade 1–3 with streams A, B creates 6 classes, ready to enrol students into right away.
          </p>
          <label className="admin-field" style={{ maxWidth: 200, marginBottom: 'var(--eb-space-3)' }}>
            <span>Academic year</span>
            <input
              type="number"
              value={s.academicYear}
              onChange={(e) => update('academicYear', Number(e.target.value))}
            />
          </label>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Grade levels</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--eb-space-3)' }}>
            {GRADE_LEVELS.map((g) => (
              <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={s.gradeLevels.includes(g)}
                  onChange={() => update('gradeLevels', toggleInArray(s.gradeLevels, g))}
                />
                {g}
              </label>
            ))}
          </div>
          <label className="admin-field">
            <span>Streams (comma-separated, e.g. A, B, C)</span>
            <input value={s.streamsText} onChange={(e) => update('streamsText', e.target.value)} placeholder="A, B" />
          </label>
        </>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FACILITY_OPTIONS.map((f) => (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={s.facilities.includes(f)}
                onChange={() => update('facilities', toggleInArray(s.facilities, f))}
              />
              {f}
            </label>
          ))}
        </div>
      )}

      {step === 4 && (
        <>
          <div className="admin-form-row">
            <label className="admin-field">
              <span>Connectivity type</span>
              <input value={s.connectivityType} onChange={(e) => update('connectivityType', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Provider (optional)</span>
              <input value={s.provider} onChange={(e) => update('provider', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Bandwidth (Mbps, optional)</span>
              <input type="number" value={s.bandwidthMbps} onChange={(e) => update('bandwidthMbps', e.target.value)} />
            </label>
          </div>
          <div className="admin-form-row">
            <label className="admin-field">
              <span>Computers (optional)</span>
              <input type="number" value={s.computersCount} onChange={(e) => update('computersCount', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Tablets (optional)</span>
              <input type="number" value={s.tabletsCount} onChange={(e) => update('tabletsCount', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Wi-Fi coverage</span>
              <select value={s.wifiCoverage} onChange={(e) => update('wifiCoverage', e.target.value as WizardState['wifiCoverage'])}>
                <option value="None">None</option>
                <option value="Partial">Partial</option>
                <option value="Full">Full</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 8 }}>
            <input type="checkbox" checked={s.hasElectricity} onChange={(e) => update('hasElectricity', e.target.checked)} />
            Has electricity
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={s.hasBackupPower} onChange={(e) => update('hasBackupPower', e.target.checked)} />
            Has backup power
          </label>
        </>
      )}

      {step === 5 && (
        <>
          <div className="admin-form-row">
            <label className="admin-field">
              <span>Currency</span>
              <input value={s.currency} onChange={(e) => update('currency', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Invoice prefix</span>
              <input value={s.invoicePrefix} onChange={(e) => update('invoicePrefix', e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Receipt prefix</span>
              <input value={s.receiptPrefix} onChange={(e) => update('receiptPrefix', e.target.value)} />
            </label>
          </div>
          <label className="admin-field" style={{ maxWidth: 260, marginBottom: 'var(--eb-space-3)' }}>
            <span>M-Pesa number (optional)</span>
            <input value={s.mpesaNumber} onChange={(e) => update('mpesaNumber', e.target.value)} />
          </label>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Payment methods</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={s.paymentMethods.includes(m)}
                  onChange={() => update('paymentMethods', toggleInArray(s.paymentMethods, m))}
                />
                {m}
              </label>
            ))}
          </div>
        </>
      )}

      {step === 6 && (
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Primary color</span>
            <input type="color" value={s.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Secondary color</span>
            <input type="color" value={s.secondaryColor} onChange={(e) => update('secondaryColor', e.target.value)} />
          </label>
        </div>
      )}

      {step === 7 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0 }}>
            Creates a real tenant and its first admin account together — that account can log in immediately, no
            separate invitation step.
          </p>
          <div className="admin-form-row">
            <label className="admin-field">
              <span>Full name</span>
              <input value={s.adminFullName} onChange={(e) => update('adminFullName', e.target.value)} required />
            </label>
            <label className="admin-field">
              <span>Email</span>
              <input type="email" value={s.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} required />
            </label>
            <label className="admin-field">
              <span>Password</span>
              <input
                type="text"
                value={s.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
                required
                minLength={12}
                placeholder="At least 12 characters"
              />
            </label>
          </div>
        </>
      )}

      {step === 8 && (
        <table className="data-table">
          <tbody>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Name</td>
              <td>{s.name || '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Slug</td>
              <td>{s.slug || '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Type</td>
              <td>{s.kind}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>County</td>
              <td>{s.countyCode || '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Grade levels / streams</td>
              <td>
                {s.gradeLevels.length ? s.gradeLevels.join(', ') : '—'} / {s.streamsText || '—'}
              </td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Facilities</td>
              <td>{s.facilities.length ? s.facilities.join(', ') : '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Administrator</td>
              <td>
                {s.adminFullName || '—'} ({s.adminEmail || '—'})
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--eb-space-4)' }}>
        {step > 0 && (
          <button type="button" onClick={goBack} className="admin-nav-link" style={{ padding: '10px 16px' }}>
            &larr; Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="admin-submit">
            Next &rarr;
          </button>
        ) : (
          <button type="submit" className="admin-submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create organization'}
          </button>
        )}
      </div>
    </form>
  );
}
