import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStingrayModel } from './stingrayModel.js';
import { createMarineLife } from './marineLife.js';
import { OCEAN_RADIUS, isLand } from './world.js';

test('detailed stingray has continuous animated disc, spotted back, pale belly and a long flexible tail',()=>{
 const ray=createStingrayModel(),disc=ray.root.getObjectByName('ray-disc'),tail=ray.root.getObjectByName('ray-whip-tail');
 assert.ok(disc.geometry.attributes.position.count>2000);assert.equal(ray.root.getObjectByName('ray-dorsal-spots').count,88);assert.ok(ray.root.getObjectByName('ray-belly'));
 const before=disc.geometry.attributes.position.array.slice(),tailBefore=tail.geometry.attributes.position.array.slice();ray.update(1);
 assert.notDeepEqual(disc.geometry.attributes.position.array,before);assert.notDeepEqual(tail.geometry.attributes.position.array,tailBefore);
 assert.ok([...disc.geometry.attributes.normal.array].every(Number.isFinite));
 ray.update(3,true);const still=disc.geometry.attributes.position.array.slice();ray.update(9,true);assert.deepEqual(disc.geometry.attributes.position.array,still);
 const box=new THREE.Box3().setFromObject(ray.root);assert.ok(box.min.x<-2.9&&box.max.z-box.min.z>2.5);
 let releases=0;const geometries=new Set();ray.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry)});geometries.forEach(g=>g.addEventListener('dispose',()=>releases++));ray.dispose();assert.equal(releases,geometries.size);
});
test('stingray patrols actual sea, remains uncatchable, and leaves no scene resources',()=>{
 const parent=new THREE.Group(),marine=createMarineLife(parent,OCEAN_RADIUS);let seen=false;
 for(let t=0;t<70;t+=.5){marine.update(t);const ray=parent.getObjectByName('visitor:stingray');assert.ok(ray);if(ray.visible){seen=true;assert.ok(!isLand(ray.position.x,ray.position.z,-2.5));assert.ok(ray.position.y<-.8);assert.equal(marine.takeFish('visitor:stingray'),null);}}
 assert.ok(seen);marine.dispose();assert.equal(parent.children.length,0);
});
