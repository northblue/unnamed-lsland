export const ISLAND = { x: 20, z: 15.5 };
export const OCEAN_RADIUS = 33;
export const LIGHTHOUSE = { x: -22.3, z: 3.5, radius: 1.8 };
export const POND = { x: 16, z: 6, radius: 2.1, waterY: 0.58, capacity: 24 };
export const SCENERY_TREES = [[-16, 0], [-15, -4], [-11, -10], [-6, -12], [-2, -13], [5, -12], [11, -10], [15, -5], [17, 0], [-14, 7]]
  .map(([x, z], i) => ({ id: `grove:${i}`, x, z, radius: 0.55, type: 'wood', remaining: 3 }));
const POND_OBSTACLE = { x: POND.x, z: POND.z, radius: POND.radius + 0.25 };
export const SCENERY_ROCKS = [
  { x: -12.5, z: -2.8, radius: 0.9, height: 1.8 },
  { x: 11.7, z: -5.5, radius: 1.0, height: 2.1 },
  { x: -7.8, z: -9, radius: 0.8, height: 1.6 },
];
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
// Preserve earlier terrain under existing saves; relief is added beyond the old coast.
export function terrainHeight(x, z) {
  const legacy = Math.hypot(x / 12, z / 9);
  const coast = Math.hypot(x / ISLAND.x, z / ISLAND.z);
  const oldCoast = Math.hypot(x / 15, z / 11.5);
  const hills = 2.4 * Math.exp(-((x + 9.6) ** 2 / 10 + (z + 7.4) ** 2 / 5))
    + 1.8 * Math.exp(-((x - 8) ** 2 / 10 + (z + 8.1) ** 2 / 5))
    + 5 * Math.exp(-((x + 12.6) ** 2 / 4 + (z + 3.8) ** 2 / 8));
  const oldHeight = 0.52 + hills * smooth(1, 1.18, legacy) * (1 - smooth(0.85, 0.98, oldCoast));
  // All new relief lies beyond the previous shoreline; old saves keep their ground.
  const west = 5.4 * (1 - smooth(0.25, 1.1, Math.hypot((x + 15.3) / 5, (z + 2) / 7)));
  const north = 5.8 * Math.exp(-((x + 5) ** 2 / 30 + (z + 12.2) ** 2 / 8));
  const east = 4.4 * Math.exp(-((x - 10.5) ** 2 / 28 + (z + 10.3) ** 2 / 10));
  const dunes = 1.3 * Math.exp(-((x + 8) ** 2 / 24 + (z - 11.5) ** 2 / 5));
  const added = (west + north + east + dunes) * smooth(1, 1.13, oldCoast) * (1-smooth(0.88, 0.99, coast));
  const pondDistance = Math.hypot(x-POND.x, z-POND.z);
  // A shallow basin below the pond water, with a flat stone rim.
  const basin = 0.16 + 0.36 * smooth(1.55, 2.05, pondDistance);
  return pondDistance < 2.05 ? basin : oldHeight + added;
}
export function activeObstacles(resources) { return [...resources.filter((resource) => resource.remaining > 0), ...SCENERY_ROCKS, ...SCENERY_TREES, POND_OBSTACLE]; }
export const PLAYER_RADIUS = 0.35;
export const SPAWN = { x: 0, z: 4 };
export const TREES = [
  [-7, -2], [-5, -5], [-2, -5.5], [1, -5], [5, -4], [7, -1],
  [-6, 1], [-3, -2], [2, -2.5], [5, 1], [-8, -0.5], [0, -6.5],
];
export const ROCKS = [[-5, 4, 0.8], [6, 4, 1], [8, 1.5, 0.65], [-1, -3, 0.7]];
export const OBSTACLES = [
  ...SCENERY_TREES, POND_OBSTACLE,
  ...SCENERY_ROCKS,
  ...TREES.map(([x, z]) => ({ x, z, radius: 0.55 })),
  ...ROCKS.map(([x, z, radius]) => ({ x, z, radius })),
];

export function circleIntersectsBox(circle, box, halfX, halfZ) {
  const dx = Math.max(Math.abs(circle.x - box.x) - halfX, 0);
  const dz = Math.max(Math.abs(circle.z - box.z) - halfZ, 0);
  return dx * dx + dz * dz <= circle.radius * circle.radius;
}

export function canWalk(x, z, buildings = [], obstacles = OBSTACLES) {
  const a = ISLAND.x - PLAYER_RADIUS - 0.3;
  const b = ISLAND.z - PLAYER_RADIUS - 0.3;
  return (x / a) ** 2 + (z / b) ** 2 <= 1 &&
    obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + PLAYER_RADIUS) &&
    buildings.every((building) => !circleIntersectsBox({ x, z, radius: PLAYER_RADIUS }, building, building.halfX, building.halfZ));
}

// Resolve each ground axis separately so the player slides along obstacles.
export function movePlayer(position, dx, dz, buildings = [], obstacles = OBSTACLES) {
  if (canWalk(position.x + dx, position.z, buildings, obstacles)) position.x += dx;
  if (canWalk(position.x, position.z + dz, buildings, obstacles)) position.z += dz;
}
