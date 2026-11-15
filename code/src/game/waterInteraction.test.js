import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, OCEAN_RADIUS } from './world.js';
import { isOpenWater, rippleHeight, RIPPLE_LIFETIME, isTap } from './waterInteraction.js';

test('only exposed sea inside the disc accepts splashes', () => {
  assert.equal(isOpenWater(ISLAND.x + 3, 0, OCEAN_RADIUS), true);
  assert.equal(isOpenWater(0, 0, OCEAN_RADIUS), false);
  assert.equal(isOpenWater(12, 0, OCEAN_RADIUS), false);
  assert.equal(isOpenWater(OCEAN_RADIUS + 1, 0, OCEAN_RADIUS), false);
  assert.equal(isOpenWater(NaN, 0, OCEAN_RADIUS), false);
});

test('ripples propagate, remain bounded, and expire', () => {
  const splashes = [{ x: 0, z: 0, time: 0 }];
  assert.notEqual(rippleHeight(0.3, 0, 0.1, splashes), 0);
  assert.equal(rippleHeight(0.3, 0, RIPPLE_LIFETIME + 0.1, splashes), 0);
  assert.equal(rippleHeight(0.3, 0, -1, splashes), 0);
  assert.ok(Math.abs(rippleHeight(0.3, 0, 0.1, Array(8).fill(splashes[0]))) <= 0.4);
});

test('drags returning to their start and right clicks are not taps', () => {
  const down = { x: 10, y: 10, id: 1, moved: false };
  const event = { clientX: 10, clientY: 10, pointerId: 1, button: 0 };
  assert.equal(isTap(down, event), true);
  assert.equal(isTap({ ...down, moved: true }, event), false);
  assert.equal(isTap(down, { ...event, button: 2 }), false);
  assert.equal(isTap(down, { ...event, pointerId: 2 }), false);
});
