'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface Profile {
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export function EditStudentDetailsForm({ studentId, profile }: { studentId: string; profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [address, setAddress] = useState(profile.address ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(profile.emergencyContactName ?? '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profile.emergencyContactPhone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || undefined,
          address,
          emergencyContactName,
          emergencyContactPhone
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not save these changes. Try again.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <table className="data-table">
          <tbody>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)', width: 200 }}>Date of birth</td>
              <td>{profile.dateOfBirth ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Gender</td>
              <td style={{ textTransform: 'capitalize' }}>{profile.gender ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Address</td>
              <td>{profile.address ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Emergency contact</td>
              <td>
                {profile.emergencyContactName
                  ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` — ${profile.emergencyContactPhone}` : ''}`
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
        <button
          type="button"
          className="admin-nav-link"
          style={{ padding: '9px 16px', marginTop: 12 }}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Date of birth</span>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Gender</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>
      <label className="admin-field">
        <span>Address</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Emergency contact name</span>
          <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Emergency contact phone</span>
          <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="admin-nav-link"
          style={{ padding: '9px 16px' }}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
