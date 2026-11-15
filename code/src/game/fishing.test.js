import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, OCEAN_RADIUS } from './world.js';
import { castError, createFishingState, startCast, stepFishing, landFish, WAIT_LIMIT } from './fishing.js';

test('casting requires shore, reachable open sea, and does not mutate on a bad cast', () => {
  assert.equal(castError({ x: 0, z: 4 }, { x: 0, z: 14 }), 'shore');
  assert.equal(castError({ x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: 0 }), 'water');
  assert.equal(castError({ x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: OCEAN_RADIUS + 1 }), 'water');
  assert.equal(castError({ x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: -ISLAND.z - 5 }), 'range');
  const state = createFishingState(); state.phase = 'aim';
  assert.ok(startCast(state, { x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: ISLAND.z + 5 }));
  assert.equal(state.phase, 'waiting');
});

test('only currently passing small fish can bite, random failures and empty sea grant nothing', () => {
  const state = createFishingState();
  startCast(state, { x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: ISLAND.z + 5 });
  assert.equal(stepFishing(state, 1, [{ id: 'whale', kind: 'whale', x: 0, z: ISLAND.z + 5 }], () => 0), null);
  assert.equal(stepFishing(state, 1, [{ id: 'far', kind: 'blue', x: 12, z: ISLAND.z + 5 }], () => 0), null);
  const passing = { id: 'real-fish', kind: 'gold', x: 1, z: ISLAND.z + 5 };
  assert.equal(stepFishing(state, 1, [passing], () => 0.99), null);
  assert.equal(stepFishing(state, 1, [], () => 0), null);
  assert.equal(stepFishing(state, 1, [passing], () => 0), passing);
  assert.ok(landFish(state, passing));
  assert.equal(landFish(state, passing), false);
  assert.equal(stepFishing(state, 0.5, [passing], () => 0), null);
});

test('a fish that already swam away is not awarded; empty casts time out', () => {
  const state = createFishingState();
  startCast(state, { x: 0, z: ISLAND.z * 0.85 }, { x: 0, z: ISLAND.z + 5 });
  assert.equal(stepFishing(state, 0.3, [{ id: 'a', kind: 'blue', x: 0, z: ISLAND.z + 5 }], () => 0), null);
  assert.equal(stepFishing(state, 0.4, [], () => 0), null);
  stepFishing(state, WAIT_LIMIT, [], () => 0);
  assert.equal(state.phase, 'empty');
  stepFishing(state, 3, [], () => 0);
  assert.equal(state.phase, 'aim');
});
