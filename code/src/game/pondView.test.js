import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPondView } from './pondView.js';
import { emptyCatch } from './fishing.js';

test('pond view shows exactly the saved fish and removes withdrawn fish', () => {
  const scene=new THREE.Scene(); const view=createPondView(scene);
  const fish=()=>scene.getObjectByName('seaside-fish-pond').children.filter(o=>o.name.startsWith('pond-fish:') && o.visible);
  const pond={...emptyCatch(),gold:1,blue:2};
  view.update(pond,0,false); assert.equal(fish().length,3);
  const before=fish()[0].position.clone();
  view.update(pond,2,false);assert.notDeepEqual(fish()[0].position,before);
  view.update({...pond,blue:0},2,false);assert.equal(fish().length,1);
  view.update(emptyCatch(),2,false);assert.equal(fish().length,0);
  view.dispose();assert.equal(scene.children.length,0);
});
