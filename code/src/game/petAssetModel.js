import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export function preparePetAsset(gltf, kind) {
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene), height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid pet bounds');
  const center = bounds.getCenter(new THREE.Vector3()), scale = (kind === 'cat' ? 0.62 : 0.78) / height;
  const head = gltf.scene.getObjectByName('head').getWorldPosition(new THREE.Vector3());
  const hips = gltf.scene.getObjectByName('hips').getWorldPosition(new THREE.Vector3());
  const yaw = Math.PI / 2 - Math.atan2(head.x - hips.x, head.z - hips.z);
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set();
  gltf.scene.traverse(o => {
    if (!o.isMesh) return; geometries.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(material); Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  return { create(variant = 0) {
    const root = new THREE.Group(); root.name = `mesh2motion-${kind}`;
    const normalized = new THREE.Group(); normalized.scale.setScalar(scale); normalized.rotation.y = yaw; root.add(normalized);
    const model = clone(gltf.scene); model.position.set(-center.x, -bounds.min.y, -center.z); normalized.add(model);
    const ownMaterials = new Set(), tints = ['#ffffff', '#d3c6b8', '#b7c4cb'];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tints[variant % tints.length])); ownMaterials.add(o.material);
    });
    const mixer = new THREE.AnimationMixer(model), actions = {}, weights = {};
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip).play(); action.setEffectiveWeight(0);
      if (clip.name === 'Sleep' || clip.name === 'Sit') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      actions[clip.name] = action; weights[clip.name] = 0;
    }
    let previous, active;
    const instance = { root, update(time, { moving = false, resting = false, playful = false, reduceMotion = false, motionTime = time } = {}) {
      const dt = previous === undefined ? 0 : Math.max(0, Math.min(0.1, motionTime - previous)); previous = motionTime;
      const target = reduceMotion ? 'Idle' : resting ? variant % 2 ? 'Sit' : 'Sleep' : moving ? playful ? 'Run' : 'Walk' : playful ? 'Play Bow' : 'Idle';
      if (active !== target) { actions[target]?.reset().play(); active = target; }
      const blend = (dt === 0 && Object.values(weights).every(w => w === 0)) || reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
      for (const [name, action] of Object.entries(actions)) {
        weights[name] = THREE.MathUtils.lerp(weights[name], name === target ? 1 : 0, blend); action.setEffectiveWeight(weights[name]);
      }
      if (reduceMotion) { actions.Idle.time = 0; mixer.update(0); } else mixer.update(dt);
    }, dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model); root.removeFromParent(); ownMaterials.forEach(m => m.dispose()); instances.delete(instance); } };
    instances.add(instance); instance.update(0); return instance;
  }, dispose() { [...instances].forEach(v => v.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { t.source?.data?.close?.(); t.dispose(); }); } };
}

export async function loadPetAssets() {
  const templates = {};
  const results = await Promise.allSettled(['cat', 'dog'].map(async kind => {
    templates[kind] = preparePetAsset(await new GLTFLoader().loadAsync(`/models/mesh2motion-pets/${kind}.glb`), kind);
  }));
  if (results.every(r => r.status === 'rejected')) throw new Error('Pet models unavailable');
  return { create: (kind, variant) => templates[kind]?.create(variant) ?? null,
    dispose() { Object.values(templates).forEach(t => t.dispose()); } };
}
