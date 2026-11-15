import { ISLAND, OBSTACLES, PLAYER_RADIUS, circleIntersectsBox, terrainHeight, activeObstacles } from './world.js';

export const HUT = { wood: 6, stone: 3, halfX: 1.4, halfZ: 1.2 };

export function hutMaterialsMissing(inventory) {
  return { wood: Math.max(0, HUT.wood - inventory.wood), stone: Math.max(0, HUT.stone - inventory.stone) };
}

// The preview and final purchase use exactly the same validation.
export function placementError(state, inventory, position, player) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return 'choose';
  const { x, z } = position;
  for (const dx of [-HUT.halfX, HUT.halfX]) {
    for (const dz of [-HUT.halfZ, HUT.halfZ]) {
      if (((x + dx) / (ISLAND.x - 0.3)) ** 2 + ((z + dz) / (ISLAND.z - 0.3)) ** 2 > 1) return 'water';
    }
  }
  const heights = [-HUT.halfX, 0, HUT.halfX].flatMap((dx) => [-HUT.halfZ, 0, HUT.halfZ].map((dz) => terrainHeight(x + dx, z + dz)));
  if (Math.max(...heights) - Math.min(...heights) > 0.35) return 'slope';
  const obstacles = inventory.resources ? activeObstacles(inventory.resources) : OBSTACLES;
  if (obstacles.some((o) => circleIntersectsBox(o, position, HUT.halfX, HUT.halfZ))) return 'obstacle';
  if (state.buildings.some((b) => Math.abs(b.x - x) <= b.halfX + HUT.halfX + 0.1 && Math.abs(b.z - z) <= b.halfZ + HUT.halfZ + 0.1)) return 'building';
  if (circleIntersectsBox({ ...player, radius: PLAYER_RADIUS + 0.1 }, position, HUT.halfX, HUT.halfZ)) return 'player';
  if (inventory.wood < HUT.wood || inventory.stone < HUT.stone) return 'materials';
  return null;
}

export function findBuildSpot(state, inventory, player) {
  let best = null;
  let bestDistance = Infinity;
  const previewInventory = { ...inventory, wood: Infinity, stone: Infinity };
  for (let x = -ISLAND.x + 2; x <= ISLAND.x - 2; x += 0.5) {
    for (let z = -ISLAND.z + 2; z <= ISLAND.z - 2; z += 0.5) {
      const position = { x, z };
      if (placementError(state, previewInventory, position, player)) continue;
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance < bestDistance) { best = position; bestDistance = distance; }
    }
  }
  return best;
}

export function buildHut(state, inventory, position, player) {
  const error = placementError(state, inventory, position, player);
  if (error) return { error };
  const building = { id: `hut:${crypto.randomUUID()}`, x: position.x, z: position.z, halfX: HUT.halfX, halfZ: HUT.halfZ };
  inventory.wood -= HUT.wood;
  inventory.stone -= HUT.stone;
  state.buildings.push(building);
  return { building };
}
