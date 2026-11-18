import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMarineLife } from './marineLife.js';
import { isLand, OCEAN_RADIUS } from './world.js';

test('octopus and two seahorses animate independently, remain in open water and are not catchable', () => {
  const parent = new THREE.Group(), marine = createMarineLife(parent, OCEAN_RADIUS);
  const names = ['octopus', 'seahorse', 'seahorse-small'];
  const seen = new Set(), geometry = new Set(); let released = 0;
  for (const kind of names) {
    const root = parent.getObjectByName(`visitor:${kind}`); assert.ok(root);
    root.traverse(o => { if (o.geometry?.type === 'TubeGeometry') geometry.add(o.geometry); });
  }
  assert.equal(geometry.size, 10);
  for (const g of geometry) g.addEventListener('dispose', () => released++);
  for (let time = 0; time < 180; time += 0.2) {
    marine.update(time);
    for (const kind of names) {
      const root = parent.getObjectByName(`visitor:${kind}`);
      if (!root.visible) continue;
      seen.add(kind); assert.ok(!isLand(root.position.x, root.position.z, -2.5));
      assert.ok(root.position.y < 0);
      assert.equal(marine.takeFish(`visitor:${kind}`), null);
    }
  }
  assert.equal(seen.size, 3); marine.dispose();
  assert.equal(released, geometry.size); assert.equal(parent.children.length, 0);
});
