import { getPrisma } from '../../../lib/prisma';
import { authSettings, sessionStatus } from '../../../lib/sharedAuth';
import { checkIslandRequest } from '../../../lib/requestAccess';
import { checkLocalRequest } from '../../../lib/localRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  if (!checkIslandRequest(request)) return Response.json({ status: 'unavailable' }, { status: 403, headers });
  try {
    authSettings();
    if (!checkLocalRequest(request) && !sessionStatus(request).ok) return Response.json({ status: 'unavailable' }, { status: 401, headers });
    // Check schema availability without creating or changing an island.
    await getPrisma().island.findFirst({ select: { id: true } });
    return Response.json({ status: 'ok' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
