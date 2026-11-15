// A short breach occupies only the middle of a passage, safely inside the disc.
export function whalePose(progress, duration, enabled = true, reduceMotion = false) {
  const u = (progress - 0.48) * duration / 4.2;
  if (!enabled || reduceMotion || u < 0 || u > 1) return { active: false, u, lift: 0, pitch: 0, roll: 0 };
  const envelope = Math.sin(Math.PI * u);
  return { active: true, u, lift: 4.1 * envelope * envelope,
    pitch: Math.sin(Math.PI * 2 * u) * 1.05,
    roll: Math.sin(Math.PI * u) ** 2 * 0.38 };
}
