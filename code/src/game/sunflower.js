import { solarPositionAt } from './dayCycle.js';

export function sunflowerPose(cycle, origin) {
  const sun = solarPositionAt(cycle), daylight = Math.max(0, Math.min(1, cycle.daylight));
  const dx = sun.x - origin.x, dy = Math.max(0.12, sun.y - origin.y), dz = sun.z - origin.z;
  const length = Math.hypot(dx, dy, dz);
  const direction = { x: dx / length * daylight, y: dy / length * daylight - (1 - daylight) * 0.85,
    z: dz / length * daylight + (1 - daylight) * 0.53 };
  const size = Math.hypot(direction.x, direction.y, direction.z);
  return { direction: { x: direction.x / size, y: direction.y / size, z: direction.z / size }, droop: 1 - daylight };
}
