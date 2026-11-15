import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLighthouse } from './lighthouse.js';
import { LIGHTHOUSE, OCEAN_RADIUS, ISLAND } from './world.js';
import { isOpenWater } from './waterInteraction.js';
import { castError } from './fishing.js';

test('lighthouse lights at night, fades at dawn, and respects reduced motion', () => {
  const scene = new THREE.Scene(), lighthouse = createLighthouse(scene);
  const root = scene.getObjectByName('coastal-lighthouse');
  const lantern = root.getObjectByName('lighthouse-lantern'), beacon = root.getObjectByName('lighthouse-beacon');
  const lights = []; root.traverse(o => { if (o.isLight) lights.push(o); });
  lighthouse.update(0, 1); assert.equal(lantern.material.emissiveIntensity, 0); assert.ok(lights.every(l => l.intensity === 0));
  lighthouse.update(1, 0); const night = lantern.material.emissiveIntensity;
  assert.ok(night > 0 && lights.every(l => l.intensity > 0));
  const angle = beacon.rotation.y; lighthouse.update(2, 0); assert.notEqual(beacon.rotation.y, angle);
  lighthouse.update(3, 0.35); assert.ok(lantern.material.emissiveIntensity > 0 && lantern.material.emissiveIntensity < night);
  lighthouse.update(4, 0, true); const still = beacon.rotation.y;
  lighthouse.update(40, 0, true); assert.equal(beacon.rotation.y, still);
  lighthouse.dispose(); assert.equal(scene.children.length, 0);
});

test('lighthouse reef is outside saved buildable land and cannot receive splashes or casts', () => {
  assert.ok((LIGHTHOUSE.x / ISLAND.x) ** 2 + (LIGHTHOUSE.z / ISLAND.z) ** 2 > 1);
  assert.equal(isOpenWater(LIGHTHOUSE.x, LIGHTHOUSE.z, OCEAN_RADIUS), false);
  assert.equal(castError({ x: -18, z: 3.5 }, LIGHTHOUSE), 'water');
  assert.equal(isOpenWater(-26, 3.5, OCEAN_RADIUS), true);
});
