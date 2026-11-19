// Camera math only; no game state or browser dependencies.
export function surfCameraTarget(position, heading) {
  return { x: position.x - Math.sin(heading) * 1.1, y: position.y + 0.8, z: position.z - Math.cos(heading) * 1.1 };
}
export function smoothCameraAngle(current, target, seconds) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-Math.max(0, Math.min(seconds, 0.1)) * 5));
}
export function surfCameraZoom(top) { return Math.max(1, Math.min(20, top / 5.2)); }
