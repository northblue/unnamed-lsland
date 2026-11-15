import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatheringState, findNearbyResource, gatherResource, GATHER_RANGE, WOOD_PER_TREE, STONE_PER_ROCK } from './gathering.js';

test('out-of-range interaction grants nothing; the range boundary is inclusive', () => {
  const state = createGatheringState();
  state.resources = [{ id: 'test-tree', type: 'wood', x: 0, z: 0, remaining: WOOD_PER_TREE, STONE_PER_ROCK }];
  assert.equal(gatherResource(state, { x: GATHER_RANGE + 0.01, z: 0 }), null);
  assert.equal(state.wood, 0);
  assert.equal(gatherResource(state, { x: GATHER_RANGE, z: 0 }).resourceId, 'test-tree');
  assert.equal(state.wood, 1);
});

test('only the closest tree loses wood and depleted trees cannot grant extra wood', () => {
  const state = createGatheringState();
  const tree = state.resources[0];
  const position = { x: tree.x + 1, z: tree.z };
  assert.equal(findNearbyResource(state, position).id, tree.id);
  for (let i = 0; i < WOOD_PER_TREE; i++) {
    assert.equal(gatherResource(state, position).depleted, i === WOOD_PER_TREE - 1);
  }
  assert.equal(gatherResource(state, position), null);
  assert.equal(tree.remaining, 0);
  assert.equal(state.wood, WOOD_PER_TREE);
  assert.ok(state.resources.slice(1).every((other) => other.remaining === (other.type === 'wood' ? WOOD_PER_TREE : STONE_PER_ROCK)));
});

test('fresh sessions are independent; total wood cannot exceed map supply', () => {
  const state = createGatheringState();
  assert.equal(new Set(state.resources.map((tree) => tree.id)).size, state.resources.length);
  for (const tree of state.resources) {
    for (let i = 0; i < WOOD_PER_TREE + 2; i++) gatherResource(state, tree);
  }
  assert.equal(state.wood, state.resources.filter((node) => node.type === 'wood').length * WOOD_PER_TREE);
  assert.equal(state.stone, state.resources.filter((node) => node.type === 'stone').length * STONE_PER_ROCK);
  assert.ok(createGatheringState().resources.every((tree) => tree.remaining === WOOD_PER_TREE));
});


test('stone gathering only increments stone and stops at depletion', () => {
  const state = createGatheringState();
  const rock = state.resources.find((node) => node.type === 'stone');
  for (let i = 0; i < STONE_PER_ROCK; i++) {
    assert.equal(gatherResource(state, rock).type, 'stone');
  }
  assert.equal(state.stone, STONE_PER_ROCK);
  assert.equal(state.wood, 0);
  assert.equal(gatherResource(state, rock), null);
});

test('mixed targets select nearest usable resource; depleted nodes do not hide usable ones', () => {
  const state = createGatheringState();
  state.resources = [
    { id: 'tree', type: 'wood', x: 1, z: 0, remaining: 1 },
    { id: 'rock', type: 'stone', x: 1.5, z: 0, remaining: 1 },
  ];
  const position = { x: 0, z: 0 };
  assert.equal(gatherResource(state, position).type, 'wood');
  assert.equal(findNearbyResource(state, position).id, 'rock');
  assert.equal(gatherResource(state, position).type, 'stone');
  assert.equal(findNearbyResource(state, position).id, 'tree');
  assert.equal(gatherResource(state, position), null);
  assert.equal(state.wood, 1);
  assert.equal(state.stone, 1);
});
