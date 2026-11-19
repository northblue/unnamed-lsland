import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraControls } from './cameraControls.js';

class Canvas extends EventTarget {
  style = {}; clientWidth = 800; clientHeight = 600;
  ownerDocument = new EventTarget();
  getRootNode() { return this.ownerDocument; }
}
test('orbit buttons remain rotated through follow updates, forward reset works, and target keeps moving', () => {
  const camera = new THREE.OrthographicCamera(-40,40,37,-37,0.1,150);
  camera.position.set(23,28,31); camera.lookAt(0,0,0);
  const controls = createCameraControls(camera,new Canvas()), player = { x: 20, y: 1, z: 10 };
  controls.setSurfFollow(true,player,0);
  const before = camera.position.clone(); controls.command('left');
  const rotated = camera.position.clone(); assert.ok(rotated.distanceTo(before)>5);
  controls.follow(player,0,1/60); assert.ok(camera.position.distanceTo(rotated)<1e-7);
  const next = { ...player, x: player.x+1 }; controls.follow(next,0,1/60);
  assert.ok(Math.abs(camera.position.x-rotated.x-1)<1e-7);
  controls.command('surf-front');for(let i=0;i<120;i++)controls.follow(player,0,1/60);
  assert.ok(camera.position.distanceTo(before)<0.002);
  controls.command('right'); const right = camera.position.clone();controls.follow(player,0,1/60);
  assert.ok(camera.position.distanceTo(right)<1e-7);
  controls.dispose();
});
