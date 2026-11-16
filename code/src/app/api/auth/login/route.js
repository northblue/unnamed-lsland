import { checkIslandRequest, requestOrigin } from '../../../../lib/requestAccess';
import { authSettings, passwordMatches, issueSession, sessionCookie, createLoginLimiter, loginBody } from '../../../../lib/sharedAuth';

export const runtime = 'nodejs';
const limited = createLoginLimiter();
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request) {
  if (!checkIslandRequest(request, true)) return Response.json({ error: 'localOnly' }, { status: 403, headers });
  let settings;
  try { settings = authSettings(); if (!settings.enabled) throw new Error(); }
  catch { return Response.json({ error: 'authUnavailable' }, { status: 503, headers }); }
  const retry = limited();
  if (retry) return Response.json({ error: 'rateLimited' }, { status: 429, headers: { ...headers, 'Retry-After': String(retry) } });
  let input;
  try { input = await loginBody(request); }
  catch { return Response.json({ error: 'invalidRequest' }, { status: 400, headers }); }
  if (!passwordMatches(input?.password, settings)) return Response.json({ error: 'invalidPassword' }, { status: 401, headers });
  const origin = requestOrigin(request);
  return Response.json({ ok: true }, { headers: { ...headers, 'Set-Cookie': sessionCookie(issueSession(settings, origin), origin) } });
}
