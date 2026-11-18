import { OCEAN_RADIUS, coastRatio } from './world.js';
import { isOpenWater } from './waterInteraction.js';

export const FISH_KINDS = ['gold', 'blue', 'coral', 'silver'];
export const FISH_COLORS = ['#ffc36b', '#59a3bb', '#df867c', '#b7c9a5'];
export const HOOK_RADIUS = 3.4;
export const CAST_RANGE = 13;
export const WAIT_LIMIT = 25;
export function emptyCatch() { return Object.fromEntries(FISH_KINDS.map((kind) => [kind, 0])); }
export function isNearShore(player) { return coastRatio(player.x, player.z) >= 0.72; }
export function castError(player, point) {
  if (!isNearShore(player)) return 'shore';
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z) || !isOpenWater(point.x, point.z, OCEAN_RADIUS)) return 'water';
  if (Math.hypot(point.x - player.x, point.z - player.z) > CAST_RANGE) return 'range';
  return null;
}
export function createFishingState() { return { phase: 'idle', point: null, elapsed: 0, nextCheck: 0.6, result: null, error: null }; }
export function startCast(state, player, point) {
  const error = castError(player, point);
  state.error = error;
  if (error) return false;
  Object.assign(state, { phase: 'waiting', point: { x: point.x, z: point.z }, elapsed: 0, nextCheck: 0.6, result: null });
  return true;
}
// Candidates are snapshots of the fish actually rendered in the ocean this frame.
// Randomness only chooses whether one of these nearby fish bites, never a fake prize.
export function stepFishing(state, dt, fish, random = Math.random) {
  state.elapsed += Math.max(0, dt);
  if (state.phase === 'caught' || state.phase === 'empty') {
    if (state.elapsed >= 3) state.phase = 'aim';
    return null;
  }
  if (state.phase !== 'waiting') return null;
  if (state.elapsed >= WAIT_LIMIT) { state.phase = 'empty'; state.elapsed = 0; return null; }
  if (state.elapsed < state.nextCheck) return null;
  state.nextCheck = state.elapsed + 0.8;
  const nearby = fish.filter((item) => FISH_KINDS.includes(item.kind) && Math.hypot(item.x - state.point.x, item.z - state.point.z) <= HOOK_RADIUS);
  if (!nearby.length || random() >= 0.55) return null;
  return nearby[Math.min(nearby.length - 1, Math.floor(random() * nearby.length))];
}
export function landFish(state, fish) {
  if (state.phase !== 'waiting' || !fish || !FISH_KINDS.includes(fish.kind)) return false;
  Object.assign(state, { phase: 'caught', result: fish.kind, elapsed: 0, error: null });
  return true;
}
