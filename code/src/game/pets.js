import { canWalk, OBSTACLES, COURT } from './world.js';

// Ephemeral companions: never write their routes or timers into the island save.
export function createPetState() {
  const starts = [[5.4, 16.4], [7.2, 22], [15.8, 18.6], [6.7, 18.1], [12.2, 22.8], [14.5, 16.4]];
  return { time: 0, pets: starts.map(([x, z], i) => ({ id: `pet:${i}`, kind: i < 3 ? 'cat' : 'dog',
    x, z, heading: 0, mode: 'wander', moving: false, target: { x, z }, nextTarget: 0, phase: i * 1.7 })) };
}

export function stepPets(state, seconds, { buildings = [], obstacles = OBSTACLES, reduceMotion = false } = {}) {
  if (reduceMotion || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.1); state.time += dt;
  for (const [i, pet] of state.pets.entries()) {
    const cycle = Math.floor((state.time + i * 3.7) / 8) % 4;
    pet.mode = ['rest', 'wander', 'chase', 'play'][cycle];
    pet.moving = false;
    if (pet.mode === 'rest') continue;
    if (pet.mode === 'play' && Math.sin(state.time * 1.4 + i) > 0.35) continue;
    if (state.time >= pet.nextTarget) {
      const phase = state.time * 0.29 + i * 2.399;
      const target = { x: COURT.x + Math.cos(phase) * (4.9 + Math.sin(i) * 0.7), z: COURT.z + Math.sin(phase * 0.81) * 3.6 };
      if (canWalk(target.x, target.z, buildings, obstacles)) pet.target = target;
      pet.nextTarget = state.time + 2.4 + i * 0.23;
    }
    const friend = state.pets[(i + 3) % state.pets.length];
    const target = pet.mode === 'chase'
      ? { x: friend.x + Math.cos(state.time + i) * 0.8, z: friend.z + Math.sin(state.time + i) * 0.8 }
      : pet.target;
    let dx = target.x - pet.x, dz = target.z - pet.z;
    for (const other of state.pets) {
      if (other === pet) continue;
      const distance = Math.hypot(pet.x - other.x, pet.z - other.z);
      if (distance > 0.001 && distance < 0.85) {
        dx += (pet.x - other.x) / distance * (0.85 - distance) * 4;
        dz += (pet.z - other.z) / distance * (0.85 - distance) * 4;
      }
    }
    if (Math.hypot(dx, dz) < 0.25) { pet.nextTarget = 0; continue; }
    const angle = Math.atan2(dz, dx), speed = (pet.mode === 'chase' ? 1.9 : pet.mode === 'play' ? 1.4 : 0.75) * dt;
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
      const heading = angle + turn, x = pet.x + Math.cos(heading) * speed, z = pet.z + Math.sin(heading) * speed;
      if (!canWalk(x, z, buildings, obstacles)) continue;
      pet.x = x; pet.z = z; pet.moving = true;
      const difference = Math.atan2(Math.sin(-heading - pet.heading), Math.cos(-heading - pet.heading));
      pet.heading += difference * Math.min(1, dt * 9); break;
    }
    if (!pet.moving) pet.nextTarget = 0;
    pet.phase += dt * (pet.mode === 'chase' ? 12 : 8);
  }
  return state;
}
