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
// The 47 counties of Kenya, with their official numeric county codes
// (001-047) per the Constitution's First Schedule / IEBC numbering.
// The dropdown displays the name; the numeric code is what's stored
// in countyCode and sent to the API, keeping it consistent with the
// codes used in the government/platform-admin modules and tests.
const COUNTIES: { name: string; code: string }[] = [
  { name: 'Baringo', code: '030' },
  { name: 'Bomet', code: '036' },
  { name: 'Bungoma', code: '039' },
  { name: 'Busia', code: '040' },
  { name: 'Elgeyo-Marakwet', code: '028' },
  { name: 'Embu', code: '014' },
  { name: 'Garissa', code: '007' },
  { name: 'Homa Bay', code: '043' },
  { name: 'Isiolo', code: '011' },
  { name: 'Kajiado', code: '034' },
  { name: 'Kakamega', code: '037' },
  { name: 'Kericho', code: '035' },
  { name: 'Kiambu', code: '022' },
  { name: 'Kilifi', code: '003' },
  { name: 'Kirinyaga', code: '020' },
  { name: 'Kisii', code: '045' },
  { name: 'Kisumu', code: '042' },
  { name: 'Kitui', code: '015' },
  { name: 'Kwale', code: '002' },
  { name: 'Laikipia', code: '031' },
  { name: 'Lamu', code: '005' },
  { name: 'Machakos', code: '016' },
  { name: 'Makueni', code: '017' },
  { name: 'Mandera', code: '009' },
  { name: 'Marsabit', code: '010' },
  { name: 'Meru', code: '012' },
  { name: 'Migori', code: '044' },
  { name: 'Mombasa', code: '001' },
  { name: "Murang'a", code: '021' },
  { name: 'Nairobi', code: '047' },
  { name: 'Nakuru', code: '032' },
  { name: 'Nandi', code: '029' },
  { name: 'Narok', code: '033' },
  { name: 'Nyamira', code: '046' },
  { name: 'Nyandarua', code: '018' },
  { name: 'Nyeri', code: '019' },
  { name: 'Samburu', code: '025' },
  { name: 'Siaya', code: '041' },
  { name: 'Taita-Taveta', code: '006' },
  { name: 'Tana River', code: '004' },
  { name: 'Tharaka-Nithi', code: '013' },
  { name: 'Trans Nzoia', code: '026' },
  { name: 'Turkana', code: '023' },
  { name: 'Uasin Gishu', code: '027' },
  { name: 'Vihiga', code: '038' },
  { name: 'Wajir', code: '008' },
  { name: 'West Pokot', code: '024' },
];
const COUNTY_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  COUNTIES.map((c) => [c.code, c.name])
);

const STEPS = ['Institution', 'Location', 'Contacts', 'Academics', 'Facilities', 'Technology', 'Finance', 'Branding', 'Administrator', 'Data migration', 'Review'];
const MIGRATION_METHODS = ['EMPTY', 'IMPORT', 'ASSISTED'] as const;

interface Contact {
  role: string;
  fullName: string;
  phone: string;
  email: string;
  preferredChannel: 'EMAIL' | 'PHONE' | 'SMS';
}

const emptyContact: Contact = { role: '', fullName: '', phone: '', email: '', preferredChannel: 'EMAIL' };

