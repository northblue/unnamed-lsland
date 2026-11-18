import * as THREE from 'three';

export function whaleBreath(progress, duration, reduceMotion = false) {
  const age = (progress - 0.37) * duration;
  if (reduceMotion || age < 0 || age > 3.1) return { lift: 0, sprayAge: -1 };
  const rise = THREE.MathUtils.smoothstep(age, 0, 0.55), sink = 1 - THREE.MathUtils.smoothstep(age, 2.4, 3.1);
  return { lift: 0.62 * rise * sink, sprayAge: age >= 0.6 && age < 3 ? age - 0.6 : -1 };
}

export function createWhaleSpout(parent) {
  const root = new THREE.Group(); root.name = 'whale-spout'; root.visible = false; root.userData.skipWaterReflection = true; parent.add(root);
  const geometry = new THREE.SphereGeometry(1, 7, 5), material = new THREE.MeshStandardMaterial({ color: '#e5f6f2', transparent: true, opacity: 0.62, roughness: 0.5, depthWrite: false });
  const droplets = new THREE.InstancedMesh(geometry, material, 80); droplets.frustumCulled = false; root.add(droplets);
  const ringGeometry = new THREE.TorusGeometry(1, 0.018, 5, 40), ringMaterial = new THREE.MeshBasicMaterial({ color: '#d9f3ee', transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.rotation.x = -Math.PI / 2; root.add(ring);
  const dummy = new THREE.Object3D();
  return { root, update(origin, age, reduceMotion = false) {
    root.visible = !reduceMotion && age >= 0 && age < 2.4;
    if (!root.visible) return;
    root.position.set(origin.x, Math.max(-0.08, origin.y), origin.z);
    for (let i = 0; i < 80; i++) {
      const elapsed = age - i / 80 * 1.1, life = 1.05 + i % 7 * 0.055;
      const alive = elapsed >= 0 && elapsed < life, angle = i * 2.399963;
      const spread = elapsed * elapsed * (0.17 + i % 5 * 0.055);
      dummy.position.set(Math.cos(angle) * spread, Math.max(0, elapsed * 4.4 - elapsed * elapsed * 2), Math.sin(angle) * spread);
      dummy.scale.setScalar(alive ? (0.025 + i % 4 * 0.008) * (1 - elapsed / life) : 0);
      dummy.updateMatrix(); droplets.setMatrixAt(i, dummy.matrix);
    }
    droplets.instanceMatrix.needsUpdate = true;
    ring.position.y = -root.position.y - 0.09; ring.scale.setScalar(0.3 + age * 0.45); ringMaterial.opacity = Math.max(0, 0.3 - age * 0.12);
  }, dispose() { root.removeFromParent(); droplets.dispose(); geometry.dispose(); material.dispose(); ringGeometry.dispose(); ringMaterial.dispose(); } };
}
