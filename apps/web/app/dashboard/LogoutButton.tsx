'use client';

import { logout } from '@netlify/identity';
import { useState } from 'react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await logout().catch(() => undefined);
    window.location.href = '/';
  }

  return (
    <button type="button" className="dashboard-logout" onClick={handleLogout} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
