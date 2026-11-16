'use client';

import { useEffect, useState } from 'react';

export default function AuthControls({ text, onBeforeLogout }) {
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const refresh = () => fetch('/api/auth/session', { cache: 'no-store' }).then(response => response.json())
      .then(value => { if (!disposed && typeof value.enabled === 'boolean') setSession(value); }).catch(() => {});
    const expired = () => setSession({ enabled: true, authenticated: false });
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('unnamed-island-auth-required', expired);
    return () => { disposed = true; window.removeEventListener('focus', refresh); window.removeEventListener('unnamed-island-auth-required', expired); };
  }, []);
  if (!session?.enabled) return null;
  async function logout() {
    setBusy(true); setError('');
    try { await onBeforeLogout(); }
    catch { setError('logoutSave'); setBusy(false); return; }
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.assign('/login');
    } catch { setError('authUnavailable'); setBusy(false); }
  }
  return <div className="auth-controls">
    {session.authenticated
      ? <button type="button" onClick={logout} disabled={busy}>{busy ? text.leaving : text.logout}</button>
      : <a href="/login" target="_blank" rel="noopener noreferrer">{text.relogin}</a>}
    {error && <p role="alert">{text.errors[error]}</p>}
  </div>;
}
