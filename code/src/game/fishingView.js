import * as THREE from 'three';
import { FISH_COLORS, FISH_KINDS } from './fishing.js';

export function createFishingView(scene) {
  const group = new THREE.Group(); scene.add(group);
  const rodMaterial = new THREE.MeshStandardMaterial({ color: '#bb905d', roughness: 0.8 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 1, 8), rodMaterial); group.add(rod);
  const floatMaterial = new THREE.MeshStandardMaterial({ color: '#f57b64', emissive: '#7a3020', emissiveIntensity: 0.35 });
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), floatMaterial); group.add(bobber);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.39, 32), new THREE.MeshBasicMaterial({ color: '#fff3b6', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; group.add(ring);
  const ropeGeometry = new THREE.BufferGeometry();
  ropeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const rope = new THREE.Line(ropeGeometry, new THREE.LineBasicMaterial({ color: '#fff3d1', transparent: true, opacity: 0.8 }));
  rope.frustumCulled = false; group.add(rope);
  const fishMaterial = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const caught = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fishMaterial); body.scale.set(0.46, 0.17, 0.2); caught.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.35, 3), fishMaterial); tail.rotation.z = -Math.PI / 2; tail.position.x = -0.5; caught.add(tail);
  group.add(caught);
  const base = new THREE.Vector3(), tip = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    update(state, player, time, surfaceHeight, reduceMotion, grip = null) {
      group.visible = state.phase !== 'idle';
      if (!group.visible) return;
      const point = state.point ?? { x: player.x * 2, z: player.z * 2 + 1 };
      direction.set(point.x - player.x, 0, point.z - player.z).normalize();
      if(grip)base.copy(grip);else base.set(player.x, player.y + 0.98, player.z);
      tip.copy(base).addScaledVector(direction, 1.6); tip.y = base.y + 1.8;
      rod.position.copy(base).add(tip).multiplyScalar(0.5);
      direction.copy(tip).sub(base); rod.scale.y = direction.length(); rod.quaternion.setFromUnitVectors(up, direction.normalize());
      const reeling = state.phase === 'caught' && state.elapsed < 1.2;
      bobber.visible = rope.visible = state.phase === 'waiting' || reeling;
      ring.visible = state.phase === 'waiting'; caught.visible = reeling;
      if (!bobber.visible) return;
      target.set(point.x, surfaceHeight(point.x, point.z) + 0.14, point.z);
      if (state.phase === 'waiting' && state.elapsed < 0.45 && !reduceMotion) {
        const t = state.elapsed / 0.45;
        target.lerpVectors(tip, target, t); target.y += Math.sin(t * Math.PI) * 2;
      } else if (reeling) {
        const t = reduceMotion ? 1 : Math.min(1, state.elapsed / 1.2);
        target.lerp(base, t); target.y += Math.sin(t * Math.PI) * 2.3;
        fishMaterial.color.set(FISH_COLORS[FISH_KINDS.indexOf(state.result)]);
        caught.position.copy(target); caught.rotation.z = reduceMotion ? 0 : Math.sin(t * 18) * 0.4;
      }
      bobber.position.copy(target);
      ring.position.set(point.x, surfaceHeight(point.x, point.z) + 0.03, point.z);
      ring.scale.setScalar(reduceMotion ? 1 : 1 + Math.sin(time * 3) * 0.12);
      const positions = ropeGeometry.attributes.position;
      positions.setXYZ(0, tip.x, tip.y, tip.z); positions.setXYZ(1, target.x, target.y, target.z); positions.needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      const materials = new Set();
      group.traverse((object) => { object.geometry?.dispose(); if (object.material) materials.add(object.material); });
      materials.forEach((material) => material.dispose());
    },
  };
}
