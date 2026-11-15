import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVegetation } from './vegetation.js';
import { createCoastalLife } from './coastalLife.js';
import { ISLAND,POND } from './world.js';

test('tropical tree variants preserve resource IDs and only mature visible trees offer perches',()=>{
  const scene=new THREE.Scene(),resources=Array.from({length:6},(_,i)=>({id:`wood:${i}`,type:'wood',x:i-3,z:0,remaining:3}));
  const plants=createVegetation(scene,resources);
  assert.equal(plants.views.size,6);
  assert.deepEqual(new Set([...plants.views.values()].map(v=>v.userData.treeKind)),new Set(['coconut-palm','broadleaf','umbrella']));
  const palm=plants.views.get('wood:0');assert.ok(plants.perches().find(p=>p.id==='wood:0').y>3.8);
  palm.scale.setScalar(0.5);assert.ok(!plants.perches().some(p=>p.id==='wood:0'));
  palm.scale.setScalar(1);palm.visible=false;assert.ok(!plants.perches().some(p=>p.id==='wood:0'));
  plants.update(10,true);plants.dispose();assert.equal(scene.children.length,0);
});

test('beach crabs stay on land and clear of the fish pond, reduced motion freezes their positions',()=>{
  const scene=new THREE.Scene(),coast=createCoastalLife(scene);
  const crabs=[];scene.traverse(o=>{if(o.name==='shore-crab')crabs.push(o);});assert.equal(crabs.length,4);
  for(let t=0;t<120;t+=2){coast.update(t);for(const crab of crabs){const {x,z}=crab.position;
    assert.ok((x/ISLAND.x)**2+(z/ISLAND.z)**2<1);assert.ok(Math.hypot(x-POND.x,z-POND.z)>POND.radius+0.4);
  }}
  coast.update(0,true);const still=crabs.map(c=>c.position.toArray());coast.update(50,true);assert.deepEqual(crabs.map(c=>c.position.toArray()),still);
  coast.dispose();assert.equal(scene.children.length,0);
});
