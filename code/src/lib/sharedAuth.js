import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { requestOrigin } from './requestAccess.js';

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest();

export function authSettings(env = process.env) {
  const password = env.ISLAND_SHARED_PASSWORD || '';
  const secret = env.ISLAND_SESSION_SECRET || '';
  const enabled = !!(password || secret || env.PUBLIC_ORIGIN);
  if (!enabled) return { enabled: false };
  if (password.length < 12 || password.length > 256 || /[\r\n\0]/.test(password) || secret.length < 32) {
    throw new Error('Shared password/session configuration is incomplete');
  }
  return { enabled: true, password, key: createHmac('sha256', secret).update(`unnamed-island-session-v1\0${password}`).digest() };
}

export function passwordMatches(input, settings) {
  return typeof input === 'string' && input.length <= 256
    && timingSafeEqual(digest(input), digest(settings.password));
}

export const cookieName = origin => origin.startsWith('https:') ? '__Host-island-session' : 'island_session';

export function issueSession(settings, origin, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, aud: origin, iat, exp: iat + SESSION_SECONDS,
    nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', settings.key).update(payload).digest('base64url')}`;
}

export function validSession(token, settings, origin, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024 || !/^[\w-]+\.[\w-]+$/.test(token)) return false;
  const [body, signature] = token.split('.');
  const actual = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', settings.key).update(body).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    const time = Math.floor(now / 1000);
    return data.v === 1 && data.aud === origin && Number.isInteger(data.iat) && Number.isInteger(data.exp)
      && data.iat <= time + 60 && data.exp === data.iat + SESSION_SECONDS && data.exp > time;
  } catch { return false; }
}

function readCookie(request, name) {
  const values = (request.headers.get('cookie') || '').split(';').map(s => s.trim())
    .filter(s => s.startsWith(name + '=')).map(s => s.slice(name.length + 1));
  return values.length === 1 ? values[0] : null;
}

export function sessionStatus(request, env = process.env, now = Date.now()) {
  try {
    const settings = authSettings(env);
    if (!settings.enabled) return { ok: true, enabled: false };
    const origin = requestOrigin(request, env);
    const ok = !!origin && validSession(readCookie(request, cookieName(origin)), settings, origin, now);
    return { ok, enabled: true, status: ok ? 200 : 401, error: ok ? null : 'authenticationRequired' };
  } catch { return { ok: false, enabled: true, status: 503, error: 'authUnavailable' }; }
}

export function sessionCookie(token, origin, clear = false) {
  return `${cookieName(origin)}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${origin.startsWith('https:') ? '; Secure' : ''}`;
}

export function createLoginLimiter() {
  let attempts = [];
  return (now = Date.now()) => {
    attempts = attempts.filter(time => time > now - 60000);
    if (attempts.length >= 20) return Math.max(1, Math.ceil((attempts[0] + 60000 - now) / 1000));
    attempts.push(now);
    return 0;
  };
}

export async function loginBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalidRequest');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalidRequest');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new Error('invalidRequest'); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { reader.releaseLock(); }
}
