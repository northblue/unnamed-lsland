// Synthetic credentials and isolated CI database only; never contact the NAS.
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

assert.ok(process.env.RUNNER_TEMP, 'Requires an isolated CI runner');
const publicOrigin = 'https://unnamed-island.northblue.cc';
const lan = 'http://192.168.4.82:3080';
const snapshot = `${process.env.RUNNER_TEMP}/island-auth.json`;
const password = 'ci-only-shared-password';
function call(path, { origin = publicOrigin, method = 'GET', cookie, data, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? undefined : JSON.stringify(data);
    const req = request(`http://127.0.0.1:3000${path}`, { method, headers: {
      Host: new URL(origin).host, 'X-Forwarded-Proto': new URL(origin).protocol.slice(0, -1),
      ...(method === 'GET' ? {} : { Origin: origin }), ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers,
    } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(body);
  });
}
if (process.argv.includes('--broken')) {
  for (const path of ['/', '/api/island', '/api/auth/session']) assert.equal((await call(path)).status, 503);
  assert.equal((await call('/api/health', { origin: 'http://127.0.0.1:3000' })).status, 503);
  console.log('PASS: incomplete public authentication configuration fails closed');
} else if (process.argv.includes('--saved')) {
  const saved = JSON.parse(readFileSync(snapshot));
  const result = await call('/api/island', { cookie: saved.cookie });
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(JSON.parse(result.text), saved.save);
  console.log('PASS: session and save survive Web restart');
} else {
  const root = await call('/');
  assert.equal(root.status, 307); assert.equal(root.headers.location, `${publicOrigin}/login`);
  const loginPage = await call('/login');
  assert.equal(loginPage.status, 200); assert.match(loginPage.text, /island-password/);
  for (const path of ['/api/island', '/api/health']) assert.equal((await call(path)).status, 401);
  assert.equal((await call('/api/island', { method: 'PUT', data: {} })).status, 401);
  assert.equal((await call('/api/island', { headers: { 'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy' } })).status, 401);
  assert.equal((await call('/models/quaternius-fish/Fish1.glb')).status, 307);
  assert.equal((await call('/fish-preview')).headers.location, `${publicOrigin}/login?next=%2Ffish-preview`);
  assert.equal((await call('/api/island', { origin: 'https://evil.example', headers: { 'X-Forwarded-Host': new URL(publicOrigin).host } })).status, 403);
  const redirect = await call('/login?next=x', { headers: { 'X-Forwarded-Proto': 'http' } });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.location, `${publicOrigin}/login?next=x`);
  const post = (data, extra = {}) => call('/api/auth/login', { method: 'POST', data, ...extra });
  assert.equal((await post({ password }, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post({ password: 'wrong' })).status, 401);
  assert.equal((await post({ password: 'x'.repeat(2100) })).status, 400);
  const login = await post({ password });
  assert.equal(login.status, 200, login.text);
  const setCookie = login.headers['set-cookie'][0];
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=604800']) assert.ok(setCookie.includes(flag));
  assert.ok(!setCookie.includes(password) && !setCookie.includes('Domain='));
  const cookie = setCookie.split(';')[0]; assert.ok(cookie.startsWith('__Host-island-session='));
  const read = await call('/api/island', { cookie }); assert.equal(read.status, 200, read.text);
  const save = JSON.parse(read.text);
  assert.equal((await call('/api/island', { cookie: cookie + 'x' })).status, 401);
  assert.equal((await call('/api/island', { cookie, origin: lan })).status, 401);
  const data = { state: save.state, revision: save.revision };
  assert.equal((await call('/api/island', { cookie, method: 'PUT', data, headers: { Origin: lan } })).status, 403);
  const write = await call('/api/island', { cookie, method: 'PUT', data });
  assert.equal(write.status, 200, write.text);
  assert.equal(JSON.parse(write.text).revision, save.revision + 1);
  assert.equal((await call('/api/island', { cookie, method: 'PUT', data })).status, 409);
  assert.equal((await call('/api/island', { origin: lan })).status, 401);
  const lanLogin = await post({ password }, { origin: lan });
  assert.equal(lanLogin.status, 200);
  assert.ok(!lanLogin.headers['set-cookie'][0].includes('Secure'));
  const lanCookie = lanLogin.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call('/api/island', { origin: lan, cookie: lanCookie })).status, 200);
  assert.equal((await call('/models/quaternius-fish/Fish1.glb', { cookie })).status, 200);
  assert.equal(JSON.parse((await call('/api/auth/session', { cookie })).text).authenticated, true);
  assert.equal(JSON.parse((await call('/api/auth/session')).text).authenticated, false);
  const logout = await call('/api/auth/logout', { cookie, method: 'POST' });
  assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  writeFileSync(snapshot, JSON.stringify({ cookie, save: JSON.parse(write.text) }), { mode: 0o600 });
  console.log('PASS: shared login, protected pages/assets/API, CSRF, HTTPS, LAN isolation, save conflicts and logout');
}
