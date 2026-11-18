import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Locally authored stylized anatomy, with independently posed paws/head/tail.
export function createPetModel(kind = 'cat', variant = 0) {
  const cat = kind === 'cat', root = new THREE.Group(); root.name = `${kind}-companion`;
  const geometries = new Set(), materials = new Map();
  const sphere = new THREE.SphereGeometry(1, 14, 10); geometries.add(sphere);
  const palette = cat ? ['#d7a36e', '#e9e5d7', '#84959a'] : ['#cda375', '#ebd6b0', '#a58469'];
  const fur = palette[variant % palette.length], cream = '#f5efdf', dark = '#343e40';
  function material(color) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88 })); return materials.get(color); }
  const dummy = new THREE.Object3D();
  function part(parent, geometry, color, position, scale, rotation = [0, 0, 0]) {
    geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function oval(parent, color, x, y, z, sx, sy, sz) { return part(parent, sphere, color, [x, y, z], [sx, sy, sz]); }
  function batch(group) {
    group.updateMatrixWorld(true); const buckets = new Map(), inverse = group.matrixWorld.clone().invert();
    for (const child of [...group.children]) {
      if (!child.isMesh) continue;
      const geometry = child.geometry.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld));
      const bucket = buckets.get(child.material) ?? []; bucket.push(geometry); buckets.set(child.material, bucket); group.remove(child);
    }
    for (const [mat, parts] of buckets) {
      const geometry = mergeGeometries(parts, false); parts.forEach(g => g.dispose()); geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    }
  }
  const body = new THREE.Group(); root.add(body);
  oval(body, fur, -0.05, 0.5, 0, cat ? 0.46 : 0.53, cat ? 0.23 : 0.27, cat ? 0.21 : 0.25);
  oval(body, cream, 0.27, 0.46, 0, 0.2, 0.22, 0.2);
  oval(body, fur, -0.32, 0.44, 0, 0.25, 0.23, 0.22);
  if (cat) for (let i = 0; i < 3; i++) {
    const stripe = oval(body, variant === 2 ? '#566970' : '#b77f52', -0.32 + i * 0.16, 0.68, 0, 0.035, 0.06, 0.19);
    stripe.rotation.z = 0.15;
  }
  batch(body);
  const head = new THREE.Group(); head.name = 'pet-head'; head.position.set(0.36, 0.72, 0); root.add(head);
  oval(head, fur, 0, 0, 0, cat ? 0.23 : 0.27, 0.23, cat ? 0.22 : 0.25);
  oval(head, cream, 0.16, -0.08, 0, cat ? 0.11 : 0.22, 0.095, cat ? 0.14 : 0.17);
  oval(head, cat ? '#ba8f86' : dark, cat ? 0.25 : 0.36, -0.045, 0, 0.045, 0.032, 0.052);
  for (const side of [-1, 1]) {
    if (cat) {
      part(head, new THREE.ConeGeometry(0.14, 0.3, 3), fur, [-0.04, 0.21, side * 0.14], [0.9, 1, 0.8], [side * 0.12, 0.5, side * 0.14]);
      part(head, new THREE.ConeGeometry(0.085, 0.18, 3), '#d0a298', [0.01, 0.23, side * 0.14], [0.8, 1, 0.8], [0, 0.5, 0]);
    } else {
      const ear = oval(head, variant === 1 ? '#b38b61' : '#7d6551', -0.08, -0.08, side * 0.24, 0.11, 0.24, 0.1);
      ear.rotation.x = side * 0.27;
      oval(head, '#d2928d', 0.25, -0.18, 0, 0.065, 0.075, 0.05);
    }
    oval(head, dark, 0.14, 0.065, side * 0.17, 0.037, 0.043, 0.03);
    oval(head, '#fffbed', 0.162, 0.08, side * 0.18, 0.009, 0.012, 0.009);
    if (cat) for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.005, 0.005, 0.24, 4); const whisker = part(head, g, cream,
        [0.21, -0.07 + i * 0.035, side * 0.22], [1, 1, 1], [Math.PI / 2, 0, 0.3 * (i - 1)]);
      whisker.rotation.x += side * 0.25;
    }
  }
  batch(head);
  const collar = part(root, new THREE.TorusGeometry(cat ? 0.19 : 0.23, 0.028, 6, 24), variant % 2 ? '#789a87' : '#be7b64', [0.27, 0.56, 0], [1, 1, 1], [0, Math.PI / 2, 0]); collar.name = 'pet-collar';
  oval(root, '#d9b663', 0.29, 0.34, 0, 0.045, 0.055, 0.025);
  const tail = new THREE.Group(); tail.name = 'pet-tail'; tail.position.set(-0.45, 0.48, 0); root.add(tail);
  const points = cat ? [[0, 0, 0], [-0.23, 0.12, 0], [-0.3, 0.48, 0], [-0.18, 0.63, 0]] : [[0, 0, 0], [-0.22, 0.2, 0], [-0.3, 0.4, 0.04], [-0.1, 0.4, 0.09]];
  part(tail, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 14, cat ? 0.045 : 0.075, 7, false), fur, [0, 0, 0], [1, 1, 1]);
  if (!cat) oval(tail, cream, -0.1, 0.4, 0.09, 0.09, 0.09, 0.09);
  const legs = new THREE.InstancedMesh(sphere, material(fur), 4), paws = new THREE.InstancedMesh(sphere, material(cream), 4);
  legs.castShadow = paws.castShadow = true; root.add(legs, paws);
  const size = cat ? 0.96 : variant === 1 ? 1.15 : 1.08; root.scale.setScalar(size);
  const anchors = [[0.27, -0.15], [0.27, 0.15], [-0.34, -0.16], [-0.34, 0.16]];
  function update(time, { moving = false, resting = false, playful = false, reduceMotion = false } = {}) {
    const phase = reduceMotion ? 0 : time;
    body.position.y = resting ? -0.11 : moving ? Math.sin(phase * 2) * 0.025 : 0;
    head.rotation.z = resting ? 0.23 : playful ? Math.sin(phase * 0.8) * 0.13 : Math.sin(phase * 0.23) * 0.035;
    head.position.y = resting ? 0.56 : 0.72;
    tail.rotation.y = reduceMotion ? 0 : Math.sin(phase * (cat ? 0.75 : 1.6)) * (resting ? 0.08 : 0.38);
    tail.rotation.z = resting ? -0.65 : 0;
    for (const [i, [x, z]] of anchors.entries()) {
      const step = moving && !reduceMotion ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) : 0;
      dummy.position.set(x + step * 0.08, resting ? 0.18 : 0.24, z); dummy.rotation.set(0, 0, resting ? (i < 2 ? -0.5 : 0.65) : step * 0.45);
      dummy.scale.set(0.075, resting ? 0.13 : 0.21, 0.075); dummy.updateMatrix(); legs.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + step * 0.14, 0.07 + Math.max(0, step) * (moving ? 0.08 : 0), z); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.11, 0.065, 0.085); dummy.updateMatrix(); paws.setMatrixAt(i, dummy.matrix);
    }
    legs.instanceMatrix.needsUpdate = paws.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { root, update, dispose() { root.removeFromParent(); legs.dispose(); paws.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
