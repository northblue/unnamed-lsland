import { canWalk, OBSTACLES, COURT, terrainHeight } from './world.js';

// Shared destinations cover the island. Routes and companions are not saved.
export const PET_CLEARINGS = [COURT, { x: -9.5, z: 7 }, { x: 13.5, z: 11.5 }, { x: -3, z: 2 },
  { x: -18, z: 5 }, { x: -21, z: 5 }, { x: -3, z: -10 }, { x: 10, z: -9 }, { x: 0, z: 6 }];
export function createPetState({ random = Math.random } = {}) {
  const starts = [[5.4, 16.4], [-3, -7], [14, 11], [6.7, 18.1], [-9.8, 6.8], [12.8, 12.0]];
  const state = { time: 0, pets: starts.map(([x, z], i) => ({ id: `pet:${i}`, kind: i < 3 ? 'cat' : 'dog',
    x, z, heading: 0, mode: 'wander', interaction: 'none', partner: null, moving: false, target: { x, z }, vx: 0, vz: 0, travelHeading: 0, avoidUntil: 0, avoidTurn: 0, blockedFor: 0, nextTarget: 0, nextMood: 2 + i * 2.3, sociability: 0.35 + random() * 0.55, speed: 0.8 + random() * 0.4, phase: i * 1.7 })) };
  Object.defineProperty(state, 'random', { value: random }); return state;
}

