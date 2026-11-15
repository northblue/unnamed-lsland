import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareFishModel } from './fishModel.js';

export function prepareMarineModel(gltf, name, configureMaterial) {
  return prepareFishModel(gltf, configureMaterial, {
    name: `quaternius-${name.toLowerCase()}`, size: name === 'Whale' ? 6 : 3.1,
    eyeScale: name === 'Whale' ? 1.8 : 1.2,
    colors: { Top: name === 'Whale' ? '#425d70' : '#72999f', Bottom: '#ccd8d0' },
  });
}

export async function loadMarineModels(configureMaterial) {
  const templates = {};
  await Promise.allSettled(['Whale', 'Dolphin'].map(async name => {
    const gltf = await new GLTFLoader().loadAsync(`/models/quaternius-fish/${name}.glb`);
    templates[name.toLowerCase()] = prepareMarineModel(gltf, name, configureMaterial);
  }));
  if (!Object.keys(templates).length) throw new Error('Marine models unavailable');
  return { create: kind => templates[kind]?.create() ?? null,
    dispose() { Object.values(templates).forEach(t => t.dispose()); } };
}
