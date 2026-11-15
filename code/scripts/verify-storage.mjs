// Run against a local development server; restores the original state afterward.
import assert from 'node:assert/strict';

const base = process.env.ISLAND_TEST_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
const url = new URL('/api/island', base);
const read = async () => {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
};
const put = (state, revision, origin = url.origin) => fetch(url, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ state, revision }),
});
const original = await read();
let revision = original.revision;
try {
  const edited = structuredClone(original.state);
  edited.name = '存档验证 / Save test';
  edited.wood = 123; edited.stone = 45;
  edited.pond = { gold: 1, blue: 2, coral: 0, silver: 1 };
  edited.catches = { gold: 2, blue: 3, coral: 1, silver: 0 };
  edited.resources = edited.resources.map((resource) => ({ ...resource, remaining: 0, ...(resource.id.startsWith('tree:')?{growth:35}:{}) }));
  edited.player = { x: 0, z: 4 };
  edited.buildings = [{ id: 'hut:storage-test', type: 'hut', x: 0, z: 0 }];
  assert.equal((await put(edited, revision, 'https://example.com')).status, 403);
  assert.equal((await put({ ...edited, wood: -1 }, revision)).status, 400);
  assert.equal((await put({ ...edited, catches: { whale: 1 } }, revision)).status, 400);
  assert.equal((await put({ ...edited, pond: { blue: 25 } }, revision)).status, 400);
  assert.equal((await put({ ...edited, pond: { whale: 1 } }, revision)).status, 400);
  const saved = await put(edited, revision);
  assert.equal(saved.status, 200);
  revision = (await saved.json()).revision;
  assert.deepEqual((await read()).state, edited);
  assert.equal((await put(original.state, original.revision)).status, 409);
  assert.deepEqual((await read()).state, edited);
  const removed = { ...edited, buildings: [] };
  const concurrent = await Promise.all([put(removed, revision), put(removed, revision)]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  revision = (await concurrent.find((r) => r.status === 200).json()).revision;
  assert.deepEqual((await read()).state, removed);
  console.log('PASS: name, resources, depleted nodes, buildings, basket and pond, reload, removal, validation, origin and concurrent revision checks');
} finally {
  const restored = await put(original.state, revision);
  assert.equal(restored.status, 200, 'Original state was not restored; another writer may have changed the island.');
  assert.deepEqual((await read()).state, original.state);
  console.log('Original island state restored.');
}
