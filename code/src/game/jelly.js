export function createJelly() {
  const state = { x: 0, z: 0, vx: 0, vz: 0 };
  const clamp = (value, max) => Math.max(-max, Math.min(max, value));
  return {
    state,
    kick(dx, dz) {
      state.vx = clamp(state.vx + dx * 0.09, 8);
      state.vz = clamp(state.vz + dz * 0.09, 8);
    },
    update(dt) {
      // Small substeps keep the damped spring stable across different frame rates.
      const steps = Math.max(1, Math.ceil(Math.min(dt, 0.05) / 0.008));
      const step = Math.min(dt, 0.05) / steps;
      for (let i = 0; i < steps; i++) {
        state.vx += (-55 * state.x - 3.2 * state.vx) * step;
        state.vz += (-55 * state.z - 3.2 * state.vz) * step;
        state.x = clamp(state.x + state.vx * step, 0.95);
        state.z = clamp(state.z + state.vz * step, 0.95);
      }
    },
  };
}
