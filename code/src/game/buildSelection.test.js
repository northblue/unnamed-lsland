import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildSelection } from './buildSelection.js';
import { findBuildSpot, placementError, buildHut } from './building.js';
import { createGatheringState } from './gathering.js';

test('recommended spot survives hovering obstacles and leaving canvas before confirmation', () => {
  const state = { buildings: [] };
  const inventory = createGatheringState();
  inventory.wood = 6; inventory.stone = 3;
  const player = { x: 0, z: 4 };
  const selection = createBuildSelection();
  selection.recommend(findBuildSpot(state, inventory, player));
  selection.update({ x: 5, z: 1 }); // Cursor crosses a tree on its way to the UI.
  selection.update(null); // Pointer leaves the canvas for the confirm button.
  assert.equal(placementError(state, inventory, selection.position, player), null);
  assert.ok(buildHut(state, inventory, selection.position, player).building);
  assert.equal(inventory.wood, 0);
});

test('intentional island click releases recommendation; leaving UI preserves manual choice', () => {
  const selection = createBuildSelection();
  selection.recommend({ x: 0, z: 0 });
  selection.beginManual();
  selection.update({ x: 2, z: 3 });
  selection.update(null);
  assert.deepEqual(selection.position, { x: 2, z: 3 });
  selection.reset();
  assert.equal(selection.position, null);
});
