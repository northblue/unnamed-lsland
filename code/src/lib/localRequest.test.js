import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLocalRequest } from './localRequest.js';

test('standalone listen address does not replace the actual local HTTP authority', () => {
  const request = new Request('http://0.0.0.0:3000/api/island', {
    headers: { Host: 'localhost:3000', Origin: 'http://localhost:3000' },
  });
  assert.equal(checkLocalRequest(request), true);
  assert.equal(checkLocalRequest(request, true), true);
});

test('writes require the same origin including protocol and port', () => {
  for (const origin of ['', 'http://localhost:3001', 'https://localhost:3000', 'https://example.com']) {
    const request = new Request('http://0.0.0.0:3000/api/island', { headers: { Host: 'localhost:3000', Origin: origin } });
    assert.equal(checkLocalRequest(request, true), false);
  }
});

test('public hosts, malformed authorities and forwarded local headers cannot grant access', () => {
  for (const host of ['island.northblue.cc', 'localhost.example.com', '0.0.0.0:3000', 'localhost:99999', 'user@localhost', 'localhost/path']) {
    const request = new Request('http://localhost:3000/api/island', {
      headers: { Host: host, Origin: 'http://localhost:3000', 'X-Forwarded-Host': 'localhost:3000' },
    });
    assert.equal(checkLocalRequest(request), false, host);
  }
});

test('direct localhost, IPv4 and IPv6 requests still work without explicit Host', () => {
  for (const host of ['localhost:3017', '127.0.0.1:3000', '[::1]:3000']) {
    const origin = `http://${host}`;
    assert.equal(checkLocalRequest(new Request(`${origin}/api/island`, { headers: { Origin: origin } }), true), true);
  }
});
