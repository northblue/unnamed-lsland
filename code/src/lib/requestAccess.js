import { isIP } from 'node:net';
import { checkLocalRequest } from './localRequest.js';

export function lanOrigin(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { throw new Error('APP_ORIGIN must be a private LAN IP origin'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const bytes = host.split('.').map(Number);
  const privateIPv4 = isIP(host) === 4 && (bytes[0] === 10
    || (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31)
    || (bytes[0] === 192 && bytes[1] === 168));
  const privateIPv6 = isIP(host) === 6 && /^(fc|fd)/i.test(host);
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.href !== `${url.origin}/` || !(privateIPv4 || privateIPv6 || loopback)) {
    throw new Error('APP_ORIGIN must be an http(s) origin on a private LAN IP');
  }
  return url;
}

export function publicOrigin(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { throw new Error('PUBLIC_ORIGIN must be an HTTPS domain origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.href !== `${url.origin}/` || isIP(url.hostname) || !url.hostname.includes('.')
    || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.hostname.endsWith('.local')) {
    throw new Error('PUBLIC_ORIGIN must be an HTTPS domain origin');
  }
  return url;
}

export function requestOrigin(request, env = process.env) {
  const configured = lanOrigin(env.APP_ORIGIN);
  const published = publicOrigin(env.PUBLIC_ORIGIN);
  const host = request.headers.get('host') ?? new URL(request.url).host;
  for (const allowed of [published, configured]) {
    if (allowed && host.toLowerCase() === allowed.host.toLowerCase()) return allowed.origin;
  }
  if (checkLocalRequest(request)) return new URL(`${new URL(request.url).protocol}//${host}`).origin;
  return null;
}

export function checkIslandRequest(request, write = false, env = process.env) {
  try {
    const origin = requestOrigin(request, env);
    // The external origin is explicit; never trust forwarded host/protocol headers.
    return !!origin && (!write || request.headers.get('origin') === origin);
  } catch { return false; }
}

export function publicHttpsRedirect(request, env = process.env) {
  const configured = publicOrigin(env.PUBLIC_ORIGIN);
  const current = new URL(request.url);
  const host = request.headers.get('host') ?? current.host;
  if (!configured || host.toLowerCase() !== configured.host.toLowerCase()) return null;
  // Cloudflare overwrites X-Forwarded-Proto. This signal only selects HTTPS redirects;
  // it never authenticates a visitor or changes the allowed authority.
  const protocol = request.headers.get('x-forwarded-proto') ?? current.protocol.slice(0, -1);
  if (protocol === 'https') return null;
  const target = new URL(configured.origin);
  target.pathname = current.pathname; target.search = current.search;
  return target;
}
