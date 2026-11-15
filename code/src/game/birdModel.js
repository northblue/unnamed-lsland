import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export function prepareBirdModel(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const scale = 1.65 / size.x;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid bird bounds');
  const geometries = new Set(), materials = new Set(), instances = new Set();
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
  });
  return {
    create() {
      const root = new THREE.Group(); root.name = 'mesh2motion-bird';
      const normalized = new THREE.Group(); normalized.scale.setScalar(scale);
      normalized.rotation.y = Math.PI; root.add(normalized); // Source +Z -> game -Z.
      const model = clone(gltf.scene); normalized.add(model);
      model.position.set(-center.x, -bounds.min.y, -center.z);
      const mixer = new THREE.AnimationMixer(model);
      const actions = ['Flap', 'Glide', 'Idle'].map(name => {
        const clip = THREE.AnimationClip.findByName(gltf.animations, name);
        if (!clip) throw new Error(`Missing bird animation: ${name}`);
        return mixer.clipAction(clip).play();
      });
      const weights = [1, 0, 0]; let previous;
      const instance = { root, update(time, { resting = false, gliding = false, reduceMotion = false } = {}) {
        const target = resting ? 2 : gliding || reduceMotion ? 1 : 0;
        const amount = previous === undefined || reduceMotion ? 1 : 1 - Math.exp(-Math.min(0.2, Math.abs(time - previous)) * 7);
        previous = time;
        weights.forEach((weight, i) => {
          weights[i] = THREE.MathUtils.lerp(weight, i === target ? 1 : 0, amount);
          actions[i].setEffectiveWeight(weights[i]);
        });
        mixer.setTime(reduceMotion ? 0 : time);
      }, dispose() {
        mixer.stopAllAction(); mixer.uncacheRoot(model); root.removeFromParent(); instances.delete(instance);
      } };
      instances.add(instance); return instance;
    },
    dispose() {
      [...instances].forEach(instance => instance.dispose());
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    },
  };
}

export async function loadBirdModels() {
  const templates = {};
  const results = await Promise.allSettled(['bird', 'seagull'].map(async kind => {
    templates[kind] = prepareBirdModel(await new GLTFLoader().loadAsync(`/models/mesh2motion-birds/${kind}.glb`));
  }));
  if (results.every(r => r.status === 'rejected')) throw new Error('Bird models unavailable');
  return {
    create: gull => templates[gull ? 'seagull' : 'bird']?.create() ?? null,
    dispose() { Object.values(templates).forEach(t => t.dispose()); },
  };
}
