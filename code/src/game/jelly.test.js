import test from 'node:test';
import assert from 'node:assert/strict';
import { createJelly } from './jelly.js';

test('drag impulse produces a bounded wobble that reverses and settles', () => {
  const jelly = createJelly();
  jelly.kick(100, -80);
  let reversed = false;
  for (let i = 0; i < 720; i++) {
    jelly.update(1 / 60);
    assert.ok(Number.isFinite(jelly.state.x));
    assert.ok(Math.abs(jelly.state.x) <= 0.95);
    if (jelly.state.x < 0) reversed = true;
  }
  assert.ok(reversed);
  assert.ok(Math.abs(jelly.state.x) < 0.001);
  assert.ok(Math.abs(jelly.state.vz) < 0.001);
});
