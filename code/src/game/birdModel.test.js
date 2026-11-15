import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareBirdModel } from './birdModel.js';
import { createBirds } from './birds.js';

async function template(name = 'seagull') {
  const b = fs.readFileSync(new URL(`../../public/models/mesh2motion-birds/${name}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  assert.deepEqual(gltf.animations.map(a => a.name), ['Flap', 'Glide', 'Idle']);
  return prepareBirdModel(gltf);
}
const bones = root => { const result = []; root.traverse(o => { if (o.isBone) result.push(o.quaternion.toArray()); }); return result; };
for (const name of ['bird', 'seagull']) test(`${name} has independent feather bones, folded idle wings and reduced motion`, async () => {
  const source = await template(name), a = source.create(), b = source.create();
  try {
    a.update(0); b.update(0); const before = bones(b.root);
    a.update(0.2); assert.notDeepEqual(bones(a.root), before); assert.deepEqual(bones(b.root), before);
    a.update(2, { resting: true, reduceMotion: true }); a.root.updateMatrixWorld(true);
    const folded = new THREE.Box3().setFromObject(a.root, true).getSize(new THREE.Vector3());
    b.update(0, { gliding: true, reduceMotion: true }); b.root.updateMatrixWorld(true);
    const spread = new THREE.Box3().setFromObject(b.root, true).getSize(new THREE.Vector3());
    assert.ok(folded.x < spread.x * 0.8, `Folded ${folded.x}; spread ${spread.x}`);
    const still = bones(a.root); a.update(20, { resting: true, reduceMotion: true }); assert.deepEqual(bones(a.root), still);
    assert.ok(a.root.getObjectByName('head').getWorldPosition(new THREE.Vector3()).z < a.root.getObjectByName('tail_1').getWorldPosition(new THREE.Vector3()).z);
  } finally { source.dispose(); }
  assert.equal(a.root.parent, null);
});

test('bird replacement preserves live perches, all ten IDs, and late-load cleanup', async () => {
  const scene = new THREE.Scene();
  const source = await template();
  const birds = createBirds(scene, () => [{ id: 'branch', x: 1, y: 3, z: 2 }], { modelLoader: async () => ({
    create: () => source.create(), dispose: () => source.dispose(),
  }) });
  await new Promise(resolve => setImmediate(resolve));
  birds.update(22, 1, false);
  for (let i = 0; i < 10; i++) assert.ok(scene.getObjectByName(`bird:${i}`).userData.model);
  assert.ok(scene.getObjectByName('bird:0').position.distanceTo(new THREE.Vector3(1, 3.02, 2)) < 0.001);
  birds.dispose(); assert.equal(scene.children.length, 0);
  let finish, disposed = 0;
  const late = createBirds(scene, () => [], { modelLoader: () => new Promise(resolve => { finish = resolve; }) });
  await Promise.resolve(); late.dispose(); finish({ dispose() { disposed++; }, create() { assert.fail('Detached scene'); } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(disposed, 1);
});
