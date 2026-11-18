import test from 'node:test';
import assert from 'node:assert/strict';
import { createJumpState, startJump, stepJump } from './jump.js';
import { createExplorerModel } from './explorerModel.js';

test('jump rises and lands once, rejects mid-air jumps and remains stable across frame rates', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const state = createJumpState(); assert.ok(startJump(state));
    let peak = 0, elapsed = 0;
    while (!state.grounded && elapsed < 2) {
      assert.equal(startJump(state), false);
      stepJump(state, dt); peak = Math.max(peak, state.height); elapsed += dt;
      assert.ok(state.height >= 0);
    }
    assert.ok(peak > 0.95 && peak < 0.97);
    assert.ok(elapsed > 0.74 && elapsed < 0.79);
    assert.deepEqual(state, createJumpState()); assert.ok(startJump(state));
    const paused = structuredClone(state); stepJump(state, 0); assert.deepEqual(state, paused);
  }
});

test('airborne explorer tucks legs and returns to a grounded pose without changing root height', () => {
  const model = createExplorerModel(); model.root.position.y = 3;
  model.update(1, { jumping: true });
  assert.ok(model.root.getObjectByName('left-leg').rotation.x > 0);
  assert.ok(model.root.getObjectByName('left-arm').rotation.x < 0);
  assert.equal(model.root.position.y, 3);
  model.update(2, { reduceMotion: true });
  assert.equal(model.root.getObjectByName('left-leg').rotation.x, 0);
  model.dispose();
});
