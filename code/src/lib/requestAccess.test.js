import test from 'node:test';
import assert from 'node:assert/strict';
import { checkIslandRequest, lanOrigin } from './requestAccess.js';

const origin = 'http://192.168.4.82:3080';
const env = { APP_ORIGIN: origin };
const request = (host, source) => new Request('http://0.0.0.0:3000/api/island', {
  headers: { Host: host, ...(source === undefined ? {} : { Origin: source }), 'X-Forwarded-Host': '192.168.4.82:3080' },
});

test('explicit LAN origin accepts its real Host and same-origin writes behind a container port', () => {
  assert.equal(checkIslandRequest(request('192.168.4.82:3080'), false, env), true);
  assert.equal(checkIslandRequest(request('192.168.4.82:3080', origin), true, env), true);
  assert.equal(checkIslandRequest(request('192.168.4.82:3080', origin), true, {}), false);
  assert.equal(checkIslandRequest(request('localhost:3000', 'http://localhost:3000'), true, env), true);
});

test('LAN requests reject mismatched IP, port, Origin and forged forwarded hosts', () => {
  for (const host of ['192.168.4.83:3080', '192.168.4.82:3081', '192.168.4.82', 'public.example.com']) {
    assert.equal(checkIslandRequest(request(host, origin), true, env), false, host);
  }
  for (const source of [undefined, 'null', 'http://192.168.4.82:3081', 'https://192.168.4.82:3080', 'https://evil.example']) {
    assert.equal(checkIslandRequest(request('192.168.4.82:3080', source), true, env), false, source);
  }
});

test('LAN configuration refuses public origins, credentials and URL paths', () => {
  for (const value of ['https://example.com', 'http://8.8.8.8:3080', 'http://user:secret@192.168.4.82:3080',
    origin + '/path', origin + '?a=b', origin + '#fragment', 'file:///tmp/island', 'invalid']) {
    assert.throws(() => lanOrigin(value));
    assert.equal(checkIslandRequest(request('localhost:3000'), false, { APP_ORIGIN: value }), false);
  }
  for (const value of [origin, 'http://10.1.2.3:3080', 'http://172.16.1.2:3080', 'http://[fd00::82]:3080']) {
    assert.ok(lanOrigin(value));
  }
});
