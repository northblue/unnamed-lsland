import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { swellHeight } from './surfSwell.js';
import { surfWaveHeight } from './surfing.js';
import { createOrbitWaves } from './orbitWaves.js';

test('large swell has a taller-than-player crest, gentle edges and seamless circulating packets', () => {
  assert.ok(swellHeight(0, 2.9, 0) > 2.7);
  assert.ok(swellHeight(0, -1.5, 0) < 0.1); assert.ok(swellHeight(0, 5.5, 0) < 0.08);
  for (let i = 0; i < 100; i++) {
    const t = i * 0.2, a = i * 0.07;
    assert.ok(Math.abs(swellHeight(a, 2, t) - swellHeight(a + Math.PI * 2, 2, t)) < 1e-10);
    for (const lane of [0.5, 2, 2.9, 4.5]) assert.equal(surfWaveHeight(a, t, lane), swellHeight(a, lane, t));
    assert.ok(Math.abs(swellHeight(a, 2, t) - swellHeight(a, 2, t + 0.01)) < 0.03);
  }
  assert.ok(Math.abs(swellHeight(0, 2.9, 0) - swellHeight(1, 2.9, 0)) > 2);
});
test('raised wave face and separate curling lip share time and release their resources', () => {
  const scene = new THREE.Scene(), waves = createOrbitWaves(scene), lip = scene.getObjectByName('breaking-wave-lip');
  assert.ok(lip); assert.ok(waves.mesh.geometry.attributes.position.count < 20000);
  assert.equal(lip.material.uniforms, waves.mesh.material.uniforms);
  waves.update(7, 0.5, false); assert.equal(lip.material.uniforms.time.value, 7);
  waves.update(10, 1, true); assert.equal(lip.material.uniforms.motion.value, 0);
  let releases = 0; for (const m of [waves.mesh, lip]) { m.geometry.addEventListener('dispose',()=>releases++); m.material.addEventListener('dispose',()=>releases++); }
  waves.dispose(); assert.equal(scene.children.length, 0); assert.equal(releases, 4);
});
