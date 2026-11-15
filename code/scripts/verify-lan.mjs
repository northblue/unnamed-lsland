// Connect only to the isolated CI runner; the LAN address is an HTTP Host fixture.
import assert from 'node:assert/strict';
import { request } from 'node:http';

assert.ok(process.env.RUNNER_TEMP, 'Run only against the isolated CI database');
const origin = 'http://192.168.4.82:3080';
function call({ host = '192.168.4.82:3080', source, method = 'GET', data } = {}) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? null : JSON.stringify(data);
    const headers = { Host: host, 'X-Forwarded-Host': '192.168.4.82:3080',
      ...(source === undefined ? {} : { Origin: source }),
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) };
    const req = request('http://127.0.0.1:3000/api/island', { method, headers }, (response) => {
      let text = '';
      response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
const read = await call();
assert.equal(read.status, 200);
const original = JSON.parse(read.text);
const data = { state: original.state, revision: original.revision };
for (const source of [undefined, 'null', 'http://192.168.4.82:3081', 'https://evil.example']) {
  assert.equal((await call({ method: 'PUT', source, data })).status, 403);
}
for (const host of ['192.168.4.83:3080', '192.168.4.82:3081', 'public.example.com']) {
  assert.equal((await call({ host, source: origin })).status, 403);
}
const saved = await call({ method: 'PUT', source: origin, data });
assert.equal(saved.status, 200, saved.text);
const actual = JSON.parse(saved.text);
assert.deepEqual(actual.state, original.state);
assert.equal(actual.revision, original.revision + 1);
assert.equal((await call({ method: 'PUT', source: origin, data })).status, 409);
assert.deepEqual(JSON.parse((await call()).text).state, original.state);
console.log('PASS: configured LAN Host reads/saves; cross-origin, wrong Host and stale revisions rejected');
