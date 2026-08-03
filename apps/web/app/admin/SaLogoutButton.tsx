'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function SaLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/');
    router.refresh();
  }

  return (
    <button type="button" className="sa-logout-btn" onClick={handleLogout} disabled={loading}>
      <LogOut />
      {loading ? 'Signing out…' : 'Log out'}
    </button>
  );
}
