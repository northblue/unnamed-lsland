import * as THREE from 'three';
import { ISLAND } from './world.js';
import { MAX_SPLASHES, RIPPLE_LIFETIME } from './waterInteraction.js';

export function createSplashes(parent, radius) {
  const group = new THREE.Group();
  group.userData.skipWaterReflection = true;
  parent.add(group);
  const ringGeometry = new THREE.RingGeometry(0.91, 1, 64);
  const dropGeometry = new THREE.SphereGeometry(1, 6, 4);
  const matrix = new THREE.Object3D();
  const pool = [];
  for (let i = 0; i < MAX_SPLASHES; i++) {
    const rings = [];
    for (let j = 0; j < 3; j++) {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
        uniforms: { alpha: { value: 0 }, radius: { value: radius }, shore: { value: new THREE.Vector2(ISLAND.x * 1.055, ISLAND.z * 1.055) } },
        vertexShader: `varying vec2 worldXZ;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            worldXZ = world.xz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: `uniform float alpha; uniform float radius; uniform vec2 shore; varying vec2 worldXZ;
          void main() {
            if (length(worldXZ) > radius - 0.04 || dot(worldXZ / shore, worldXZ / shore) < 1.0) discard;
            gl_FragColor = vec4(0.86, 1.0, 1.0, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      const ring = new THREE.Mesh(ringGeometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 5;
      ring.visible = false;
      group.add(ring);
      rings.push(ring);
    }
    const dropMaterial = new THREE.MeshBasicMaterial({ color: '#e4ffff', transparent: true, depthWrite: false });
    const drops = new THREE.InstancedMesh(dropGeometry, dropMaterial, 12);
    drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    drops.frustumCulled = false;
    drops.visible = false;
    drops.renderOrder = 4;
    group.add(drops);
    pool.push({ rings, drops, dropMaterial });
  }

  return {
    update(time, splashes, heightAt, reducedMotion) {
      pool.forEach((view, index) => {
        const splash = splashes[index];
        const strength = splash?.strength ?? 1;
        const age = splash ? time - splash.time : Infinity;
        const active = age >= 0 && age < RIPPLE_LIFETIME;
        for (let j = 0; j < view.rings.length; j++) {
          const ring = view.rings[j];
          const ringAge = age - j * 0.13;
          ring.visible = active && ringAge >= 0;
          if (!ring.visible) continue;
          const size = (reducedMotion ? 0.6 + j * 0.18 : 0.45 + ringAge * 2.5) * Math.sqrt(strength);
          ring.scale.setScalar(size);
          ring.position.set(splash.x, -0.07 + heightAt(splash.x, splash.z), splash.z);
          ring.material.uniforms.alpha.value = Math.max(0, 1 - age / RIPPLE_LIFETIME) * (0.8 - j * 0.12);
        }
        view.drops.visible = active && !reducedMotion && age < 0.85;
        if (!view.drops.visible) return;
        for (let j = 0; j < 12; j++) {
          const angle = j / 12 * Math.PI * 2 + splash.x;
          const speed = (0.8 + (j % 4) * 0.25) * Math.sqrt(strength);
          matrix.position.set(splash.x + Math.cos(angle) * age * speed,
            -0.02 + (2.5 + (j % 3) * 0.45) * Math.sqrt(strength) * age - 4.9 * age * age,
            splash.z + Math.sin(angle) * age * speed);
          const scale = Math.max(0.005, 0.11 * Math.sqrt(strength) * (1 - age / 0.85));
          matrix.scale.set(scale, scale * 1.9, scale);
          matrix.updateMatrix();
          view.drops.setMatrixAt(j, matrix.matrix);
        }
        view.drops.instanceMatrix.needsUpdate = true;
        view.dropMaterial.opacity = Math.max(0, 1 - age / 0.85);
      });
    },
    dispose() {
      group.removeFromParent();
      ringGeometry.dispose(); dropGeometry.dispose();
      for (const view of pool) {
        view.rings.forEach((ring) => ring.material.dispose());
        view.dropMaterial.dispose();
        view.drops.dispose();
      }
    },
  };
}
