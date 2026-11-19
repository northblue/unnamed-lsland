import * as THREE from 'three';
import { createPetState, stepPets, PET_CLEARINGS } from './pets.js';
import { terrainHeight, activeObstacles, canWalk } from './world.js';
import { ACTOR_SHAPES } from './islandPhysics.js';
import { createPetModel } from './petModel.js';
import { loadPetAssets } from './petAssetModel.js';

export function createPets(scene, { modelLoader = typeof window === 'undefined' ? null : loadPetAssets, physics } = {}) {
  const root = new THREE.Group(); root.name = 'island-pet-garden'; scene.add(root);
  const state = createPetState();
  const views = state.pets.map((pet, i) => { const view = createPetModel(pet.kind, i % 3); view.root.name = pet.id; root.add(view.root); return view; });
  state.pets.forEach(p=>physics?.addActor(p.id,p.kind,p));
  let disposed = false, imported;
  if (modelLoader) Promise.resolve().then(modelLoader).then(template => {
    if (disposed) { template.dispose(); return; } imported = template;
    state.pets.forEach((pet, i) => {
      const view = template.create(pet.kind, i % 3); if (!view) return;
      views[i].dispose(); views[i] = view; view.root.name = pet.id; root.add(view.root);
    });
  }).catch(() => { /* Keep smaller procedural companions if optional assets fail. */ });
  return { root, state,
    update(dt, buildings = [], resources = [], reduceMotion = false, player = null) {
      const obstacles=activeObstacles(resources);
      for(const [i,pet] of state.pets.entries()) {
        if(canWalk(pet.x,pet.z,buildings,obstacles)&&(!player||Math.hypot(pet.x-player.x,pet.z-player.z)>ACTOR_SHAPES[pet.kind].radius+.32))continue;
        let point;
        for(let attempt=0;attempt<90&&!point;attempt++) {
          const zone=attempt<30?pet:PET_CLEARINGS[(i+Math.floor(attempt/10))%PET_CLEARINGS.length];
          const angle=attempt*2.4,r=.6+(attempt%10)*.3;
          const p={x:zone.x+Math.cos(angle)*r,z:zone.z+Math.sin(angle)*r};
          if(canWalk(p.x,p.z,buildings,obstacles)&&state.pets.every(other=>other===pet||Math.hypot(p.x-other.x,p.z-other.z)>1.1)&&(!player||Math.hypot(p.x-player.x,p.z-player.z)>1.1))point=p;
        }
        if(point){pet.x=point.x;pet.z=point.z;pet.vx=pet.vz=0;physics?.place(pet.id,point);}
      }
      stepPets(state, dt, { buildings, obstacles, reduceMotion, player,
        moveActor: physics ? (pet,dx,dz)=>physics.move(pet.id,pet,dx,dz) : undefined });
      state.pets.forEach((pet, i) => {
        const view = views[i], playful = pet.mode === 'play' || pet.mode === 'chase';
        const ground=terrainHeight(pet.x,pet.z);
        pet.renderY=pet.renderY===undefined?ground:pet.renderY+(ground-pet.renderY)*(1-Math.exp(-Math.max(0,dt)*12));
        view.root.position.set(pet.x,pet.renderY,pet.z);
        view.root.rotation.y = pet.heading;
        view.update(pet.phase, { moving: pet.moving, resting: pet.mode === 'rest' && !pet.moving, playful, interaction: pet.interaction, reduceMotion, motionTime: state.time });
      });
    },
    dispose() { disposed = true; root.removeFromParent(); views.forEach(view => view.dispose()); imported?.dispose(); },
  };
}
