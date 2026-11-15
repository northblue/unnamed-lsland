import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { whalePose } from './whaleBehaviour.js';
import { createMarineLife } from './marineLife.js';
import { OCEAN_RADIUS } from './world.js';

test('breach arc rises and dives continuously and is disabled for reduced motion', () => {
  assert.equal(whalePose(0.4,34).lift,0);
  const mid=0.48+2.1/34;
  assert.ok(whalePose(mid,34).lift>4);
  assert.ok(whalePose(mid-0.04,34).pitch>0);
  assert.ok(whalePose(mid+0.04,34).pitch<0);
  assert.ok(whalePose(0.48+4.2/34,34).lift<0.00001);
  assert.equal(whalePose(mid,34,true,true).lift,0);
  assert.equal(whalePose(mid,34,false).lift,0);
});

test('whale breaches with two splashes, seal and dolphin remain distinct and uncatchable', () => {
  const parent=new THREE.Group(), splashes=[];
  const marine=createMarineLife(parent,OCEAN_RADIUS,{onSplash:(x,z,strength)=>splashes.push({x,z,strength})});
  let peak=-Infinity;
  for(let t=0;t<24;t+=0.05){marine.update(t);peak=Math.max(peak,parent.getObjectByName('visitor:whale').position.y);}
  assert.ok(peak>2.9);assert.equal(splashes.length,2);assert.ok(splashes[1].strength>splashes[0].strength);
  assert.ok(parent.getObjectByName('visitor:seal'));assert.ok(parent.getObjectByName('visitor:dolphin'));
  assert.ok(marine.getFish().every(f=>!['seal','whale','dolphin'].includes(f.kind)));
  assert.equal(marine.takeFish('visitor:seal'),null);
  marine.dispose();assert.equal(parent.children.length,0);
});

test('reduced motion keeps the whale underwater and emits no breach splashes', () => {
  const parent=new THREE.Group();let splashes=0;
  const marine=createMarineLife(parent,OCEAN_RADIUS,{onSplash:()=>splashes++});
  for(let t=0;t<24;t+=0.1){marine.update(t,true);assert.ok(parent.getObjectByName('visitor:whale').position.y<=0);}
  assert.equal(splashes,0);marine.dispose();
});