interface WizardState {
  name: string;
  slug: string;
  slugTouched: boolean;
  kind: (typeof KINDS)[number];
  countyCode: string;
  shortName: string;
  registrationNumber: string;
  educationLevel: string;
  ownership: string;
  yearEstablished: string;
  motto: string;
  subCounty: string;
  ward: string;
  physicalAddress: string;
  contacts: Contact[];
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
  migrationMethod: (typeof MIGRATION_METHODS)[number];
  migrationNotes: string;
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
  shortName: '',
  registrationNumber: '',
  educationLevel: '',
  ownership: '',
  yearEstablished: '',
  motto: '',
  subCounty: '',
  ward: '',
  physicalAddress: '',
  contacts: [],
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
  adminPassword: '',
  migrationMethod: 'EMPTY',
  migrationNotes: ''
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
  if (step === 8) {
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
      const validContacts = s.contacts.filter((c) => c.role.trim() && c.fullName.trim());
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: s.name,
          slug: s.slug,
          kind: s.kind,
          countyCode: s.countyCode || undefined,
          shortName: s.shortName || undefined,
          registrationNumber: s.registrationNumber || undefined,
          educationLevel: s.educationLevel || undefined,
          ownership: s.ownership || undefined,
          yearEstablished: s.yearEstablished || undefined,
          motto: s.motto || undefined,
          subCounty: s.subCounty || undefined,
          ward: s.ward || undefined,
          physicalAddress: s.physicalAddress || undefined,
          contacts: validContacts.length
            ? validContacts.map((c) => ({
                role: c.role,
                fullName: c.fullName,
                phone: c.phone || undefined,
                email: c.email || undefined,
                preferredChannel: c.preferredChannel
              }))
            : undefined,
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
          adminPassword: s.adminPassword,
          migrationMethod: s.migrationMethod,
          migrationNotes: s.migrationNotes || undefined
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
        <>
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
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Short name (optional)</span>
            <input value={s.shortName} onChange={(e) => update('shortName', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Registration number (optional)</span>
            <input value={s.registrationNumber} onChange={(e) => update('registrationNumber', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Education level (optional)</span>
            <input value={s.educationLevel} onChange={(e) => update('educationLevel', e.target.value)} placeholder="e.g. Primary & Junior School" />
          </label>
        </div>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Ownership (optional)</span>
            <input value={s.ownership} onChange={(e) => update('ownership', e.target.value)} placeholder="e.g. Government, Private" />
          </label>
          <label className="admin-field">
            <span>Year established (optional)</span>
            <input value={s.yearEstablished} onChange={(e) => update('yearEstablished', e.target.value)} maxLength={4} />
          </label>
          <label className="admin-field">
            <span>Motto (optional)</span>
            <input value={s.motto} onChange={(e) => update('motto', e.target.value)} />
          </label>
        </div>
        </>
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
            Institution contacts beyond the login administrator — Principal, Deputy, Bursar, and similar.
            Record-keeping only; these don't get portal accounts.
          </p>
          {s.contacts.map((c, i) => (
            <div key={i} className="admin-form-row" style={{ alignItems: 'flex-end' }}>
              <label className="admin-field">
                <span>Role</span>
                <input
                  value={c.role}
                  onChange={(e) =>
                    update(
                      'contacts',
                      s.contacts.map((x, j) => (j === i ? { ...x, role: e.target.value } : x))
                    )
                  }
                  placeholder="e.g. Principal / Headteacher"
                />
              </label>
              <label className="admin-field">
                <span>Full name</span>
                <input
                  value={c.fullName}
                  onChange={(e) =>
                    update(
                      'contacts',
                      s.contacts.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x))
                    )
                  }
                />
              </label>
              <label className="admin-field">
                <span>Phone</span>
                <input
                  value={c.phone}
                  onChange={(e) =>
                    update(
                      'contacts',
                      s.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x))
                    )
                  }
                />
              </label>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  value={c.email}
                  onChange={(e) =>
                    update(
                      'contacts',
                      s.contacts.map((x, j) => (j === i ? { ...x, email: e.target.value } : x))
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => update('contacts', s.contacts.filter((_, j) => j !== i))}
                className="admin-nav-link"
                style={{ padding: '9px 12px', marginBottom: 12 }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('contacts', [...s.contacts, { ...emptyContact }])}
            className="admin-nav-link"
            style={{ padding: '8px 14px' }}
          >
            + Add a contact
          </button>
        </>
      )}

      {step === 3 && (
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

      {step === 4 && (
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

      {step === 5 && (
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

      {step === 6 && (
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

      {step === 7 && (
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

      {step === 8 && (
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

      {step === 9 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0 }}>
            How will this school bring in any existing records?
          </p>
          <label className="admin-field" style={{ maxWidth: 260, marginBottom: 'var(--eb-space-3)' }}>
            <span>Method</span>
            <select
              value={s.migrationMethod}
              onChange={(e) => update('migrationMethod', e.target.value as WizardState['migrationMethod'])}
            >
              <option value="EMPTY">Start empty — enrol as we go</option>
              <option value="IMPORT">Import existing records ourselves</option>
              <option value="ASSISTED">Need help migrating records</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Notes (optional)</span>
            <textarea
              value={s.migrationNotes}
              onChange={(e) => update('migrationNotes', e.target.value)}
              rows={3}
              style={{
                fontFamily: 'var(--eb-font-body)',
                fontSize: 14,
                padding: '10px 14px',
                borderRadius: 16,
                border: '1px solid var(--eb-line)'
              }}
            />
          </label>
        </>
      )}

      {step === 10 && (
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
              <td style={{ color: 'var(--eb-fg-muted)' }}>Registration number</td>
              <td>{s.registrationNumber || '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>County</td>
              <td>{s.countyCode ? `${COUNTY_CODE_TO_NAME[s.countyCode] ?? 'Unknown'} (${s.countyCode})` : '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Contacts</td>
              <td>{s.contacts.length ? `${s.contacts.length} added` : '—'}</td>
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
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Data migration</td>
              <td>{s.migrationMethod}</td>
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
