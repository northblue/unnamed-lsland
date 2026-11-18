import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPetState, stepPets } from './pets.js';
import { canWalk } from './world.js';
import { createPetModel } from './petModel.js';
import { createPets } from './petView.js';

test('three cats and three dogs explore, chase, play and rest without entering water or obstacles', () => {
  const state = createPetState(), initial = structuredClone(state), modes = new Set();
  assert.equal(state.pets.filter(p => p.kind === 'cat').length, 3);
  assert.equal(state.pets.filter(p => p.kind === 'dog').length, 3);
  const buildings = [{ x: 11, z: 19, halfX: 1.4, halfZ: 1.2 }];
  for (let i = 0; i < 3000; i++) {
    stepPets(state, 0.04, { buildings });
    for (const pet of state.pets) { assert.ok(canWalk(pet.x, pet.z, buildings)); modes.add(pet.mode); }
  }
  assert.equal(modes.size, 4);
  assert.ok(state.pets.every((p, i) => Math.hypot(p.x - initial.pets[i].x, p.z - initial.pets[i].z) > 0.5));
  const still = structuredClone(state); stepPets(state, 2, { reduceMotion: true }); assert.deepEqual(state, still);
  assert.equal(new Set(state.pets.map(p => p.id)).size, 6);
});

test('pet anatomy has articulated heads, tails, paws, collars and independently animated models', () => {
  for (const kind of ['cat', 'dog']) {
    const a = createPetModel(kind, 0), b = createPetModel(kind, 1);
    assert.ok(a.root.getObjectByName('pet-collar'));
    const tail = a.root.getObjectByName('pet-tail'); a.update(1, { moving: true }); const pose = tail.rotation.y;
    a.update(3, { moving: true }); assert.notEqual(tail.rotation.y, pose);
    assert.notEqual(tail.rotation.y, b.root.getObjectByName('pet-tail').rotation.y);
    a.update(20, { reduceMotion: true }); const quiet = tail.rotation.y; a.update(40, { reduceMotion: true }); assert.equal(tail.rotation.y, quiet);
    let calls = 0; a.root.traverse(o => { if (o.isMesh) calls++; }); assert.ok(calls < 20);
    const box = new THREE.Box3().setFromObject(a.root); assert.ok(box.min.y > -0.01 && box.max.y > 0.5 && box.max.y < 1);
    a.dispose(); b.dispose();
  }
});

test('pet view cleanup removes companions without creating persistent gameplay fields', () => {
  const scene = new THREE.Scene(), pets = createPets(scene);
  pets.update(0.04); assert.equal(pets.root.children.length, 6);
  assert.ok(pets.state.pets.every(p => canWalk(p.x, p.z)));
  pets.dispose(); assert.equal(scene.children.length, 0);
});
