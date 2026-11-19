export const ISLAND = { x: 20, z: 15.5 };
export const OCEAN_RADIUS = 43;
export const LIGHTHOUSE = { x: -22.3, z: 3.5, radius: 4.5 };
export const GARDEN = { x: 10, z: 17, rx: 8.8, rz: 8.8 };
export const COURT = { x: 10.5, z: 19.2, halfX: 4, halfZ: 3.8, y: 1.02, hoopZ: 14.7 };
export const SUNFLOWER = { x: 4.5, z: 19, radius: 0.45 };
// These fixtures lie beyond the original building coast, preserving old saves.
export const LANDMARK_OBSTACLES = [
  { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, radius: 1.12 },
  { x: -24.1, z: 4.1, radius: 1.0 },
  { x: COURT.x, z: COURT.hoopZ, radius: 0.25 },
  SUNFLOWER,
];
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
export function coastRadius(angle) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const original = 1 / Math.hypot(dx / ISLAND.x, dz / ISLAND.z);
  let radius = original;
  for (const feature of [{ x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, rx: LIGHTHOUSE.radius, rz: LIGHTHOUSE.radius }, GARDEN]) {
    const a = (dx / feature.rx) ** 2 + (dz / feature.rz) ** 2;
    const b = -2 * (dx * feature.x / feature.rx ** 2 + dz * feature.z / feature.rz ** 2);
    const c = (feature.x / feature.rx) ** 2 + (feature.z / feature.rz) ** 2 - 1;
    const discriminant = b * b - 4 * a * c;
    if (discriminant <= 0) continue;
    const halfChord = Math.sqrt(discriminant) / (2 * a), far = -b / (2 * a) + halfChord;
    radius = Math.max(radius, original + Math.max(0, far - original) * smooth(0, 1.2, halfChord));
  }
  return radius;
}
export function coastRatio(x, z) { return Math.hypot(x, z) / coastRadius(Math.atan2(z, x)); }
export function isLand(x, z, inset = 0) { return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= coastRadius(Math.atan2(z, x)) - inset; }
// Preserve earlier terrain under existing saves; relief is added beyond the old coast.
export function legacyTerrainHeight(x, z) {
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
export function terrainHeight(x, z) {
  const oldCoast = Math.hypot(x / ISLAND.x, z / ISLAND.z);
  if (oldCoast <= 1) return legacyTerrainHeight(x, z);
  const distance = Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z);
  const headland = 2 * (1 - smooth(3.4, 4.4, distance))
    + 2.2 * (1 - smooth(2.6, 3.3, distance)) + 1.8 * (1 - smooth(1.85, 2.55, distance));
  const garden = Math.hypot((x - GARDEN.x) / GARDEN.rx, (z - GARDEN.z) / GARDEN.rz);
  const apron = Math.max(Math.abs(x - COURT.x) - COURT.halfX, Math.abs(z - COURT.z) - COURT.halfZ);
  const sports = Math.max(0.43 * (1 - smooth(0.83, 1, garden)), 0.5 * (1 - smooth(0.1, 0.7, apron)));
  const shore = 1 - smooth(0.97, 1, coastRatio(x, z));
  return 0.52 + Math.max(headland * smooth(1, 1.07, oldCoast), sports * smooth(1, 1.035, oldCoast)) * shore;
}
export function activeObstacles(resources) { return [...resources.filter((resource) => resource.remaining > 0), ...SCENERY_ROCKS, ...SCENERY_TREES, POND_OBSTACLE, ...LANDMARK_OBSTACLES]; }
export const PLAYER_RADIUS = 0.35;
export const SPAWN = { x: 0, z: 4 };
export const TREES = [
  [-7, -2], [-5, -5], [-2, -5.5], [1, -5], [5, -4], [7, -1],
  [-6, 1], [-3, -2], [2, -2.5], [5, 1], [-8, -0.5], [0, -6.5],
];
export const ROCKS = [[-5, 4, 0.8], [6, 4, 1], [8, 1.5, 0.65], [-1, -3, 0.7]];
export const OBSTACLES = [
  ...SCENERY_TREES, POND_OBSTACLE, ...LANDMARK_OBSTACLES,
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
  return isLand(x, z, PLAYER_RADIUS + 0.3) &&
    obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + PLAYER_RADIUS) &&
    buildings.every((building) => !circleIntersectsBox({ x, z, radius: PLAYER_RADIUS }, building, building.halfX, building.halfZ));
}

// Resolve each ground axis separately so the player slides along obstacles.
export function movePlayer(position, dx, dz, buildings = [], obstacles = OBSTACLES) {
  const startX=position.x,startZ=position.z;
  if (canWalk(position.x + dx, position.z, buildings, obstacles)) position.x += dx;
  if (canWalk(position.x, position.z + dz, buildings, obstacles)) position.z += dz;
  // Narrow diagonal gaps can block both separate axes even when the desired path is clear.
  if(position.x===startX&&position.z===startZ&&dx&&dz) {
    const steps=Math.ceil(Math.hypot(dx,dz)/.04);
    if(Array.from({length:steps+1},(_,i)=>i/steps).every(t=>canWalk(startX+dx*t,startZ+dz*t,buildings,obstacles))) { position.x+=dx;position.z+=dz; }
  }
}
