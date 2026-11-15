import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createExplorerModel } from './explorerModel.js';

test('explorer has grounded boots, detailed face and articulated walking joints',()=>{
  const model=createExplorerModel();model.root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model.root);
  assert.ok(box.min.y>=-0.005 && box.min.y<0.03);assert.ok(box.max.y<1.7);
  model.update(0,{moving:true});model.update(0.1,{moving:true});
  assert.notEqual(model.root.getObjectByName('left-leg').rotation.x,0);
  assert.notEqual(model.root.getObjectByName('left-arm').rotation.x,0);
  model.update(1,{moving:true,reduceMotion:true});assert.ok(Math.abs(model.root.getObjectByName('left-leg').rotation.x)<0.000001);
  model.dispose();assert.equal(model.root.parent,null);
});

test('fishing grip follows the posed hand through player movement and rotation',()=>{
  const model=createExplorerModel();model.root.position.set(3,0.52,4);model.root.rotation.y=1;
  model.update(1,{fishing:true});
  const grip=model.gripPosition();assert.ok(grip.y>1.1 && grip.y<1.6);
  const hand=model.root.getObjectByName('right-hand').getWorldPosition(new THREE.Vector3());
  assert.ok(grip.distanceTo(hand)<0.000001);
  model.root.position.x+=2;assert.ok(Math.abs(model.gripPosition().x-grip.x-2)<0.000001);
  model.dispose();
});
