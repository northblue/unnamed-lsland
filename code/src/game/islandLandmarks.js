import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURT, LIGHTHOUSE, SUNFLOWER, terrainHeight } from './world.js';

export function createIslandLandmarks(scene) {
  const root = new THREE.Group(); root.name = 'island-landmarks'; scene.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const standard = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); materials.add(m); return m; };
  const stone = standard('#b9b39d'), ivory = standard('#f3ecda'), navy = standard('#3b5669'), wood = standard('#987653');
  function mesh(g, m, x = 0, y = 0, z = 0, parent = root) {
    geometries.add(g); const value = new THREE.Mesh(g, m); value.position.set(x, y, z);
    value.castShadow = value.receiveShadow = !m.transparent; parent.add(value); return value;
  }
  function link(a, b, radius, m, parent = root) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const value = mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 7), m, 0, 0, 0, parent);
    value.position.copy(start).add(end).multiplyScalar(0.5);
    value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return value;
  }
  // A winding stair and landing follow actual walkable ground up three rock tiers.
  const path = [[-18.7, 7.4], [-20.4, 7.1], [-21.7, 5.8], [-22.1, 4.9]];
  for (let section = 0; section < path.length - 1; section++) {
    const [a, b] = [path[section], path[section + 1]];
    const angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i < 12; i++) {
      const t = i / 11, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t), y = terrainHeight(x, z);
      const step = mesh(new THREE.BoxGeometry(1.15, 0.16, Math.hypot(b[0] - a[0], b[1] - a[1]) / 11 + 0.04), stone, x, y - 0.04, z);
      step.rotation.y = angle;
      if (i % 3 === 0) {
        const dx = Math.cos(angle) * 0.62, dz = -Math.sin(angle) * 0.62;
        link([x + dx, y, z + dz], [x + dx, y + 0.63, z + dz], 0.035, wood);
        const nextT = Math.min(1, (i + 3) / 11), nx = THREE.MathUtils.lerp(a[0], b[0], nextT), nz = THREE.MathUtils.lerp(a[1], b[1], nextT);
        link([x + dx, y + 0.57, z + dz], [nx + dx, terrainHeight(nx, nz) + 0.57, nz + dz], 0.026, wood);
      }
    }
  }
  const cottage = new THREE.Group(); cottage.name = 'lighthouse-keepers-cottage';
  cottage.position.set(-24.1, terrainHeight(-24.1, 4.1), 4.1); root.add(cottage);
  const footing = Math.min(...[-0.825, 0.825].flatMap(dx => [-0.9, 0.9].map(dz => terrainHeight(cottage.position.x + dx, cottage.position.z + dz)))) - 0.15;
  const footingHeight = cottage.position.y - footing;
  mesh(new THREE.BoxGeometry(1.65, footingHeight, 1.8), stone, 0, -footingHeight / 2, 0, cottage);
  mesh(new THREE.BoxGeometry(1.65, 0.22, 1.8), stone, 0, 0.06, 0, cottage);
  mesh(new THREE.BoxGeometry(1.45, 1.55, 1.55), ivory, 0, 0.88, 0, cottage);
  const roof = mesh(new THREE.ConeGeometry(1.35, 0.8, 4), navy, 0, 1.99, 0, cottage); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.1;
  mesh(new THREE.BoxGeometry(0.27, 0.8, 0.3), stone, -0.45, 2.18, -0.25, cottage);
  mesh(new THREE.BoxGeometry(0.4, 0.91, 0.04), navy, 0.2, 0.57, 0.79, cottage);
  for (const x of [-0.43, 0.46]) {
    mesh(new THREE.BoxGeometry(0.26, 0.33, 0.05), navy, x, 1.22, 0.8, cottage);
    mesh(new THREE.BoxGeometry(0.025, 0.31, 0.025), ivory, x, 1.22, 0.83, cottage);
  }
  const deckY = terrainHeight(-23.2, 6.2) + 0.16;
  for (let i = 0; i < 14; i++) mesh(new THREE.BoxGeometry(2.3, 0.1, 0.13), wood, -23.2, deckY, 5.5 + i * 0.15);
  for (const x of [-24.25, -22.15]) for (const z of [5.5, 6.4, 7.4]) {
    link([x, terrainHeight(x, z) - 0.4, z], [x, deckY + 0.65, z], 0.045, wood);
  }
  for (const x of [-24.25, -22.15]) link([x, deckY + 0.6, 5.5], [x, deckY + 0.6, 7.4], 0.035, wood);

  // A complete half-court: markings, painted key, backboard, rim and hanging net.
  const court = new THREE.Group(); court.name = 'basketball-half-court'; court.position.set(COURT.x, COURT.y, COURT.z); root.add(court);
  mesh(new THREE.BoxGeometry(COURT.halfX * 2 + 0.4, 0.7, COURT.halfZ * 2 + 0.4), stone, 0, -0.36, 0, court);
  const floorMaterial = standard('#659b91');
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#63998d'; ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#ce9c75'; ctx.fillRect(365, 22, 294, 390);
      ctx.strokeStyle = '#fcf3d7'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      ctx.strokeRect(20, 20, 984, 984); ctx.strokeRect(365, 20, 294, 392);
      ctx.beginPath(); ctx.arc(512, 410, 146, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(512, 98, 650, 0.08, Math.PI - 0.08); ctx.stroke();
      ctx.beginPath(); ctx.arc(512, 1004, 135, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(512, 102, 54, 0, Math.PI); ctx.stroke();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      textures.add(texture); floorMaterial.color.set('#ffffff'); floorMaterial.map = texture;
    }
  }
  const floor = mesh(new THREE.PlaneGeometry(COURT.halfX * 2, COURT.halfZ * 2), floorMaterial, 0, 0.005, 0, court); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const poleY = terrainHeight(COURT.x, COURT.hoopZ);
  mesh(new THREE.CylinderGeometry(0.075, 0.11, 3.25, 12), navy, COURT.x, poleY + 1.625, COURT.hoopZ);
  link([COURT.x, poleY + 3.17, COURT.hoopZ], [COURT.x, COURT.y + 3.1, COURT.z - COURT.halfZ + 0.14], 0.07, navy);
  const boardZ = COURT.z - COURT.halfZ + 0.1, rimZ = boardZ + 0.45;
  const glass = standard('#d4e9df', { transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  mesh(new THREE.BoxGeometry(1.65, 1, 0.055), glass, COURT.x, COURT.y + 3.1, boardZ);
  for (const dx of [-0.83, 0.83]) mesh(new THREE.BoxGeometry(0.045, 1.04, 0.07), ivory, COURT.x + dx, COURT.y + 3.1, boardZ);
  for (const dy of [-0.51, 0.51]) mesh(new THREE.BoxGeometry(1.7, 0.045, 0.07), ivory, COURT.x, COURT.y + 3.1 + dy, boardZ);
  const rim = mesh(new THREE.TorusGeometry(0.29, 0.032, 8, 32), standard('#d77b43'), COURT.x, COURT.y + 2.88, rimZ); rim.rotation.x = Math.PI / 2;
  const netPositions = [];
  for (let i = 0; i < 14; i++) for (let j = 0; j < 4; j++) {
    const a = i / 14 * Math.PI * 2 + j * 0.1, b = a + 0.21;
    netPositions.push(COURT.x + Math.cos(a) * (0.28 - j * 0.025), COURT.y + 2.86 - j * 0.12, rimZ + Math.sin(a) * (0.28 - j * 0.025), COURT.x + Math.cos(b) * (0.255 - j * 0.025), COURT.y + 2.74 - j * 0.12, rimZ + Math.sin(b) * (0.255 - j * 0.025));
  }
  const netGeometry = new THREE.BufferGeometry(); netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(netPositions, 3)); geometries.add(netGeometry);
  const netMaterial = new THREE.LineBasicMaterial({ color: '#f6efda' }); materials.add(netMaterial); root.add(new THREE.LineSegments(netGeometry, netMaterial));
  const basketball = mesh(new THREE.SphereGeometry(0.25, 20, 14), standard('#cd7a3f'), COURT.x + 1.1, COURT.y + 0.25, COURT.z + 1.3);
  const seam = standard('#684a35');
  for (let i = 0; i < 3; i++) { const band = mesh(new THREE.TorusGeometry(0.252, 0.007, 5, 40), seam, 0, 0, 0, basketball); band.rotation.set(i * Math.PI / 2, i * 0.6, 0); }

  const flower = new THREE.Group(); flower.name = 'giant-sunflower'; flower.position.set(SUNFLOWER.x, terrainHeight(SUNFLOWER.x, SUNFLOWER.z), SUNFLOWER.z); root.add(flower);
  const green = standard('#568347'), leafGreen = standard('#709b53', { side: THREE.DoubleSide });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(-0.16, 1.8, 0), new THREE.Vector3(0.2, 3.8, 0), new THREE.Vector3(0, 5.15, 0)]);
  mesh(new THREE.TubeGeometry(curve, 24, 0.1, 8, false), green, 0, 0, 0, flower);
  for (let i = 0; i < 5; i++) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-0.62, 0.2, -0.5, 0.8, 0, 1.2); shape.bezierCurveTo(0.5, 0.8, 0.62, 0.2, 0, 0);
    const leaf = mesh(new THREE.ShapeGeometry(shape, 10), leafGreen, i % 2 ? 0.08 : -0.08, 1.05 + i * 0.59, 0, flower);
    leaf.rotation.set(0.35, i * 2.4, i % 2 ? -1.05 : 1.05);
    link([0, 0, 0.015], [0, 1.03, 0.015], 0.013, green, leaf);
  }
  const head = new THREE.Group(); head.position.y = 5.15; head.rotation.set(-0.12, 0.35, 0); flower.add(head);
  const gold = standard('#e9b447'), warmGold = standard('#f2cc5b'), brown = standard('#694c2e');
  const petalGeometry = new THREE.SphereGeometry(1, 12, 8); geometries.add(petalGeometry);
  const dummy = new THREE.Object3D();
  for (const [layer, count] of [26, 20].entries()) {
    const petals = new THREE.InstancedMesh(petalGeometry, layer ? warmGold : gold, count);
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + layer * 0.15, r = layer ? 0.87 : 1.04;
      dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, layer * 0.08); dummy.rotation.set(0.07 * Math.sin(i), 0, a - Math.PI / 2);
      dummy.scale.set(layer ? 0.15 : 0.18, layer ? 0.58 : 0.65, 0.065); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.castShadow = true; head.add(petals);
  }
  const disk = mesh(new THREE.SphereGeometry(1, 32, 20), brown, 0, 0, 0.14, head); disk.scale.set(0.66, 0.66, 0.18);
  const seedGeometry = new THREE.SphereGeometry(0.023, 5, 4); geometries.add(seedGeometry);
  const seeds = new THREE.InstancedMesh(seedGeometry, standard('#b79755'), 180);
  for (let i = 0; i < 180; i++) {
    const r = Math.sqrt(i / 180) * 0.62, a = i * 2.399963;
    dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.14 + 0.18 * Math.sqrt(1 - (r / 0.66) ** 2)); dummy.rotation.set(0, 0, a); dummy.scale.setScalar(1); dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix);
  }
  head.add(seeds);
  // Batch static pieces by material; keep the flower head and instances animated.
  root.updateMatrixWorld(true);
  const buckets = new Map(), inverse = root.matrixWorld.clone().invert(), staticMeshes = [];
  root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh) return;
    for (let parent = object.parent; parent && parent !== root; parent = parent.parent) if (parent === head) return;
    staticMeshes.push(object);
  });
  for (const object of staticMeshes) {
    const key = `${object.material.uuid}:${object.castShadow}`;
    const bucket = buckets.get(key) ?? { material: object.material, castShadow: object.castShadow, parts: [] };
    bucket.parts.push(object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)));
    buckets.set(key, bucket); object.removeFromParent();
  }
  for (const bucket of buckets.values()) {
    const g = mergeGeometries(bucket.parts, false); bucket.parts.forEach(part => part.dispose()); geometries.add(g);
    const object = new THREE.Mesh(g, bucket.material); object.castShadow = bucket.castShadow; object.receiveShadow = true; root.add(object);
  }
  return { root, update(time, reduceMotion = false) { head.rotation.z = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.055; },
    dispose() { root.removeFromParent(); root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
