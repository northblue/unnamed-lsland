import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { whaleBreath, createWhaleSpout } from './whaleSpout.js';
import { createMarineLife } from './marineLife.js';
import { OCEAN_RADIUS } from './world.js';

test('whale surfaces and blows before breaching, then sinks without an abrupt height change', () => {
  const start = 0.37, duration = 34;
  assert.equal(whaleBreath(start - 0.01, duration).lift, 0);
  assert.ok(whaleBreath(start + 1 / duration, duration).lift > 0.6);
  assert.ok(whaleBreath(start + 1 / duration, duration).sprayAge > 0);
  assert.equal(whaleBreath(0.48, duration).lift, 0);
  assert.equal(whaleBreath(start + 1 / duration, duration, true).sprayAge, -1);
});
test('spray remains bounded, expires, respects reduced motion and is emitted by the actual whale', () => {
  const parent = new THREE.Group(), spout = createWhaleSpout(parent);
  spout.update({ x: 0, y: -0.1, z: 0 }, 1); assert.ok(spout.root.visible);
  const particles = spout.root.children.find(o => o.isInstancedMesh), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < particles.count; i++) { particles.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix); assert.ok(p.y <= 2.5 && Math.hypot(p.x, p.z) < 1); }
  spout.update({ x: 0, y: 0, z: 0 }, 3); assert.equal(spout.root.visible, false);
  spout.update({ x: 0, y: 0, z: 0 }, 1, true); assert.equal(spout.root.visible, false); spout.dispose();
  const marine = createMarineLife(parent, OCEAN_RADIUS); let saw = false;
  for (let time = 0; time < 5; time += 0.05) { marine.update(time); if (parent.getObjectByName('whale-spout').visible) saw = true; }
  assert.ok(saw); marine.dispose(); assert.equal(parent.children.length, 0);
});
