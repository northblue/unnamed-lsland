import { NextResponse } from 'next/server';
import { checkIslandRequest, requestOrigin, publicHttpsRedirect } from './lib/requestAccess';
import { checkLocalRequest } from './lib/localRequest';
import { sessionStatus } from './lib/sharedAuth';

const headers = { 'Cache-Control': 'private, no-store' };

export function proxy(request) {
  const path = request.nextUrl.pathname;
  if (!checkIslandRequest(request)) return NextResponse.json({ error: 'localOnly' }, { status: 403, headers });
  const https = publicHttpsRedirect(request);
  if (https) return NextResponse.redirect(https, 308);
  if (path === '/api/health' && checkLocalRequest(request)) return NextResponse.next();
  const auth = sessionStatus(request);
  const open = path === '/login' || ['/api/auth/login', '/api/auth/logout', '/api/auth/session'].includes(path);
  if (open) {
    if (path === '/login' && !auth.enabled) return NextResponse.redirect(new URL('/', requestOrigin(request)));
    const response = NextResponse.next(); response.headers.set('Cache-Control', 'private, no-store'); return response;
  }
  if (!auth.ok) {
    if (auth.status === 503 || path.startsWith('/api/')) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
    const url = new URL('/login', requestOrigin(request));
    if (path === '/fish-preview') url.searchParams.set('next', '/fish-preview');
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next(); response.headers.set('Cache-Control', 'private, no-store');
  if (requestOrigin(request).startsWith('https:')) response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
