import { ISLAND, LIGHTHOUSE } from './world.js';

export const RIPPLE_LIFETIME = 2.4;
export const MAX_SPLASHES = 8;

export function isOpenWater(x, z, radius) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) < radius - 0.2 &&
    Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) > LIGHTHOUSE.radius &&
    (x / (ISLAND.x * 1.06)) ** 2 + (z / (ISLAND.z * 1.06)) ** 2 > 1;
}

export function rippleHeight(x, z, time, splashes) {
  let height = 0;
  for (const splash of splashes) {
    const age = time - splash.time;
    if (age < 0 || age > RIPPLE_LIFETIME) continue;
    const distance = Math.hypot(x - splash.x, z - splash.z);
    const front = distance - age * 2.5;
    height += Math.sin(front * 7) * Math.exp(-front * front * 1.8) *
      (1 - age / RIPPLE_LIFETIME) * 0.23 * Math.sqrt(splash.strength ?? 1);
  }
  return Math.max(-0.4, Math.min(0.4, height));
}

export function isTap(down, event) {
  return Boolean(down && event.button === 0 && event.pointerId === down.id && !down.moved &&
    Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 5);
}
