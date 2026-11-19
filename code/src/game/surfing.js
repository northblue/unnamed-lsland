import { swellHeight } from './surfSwell.js';
import { coastRadius, canWalk, OCEAN_RADIUS } from './world.js';

export const SURF_STATION = { x: 18.6, z: 1.5, range: 2.5 };
const TAU = Math.PI * 2;
// A conservative periodic spline rounds the headland corners without cutting across land.
const TRACK_SEGMENTS = 32;
const controls = Array.from({ length: TRACK_SEGMENTS }, (_, i) => {
  let radius = 0;
  for (let j = -80; j <= 80; j++) radius = Math.max(radius, coastRadius((i + j / 40) / TRACK_SEGMENTS * TAU));
  return radius * 1.15 + 3.7;
});
export function surfTrackRadius(angle) {
  const u = ((angle / TAU * TRACK_SEGMENTS) % TRACK_SEGMENTS + TRACK_SEGMENTS) % TRACK_SEGMENTS;
  const i = Math.floor(u), t = u - i, weights = [(1-t)**3/6, (3*t**3-6*t*t+4)/6, (-3*t**3+3*t*t+3*t+1)/6, t**3/6];
  return weights.reduce((sum, weight, j) => sum + weight * controls[(i + j - 1 + TRACK_SEGMENTS) % TRACK_SEGMENTS], 0);
}
export function surfPoint(angle, lane = 2) {
  const radius = Math.min(OCEAN_RADIUS - 2.5, surfTrackRadius(angle) + lane);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
export function surfWaveHeight(angle, time, lane = 2) { return swellHeight(angle, lane, time); }
export function createSurfState() { return { active: false, angle: 0, lane: 2.25, speed: 6, time: 0, waveClock: 0, waveStart: 0, phaseOffset: 0, lean: 0, waveAngle: 0, laps: 0, distance: 0, shore: null, heading: 0, position: null }; }
export function nearSurfStation(player) { return Math.hypot(player.x - SURF_STATION.x, player.z - SURF_STATION.z) <= SURF_STATION.range; }
export function startSurf(state, player, { waveTime = 0 } = {}) {
  if (state.active || !nearSurfStation(player)) return false;
  Object.assign(state, createSurfState(), { active: true, shore: { x: player.x, z: player.z }, angle: Math.atan2(SURF_STATION.z, SURF_STATION.x) });
  // Catch the nearest advancing wave packet rather than cruising independently.
  const phase = waveTime * 0.16, spacing = TAU / 3;
  state.angle = phase + Math.round((state.angle - phase) / spacing) * spacing;
  state.waveAngle = state.angle; state.waveClock = state.waveStart = waveTime;
  state.position = surfPoint(state.angle, state.lane);
  const ahead = surfPoint(state.angle + 0.002, state.lane);
  state.heading = Math.atan2(-(ahead.x - state.position.x), -(ahead.z - state.position.z)); return true;
}
export function endSurf(state, buildings = [], obstacles) {
  if (!state.active) return null;
  // Keep a valid land position even if the scene was edited during a ride.
  const origin = state.shore, candidates = [origin];
  for (let radius = 0.5; radius <= 8; radius += 0.5) for (let i = 0; i < 16; i++) candidates.push({ x: origin.x + Math.cos(i / 16 * TAU) * radius, z: origin.z + Math.sin(i / 16 * TAU) * radius });
  const shore = candidates.find(p => canWalk(p.x, p.z, buildings, obstacles));
  if (!shore) return null;
  state.active = false; state.position = null; return { ...shore };
}
export function stepSurf(state, seconds, { steer = 0, throttle = 0, waveTime } = {}) {
  if (!state.active || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.1); state.time += dt;
  state.waveClock = Number.isFinite(waveTime) ? waveTime : state.waveClock + dt;
  const old = state.position, oldAngle = state.angle;
  state.lane = Math.max(1.95, Math.min(2.72, state.lane + Math.max(-1, Math.min(1, steer)) * dt * 0.85));
  // Speed input moves along the same wave's shoulder, never outruns the packet.
  state.lean += (Math.max(-1, Math.min(1, steer)) * 0.24 - state.lean) * (1 - Math.exp(-dt * 5));
  const targetPhase = Math.max(-1, Math.min(1, throttle)) * 0.11;
  state.phaseOffset += (targetPhase - state.phaseOffset) * (1 - Math.exp(-dt * 2.5));
  state.angle = state.waveAngle + (state.waveClock - state.waveStart) * 0.16 + state.phaseOffset;
  state.distance += Math.max(0, state.angle - oldAngle); state.laps = Math.floor(state.distance / TAU);
  state.position = surfPoint(state.angle, state.lane);
  const dx = state.position.x - old.x, dz = state.position.z - old.z;
  state.speed = Math.hypot(dx, dz) / dt;
  if (state.speed > 0.001) state.heading = Math.atan2(-dx, -dz);
  return state;
}
export function surfHud(state, player) { return { active: state.active, nearby: nearSurfStation(player), laps: state.laps }; }
