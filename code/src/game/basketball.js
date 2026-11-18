import { COURT, terrainHeight, isLand } from './world.js';

export const BALL_RADIUS = 0.16;
export const HOOP = { x: COURT.x, y: COURT.y + 2.88, z: COURT.z - COURT.halfZ + 0.55,
  radius: 0.29, boardZ: COURT.z - COURT.halfZ + 0.1 };
const spawn = () => ({ x: COURT.x + 1.1, y: COURT.y + BALL_RADIUS, z: COURT.z + 1.3 });
export function createBasketballState() {
  return { phase: 'ground', ball: spawn(), velocity: { x: 0, y: 0, z: 0 }, time: 0,
    makes: 0, shots: 0, scored: false, result: null, noticeUntil: 0, releaseUntil: 0, flightAge: 0, rimCooldown: 0 };
}
export function canPickUpBall(state, player) {
  return state.phase === 'ground' && Math.hypot(player.x - state.ball.x, player.z - state.ball.z) <= 1.5
    && Math.abs(player.y - state.ball.y) < 1.3;
}
export function toggleBall(state, player) {
  if (state.phase === 'held') {
    state.phase = 'flight'; state.velocity = { x: 0, y: 0, z: 0 }; state.flightAge = 0; state.scored = true;
    return true;
  }
  if (!canPickUpBall(state, player)) return false;
  state.phase = 'held'; state.velocity = { x: 0, y: 0, z: 0 }; return true;
}
export function shootBall(state, player, { moving = false, airborne = false, random = Math.random } = {}) {
  const distance = Math.hypot(player.x - HOOP.x, player.z - HOOP.z);
  if (state.phase !== 'held' || distance > 15) return false;
  const flight = 1 + distance * 0.055, gravity = 9.8;
  const error = Math.max(0.03, 0.06 + Math.max(0, distance - 4) * 0.045 + (moving ? 0.14 : 0) - (airborne ? 0.025 : 0));
  state.ball = { x: player.x, y: player.y + 1.25, z: player.z };
  const target = { x: HOOP.x + (random() - 0.5) * error, z: HOOP.z + (random() - 0.5) * error };
  state.velocity = { x: (target.x - state.ball.x) / flight, z: (target.z - state.ball.z) / flight,
    y: (HOOP.y - state.ball.y + gravity * flight * flight / 2) / flight };
  state.phase = 'flight'; state.shots++; state.scored = false; state.result = null;
  state.releaseUntil = state.time + 0.5; state.flightAge = 0; state.rimCooldown = 0; return true;
}
function returnToCourt(state) {
  state.ball = spawn(); state.velocity = { x: 0, y: 0, z: 0 }; state.phase = 'ground';
  state.result = 'returned'; state.noticeUntil = state.time + 2.5;
}
export function stepBasketball(state, seconds, player, { heading = 0, moving = false, airborne = false } = {}) {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.05); state.time += dt;
  if (state.phase === 'held') {
    state.ball = { x: player.x + Math.cos(heading) * 0.34 - Math.sin(heading) * 0.12,
      z: player.z - Math.sin(heading) * 0.34 - Math.cos(heading) * 0.12,
      y: player.y + (moving && !airborne ? BALL_RADIUS + (1 + Math.cos(state.time * 10)) * 0.31 : 0.8) };
    return state;
  }
  if (state.phase === 'ground') return state;
  state.flightAge += dt;
  for (let remaining = dt; remaining > 1e-8; remaining -= 0.01) {
    const step = Math.min(remaining, 0.01), old = { ...state.ball }, ball = state.ball, v = state.velocity;
    ball.x += v.x * step; ball.z += v.z * step; ball.y += v.y * step - 4.9 * step * step; v.y -= 9.8 * step;
    state.rimCooldown = Math.max(0, state.rimCooldown - step);
    if (!state.scored && v.y < 0 && old.y >= HOOP.y && ball.y < HOOP.y) {
      const t = (old.y - HOOP.y) / (old.y - ball.y), x = old.x + (ball.x - old.x) * t, z = old.z + (ball.z - old.z) * t;
      if (Math.hypot(x - HOOP.x, z - HOOP.z) < HOOP.radius - BALL_RADIUS - 0.032) {
        state.scored = true; state.makes++; state.result = 'scored'; state.noticeUntil = state.time + 3;
        v.x *= 0.35; v.z *= 0.35;
      }
    }
    const radial = Math.hypot(ball.x - HOOP.x, ball.z - HOOP.z);
    if (!state.scored && state.rimCooldown === 0 && Math.hypot(radial - HOOP.radius, ball.y - HOOP.y) < BALL_RADIUS + 0.032) {
      v.y = Math.abs(v.y) * 0.4 + 0.8; v.x += (ball.x - HOOP.x) / radial; v.z += (ball.z - HOOP.z) / radial;
      ball.y = HOOP.y + BALL_RADIUS; state.rimCooldown = 0.22;
    }
    const boardSide = old.z - HOOP.boardZ;
    if (Math.abs(ball.x - HOOP.x) < 0.83 + BALL_RADIUS && Math.abs(ball.y - (COURT.y + 3.1)) < 0.5 + BALL_RADIUS
      && boardSide * v.z < 0 && Math.abs(ball.z - HOOP.boardZ) < BALL_RADIUS) {
      ball.z = HOOP.boardZ + Math.sign(boardSide) * BALL_RADIUS; v.z *= -0.68;
    }
    const onLand = isLand(ball.x, ball.z);
    if ((!onLand && ball.y < -0.05) || state.flightAge > 9) { returnToCourt(state); break; }
    const floor = onLand ? terrainHeight(ball.x, ball.z) + BALL_RADIUS : -Infinity;
    if (ball.y < floor) {
      ball.y = floor;
      if (!state.scored) { state.result = 'missed'; state.noticeUntil = state.time + 2; }
      v.y = Math.abs(v.y) * 0.52; v.x *= 0.72; v.z *= 0.72;
      if (v.y < 0.38 && Math.hypot(v.x, v.z) < 0.25) { state.phase = 'ground'; state.velocity = { x: 0, y: 0, z: 0 }; break; }
    }
  }
  return state;
}
export function basketballHud(state, player) {
  const held = state.phase === 'held', nearby = Math.hypot(player.x - COURT.x, player.z - COURT.z) < 8;
  return { visible: held || nearby || canPickUpBall(state, player) || state.time < state.noticeUntil,
    held, canPickup: canPickUpBall(state, player), canShoot: held && Math.hypot(player.x - HOOP.x, player.z - HOOP.z) <= 15,
    flying: state.phase === 'flight', makes: state.makes, shots: state.shots, result: state.time < state.noticeUntil ? state.result : null };
}
