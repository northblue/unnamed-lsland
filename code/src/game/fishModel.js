import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FISH_MODEL_URL = '/models/quaternius-fish/Fish1.glb';
export const FISH_MODELS = { gold: 'Fish3', blue: 'Fish2', coral: 'Fish1', silver: 'Fish1' };

// Shared geometry/materials, independent skeleton and animation per fish.
export function prepareFishModel(gltf, configureMaterial = () => {}, { name = 'quaternius-fish1', colors = {}, size = 1.1, eyeScale = 1 } = {}) {
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const length = bounds.getSize(new THREE.Vector3()).z;
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid fish model bounds');
  const geometries = new Set(), materials = new Set(), instances = new Set();
  let eyeGeometry;
  const eyeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 });
  configureMaterial(eyeMaterial); materials.add(eyeMaterial);
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!materials.has(material)) configureMaterial(material);
      if (colors[material.name]) material.color.set(colors[material.name]);
      materials.add(material);
    }
  });
  return {
    create() {
      const root = new THREE.Group(); root.name = name;
      const normalized = new THREE.Group();
      // Source head faces +Z; the game routes expect +X. Preserve bone tracks.
      normalized.rotation.y = Math.PI / 2; normalized.scale.setScalar(size / length); root.add(normalized);
      const model = clone(gltf.scene); model.position.sub(center); normalized.add(model);
      const mixer = new THREE.AnimationMixer(model);
      if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
      mixer.setTime(0); root.updateMatrixWorld(true);
      const face = model.getObjectByName('Face') ?? model.getObjectByName('Head');
      if (face) {
        if (!eyeGeometry) {
          const position = face.getWorldPosition(new THREE.Vector3());
          const halfWidth = bounds.getSize(new THREE.Vector3()).x * size / length * 0.37;
          const parts = [];
          for (const side of [-1, 1]) for (const pupil of [false, true]) {
            const geometry = new THREE.SphereGeometry(1, 10, 6);
            const radius = (pupil ? 0.018 : 0.028) * eyeScale;
            geometry.scale(radius, radius, radius * 0.55);
            geometry.translate(position.x + 0.005, position.y + 0.06 * eyeScale, position.z + side * (halfWidth + (pupil ? 0.011 * eyeScale : 0)));
            const color = new THREE.Color(pupil ? '#102e36' : '#f2e5c5');
            const colors = [];
            for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(color.r, color.g, color.b);
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); parts.push(geometry);
          }
          eyeGeometry = mergeGeometries(parts); parts.forEach(g => g.dispose()); geometries.add(eyeGeometry);
        }
        const eyes = new THREE.Mesh(eyeGeometry, eyeMaterial); eyes.name = 'fish-eyes'; root.add(eyes);
        face.attach(eyes); // Keep both eyes attached to the independently animated head.
      }
      const instance = { root, update: time => mixer.setTime(time), dispose() {
        mixer.stopAllAction(); mixer.uncacheRoot(model); root.removeFromParent(); instances.delete(instance);
      } };
      instances.add(instance);
      return instance;
    },
    dispose() {
      for (const instance of [...instances]) instance.dispose();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    },
  };
}

export async function loadFishModel(configureMaterial) {
  return prepareFishModel(await new GLTFLoader().loadAsync(FISH_MODEL_URL), configureMaterial);
}

// One template per kind, shared within each school or pond, never one fetch per fish.
export async function loadFishCollection(configureMaterial) {
  const templates = {};
  const results = await Promise.allSettled(Object.entries(FISH_MODELS).map(async ([kind, model]) => {
    const gltf = await new GLTFLoader().loadAsync(`/models/quaternius-fish/${model}.glb`);
    templates[kind] = prepareFishModel(gltf, configureMaterial, {
      name: `quaternius-${kind}`,
      colors: kind === 'gold' ? { Body: '#d99728', Stripes: '#fff1c2' }
        : kind === 'silver' ? { Top: '#779ca8', Bottom: '#c5ddd6', Fins: '#9cb9b1' } : {},
    });
  }));
  if (results.every(result => result.status === 'rejected')) throw new Error('Fish models unavailable');
  return {
    create: (kind = 'coral') => templates[kind]?.create() ?? null,
    dispose() { Object.values(templates).forEach(template => template.dispose()); },
  };
}
