import * as THREE from 'three';
import { createPetState, stepPets } from './pets.js';
import { terrainHeight, activeObstacles } from './world.js';
import { createPetModel } from './petModel.js';
import { loadPetAssets } from './petAssetModel.js';

export function createPets(scene, { modelLoader = typeof window === 'undefined' ? null : loadPetAssets } = {}) {
  const root = new THREE.Group(); root.name = 'island-pet-garden'; scene.add(root);
  const state = createPetState();
  const views = state.pets.map((pet, i) => { const view = createPetModel(pet.kind, i % 3); view.root.name = pet.id; root.add(view.root); return view; });
  let disposed = false, imported;
  if (modelLoader) Promise.resolve().then(modelLoader).then(template => {
    if (disposed) { template.dispose(); return; } imported = template;
    state.pets.forEach((pet, i) => {
      const view = template.create(pet.kind, i % 3); if (!view) return;
      views[i].dispose(); views[i] = view; view.root.name = pet.id; root.add(view.root);
    });
  }).catch(() => { /* Keep smaller procedural companions if optional assets fail. */ });
  return { root, state,
    update(dt, buildings = [], resources = [], reduceMotion = false) {
      stepPets(state, dt, { buildings, obstacles: activeObstacles(resources), reduceMotion });
      state.pets.forEach((pet, i) => {
        const view = views[i], playful = pet.mode === 'play' || pet.mode === 'chase';
        view.root.position.set(pet.x, terrainHeight(pet.x, pet.z) + (playful && pet.moving && !reduceMotion ? Math.max(0, Math.sin(pet.phase * 0.5)) * 0.08 : 0), pet.z);
        view.root.rotation.y = pet.heading;
        view.update(pet.phase, { moving: pet.moving, resting: pet.mode === 'rest', playful, reduceMotion, motionTime: state.time });
      });
    },
    dispose() { disposed = true; root.removeFromParent(); views.forEach(view => view.dispose()); imported?.dispose(); },
  };
}
