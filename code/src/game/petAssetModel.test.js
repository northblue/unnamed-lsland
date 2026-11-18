import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preparePetAsset } from './petAssetModel.js';
import { createPets } from './petView.js';

globalThis.ProgressEvent ??= class { constructor(type, data) { Object.assign(this, data); } };
async function load(kind) {
  const file = await fs.readFile(new URL(`../../public/models/mesh2motion-pets/${kind}.glb`, import.meta.url));
  const length = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + length));
  assert.equal(json.images[0].mimeType, 'image/png'); assert.ok(json.bufferViews[json.images[0].bufferView].byteLength > 10000);
  // Node has no browser image decoder. Geometry, skinning and real clips remain unchanged.
  for (const material of json.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  delete json.images; delete json.textures; delete json.samplers;
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + file.subarray(28 + length).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
test('painted cats and dogs have independent skeletons, bounded grounded animation and natural scale', async () => {
  for (const kind of ['cat', 'dog']) {
    const gltf = await load(kind); assert.equal(gltf.animations.length, 6);
    const template = preparePetAsset(gltf, kind), a = template.create(), b = template.create(1);
    assert.notEqual(a.root.getObjectByName('head'), b.root.getObjectByName('head'));
    const idle = b.root.getObjectByName('front_leg_upper_l').quaternion.clone();
    for (const options of [{ moving: true }, { moving: true, playful: true }, { resting: true }, { playful: true }]) {
      for (let i = 0; i < 50; i++) a.update(i / 25, options);
      a.root.updateMatrixWorld(true); a.root.traverse(o => { if (o.isSkinnedMesh) o.computeBoundingBox(); });
      const bounds = new THREE.Box3().setFromObject(a.root), size = bounds.getSize(new THREE.Vector3());
      assert.ok(bounds.min.y > -0.25 && bounds.max.y < 1.5, `${kind}: ${bounds.min.y}, ${bounds.max.y}`);
      assert.ok(size.x < 3 && size.z < 2);
    }
    assert.ok(idle.angleTo(b.root.getObjectByName('front_leg_upper_l').quaternion) < 1e-6);
    a.update(5, { reduceMotion: true }); const still = a.root.getObjectByName('head').quaternion.clone().normalize();
    a.update(9, { reduceMotion: true }); assert.ok(still.angleTo(a.root.getObjectByName('head').quaternion.clone().normalize()) < 1e-6);
    a.dispose(); b.dispose(); template.dispose();
  }
});
test('late pet assets are disposed after scene teardown instead of reattaching', async () => {
  let resolve, disposed = 0;
  const scene = new THREE.Scene(), pets = createPets(scene, { modelLoader: () => new Promise(done => { resolve = done; }) });
  await Promise.resolve(); pets.dispose(); resolve({ dispose() { disposed++; } });
  await new Promise(setImmediate); assert.equal(disposed, 1); assert.equal(scene.children.length, 0);
});
