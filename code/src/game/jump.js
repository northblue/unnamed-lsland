// Voluntary jump height is relative to terrain; horizontal collision stays unchanged.
export function createJumpState() { return { height: 0, velocity: 0, grounded: true }; }
export function startJump(state) {
  if (!state.grounded) return false;
  state.grounded = false; state.velocity = 5.2; return true;
}
export function stepJump(state, seconds) {
  if (state.grounded || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.1), gravity = 14;
  state.height += state.velocity * dt - gravity * dt * dt / 2;
  state.velocity -= gravity * dt;
  if (state.height <= 0) Object.assign(state, createJumpState());
  return state;
}
