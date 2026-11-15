import { TREES, ROCKS } from './world.js';

export const TREE_GROW_SECONDS = 180;
export const GATHER_RANGE = 1.8;
export const WOOD_PER_TREE = 3;
export const STONE_PER_ROCK = 3;

// Plain game data: no Three.js objects or translated UI strings.
export function createGatheringState() {
  return {
    wood: 0,
    stone: 0,
    resources: [
      ...TREES.map(([x, z]) => ({
        id: `tree:${x}:${z}`, type: 'wood', x, z, radius: 0.55, remaining: WOOD_PER_TREE, growth: TREE_GROW_SECONDS,
      })),
      ...ROCKS.map(([x, z, radius]) => ({
        id: `rock:${x}:${z}`, type: 'stone', x, z, radius, remaining: STONE_PER_ROCK,
      })),
    ],
  };
}

export function findNearbyResource(state, position) {
  const nearby = state.resources
    .map((resource) => ({ resource, distance: Math.hypot(resource.x - position.x, resource.z - position.z) }))
    .filter(({ distance }) => distance <= GATHER_RANGE)
    .sort((a, b) => a.distance - b.distance);
  // A depleted node must not hide another usable resource within reach.
  return nearby.find(({ resource }) => resource.remaining > 0)?.resource ?? nearby[0]?.resource ?? null;
}

export function gatherResource(state, position) {
  // Recheck at the moment of interaction, rather than trusting the UI target.
  const resource = findNearbyResource(state, position);
  if (!resource || resource.remaining <= 0) return null;
  resource.remaining -= 1;
  if (state[resource.type] >= 1000000) { resource.remaining += 1; return null; }
  state[resource.type] += 1;
  if (resource.type === 'wood' && resource.remaining === 0) resource.growth = 0;
  return { resourceId: resource.id, type: resource.type, depleted: resource.remaining === 0 };
}


export function resourceSnapshot(resources) {
  return resources.map(({id,remaining,type,growth}) => ({id,remaining,...(type==='wood' ? {growth:Math.round((growth??(remaining>0?TREE_GROW_SECONDS:0))*10)/10} : {})}));
}

export function treeCovered(tree, buildings) {
  return buildings.some(b=>Math.abs(tree.x-b.x)<=b.halfX+tree.radius && Math.abs(tree.z-b.z)<=b.halfZ+tree.radius);
}

// Active play time only: independent of the visual day-cycle speed.
export function stepTreeGrowth(state, seconds, buildings=[], player={x:Infinity,z:Infinity}) {
  for(const tree of state.resources) {
    if(tree.type!=='wood' || tree.remaining>0 || treeCovered(tree,buildings))continue;
    tree.growth=Math.min(TREE_GROW_SECONDS,(tree.growth??0)+Math.max(0,Math.min(seconds,10)));
    if(tree.growth>=TREE_GROW_SECONDS && Math.hypot(tree.x-player.x,tree.z-player.z)>tree.radius+0.5) tree.remaining=WOOD_PER_TREE;
  }
}
