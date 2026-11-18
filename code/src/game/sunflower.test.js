import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sunflowerPose } from './sunflower.js';
import { dayCycleAt, solarPositionAt } from './dayCycle.js';
import { createIslandLandmarks } from './islandLandmarks.js';
import { SUNFLOWER, terrainHeight } from './world.js';

test('flower faces the shared sun from morning to evening and bows down at night', () => {
  const origin = { x: SUNFLOWER.x, y: terrainHeight(SUNFLOWER.x, SUNFLOWER.z) + 5.15 * 0.52, z: SUNFLOWER.z };
  for (const hour of [8, 12, 16]) {
    const cycle = dayCycleAt(hour), sun = solarPositionAt(cycle), pose = sunflowerPose(cycle, origin);
    const actual = new THREE.Vector3(pose.direction.x, pose.direction.y, pose.direction.z);
    const expected = new THREE.Vector3(sun.x - origin.x, sun.y - origin.y, sun.z - origin.z).normalize();
    assert.ok(actual.dot(expected) > 0.999); assert.equal(pose.droop, 0);
  }
  assert.ok(sunflowerPose(dayCycleAt(8), origin).direction.x < 0);
  assert.ok(sunflowerPose(dayCycleAt(16), origin).direction.x > 0);
  const night = sunflowerPose(dayCycleAt(0), origin); assert.ok(night.direction.y < -0.8); assert.equal(night.droop, 1);
});

test('flower transitions smoothly, keeps a tree-sized silhouette and respects reduced motion', () => {
  const scene = new THREE.Scene(), view = createIslandLandmarks(scene), head = scene.getObjectByName('sunflower-head');
  view.update(0, true, dayCycleAt(12)); const day = head.quaternion.clone();
  view.update(1, false, dayCycleAt(0), 0.04); assert.ok(day.angleTo(head.quaternion) < 0.26);
  for (let i = 0; i < 150; i++) view.update(i / 25, false, dayCycleAt(0), 0.04);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(head.quaternion);
  assert.ok(normal.y < -0.8); assert.ok(head.position.y < 4.9);
  const flower = scene.getObjectByName('giant-sunflower'); assert.equal(flower.scale.y, 0.52);
  const bounds = new THREE.Box3().setFromObject(head); assert.ok(bounds.max.y - terrainHeight(SUNFLOWER.x, SUNFLOWER.z) < 3.7);
  view.update(1, true, dayCycleAt(12)); const quiet = head.quaternion.clone();
  view.update(9, true, dayCycleAt(12)); assert.ok(quiet.angleTo(head.quaternion) < 1e-6);
  view.dispose();
});
