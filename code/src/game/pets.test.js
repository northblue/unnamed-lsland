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

test('companions travel beyond the court and meet, sniff, chase, play and rest with changing partners', () => {
  let seed = 42; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const state = createPetState({ random }), gestures = new Set(), partners = state.pets.map(() => new Set());
  const visits = state.pets.map(() => ({ minX: Infinity, minZ: Infinity, maxX: -Infinity }));
  for (let i = 0; i < 15000; i++) {
    stepPets(state, 0.04);
    state.pets.forEach((p, j) => {
      assert.ok(canWalk(p.x, p.z)); gestures.add(p.interaction); if (p.partner) partners[j].add(p.partner);
      visits[j].minX = Math.min(visits[j].minX, p.x); visits[j].maxX = Math.max(visits[j].maxX, p.x); visits[j].minZ = Math.min(visits[j].minZ, p.z);
    });
  }
  assert.ok(['sniff', 'chase', 'bow', 'paw', 'rest'].every(g => gestures.has(g)));
  assert.ok(visits.every(v => v.maxX - v.minX > 15)); assert.ok(visits.some(v => v.minZ < -5));
  assert.ok(partners.every(group => group.size === 5));
});


test('individual moods allow solitude, mixed species groups and asynchronous invitations', () => {
  let seed = 77; const state = createPetState({ random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) });
  let solo = false, group = false, sameSpecies = false, mixedMoods = false;
  for (let i = 0; i < 8000; i++) {
    stepPets(state, 0.05);
    const invitations = new Map();
    for (const pet of state.pets) {
      solo ||= pet.mode === 'rest' || pet.mode === 'wander';
      const friend = state.pets.find(p => p.id === pet.partner);
      sameSpecies ||= !!friend && friend.kind === pet.kind;
      if (pet.mode === 'play' || pet.mode === 'chase') invitations.set(pet.partner, (invitations.get(pet.partner) || 0) + 1);
    }
    group ||= [...invitations.values()].some(n => n >= 2);
    mixedMoods ||= new Set(state.pets.map(p => p.mode)).size >= 3;
  }
  assert.ok(solo && group && sameSpecies && mixedMoods);
});

test('pets limit turn rate and tolerate obstacles without instantaneous direction reversals',()=>{
 let seed=19;const state=createPetState({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});
 for(let i=0;i<4000;i++){
   const before=state.pets.map(p=>({x:p.x,z:p.z,heading:p.heading}));stepPets(state,1/60);
   state.pets.forEach((p,j)=>{
     const angle=Math.atan2(Math.sin(p.heading-before[j].heading),Math.cos(p.heading-before[j].heading));
     assert.ok(Math.abs(angle)<=3/60+1e-9);
     assert.ok(Math.hypot(p.x-before[j].x,p.z-before[j].z)<.04);
   });
 }
});
