import * as THREE from 'three';
import { createPetState, stepPets } from './pets.js';
import { terrainHeight, activeObstacles } from './world.js';
import { createPetModel } from './petModel.js';

export function createPets(scene) {
  const root = new THREE.Group(); root.name = 'island-pet-garden'; scene.add(root);
  const state = createPetState();
  const views = state.pets.map((pet, i) => { const view = createPetModel(pet.kind, i % 3); view.root.name = pet.id; root.add(view.root); return view; });
  return { root, state,
    update(dt, buildings = [], resources = [], reduceMotion = false) {
      stepPets(state, dt, { buildings, obstacles: activeObstacles(resources), reduceMotion });
      state.pets.forEach((pet, i) => {
        const view = views[i], playful = pet.mode === 'play' || pet.mode === 'chase';
        view.root.position.set(pet.x, terrainHeight(pet.x, pet.z) + (playful && pet.moving && !reduceMotion ? Math.max(0, Math.sin(pet.phase * 0.5)) * 0.08 : 0), pet.z);
        view.root.rotation.y = pet.heading;
        view.update(pet.phase, { moving: pet.moving, resting: pet.mode === 'rest', playful, reduceMotion });
      });
    },
    dispose() { root.removeFromParent(); views.forEach(view => view.dispose()); },
  };
}
