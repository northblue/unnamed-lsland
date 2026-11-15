import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBirds } from './birds.js';

test('a bird lands on a live perch and leaves smoothly when the perch is removed', () => {
  const scene = new THREE.Scene();
  let perches = [{ id: 'tree:alive', x: 1, y: 3, z: 2 }];
  const birds = createBirds(scene, () => perches);
  try {
    birds.update(22, 1, false);
    const bird = scene.getObjectByName('bird:0');
    assert.ok(bird.position.distanceTo(new THREE.Vector3(1, 3.02, 2)) < 0.001);
    const landed = bird.position.clone();
    perches = [];
    birds.update(23, 1, false);
    assert.ok(bird.position.distanceTo(landed) < 0.001);
    birds.update(24, 1, false);
    assert.ok(bird.position.distanceTo(landed) > 1);
    assert.ok(Number.isFinite(bird.position.y));
  } finally { birds.dispose(); }
  assert.equal(scene.getObjectByName('island-birds'), undefined);
});

test('visiting gulls cross the sky and wrap only while completely outside its boundary',()=>{
  const scene=new THREE.Scene(),birds=createBirds(scene,()=>[],{modelLoader:null});
  try {
    for(let i=6;i<10;i++) {
      const duration=64+(i-6)*9,offset=(i-6)*0.27;
      const bird=scene.getObjectByName(`bird:${i}`);
      birds.update((0.5-offset+1)*duration,1,false);assert.equal(bird.visible,true);
      const seam=(1-offset)*duration;
      birds.update(seam-0.001,1,false);assert.equal(bird.visible,false);const before=bird.position.clone();
      birds.update(seam+0.001,1,false);assert.equal(bird.visible,false);
      assert.ok(before.distanceTo(bird.position)>80);
      birds.update((0.5-offset+1)*duration,0,false);assert.equal(bird.visible,false);
    }
  } finally {birds.dispose();}
  assert.equal(scene.children.length,0);
});