export function stepPets(state, seconds, { buildings = [], obstacles = OBSTACLES, reduceMotion = false, moveActor, player } = {}) {
  if (reduceMotion || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.1); state.time += dt;
  const random = state.random;
  // Decisions use a snapshot so a pet updated earlier cannot drag every follower.
  const neighbors = state.pets.map(p => ({ id: p.id, x: p.x, z: p.z, mode: p.mode }));
  for (const [i, pet] of state.pets.entries()) {
    if (state.time >= pet.nextMood) {
      const roll = random();
      pet.mode = roll < 0.16 ? 'rest' : roll < 0.43 ? 'wander' : roll < 0.73 ? 'play' : 'chase';
      const candidates = neighbors.filter(p => p.id !== pet.id);
      // Usually notice someone nearby, sometimes become curious about a distant friend.
      candidates.sort((a, b) => Math.hypot(a.x - pet.x, a.z - pet.z) - Math.hypot(b.x - pet.x, b.z - pet.z));
      pet.partner = candidates[Math.floor(random() * (random() < pet.sociability ? 3 : 5))].id;
      pet.nextMood = state.time + 4 + random() * 13;
      pet.gesture = ['sniff', 'bow', 'paw'][Math.floor(random() * 3)];
      pet.nextTarget = 0;
    }
    const friend = neighbors.find(p => p.id === pet.partner);
    pet.interaction = 'none';
    const distance = friend ? Math.hypot(friend.x - pet.x, friend.z - pet.z) : Infinity;
    if (state.time >= pet.nextTarget) {
      // Shared clearings create chance meetings, but each animal chooses independently.
      const zone = PET_CLEARINGS[Math.floor(random() * PET_CLEARINGS.length)];
      for (let attempt = 0; attempt < 10; attempt++) {
        const angle = random() * Math.PI * 2, radius = 0.7 + random() * 2.8;
        const target = { x: zone.x + Math.cos(angle) * radius, z: zone.z + Math.sin(angle) * radius };
        if (canWalk(target.x, target.z, buildings, obstacles)) { pet.target = target; break; }
      }
      pet.nextTarget = state.time + 6 + random() * 12;
    }
    let faceAim;
    const faceFriend = () => { faceAim = -Math.atan2(friend.z - pet.z, friend.x - pet.x); };
    let stopping = pet.mode === 'rest';
    if (stopping) pet.interaction = 'rest';
    const social = friend && pet.mode === 'play';
    if (social && distance <= 1.6) {
      pet.interaction = pet.gesture; faceFriend();
      // Short pauses alternate with circling, inviting a third animal to join.
      if (Math.sin(state.time * 0.8 + i * 1.7) > -0.3) stopping = true;
    }
    const follower = friend && pet.mode === 'chase' && distance < 12 && distance > 0.9;
    const orbit = state.time * (0.7 + i * 0.08) + i * 2.4;
    const target = social ? { x: friend.x + Math.cos(orbit) * 1.2, z: friend.z + Math.sin(orbit) * 1.2 } : follower ? friend : pet.target;
    if (follower) pet.interaction = 'chase';
    let dx = target.x - pet.x, dz = target.z - pet.z;
    const nearby = player ? [...neighbors, { ...player, id: 'player' }] : neighbors;
    for (const other of nearby) {
      if (other.id === pet.id) continue;
      const gap = Math.hypot(pet.x - other.x, pet.z - other.z);
      if (gap > 0.001 && gap < 1.2) { dx += (pet.x - other.x) / gap * (1.2 - gap) * 2; dz += (pet.z - other.z) / gap * (1.2 - gap) * 2; }
    }
    if (Math.hypot(dx, dz) < 0.3) { stopping = true; if (state.time >= pet.nextTarget - 1) pet.nextTarget = state.time + 1.5; }
    let desired = Math.atan2(dz, dx);
    const clearAhead = angle => {
      const x=pet.x+Math.cos(angle)*0.35,z=pet.z+Math.sin(angle)*0.35;
      return canWalk(x,z,buildings,obstacles)&&Math.abs(terrainHeight(x,z)-terrainHeight(pet.x,pet.z))<0.45;
    };
    if (!stopping && !clearAhead(desired)) {
      if (state.time >= pet.avoidUntil) {
        pet.avoidTurn = [0.7,-0.7,1.2,-1.2,1.8,-1.8].find(turn=>clearAhead(desired+turn)) ?? Math.PI;
        pet.avoidUntil = state.time + 1.2;
      }
      desired += pet.avoidTurn;
    } else if (state.time < pet.avoidUntil) desired += pet.avoidTurn;
    const difference = Math.atan2(Math.sin(desired-pet.travelHeading),Math.cos(desired-pet.travelHeading));
    pet.travelHeading += Math.max(-dt*2.6,Math.min(dt*2.6,difference));
    const pace = stopping ? 0 : (pet.mode==='chase'?1.65:pet.mode==='play'?1.05:0.85)*pet.speed*Math.max(0.12,Math.cos(difference));
    const blend=1-Math.exp(-dt*(stopping?7:4));
    pet.vx += (Math.cos(pet.travelHeading)*pace-pet.vx)*blend; pet.vz += (Math.sin(pet.travelHeading)*pace-pet.vz)*blend;
    const x=pet.x+pet.vx*dt,z=pet.z+pet.vz*dt,oldX=pet.x,oldZ=pet.z;
    if(canWalk(x,z,buildings,obstacles)&&Math.abs(terrainHeight(x,z)-terrainHeight(pet.x,pet.z))<0.2) {
      const next=moveActor?.(pet,x-pet.x,z-pet.z)??{x,z};pet.x=next.x;pet.z=next.z;
    }
    const actual=Math.hypot(pet.x-oldX,pet.z-oldZ)/dt;
    pet.moving = actual > (pet.wasMoving ? 0.035 : 0.09);pet.wasMoving=pet.moving;
    if(actual<0.02&&!stopping)pet.blockedFor+=dt;else pet.blockedFor=0;
    if(pet.blockedFor>1.5){pet.nextTarget=state.time;pet.nextMood=Math.min(pet.nextMood,state.time+1);pet.blockedFor=0;pet.avoidUntil=0;}
    if(pet.moving){
      const aim=-Math.atan2(pet.z-oldZ,pet.x-oldX),angle=Math.atan2(Math.sin(aim-pet.heading),Math.cos(aim-pet.heading));
      pet.heading+=Math.max(-dt*3,Math.min(dt*3,angle));
    } else if(faceAim!==undefined) {
      const angle=Math.atan2(Math.sin(faceAim-pet.heading),Math.cos(faceAim-pet.heading));
      pet.heading+=Math.max(-dt*2,Math.min(dt*2,angle));
    }
    pet.phase += dt * actual * 5;
  }
  return state;
}
