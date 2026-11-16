import { checkIslandRequest, requestOrigin } from '../../../../lib/requestAccess';
import { sessionCookie } from '../../../../lib/sharedAuth';

export const runtime = 'nodejs';
export async function POST(request) {
  if (!checkIslandRequest(request, true)) return Response.json({ error: 'localOnly' }, { status: 403 });
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store',
    'Set-Cookie': sessionCookie('', requestOrigin(request), true) } });
}
