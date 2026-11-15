import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTransfer } from '../src/lib/saveTransfer.js';

assert.ok(process.env.RUNNER_TEMP, 'Run only against the isolated CI island');
const expected = validateTransfer(JSON.parse(readFileSync(process.argv[2], 'utf8')));
const response = await fetch('http://localhost:3000/api/island');
assert.equal(response.status, 200);
const actual = await response.json();
assert.deepEqual(actual.state, expected.state);
assert.equal(actual.revision, expected.source.revision);
assert.equal(actual.updatedAt, expected.source.updatedAt);
console.log('PASS: imported state, revision and timestamp match through the running Web API');
