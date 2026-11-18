import { canWalk, OBSTACLES, COURT } from './world.js';

// Shared destinations cover the island. Routes and companions are not saved.
export const PET_CLEARINGS = [COURT, { x: -9.5, z: 7 }, { x: 13.5, z: 11.5 }, { x: -3, z: 2 },
  { x: -18, z: 5 }, { x: -21, z: 5 }, { x: -3, z: -10 }, { x: 10, z: -9 }, { x: 0, z: 6 }];
export function createPetState({ random = Math.random } = {}) {
  const starts = [[5.4, 16.4], [-9, 7], [14, 11], [6.7, 18.1], [-9.8, 6.8], [13.2, 11.6]];
  const state = { time: 0, pets: starts.map(([x, z], i) => ({ id: `pet:${i}`, kind: i < 3 ? 'cat' : 'dog',
    x, z, heading: 0, mode: 'wander', interaction: 'none', partner: null, moving: false, target: { x, z }, nextTarget: 0, nextMood: 2 + i * 2.3, sociability: 0.35 + random() * 0.55, speed: 0.8 + random() * 0.4, phase: i * 1.7 })) };
  Object.defineProperty(state, 'random', { value: random }); return state;
}

export function stepPets(state, seconds, { buildings = [], obstacles = OBSTACLES, reduceMotion = false } = {}) {
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
    pet.interaction = 'none'; pet.moving = false;
    const distance = friend ? Math.hypot(friend.x - pet.x, friend.z - pet.z) : Infinity;
    pet.phase += dt * (pet.mode === 'chase' ? 12 : 8);
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
    const faceFriend = () => {
      const desired = -Math.atan2(friend.z - pet.z, friend.x - pet.x);
      pet.heading += Math.atan2(Math.sin(desired - pet.heading), Math.cos(desired - pet.heading)) * Math.min(1, dt * 7);
    };
    if (pet.mode === 'rest') { pet.interaction = 'rest'; continue; }
    const social = friend && pet.mode === 'play';
    if (social && distance <= 1.6) {
      pet.interaction = pet.gesture; faceFriend();
      // Short pauses alternate with circling, inviting a third animal to join.
      if (Math.sin(state.time * 0.8 + i * 1.7) > -0.3) continue;
    }
    const follower = friend && pet.mode === 'chase' && distance < 12 && distance > 0.9;
    const orbit = state.time * (0.7 + i * 0.08) + i * 2.4;
    const target = social ? { x: friend.x + Math.cos(orbit) * 1.2, z: friend.z + Math.sin(orbit) * 1.2 } : follower ? friend : pet.target;
    if (follower) pet.interaction = 'chase';
    let dx = target.x - pet.x, dz = target.z - pet.z;
    for (const other of state.pets) {
      if (other === pet) continue;
      const gap = Math.hypot(pet.x - other.x, pet.z - other.z);
      if (gap > 0.001 && gap < 0.65) { dx += (pet.x - other.x) / gap * (0.65 - gap) * 4; dz += (pet.z - other.z) / gap * (0.65 - gap) * 4; }
    }
    if (Math.hypot(dx, dz) < 0.25) { pet.nextTarget = 0; continue; }
    const angle = Math.atan2(dz, dx), speed = (pet.mode === 'chase' ? 1.65 : pet.mode === 'play' ? 1.1 : 0.9) * pet.speed * dt;
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 1.9, -1.9]) {
      const heading = angle + turn, x = pet.x + Math.cos(heading) * speed, z = pet.z + Math.sin(heading) * speed;
      if (!canWalk(x, z, buildings, obstacles)) continue;
      pet.x = x; pet.z = z; pet.moving = true;
      pet.heading += Math.atan2(Math.sin(-heading - pet.heading), Math.cos(-heading - pet.heading)) * Math.min(1, dt * 9); break;
    }
    if (!pet.moving) pet.nextTarget = 0;
  }
  return state;
}
