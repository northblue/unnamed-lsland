import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareMarineModel } from './marineModels.js';

for (const name of ['Whale','Dolphin']) test(`${name} GLB retains independent swim bones, forward orientation and visitor scale`,async()=>{
  const file=fs.readFileSync(new URL(`../../public/models/quaternius-fish/${name}.glb`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
  assert.equal(gltf.animations.length,1);
  const template=prepareMarineModel(gltf,name),a=template.create(),b=template.create();
  a.update(0);b.update(0);a.root.updateMatrixWorld(true);
  const size=new THREE.Box3().setFromObject(a.root,true).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-(name==='Whale'?6:3.1))<0.15);
  assert.ok(a.root.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).x>a.root.getObjectByName('Tail').getWorldPosition(new THREE.Vector3()).x);
  const before=b.root.getObjectByName('Tail').quaternion.toArray();a.update(0.35);
  assert.deepEqual(b.root.getObjectByName('Tail').quaternion.toArray(),before);
  assert.notDeepEqual(a.root.getObjectByName('Tail').quaternion.toArray(),before);
  template.dispose();assert.equal(a.root.parent,null);
});
