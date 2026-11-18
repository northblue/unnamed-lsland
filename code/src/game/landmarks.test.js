import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { terrainHeight, legacyTerrainHeight, ISLAND, COURT, LIGHTHOUSE, SUNFLOWER, OCEAN_RADIUS, coastRadius, canWalk, LANDMARK_OBSTACLES, isLand } from './world.js';
import { createIslandLandmarks } from './islandLandmarks.js';
import { createLighthouse } from './lighthouse.js';
import { createGatheringState } from './gathering.js';
import { placementError, HUT } from './building.js';
import { validateIslandState, createIslandState } from './islandState.js';

test('new headland and sports garden preserve every sampled old terrain height', () => {
  for (let x = -20; x <= 20; x += 0.25) for (let z = -15.5; z <= 15.5; z += 0.25) {
    if (Math.hypot(x / ISLAND.x, z / ISLAND.z) <= 1) assert.equal(terrainHeight(x, z), legacyTerrainHeight(x, z));
  }
  assert.ok(terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z) > 6);
  for (let i = 0; i < 720; i++) assert.ok(coastRadius(i / 720 * Math.PI * 2) < OCEAN_RADIUS - 3);
  for (const dx of [-COURT.halfX, 0, COURT.halfX]) for (const dz of [-COURT.halfZ, 0, COURT.halfZ]) {
    assert.equal(terrainHeight(COURT.x + dx, COURT.z + dz), COURT.y);
    assert.ok(canWalk(COURT.x + dx, COURT.z + dz));
  }
  assert.ok(isLand(-23, 6)); assert.ok(isLand(SUNFLOWER.x, SUNFLOWER.z));
});

test('new fixed fixtures do not invalidate existing hut saves or consume buildable ground', () => {
  const inventory = createGatheringState(); inventory.wood = inventory.stone = 100;
  let checked = 0;
  for (let x = -18; x <= 18; x += 2) for (let z = -13; z <= 13; z += 2) {
    const position = { x, z };
    if (placementError({ buildings: [] }, inventory, position, { x: 100, z: 100 })) continue;
    const save = createIslandState(); save.wood = save.stone = 100;
    save.buildings.push({ id: 'hut:legacy', type: 'hut', x, z });
    assert.equal(validateIslandState(save).buildings.length, 1); checked++;
    for (const o of LANDMARK_OBSTACLES) assert.ok(Math.hypot(x - o.x, z - o.z) > o.radius);
  }
  assert.ok(checked > 40);
  assert.equal(placementError({ buildings: [] }, inventory, COURT, { x: 0, z: 4 }), 'water');
  assert.equal(HUT.wood, 6);
});

test('landmarks batch static geometry, animate only flower head and dispose cleanly', () => {
  const scene = new THREE.Scene(), landmarks = createIslandLandmarks(scene), lighthouse = createLighthouse(scene);
  assert.ok(scene.getObjectByName('basketball-half-court'));
  assert.ok(scene.getObjectByName('giant-sunflower'));
  assert.ok(scene.getObjectByName('lighthouse-keepers-cottage'));
  assert.ok(new THREE.Box3().setFromObject(scene.getObjectByName('coastal-lighthouse')).max.y > 12);
  let meshes = 0; landmarks.root.traverse(o => { if (o.isMesh) meshes++; }); assert.ok(meshes < 25);
  landmarks.update(2); landmarks.update(20, true);
  landmarks.dispose(); lighthouse.dispose(); assert.equal(scene.children.length, 0);
});
