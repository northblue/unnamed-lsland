import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND } from './world.js';
import { createIslandState, validateIslandState } from './islandState.js';

test('round trip preserves edited name, inventory, depleted resources, and buildings', () => {
  const state = createIslandState();
  state.name = '孩子们的小岛'; state.wood = 123; state.stone = 45;
  state.catches.blue = 3;
  state.resources[0].remaining = 0;
  state.buildings = [{ id: 'hut:test', type: 'hut', x: 0, z: 0 }];
  assert.deepEqual(validateIslandState(JSON.parse(JSON.stringify(state))), state);
});

test('old saves receive an empty basket and invalid or invented fish are rejected', () => {
  const state = createIslandState();
  const { catches, ...legacy } = state;
  assert.deepEqual(validateIslandState(legacy).catches, catches);
  assert.throws(() => validateIslandState({ ...state, catches: { blue: -1 } }), /invalidCatch/);
  assert.throws(() => validateIslandState({ ...state, catches: { whale: 1 } }), /invalidCatch/);
});

test('invalid inventory, unknown world data, overlapping and offshore buildings are rejected', () => {
  const state = createIslandState();
  assert.throws(() => validateIslandState({ ...state, wood: -1 }), /invalidResources/);
  assert.throws(() => validateIslandState({ ...state, stone: 1.5 }), /invalidResources/);
  assert.throws(() => validateIslandState({ ...state, resources: [] }), /invalidWorld/);
  assert.throws(() => validateIslandState({ ...state, buildings: [{ id: 'a', type: 'hut', x: ISLAND.x - 1, z: 0 }] }), /building_water/);
  assert.throws(() => validateIslandState({ ...state, buildings: [{ id: 'a', type: 'hut', x: 0, z: 0 }, { id: 'b', type: 'hut', x: 0, z: 0 }] }), /building_building/);
});

test('loading a hut on the saved player position relocates the player safely', () => {
  const state = createIslandState();
  state.player = { x: 0, z: 0 };
  state.buildings = [{ id: 'hut:test', type: 'hut', x: 0, z: 0 }];
  assert.notDeepEqual(validateIslandState(state).player, state.player);
});
