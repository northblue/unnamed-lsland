import test from 'node:test';
import assert from 'node:assert/strict';
import { authSettings, passwordMatches, issueSession, validSession, sessionStatus, sessionCookie, cookieName, SESSION_SECONDS, createLoginLimiter, loginBody } from './sharedAuth.js';
import { checkIslandRequest, requestOrigin, publicHttpsRedirect } from './requestAccess.js';
import { messages } from '../game/messages.js';

const env = { APP_ORIGIN: 'http://192.168.4.82:3080', PUBLIC_ORIGIN: 'https://unnamed-island.northblue.cc',
  ISLAND_SHARED_PASSWORD: 'synthetic-family-password', ISLAND_SESSION_SECRET: 'synthetic-session-secret-0123456789abcdef' };
const now = Date.parse('2026-11-16T00:00:00Z');
const make = (origin, cookie, source = origin) => new Request('http://0.0.0.0:3000/api/island', {
  headers: { Host: new URL(origin).host, Origin: source, ...(cookie ? { Cookie: cookie } : {}) },
});

test('public HTTPS and LAN authorities coexist without trusting forwarded headers', () => {
  const request = make(env.PUBLIC_ORIGIN);
  assert.equal(requestOrigin(request, env), env.PUBLIC_ORIGIN);
  assert.equal(checkIslandRequest(request, true, env), true);
  assert.equal(checkIslandRequest(make(env.PUBLIC_ORIGIN, null, 'http://unnamed-island.northblue.cc'), true, env), false);
  assert.equal(checkIslandRequest(make('https://evil.example'), false, env), false);
  assert.equal(checkIslandRequest(make(env.APP_ORIGIN), true, env), true);
  assert.equal(checkIslandRequest(make(env.PUBLIC_ORIGIN), false, { APP_ORIGIN: env.APP_ORIGIN }), false);
});

test('public configuration always requires a password and a session secret', () => {
  assert.deepEqual(authSettings({}), { enabled: false });
  for (const invalid of [{ PUBLIC_ORIGIN: env.PUBLIC_ORIGIN }, { ISLAND_SHARED_PASSWORD: env.ISLAND_SHARED_PASSWORD },
    { ...env, ISLAND_SHARED_PASSWORD: 'short' }, { ...env, ISLAND_SESSION_SECRET: 'short' }]) {
    assert.throws(() => authSettings(invalid));
    assert.equal(sessionStatus(make(env.PUBLIC_ORIGIN), invalid, now).status, 503);
  }
  const settings = authSettings(env);
  assert.equal(passwordMatches(env.ISLAND_SHARED_PASSWORD, settings), true);
  assert.equal(passwordMatches('wrong-password', settings), false);
  assert.equal(passwordMatches(null, settings), false);
});

test('signed sessions reject tampering, expiration, another origin and rotated credentials', () => {
  const settings = authSettings(env);
  const token = issueSession(settings, env.PUBLIC_ORIGIN, now);
  assert.equal(validSession(token, settings, env.PUBLIC_ORIGIN, now + 1000), true);
  assert.equal(validSession(token, settings, env.PUBLIC_ORIGIN, now + SESSION_SECONDS * 1000), false);
  assert.equal(validSession(token, settings, env.APP_ORIGIN, now), false);
  assert.equal(validSession('tampered.' + token.split('.')[1], settings, env.PUBLIC_ORIGIN, now), false);
  assert.equal(validSession(token, authSettings({ ...env, ISLAND_SHARED_PASSWORD: 'changed-family-password' }), env.PUBLIC_ORIGIN, now), false);
  assert.equal(validSession(token, authSettings({ ...env, ISLAND_SESSION_SECRET: 'changed-session-secret-0123456789abcdef' }), env.PUBLIC_ORIGIN, now), false);
  const name = cookieName(env.PUBLIC_ORIGIN);
  assert.equal(sessionStatus(make(env.PUBLIC_ORIGIN, `${name}=${token}`), env, now).ok, true);
  assert.equal(sessionStatus(make(env.PUBLIC_ORIGIN, `${name}=${token}; ${name}=${token}`), env, now).ok, false);
  assert.match(sessionCookie(token, env.PUBLIC_ORIGIN), /^__Host-island-session=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
  assert.doesNotMatch(sessionCookie(token, env.APP_ORIGIN), /Secure/);
  assert.match(sessionCookie('', env.PUBLIC_ORIGIN, true), /Max-Age=0/);
});

test('login limiter bounds attempts per process and releases its short window', () => {
  const limit = createLoginLimiter();
  for (let i = 0; i < 20; i++) assert.equal(limit(now), 0);
  assert.equal(limit(now), 60);
  assert.equal(limit(now + 60000), 0);
});

test('login body enforces JSON and a small streaming size limit', async () => {
  const request = body => new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  assert.deepEqual(await loginBody(request('{"password":"example"}')), { password: 'example' });
  await assert.rejects(loginBody(request('x'.repeat(2049))));
  await assert.rejects(loginBody(request('{bad-json}')));
  await assert.rejects(loginBody(new Request('http://localhost', { method: 'POST', body: '{}' })));
});

test('login and session recovery messages have matching Chinese and English keys', () => {
  assert.deepEqual(Object.keys(messages.zh.auth).sort(), Object.keys(messages.en.auth).sort());
  assert.deepEqual(Object.keys(messages.zh.auth.errors).sort(), Object.keys(messages.en.auth.errors).sort());
  for (const code of ['authenticationRequired', 'authUnavailable']) {
    assert.ok(messages.zh.storageErrors[code] && messages.en.storageErrors[code]);
  }
});

test('public login pages redirect HTTP to the configured HTTPS authority', () => {
  const request = make(env.PUBLIC_ORIGIN);
  assert.equal(publicHttpsRedirect(request, env).origin, env.PUBLIC_ORIGIN);
  request.headers.set('X-Forwarded-Proto', 'https');
  assert.equal(publicHttpsRedirect(request, env), null);
  assert.equal(sessionStatus(request, env, now).ok, false, 'transport headers never authenticate');
  assert.equal(publicHttpsRedirect(make(env.APP_ORIGIN), env), null);
});
