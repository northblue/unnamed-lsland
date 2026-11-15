import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, OCEAN_RADIUS } from './world.js';
import { createPassage, passagePoint } from './marineRoutes.js';

test('passages enter and exit beyond the water while staying clear of land', () => {
  for (let i = 0; i < 30; i++) {
    const route = createPassage(OCEAN_RADIUS);
    for (const progress of [0, 1]) {
      const p = passagePoint(route, progress);
      assert.ok(Math.hypot(p.x, p.z) > OCEAN_RADIUS);
    }
    const midpoint = passagePoint(route, 0.5);
    assert.ok(Math.hypot(midpoint.x, midpoint.z) < OCEAN_RADIUS);
    for (let progress = 0; progress <= 1; progress += 0.05) {
      const p = passagePoint(route, progress, 0.5, -0.5);
      assert.ok(Math.hypot(p.x, p.z) > ISLAND.x + 1.5);
    }
  }
});
