import { createGatheringState, resourceSnapshot, TREE_GROW_SECONDS } from './gathering.js';
import { HUT, placementError } from './building.js';
import { SPAWN, canWalk, activeObstacles, POND } from './world.js';
import { pondTotal } from './pond.js';
import { emptyCatch, FISH_KINDS } from './fishing.js';

export function createIslandState() {
  const inventory = createGatheringState();
  return { version: 1, name: '无名岛', wood: 0, stone: 0, catches: emptyCatch(), pond: emptyCatch(), player: { ...SPAWN },
    resources: resourceSnapshot(inventory.resources), buildings: [] };
}

export function validateIslandState(value) {
  function fail(code) { throw new Error(code); }
  if (!value || value.version !== 1) fail('invalidVersion');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 40) fail('invalidName');
  for (const type of ['wood', 'stone']) {
    if (!Number.isSafeInteger(value[type]) || value[type] < 0 || value[type] > 1000000) fail('invalidResources');
  }
  const catches = emptyCatch();
  if (value.catches !== undefined) {
    if (!value.catches || typeof value.catches !== 'object' || Array.isArray(value.catches)) fail('invalidCatch');
    for (const [kind, count] of Object.entries(value.catches)) {
      if (!FISH_KINDS.includes(kind) || !Number.isSafeInteger(count) || count < 0 || count > 1000000) fail('invalidCatch');
      catches[kind] = count;
    }
  }
  const pond = emptyCatch();
  if (value.pond !== undefined) {
    if (!value.pond || typeof value.pond !== 'object' || Array.isArray(value.pond)) fail('invalidPond');
    for (const [kind, count] of Object.entries(value.pond)) {
      if (!FISH_KINDS.includes(kind) || !Number.isSafeInteger(count) || count < 0 || count > POND.capacity) fail('invalidPond');
      pond[kind] = count;
    }
    if (pondTotal(pond) > POND.capacity) fail('invalidPond');
  }
  const inventory = createGatheringState();
  if (!Array.isArray(value.resources) || value.resources.length !== inventory.resources.length) fail('invalidWorld');
  const remainingById = new Map();
  const growthById = new Map();
  for (const node of value.resources) {
    if (!node || typeof node.id !== 'string' || remainingById.has(node.id) || !Number.isInteger(node.remaining) || node.remaining < 0 || node.remaining > 3) fail('invalidWorld');
    remainingById.set(node.id, node.remaining);
    if(node.growth!==undefined && (!Number.isFinite(node.growth) || node.growth<0 || node.growth>TREE_GROW_SECONDS)) fail('invalidWorld');
    growthById.set(node.id,node.growth);
  }
  for (const node of inventory.resources) {
    if (!remainingById.has(node.id)) fail('invalidWorld');
    node.remaining = remainingById.get(node.id);
    if(node.type==='wood') node.growth=node.remaining>0 ? TREE_GROW_SECONDS : growthById.get(node.id)??0;
  }
  if (!Array.isArray(value.buildings) || value.buildings.length > 50) fail('invalidBuildings');
  const ids = new Set();
  const construction = { buildings: [] };
  for (const building of value.buildings) {
    if (!building || typeof building.id !== 'string' || !/^[\w:-]{1,100}$/.test(building.id) || ids.has(building.id) || building.type !== 'hut') fail('invalidBuildings');
    ids.add(building.id);
    const reason = placementError(construction, { ...inventory, wood: Infinity, stone: Infinity }, building, { x: 100, z: 100 });
    if (reason) fail(`building_${reason}`);
    construction.buildings.push({ id: building.id, type: 'hut', x: building.x, z: building.z, halfX: HUT.halfX, halfZ: HUT.halfZ });
  }
  const active = activeObstacles(inventory.resources);
  let player = value.player;
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) fail('invalidPlayer');
  if (!canWalk(player.x, player.z, construction.buildings, active)) {
    player = null;
    for (let z = 4; z >= -7 && !player; z -= 0.5) {
      for (let x = -10; x <= 10; x += 0.5) {
        if (canWalk(x, z, construction.buildings, active)) { player = { x, z }; break; }
      }
    }
    if (!player) fail('invalidPlayer');
  }
  return { version: 1, name: value.name.trim(), wood: value.wood, stone: value.stone, catches, pond,
    player: { x: player.x, z: player.z },
    resources: resourceSnapshot(inventory.resources),
    buildings: construction.buildings.map(({ id, type, x, z }) => ({ id, type, x, z })) };
}
