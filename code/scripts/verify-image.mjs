// Smoke check an isolated CI database; never use this script against a NAS save.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const base = 'http://localhost:3000';
const snapshot = process.env.RUNNER_TEMP ? `${process.env.RUNNER_TEMP}/island-ci-save.json` : null;
assert.ok(snapshot, 'Run only in the isolated GitHub Actions smoke check');
const response = await fetch(`${base}/api/island`);
assert.equal(response.status, 200);
const save = await response.json();
if (process.argv.includes('--saved')) {
  const previous = JSON.parse(readFileSync(snapshot, 'utf8'));
  assert.deepEqual(save.state, previous.state, 'State changed across container restart');
} else {
  writeFileSync(snapshot, JSON.stringify(save), { mode: 0o600 });
  const html = await (await fetch(base)).text();
  const script = html.match(/src="([^"\s]+\.js(?:\?[^"\s]*)?)"/);
  assert.ok(script, 'No Next.js browser bundle');
  assert.equal((await fetch(new URL(script[1].replaceAll('&amp;', '&'), base))).status, 200);
  // Real project assets must survive standalone copying, not just HTML.
  for (const asset of ['/models/quaternius-fish/Fish1.glb', '/models/mesh2motion-birds/bird.glb']) {
    const r = await fetch(`${base}${asset}`);
    assert.equal(r.status, 200, `Missing ${asset}`);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString(), 'glTF');
  }
}
console.log('PASS: standalone assets, database availability and saved island');
