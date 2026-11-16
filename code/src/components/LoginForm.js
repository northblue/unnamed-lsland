'use client';

import { useEffect, useState } from 'react';
import { messages } from '../game/messages';

export default function LoginForm() {
  const [language, setLanguage] = useState('zh');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = messages[language].auth;
  useEffect(() => {
    try { if (localStorage.getItem('unnamed-island-language') === 'en') setLanguage('en'); } catch { /* Optional preference. */ }
    fetch('/api/auth/session', { cache: 'no-store' }).then(async response => {
      const status = await response.json();
      if (!response.ok) setError(status.error || 'authUnavailable');
      else if (!status.enabled) window.location.replace('/');
    }).catch(() => setError('authUnavailable'));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = text.title;
  }, [language, text.title]);
  function changeLanguage(next) {
    setLanguage(next);
    try { localStorage.setItem('unnamed-island-language', next); } catch { /* Optional preference. */ }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'authUnavailable'); return; }
      setPassword('');
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next === '/fish-preview' ? next : '/');
    } catch { setError('authUnavailable'); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-card">
      <nav className="login-languages" aria-label={text.language}>
        <button type="button" aria-pressed={language === 'zh'} onClick={() => changeLanguage('zh')}>{text.zhLabel}</button>
        <button type="button" aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>{text.enLabel}</button>
      </nav>
      <span className="login-mark" aria-hidden="true">◒</span>
      <h1>{text.heading}<span>Unnamed Island</span></h1>
      <p>{text.intro}</p>
      <form onSubmit={submit}>
        <label htmlFor="island-password">{text.password}</label>
        <input id="island-password" name="password" type="password" autoComplete="current-password" required
          maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        {error && <p className="login-error" role="alert">{text.errors[error] || text.errors.authUnavailable}</p>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? text.entering : text.enter}</button>
      </form>
      <p className="login-note">{text.note}</p>
    </section>
  </main>;
}
