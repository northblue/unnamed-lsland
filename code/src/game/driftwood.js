import { ISLAND, OCEAN_RADIUS } from './world.js';

export const SALVAGE_RANGE = 8;
export const SALVAGE_REWARDS = { plank: { wood: 2, stone: 0 }, crate: { wood: 1, stone: 2 } };

function reset(item, random, ready = false) {
  item.angle = ready ? Math.PI / 2 + item.id * 0.3 : random() * Math.PI * 2;
  item.kind = random() < 0.7 ? 'plank' : 'crate';
  item.elapsed = ready ? 42 : -random() * 15;
  item.collected = false;
  return item;
}
export function createDriftwood(random = Math.random) {
  const items = Array.from({ length: 6 }, (_, id) => reset({ id }, random, id < 2));
  stepDriftwood(items, 0, random);
  return items;
}
export function stepDriftwood(items, seconds, random = Math.random) {
  for (const item of items) {
    item.elapsed += Math.max(0, seconds);
    if (item.elapsed > 100) reset(item, random);
    const c = Math.cos(item.angle), s = Math.sin(item.angle);
    const shore = 1 / Math.hypot(c / ISLAND.x, s / ISLAND.z) + 1.3;
    const progress = Math.max(0, Math.min(1, item.elapsed / 42));
    const radius = (OCEAN_RADIUS + 1) * (1-progress) + shore * progress;
    item.x = c * radius; item.z = s * radius;
    item.visible = item.elapsed >= 0 && !item.collected && radius < OCEAN_RADIUS-0.3;
  }
}
export function nearbyDriftwood(items, player) {
  return items.filter(item => item.visible && Math.hypot(item.x-player.x,item.z-player.z) <= SALVAGE_RANGE)
    .sort((a,b) => Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0] ?? null;
}
export function collectDriftwood(items, inventory, player, id) {
  const item = items.find(item => item.id === id);
  if (!item?.visible || Math.hypot(item.x-player.x,item.z-player.z)>SALVAGE_RANGE) return null;
  const reward = SALVAGE_REWARDS[item.kind];
  if (inventory.wood+reward.wood>1000000 || inventory.stone+reward.stone>1000000) return null;
  inventory.wood += reward.wood; inventory.stone += reward.stone;
  item.collected = true; item.visible = false;
  return { ...reward, kind:item.kind };
}
