import { FISH_KINDS } from './fishing.js';
import { POND } from './world.js';

export function pondTotal(pond) { return FISH_KINDS.reduce((sum, kind) => sum + pond[kind], 0); }

// Move exactly one existing fish, preserving the total in basket + pond.
export function transferPondFish(catches, pond, kind, direction) {
  if (!FISH_KINDS.includes(kind) || !['deposit', 'withdraw'].includes(direction)) return false;
  const source = direction === 'deposit' ? catches : pond;
  const target = direction === 'deposit' ? pond : catches;
  if (!Number.isSafeInteger(source[kind]) || source[kind] <= 0 || !Number.isSafeInteger(target[kind]) || target[kind] >= 1000000) return false;
  if (direction === 'deposit' && pondTotal(pond) >= POND.capacity) return false;
  source[kind] -= 1;
  target[kind] += 1;
  return true;
}
