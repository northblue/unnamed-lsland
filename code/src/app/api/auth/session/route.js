import { checkIslandRequest } from '../../../../lib/requestAccess';
import { sessionStatus } from '../../../../lib/sharedAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!checkIslandRequest(request)) return Response.json({ error: 'localOnly' }, { status: 403, headers });
  const status = sessionStatus(request);
  if (status.status === 503) return Response.json({ error: status.error }, { status: 503, headers });
  return Response.json({ enabled: status.enabled, authenticated: status.ok }, { headers });
}
