import * as THREE from 'three';
import { coastRadius, coastRatio, terrainHeight } from './world.js';

export function beachHeight(x, z) {
  const ratio = coastRatio(x, z);
  if (ratio <= 1) return terrainHeight(x, z);
  const t = Math.min(1, (ratio - 1) / 0.15);
  return 0.52 - 2.4 * t * t * (3 - 2 * t);
}

// An underwater sand shelf replaces the vertical edge of the land plinth.
export function createBeachGeometry() {
  const positions = [], colors = [], indices = [], segments = 256, rows = 20;
  const dry = new THREE.Color('#f7e4b5'), wet = new THREE.Color('#c4b48d'), deep = new THREE.Color('#a8b8a1'), color = new THREE.Color();
  for (let row = 0; row <= rows; row++) for (let i = 0; i <= segments; i++) {
    const ratio = 1 + row / rows * 0.15, angle = i / segments * Math.PI * 2, radius = coastRadius(angle) * ratio;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, y = beachHeight(x, z);
    positions.push(x, y, z);
    color.copy(dry).lerp(wet, THREE.MathUtils.smoothstep(ratio, 1.015, 1.07)).lerp(deep, THREE.MathUtils.smoothstep(ratio, 1.07, 1.15));
    colors.push(color.r, color.g, color.b);
    if (row < rows && i < segments) { const a = row * (segments + 1) + i, b = a + segments + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
