import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHut, HUT, placementError, findBuildSpot } from './building.js';
import { createGatheringState } from './gathering.js';
import { canWalk, ISLAND } from './world.js';

const player = { x: 0, z: 4 };
const clearSpot = { x: 0, z: 0 };

test('harvested resources no longer block building, live resources still do', () => {
  const state = { buildings: [] };
  const inventory = createGatheringState();
  inventory.wood = 6; inventory.stone = 3;
  const position = { x: -5, z: 4 };
  assert.equal(placementError(state, inventory, position, player), 'obstacle');
  inventory.resources.find((resource) => resource.id === 'rock:-5:4').remaining = 0;
  assert.equal(placementError(state, inventory, position, player), null);
  assert.ok(buildHut(state, inventory, position, player).building);
});

test('recommendation finds legal land without spending materials', () => {
  const state = { buildings: [] };
  const inventory = createGatheringState();
  const spot = findBuildSpot(state, inventory, player);
  assert.ok(spot);
  assert.equal(placementError(state, { ...inventory, wood: 6, stone: 3 }, spot, player), null);
  assert.equal(inventory.wood, 0);
  assert.equal(state.buildings.length, 0);
});

test('a legal build spends the recipe once, creates collision, and rejects duplicates', () => {
  const state = { buildings: [] };
  const inventory = { wood: 12, stone: 6 };
  assert.equal(placementError(state, inventory, clearSpot, player), null);
  assert.ok(buildHut(state, inventory, clearSpot, player).building);
  assert.deepEqual(inventory, { wood: 6, stone: 3 });
  assert.equal(buildHut(state, inventory, clearSpot, player).error, 'building');
  assert.deepEqual(inventory, { wood: 6, stone: 3 });
  assert.equal(state.buildings.length, 1);
  assert.equal(canWalk(0, 0, state.buildings), false);
  assert.equal(canWalk(0, 3, state.buildings), true);
});

test('invalid placements never consume materials or create buildings', () => {
  const state = { buildings: [] };
  const inventory = { wood: HUT.wood, stone: HUT.stone };
  for (const [position, reason] of [
    [null, 'choose'], [{ x: NaN, z: 0 }, 'choose'],
    [{ x: ISLAND.x - 1, z: 0 }, 'water'], // Center is on land, but corners are outside.
    [{ x: 5, z: 1 }, 'obstacle'], [player, 'player'],
  ]) {
    assert.equal(buildHut(state, inventory, position, player).error, reason);
  }
  assert.deepEqual(inventory, { wood: HUT.wood, stone: HUT.stone });
  assert.equal(state.buildings.length, 0);
});

test('insufficient materials and repeated preview checks cannot spend inventory', () => {
  const state = { buildings: [] };
  const inventory = { wood: HUT.wood - 1, stone: HUT.stone };
  for (let i = 0; i < 10; i++) assert.equal(placementError(state, inventory, clearSpot, player), 'materials');
  assert.equal(buildHut(state, inventory, clearSpot, player).error, 'materials');
  assert.equal(inventory.wood, HUT.wood - 1);
  assert.equal(state.buildings.length, 0);
});
