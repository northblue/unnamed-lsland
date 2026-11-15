import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareFishModel, FISH_MODELS } from './fishModel.js';
import { createPondView } from './pondView.js';
import { POND } from './world.js';

test('pond uses the correct loaded fish kinds, stays below water, and removes withdrawn fish', async () => {
  const templates = {};
  await Promise.all(Object.entries(FISH_MODELS).map(async ([kind, name]) => {
    const b = fs.readFileSync(new URL(`../../public/models/quaternius-fish/${name}.glb`, import.meta.url));
    templates[kind] = prepareFishModel(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''));
  }));
  const scene = new THREE.Scene();
  const pond = createPondView(scene, { modelLoader: async () => ({
    create: kind => templates[kind].create(), dispose: () => Object.values(templates).forEach(t => t.dispose()),
  }) });
  await new Promise(resolve => setImmediate(resolve));
  const counts = { gold: 1, blue: 1, coral: 1, silver: 1 };
  pond.update(counts, 3, false); scene.updateMatrixWorld(true);
  const fish = []; scene.traverse(o => { if (o.name.startsWith('pond-fish:') && o.visible) fish.push(o); });
  assert.equal(fish.length, 4);
  assert.deepEqual(fish.map(o => o.userData.model), ['quaternius-gold', 'quaternius-blue', 'quaternius-coral', 'quaternius-silver']);
  for (const view of fish) {
    const box = new THREE.Box3().setFromObject(view, true);
    assert.ok(box.min.y > 0.19 && box.max.y < POND.waterY, `Fish must fit the basin: ${box.min.y}..${box.max.y}`);
  }
  pond.update({ gold: 0, blue: 0, coral: 0, silver: 1 }, 4, false);
  assert.equal(fish.filter(o => o.visible).length, 1); assert.equal(fish[0].userData.model, 'quaternius-silver');
  pond.dispose(); assert.equal(scene.children.length, 0);
});

test('pond disposes late assets without reattaching them', async () => {
  const scene = new THREE.Scene(); let finish, disposed = 0;
  const pond = createPondView(scene, { modelLoader: () => new Promise(resolve => { finish = resolve; }) });
  await Promise.resolve(); pond.dispose();
  finish({ create() { assert.fail('Removed pond'); }, dispose() { disposed++; } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(disposed, 1); assert.equal(scene.children.length, 0);
});
