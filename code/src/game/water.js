import * as THREE from 'three';
import { createWaterReflection } from './waterReflection.js';
import { createSplashes } from './splashes.js';
import { isOpenWater, rippleHeight, MAX_SPLASHES, RIPPLE_LIFETIME } from './waterInteraction.js';
import { createJelly } from './jelly.js';
import { createMarineLife } from './marineLife.js';
import { ISLAND, OCEAN_RADIUS } from './world.js';

const RADIUS = OCEAN_RADIUS;
const SURFACE_Y = -0.12;
const BOTTOM_Y = -2.7;

// Visual scenery only. Walkable land and construction boundaries stay in world.js.
export function createWater(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'island-water-diorama';
  scene.add(group);
  const materials = new Set();
  function add(geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    group.add(object);
    materials.add(material);
    return object;
  }

  // A small seamless normal texture creates broad, gentle highlights, not geometry waves.
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const dx = Math.cos(u * 3 + v * 2) * 0.27 + Math.cos(u * 5 - v * 3) * 0.12;
      const dy = Math.cos(u * 3 + v * 2) * 0.18 - Math.cos(u * 5 - v * 3) * 0.07;
      const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      pixels[i] = (normal.x * 0.5 + 0.5) * 255;
      pixels[i + 1] = (normal.y * 0.5 + 0.5) * 255;
      pixels[i + 2] = normal.z * 255;
      pixels[i + 3] = 255;
    }
  }
  const normalMap = new THREE.DataTexture(pixels, size, size);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.magFilter = normalMap.minFilter = THREE.LinearFilter;
  normalMap.repeat.set(3, 3);
  normalMap.needsUpdate = true;

  const sideMaterial = new THREE.MeshPhysicalMaterial({
    color: '#128b91', transmission: 0, transparent: true, opacity: 0.54,
    depthWrite: false, roughness: 0.28, metalness: 0, clearcoat: 0.08,
  });
  const reflection = createWaterReflection(new THREE.RingGeometry(0, RADIUS, 128, 24), normalMap);
  const surface = reflection.surface; surface.position.y = SURFACE_Y; group.add(surface);
  surface.rotation.x = -Math.PI / 2;
  const wall = add(new THREE.CylinderGeometry(RADIUS, RADIUS, SURFACE_Y - BOTTOM_Y, 128, 4, true),
    sideMaterial, 0, (SURFACE_Y + BOTTOM_Y) / 2);
  wall.userData.skipWaterReflection = true;

  const jelly = createJelly();
  const splashes = [];
  const splashView = createSplashes(group, RADIUS);
  let currentTime = 0;
  const surfaceBase = surface.geometry.attributes.position.array.slice();
  const wallBase = wall.geometry.attributes.position.array.slice();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function deform(x, z, time) {
    const shore = Math.sqrt((x / ISLAND.x) ** 2 + (z / ISLAND.z) ** 2);
    const envelope = THREE.MathUtils.smoothstep(shore, 1, 1.5);
    const { x: jx, z: jz } = jelly.state;
    const radius = Math.hypot(x, z);
    const breeze = Math.sin(x * 0.7 + z * 0.4 - time * 1.2) * 0.045 + Math.sin(z * 1.2 - time * 1.7) * 0.025;
    return envelope * (breeze + rippleHeight(x, z, time, splashes) + (x / RADIUS * jx + z / RADIUS * jz) * 0.85 +
      Math.sin(radius * 1.4 - time * 8) * Math.hypot(jx, jz) * 0.16);
  }

  // A gently descending shelf reveals sand near the shore, deeper turquoise farther out.
  const segments = 160;
  const rings = 36;
  const positions = [];
  const colors = [];
  const indices = [];
  const shallow = new THREE.Color('#b4cfb5');
  const deep = new THREE.Color('#216a75');
  const color = new THREE.Color();
  function shelfPoint(angle, t) {
    return {
      x: Math.cos(angle) * THREE.MathUtils.lerp(ISLAND.x - 0.1, RADIUS, t),
      z: Math.sin(angle) * THREE.MathUtils.lerp(ISLAND.z - 0.1, RADIUS, t),
      y: THREE.MathUtils.lerp(-0.3, BOTTOM_Y + 0.08, Math.pow(t, 0.72)),
    };
  }
  for (let row = 0; row <= rings; row++) {
    const t = row / rings;
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2;
      const p = shelfPoint(angle, t);
      positions.push(p.x, p.y, p.z);
      const pattern = Math.sin(p.x * 2.7 + Math.sin(p.z * 1.5)) * Math.sin(p.z * 2.4 + Math.cos(p.x));
      color.copy(shallow).lerp(deep, t * 0.85).multiplyScalar(0.96 + pattern * 0.055);
      colors.push(color.r, color.g, color.b);
      if (row < rings && col < segments) {
        const a = row * (segments + 1) + col;
        const b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const shelfGeometry = new THREE.BufferGeometry();
  shelfGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shelfGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shelfGeometry.setIndex(indices);
  shelfGeometry.computeVertexNormals();
  const shelf = add(shelfGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  shelf.receiveShadow = true;

  // Deterministic underwater stones: decoration, never gatherable obstacles.
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#a0b8ac', roughness: 0.95, flatShading: true });
  for (let i = 0; i < 42; i++) {
    const angle = i * 2.399963;
    const t = 0.22 + ((i * 17) % 31) / 31 * 0.65;
    const p = shelfPoint(angle, t);
    const scale = 0.22 + ((i * 7) % 11) * 0.055;
    const rock = add(rockGeometry, rockMaterial, p.x, p.y + scale * 0.25, p.z);
    rock.scale.set(scale * 1.4, scale * 0.65, scale);
    rock.rotation.set(i * 0.3, angle, 0.15);
    rock.receiveShadow = true;
  }

  // A thin circular plinth makes the water thickness easy to read.
  add(new THREE.CylinderGeometry(RADIUS + 0.08, RADIUS - 0.03, 0.3, 160),
    new THREE.MeshStandardMaterial({ color: '#a9b8ad', roughness: 0.8 }), 0, BOTTOM_Y - 0.15);
  const baseRim = add(new THREE.TorusGeometry(RADIUS, 0.045, 6, 160),
    new THREE.MeshStandardMaterial({ color: '#d5d6be', roughness: 0.65 }), 0, BOTTOM_Y - 0.015);
  baseRim.rotation.x = Math.PI / 2;
  // Sky replaces the old solid floor; island meshes still receive sun shadows.

  const marineLife = createMarineLife(group, RADIUS, { onSplash: (x, z, strength) => splashAt(x, z, strength, false) });
  let daylight = 1;
  function splashAt(x, z, strength = 1, disturb = true) {
    if (!isOpenWater(x, z, RADIUS)) return false;
    if (splashes.length >= MAX_SPLASHES) splashes.shift();
    splashes.push({ x, z, time: currentTime, strength });
    if (disturb && !reduceMotion.matches) jelly.kick(x * 0.7, z * 0.7);
    return true;
  }
  return {
    getFish: () => marineLife.getFish(),
    takeFish: (id) => marineLife.takeFish(id),
    splashAt,
    surfaceHeight: (x, z) => SURFACE_Y + (reduceMotion.matches ? 0 : deform(x, z, currentTime)),
    setDaylight(value) {
      daylight = value;
    },
    splash(raycaster) {
      surface.updateWorldMatrix(true, false);
      const hit = raycaster.intersectObject(surface, false)[0];
      return hit ? splashAt(hit.point.x, hit.point.z) : false;
    },
    hitPoint(raycaster) { surface.updateWorldMatrix(true, false); return raycaster.intersectObject(surface, false)[0]?.point ?? null; },
    kick(dx, dz) { if (!reduceMotion.matches) jelly.kick(dx, dz); },
    update(time, dt) {
      currentTime = time;
      reflection.update(reduceMotion.matches ? 0 : time, daylight);
      while (splashes.length && time - splashes[0].time >= RIPPLE_LIFETIME) splashes.shift();
      normalMap.offset.set(time * 0.006, time * 0.003);
      jelly.update(dt);
      const surfacePositions = surface.geometry.attributes.position;
      for (let i = 0; i < surfacePositions.count; i++) {
        const x = surfaceBase[i * 3];
        const z = -surfaceBase[i * 3 + 1];
        surfacePositions.setZ(i, reduceMotion.matches ? 0 : deform(x, z, time));
      }
      surfacePositions.needsUpdate = true;
      surface.geometry.computeVertexNormals();
      const wallPositions = wall.geometry.attributes.position;
      for (let i = 0; i < wallPositions.count; i++) {
        const x = wallBase[i * 3];
        const y = wallBase[i * 3 + 1];
        const z = wallBase[i * 3 + 2];
        const weight = (y + (SURFACE_Y - BOTTOM_Y) / 2) / (SURFACE_Y - BOTTOM_Y);
        wallPositions.setY(i, y + (reduceMotion.matches ? 0 : deform(x, z, time) * weight));
      }
      wallPositions.needsUpdate = true;
      wall.geometry.computeVertexNormals();
      splashView.update(time, splashes, (x, z) => reduceMotion.matches ? 0 : deform(x, z, time), reduceMotion.matches);
      marineLife.update(time, reduceMotion.matches);
    },
    dispose() {
      splashView.dispose();
      marineLife.dispose();
      group.removeFromParent();
      const geometries = new Set();
      group.traverse((object) => { if (object.geometry) geometries.add(object.geometry); });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      normalMap.dispose();
      reflection.dispose();
    },
  };
}
