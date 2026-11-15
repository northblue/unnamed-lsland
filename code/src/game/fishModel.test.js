import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareFishModel } from './fishModel.js';
import { createMarineLife } from './marineLife.js';
import { OCEAN_RADIUS } from './world.js';

async function loadTemplate(configureMaterial) {
  const file = fs.readFileSync(new URL('../../public/models/quaternius-fish/Fish1.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  assert.equal(gltf.animations.length, 1);
  return prepareFishModel(gltf, configureMaterial);
}

test('actual fish GLB has normalized size, forward direction and independent animated skeletons', async () => {
  const template = await loadTemplate();
  const a = template.create(), b = template.create();
  try {
    a.update(0); b.update(0); a.root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(a.root).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - 1.1) < 0.01); assert.ok(size.y < 0.5 && size.z < 0.3);
    assert.ok(a.root.getObjectByName('Face').getWorldPosition(new THREE.Vector3()).x > a.root.getObjectByName('Tail').getWorldPosition(new THREE.Vector3()).x);
    const bones = root => { const values = []; root.traverse(o => { if (o.isBone) values.push(o.quaternion.toArray()); }); return values; };
    const before = bones(b.root);
    a.update(0.45);
    assert.notDeepEqual(bones(a.root), before); assert.deepEqual(bones(b.root), before);
    assert.notEqual(a.root.getObjectByName('Tail'), b.root.getObjectByName('Tail'));
  } finally { template.dispose(); }
  assert.equal(a.root.parent, null);
});

test('import upgrades all schools and keeps real fish IDs and catch removal', async () => {
  const parent = new THREE.Group();
  const marine = createMarineLife(parent, OCEAN_RADIUS, { modelLoader: loadTemplate });
  await new Promise(resolve => setImmediate(resolve));
  const changed = [];
  parent.traverse(o => { if (o.userData.model) changed.push(o); });
  assert.equal(changed.length, 30); assert.ok(changed.every(o => /^fish:[0-3]:/.test(o.name)));
  let fish;
  for (let time = 0; time < 70 && !fish; time += 0.5) { marine.update(time); fish = marine.getFish().find(f => f.kind === 'coral'); }
  assert.ok(fish); assert.deepEqual(marine.takeFish(fish.id), { id: fish.id, kind: 'coral' });
  assert.equal(marine.takeFish(fish.id), null);
  assert.equal(parent.getObjectByName(fish.id).visible, false);
  marine.dispose(); assert.equal(parent.children.length, 0);
});

test('failed model loads retain fish and late successful loads are disposed after scene removal', async () => {
  const parent = new THREE.Group();
  const fallback = createMarineLife(parent, OCEAN_RADIUS, { modelLoader: async () => { throw new Error('offline'); } });
  await new Promise(resolve => setImmediate(resolve));
  let fish;
  for (let time = 0; time < 70 && !fish; time += 0.5) { fallback.update(time); fish = fallback.getFish().find(f => f.kind === 'coral'); }
  assert.ok(fish); fallback.dispose();
  let resolveLoad, disposed = 0;
  const late = createMarineLife(parent, OCEAN_RADIUS, { modelLoader: () => new Promise(resolve => { resolveLoad = resolve; }) });
  await Promise.resolve(); late.dispose();
  resolveLoad({ dispose() { disposed++; }, create() { assert.fail('Removed scene must not attach a model'); } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disposed, 1); assert.equal(parent.children.length, 0);
});

for (const name of ['Fish2', 'Fish3']) test(`${name} retains swim bones and batches its material faces`, async () => {
  const file = fs.readFileSync(new URL(`../../public/models/quaternius-fish/${name}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  let meshes = 0; gltf.scene.traverse(o => { if (o.isMesh) { meshes++; assert.ok(o.isSkinnedMesh); } });
  assert.ok(meshes <= 3); assert.equal(gltf.animations.length, 1);
  const template = prepareFishModel(gltf), fish = template.create(); fish.update(0.4);
  fish.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(fish.root).getSize(new THREE.Vector3());
  assert.ok(size.x > 0.8 && size.x < 1.4); assert.ok(size.y < 0.8);
  template.dispose();
});
