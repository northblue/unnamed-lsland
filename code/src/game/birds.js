import * as THREE from 'three';
import { ISLAND } from './world.js';
import { loadBirdModels } from './birdModel.js';
import { fadeAtSkyBoundary, skyVisibility } from './skyVolume.js';

export function createBirds(scene, getPerches, { modelLoader = typeof window === 'undefined' ? null : loadBirdModels } = {}) {
  let disposed = false, template;
  const group = new THREE.Group(); scene.add(group);
  group.name = 'island-birds';
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  const wingGeometry = new THREE.SphereGeometry(1, 8, 4);
  const beakGeometry = new THREE.ConeGeometry(0.07, 0.24, 5);
  const materials = new Map();
  const birds = [];
  function material(color) {
    if (!materials.has(color)) {
      const value=new THREE.MeshStandardMaterial({color,roughness:0.9});
      fadeAtSkyBoundary(value);materials.set(color,value);
    }
    return materials.get(color);
  }
  for (let i = 0; i < 10; i++) {
    const gull = i >= 5;
    const root = new THREE.Group(); group.add(root);
    root.name = `bird:${i}`;
    const color = gull ? '#f7f4e6' : ['#d9ad6d', '#86a6a0', '#c7a393'][i % 3];
    function oval(geometry, color, x, y, z, sx, sy, sz, parent = root) {
      const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
    }
    oval(sphere, color, 0, 0.12, 0, 0.22, 0.17, 0.34);
    oval(sphere, gull ? '#ffffff' : '#e2c9a2', 0, 0.29, -0.23, 0.14, 0.14, 0.16);
    const beak = oval(beakGeometry, '#d3a258', 0, 0.25, -0.4, 1, 1, 1); beak.rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) oval(sphere, '#263d41', side * 0.105, 0.32, -0.31, 0.025, 0.025, 0.025);
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group(); root.add(pivot);
      oval(wingGeometry, gull ? '#abb8bb' : color, side * 0.31, 0.1, 0.02, 0.42, 0.045, 0.2, pivot);
      return pivot;
    });
    root.scale.setScalar(gull ? 1.35 : 0.9);
    birds.push({ root, wings, gull, index: i, cycle: -1, perchId: null });
  }
  const orbit = new THREE.Vector3();
  const destination = new THREE.Vector3();
  if (modelLoader) Promise.resolve().then(() => modelLoader()).then(value => {
    if (disposed) { value.dispose(); return; }
    template = value;
    birds.forEach(bird => {
      const imported = template.create(bird.gull);
      if (!imported) return;
      bird.root.children.forEach(child => { child.visible = false; });
      imported.root.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(fadeAtSkyBoundary);});
      bird.root.add(imported.root); bird.imported = imported;
      bird.root.userData.model = bird.gull ? 'mesh2motion-seagull' : 'mesh2motion-bird';
    });
  }).catch(() => { /* A failed optional asset keeps the original birds alive. */ });
  return {
    update(time, daylight, reduceMotion) {
      const perches = getPerches();
      for (const bird of birds) {
        const { root, index, gull } = bird;
        const previous = bird.previousPosition;
        const local = time + index * 5.7;
        const cycle = Math.floor(local / 42), phase = local % 42;
        if (bird.cycle !== cycle) {
          bird.cycle = cycle;
          bird.perchId = perches.length ? perches[(index + cycle * 3) % perches.length].id : null;
        }
        const perch = perches.find((perch) => perch.id === bird.perchId);
        if (!perch && bird.hadPerch) { bird.escapeStart = root.position.clone(); bird.escapeAt = time; }
        bird.hadPerch = Boolean(perch);
        const angle = local * (gull ? 0.14 : 0.28) + index;
        const radius = gull ? 1.22 : 0.88;
        orbit.set(Math.cos(angle) * ISLAND.x * radius, (gull ? 6.5 : 4.8) + Math.sin(local * 0.7) * 0.5, Math.sin(angle) * ISLAND.z * radius);
        // Four gulls cross the spherical sky instead of circling its rim.
        // The wrap happens fully outside the faded volume, so it is never visible.
        if(gull && index>5) {
          const progress=((time/(64+(index-6)*9)+(index-6)*0.27)%1+1)%1;
          const along=(progress*2-1)*44, across=(index-7.5)*7;
          const heading=index*1.2;
          orbit.set(along*Math.cos(heading)-across*Math.sin(heading),7+(index%3)*1.3+Math.sin(local*0.4)*0.6,along*Math.sin(heading)+across*Math.cos(heading));
        }
        let resting = false;
        if (perch && (!gull || index === 5)) {
          destination.set(perch.x, perch.y + 0.02, perch.z);
          if (daylight < 0.2 || phase >= 22 && phase < 34) { root.position.copy(destination); resting = true; }
          else if (phase >= 16 && phase < 22) root.position.lerpVectors(orbit, destination, THREE.MathUtils.smoothstep(phase, 16, 22));
          else if (phase >= 34 && phase < 39) root.position.lerpVectors(destination, orbit, THREE.MathUtils.smoothstep(phase, 34, 39));
          else root.position.copy(orbit);
        } else root.position.copy(orbit);
        if (bird.escapeStart && time - bird.escapeAt < 2) {
          root.position.lerpVectors(bird.escapeStart, orbit, THREE.MathUtils.smoothstep(time - bird.escapeAt, 0, 2));
        }
        root.visible = (!gull || daylight > 0.15) && skyVisibility(root.position)>0;
        const dt = Math.max(0, Math.min(0.1, time - (bird.previousTime ?? time)));
        let heading = root.rotation.y;
        if (resting) heading = index * 1.5;
        else if (previous && root.position.distanceToSquared(previous) > 0.000001) {
          heading = Math.atan2(previous.x - root.position.x, previous.z - root.position.z);
        } else heading = Math.atan2(ISLAND.x * Math.sin(angle), -ISLAND.z * Math.cos(angle));
        const turn = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
        root.rotation.y += turn * (previous ? 1 - Math.exp(-dt * 6) : 1);
        root.rotation.z = resting || reduceMotion ? 0 : THREE.MathUtils.clamp(turn * 0.18, -0.28, 0.28);
        root.rotation.x = resting ? 0 : Math.sin(local * 0.7) * 0.035;
        bird.imported?.update(local * (gull ? 0.9 : 1.3), { resting, gliding: gull && phase % 9 > 3 && phase < 16, reduceMotion });
        if (!bird.previousPosition) bird.previousPosition = new THREE.Vector3();
        bird.previousPosition.copy(root.position); bird.previousTime = time;
        bird.wings.forEach((wing, side) => {
          wing.rotation.z = resting ? (side ? -1 : 1) * 1.1 : reduceMotion ? 0 : Math.sin(local * (gull ? 3.5 : 9)) * (side ? -1 : 1) * 0.6;
        });
      }
    },
    dispose() { disposed = true; template?.dispose(); group.removeFromParent(); sphere.dispose(); wingGeometry.dispose(); beakGeometry.dispose(); materials.forEach((value) => value.dispose()); },
  };
}
