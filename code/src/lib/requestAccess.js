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

export function checkIslandRequest(request, write = false, env = process.env) {
  let configured;
  try { configured = lanOrigin(env.APP_ORIGIN); } catch { return false; }
  if (checkLocalRequest(request, write)) return true;
  if (!configured) return false;
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (host.toLowerCase() !== configured.host.toLowerCase()) return false;
  // External origin is explicit; ignore all forwarded host/protocol headers.
  return !write || request.headers.get('origin') === configured.origin;
}
