import * as THREE from 'three';
import { SURF_STATION, surfWaveHeight } from './surfing.js';
import { terrainHeight } from './world.js';

export function createSurfView(scene) {
  const root = new THREE.Group(), geometries = [], materials = [];
  root.name = 'surf-station-and-board'; scene.add(root);
  function mesh(geometry, color, parent, position, scale) {
    geometries.push(geometry); const material = new THREE.MeshStandardMaterial({ color, roughness: 0.58 }); materials.push(material);
    const m = new THREE.Mesh(geometry, material); m.position.set(...position); if (scale) m.scale.set(...scale); parent.add(m); return m;
  }
  const board = new THREE.Group(); board.name = 'rideable-surfboard'; root.add(board);
  mesh(new THREE.SphereGeometry(1, 24, 12), '#eab976', board, [0, 0, 0], [0.42, 0.1, 1.25]);
  mesh(new THREE.SphereGeometry(1, 20, 8), '#4caaa9', board, [0, 0.078, 0], [0.12, 0.035, 1.12]);
  mesh(new THREE.BoxGeometry(0.035, 0.23, 0.26), '#456c72', board, [0, -0.16, 0.7]);
  const rack = new THREE.Group(); rack.position.set(SURF_STATION.x, terrainHeight(SURF_STATION.x, SURF_STATION.z), SURF_STATION.z); root.add(rack);
  for (const x of [-0.5, 0.5]) mesh(new THREE.CylinderGeometry(0.06, 0.08, 1, 8), '#ae8055', rack, [x, 0.5, 0]);
  mesh(new THREE.BoxGeometry(1.4, 0.36, 0.09), '#f4dfb0', rack, [0, 0.94, 0.06]);
  // A small board silhouette identifies the station without a language-specific texture.
  mesh(new THREE.SphereGeometry(1, 16, 8), '#4caaa9', rack, [0, 0.95, 0.12], [0.46, 0.085, 0.025]);
  const wake = new THREE.Group(); wake.name = 'surf-wake'; root.add(wake);
  const foamGeometry = new THREE.SphereGeometry(1, 6, 4); geometries.push(foamGeometry);
  const foamMaterial = new THREE.MeshBasicMaterial({ color: '#f0fbef', transparent: true, opacity: 0.55, depthWrite: false }); materials.push(foamMaterial);
  const droplets = new THREE.InstancedMesh(foamGeometry, foamMaterial, 28); wake.add(droplets); wake.userData.skipWaterReflection = true;
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), scale = new THREE.Vector3();
  return { root, board,
    update(state, time, surfaceHeight, reduceMotion = false) {
      wake.visible = state.active && !reduceMotion;
      if (!state.active) { board.position.set(SURF_STATION.x + 0.1, rack.position.y + 0.56, SURF_STATION.z + 0.22); board.rotation.set(0.2, 0.35, 0.65); return; }
      const { x, z } = state.position, sea = typeof surfaceHeight === 'function' ? surfaceHeight(x, z) : surfaceHeight, wave = reduceMotion ? 0 : surfWaveHeight(state.angle, time, state.lane);
      board.position.set(x, sea + 0.1 + wave, z); const ahead = surfWaveHeight(state.angle + 0.015, time, state.lane), behind = surfWaveHeight(state.angle - 0.015, time, state.lane);
      const slope = surfWaveHeight(state.angle, time, state.lane + 0.1) - surfWaveHeight(state.angle, time, state.lane - 0.1);
      board.rotation.set(reduceMotion ? 0 : Math.atan2(ahead - behind, Math.hypot(x, z) * 0.03) * 0.55, state.heading, reduceMotion ? 0 : -Math.atan2(slope, 0.2) * 0.25);
      for (let i = 0; i < 28; i++) {
        const age = ((time * 0.8 + i / 28) % 1), side = i % 2 ? 1 : -1;
        v.set(x + Math.sin(state.heading) * (0.8 + age * 3) + Math.cos(state.heading) * side * age * 0.7, sea + 0.03, z + Math.cos(state.heading) * (0.8 + age * 3) - Math.sin(state.heading) * side * age * 0.7);
        scale.setScalar((1 - age) * 0.11); scale.y *= 0.3; matrix.compose(v, q, scale); droplets.setMatrixAt(i, matrix);
      }
      droplets.instanceMatrix.needsUpdate = true;
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
