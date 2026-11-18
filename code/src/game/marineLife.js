import * as THREE from 'three';
import { createPassage, passagePoint } from './marineRoutes.js';
import { loadFishCollection } from './fishModel.js';
import { FISH_KINDS, FISH_COLORS } from './fishing.js';
import { loadMarineModels } from './marineModels.js';
import { createSealModel } from './sealModel.js';
import { whalePose } from './whaleBehaviour.js';
import { isLand } from './world.js';

export function createMarineLife(parent, outerRadius, {
  modelLoader = typeof window === 'undefined' ? null : loadFishCollection,
  marineModelLoader = typeof window === 'undefined' ? null : loadMarineModels,
  onSplash = () => {},
} = {}) {
  let disposed = false, importedTemplate = null;
  let marineTemplate;
  const importedViews = [];
  const group = new THREE.Group();
  group.name = 'ocean-visitors';
  parent.add(group);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const cone = new THREE.ConeGeometry(1, 1, 3);
  const materials = new Map();
  function clipAtBoundary(value) {
      // Slice creatures at the displayed ocean boundary, including eyes and fins.
      value.onBeforeCompile = (shader) => {
        shader.uniforms.oceanRadius = { value: outerRadius };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 oceanWorld;varying float oceanHeight;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec3 oceanPoint=(modelMatrix*vec4(transformed,1.0)).xyz;oceanWorld=oceanPoint.xz;oceanHeight=oceanPoint.y;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 oceanWorld;varying float oceanHeight; uniform float oceanRadius;')
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(length(oceanWorld) > oceanRadius - 0.04) discard;')
          .replace('#include <opaque_fragment>', 'float submerged=smoothstep(0.02,0.8,-0.12-oceanHeight);outgoingLight=mix(outgoingLight,outgoingLight*vec3(0.5,0.82,0.87)+vec3(0.01,0.04,0.05),submerged*0.65);\n#include <opaque_fragment>');
      };
      value.customProgramCacheKey = () => 'ocean-visitor-boundary-depth-v2';
  }
  function material(color) {
    if (!materials.has(color)) {
      const value = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      clipAtBoundary(value);
      materials.set(color, value);
    }
    return materials.get(color);
  }
  function oval(parent, color, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(sphere, material(color));
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function eyes(parent, x, y, z, size) {
    for (const side of [-1, 1]) {
      oval(parent, '#f5f6e6', x, y, side * z, size, size, size * 0.6);
      oval(parent, '#173746', x + size * 0.25, y, side * (z + size * 0.5), size * 0.45, size * 0.5, size * 0.25);
    }
  }
  function fish(color) {
    const root = new THREE.Group();
    oval(root, color, 0, 0, 0, 0.46, 0.17, 0.2);
    const tail = new THREE.Mesh(cone, material(color));
    tail.scale.set(0.23, 0.35, 0.23); tail.rotation.z = -Math.PI / 2; tail.position.x = -0.5; root.add(tail);
    eyes(root, 0.27, 0.06, 0.17, 0.04);
    return { root, tail, arms: [] };
  }
  function cetacean(dolphin) {
    const root = new THREE.Group();
    const color = dolphin ? '#669ea9' : '#437d94';
    const tail = new THREE.Group();
    oval(root, color, 0, 0, 0, 2.1, 0.6, 0.8);
    oval(root, '#b8d9d4', 0.4, -0.35, 0, 1.45, 0.25, 0.64);
    for (const side of [-1, 1]) {
      const fin = oval(root, color, -0.2, -0.15, side * 0.85, 0.65, 0.09, 0.34);
      fin.rotation.y = side * 0.35;
      oval(tail, color, -0.2, 0, side * 0.48, 0.58, 0.1, 0.5);
    }
    tail.position.x = -2; root.add(tail);
    eyes(root, 1.25, 0.13, 0.63, 0.13);
    if (dolphin) {
      oval(root, color, 2.05, -0.03, 0, 0.6, 0.15, 0.23);
      const fin = new THREE.Mesh(cone, material(color));
      fin.scale.set(0.38, 0.65, 0.18); fin.position.set(-0.1, 0.7, 0); root.add(fin);
      root.scale.setScalar(0.58);
    }
    return { root, tail, arms: [] };
  }
  function octopus() {
    const root = new THREE.Group();
    oval(root, '#ce8a9f', 0, 0.16, 0, 0.48, 0.48, 0.43);
    eyes(root, 0.3, 0.2, 0.28, 0.13);
    const arms = [];
    for (let i = 0; i < 8; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = i / 8 * Math.PI * 2;
      oval(arm, '#ce8a9f', 0.42, -0.18, 0, 0.48, 0.1, 0.12);
      oval(arm, '#e6b0bd', 0.78, -0.12, 0, 0.22, 0.09, 0.1);
      root.add(arm); arms.push(arm);
    }
    return { root, tail: null, arms };
  }

  const schools = [];
  for (let i = 0; i < 4; i++) {
    const members = [];
    for (let j = 0; j < 6 + i; j++) {
      const view = fish(FISH_COLORS[i]);
      view.root.visible = false;
      view.root.name = `fish:${i}:${j}`;
      group.add(view.root);
      const scale = 0.8 + Math.random() * 0.4; view.root.scale.setScalar(scale);
      members.push({ ...view, id: `fish:${i}:${j}`, kind: FISH_KINDS[i], caught: false, along: (Math.random() - 0.5) * 3, across: (j % 3 - 1) * 0.4, depth: -0.65 - Math.random() * 0.2 });
    }
    schools.push({ members, route: createPassage(outerRadius), start: -Math.random() * 18 });
  }
  const seal = createSealModel(clipAtBoundary);
  function visitorPassage(lane) {
    const route = createPassage(outerRadius, Math.random, lane);
    // Large visitors use an open lane instead of breaching through the new land.
    const crossesLand = Array.from({ length: 19 }, (_, i) => passagePoint(route, i / 18))
      .some(p => isLand(p.x, p.z, -3));
    return crossesLand ? { ...route, angle: 0, offset: -Math.abs(lane) } : route;
  }
  const visitors = [
    { ...cetacean(false), lane: outerRadius * 0.868, duration: 34, start: -14, depth: -1.1, kind: 'whale', breach: true },
    { ...cetacean(true), lane: outerRadius * 0.78, duration: 26, start: -3, depth: -0.6, kind: 'dolphin' },
    { ...octopus(), lane: outerRadius * 0.722, duration: 32, start: -10, depth: -0.9, kind: 'octopus' },
    { ...seal, tail: null, arms: [], lane: outerRadius * 0.81, duration: 31, start: -9, depth: -0.43, kind: 'seal' },
  ];
  visitors.forEach((view) => { view.root.name = `visitor:${view.kind}`; view.root.rotation.order = 'YXZ'; view.route = visitorPassage(view.lane); group.add(view.root); });
  if (marineModelLoader) Promise.resolve().then(() => marineModelLoader(clipAtBoundary)).then(template => {
    if (disposed) { template.dispose(); return; }
    marineTemplate = template;
    for (const visitor of visitors.filter(v => v.kind === 'whale' || v.kind === 'dolphin')) {
      const imported = template.create(visitor.kind);
      if (!imported) continue;
      visitor.root.children.forEach(child => { child.visible = false; });
      visitor.root.scale.setScalar(1); visitor.root.add(imported.root); visitor.imported = imported;
      visitor.root.userData.model = `quaternius-${visitor.kind}`; importedViews.push(imported);
    }
  }).catch(() => { /* Original visitors remain if a model cannot load. */ });
  const members = schools.flatMap((school) => school.members);
  // Appearance is optional; fish identity and catching remain gameplay-owned.
  if (modelLoader) Promise.resolve().then(() => modelLoader(clipAtBoundary)).then(template => {
    if (disposed) { template.dispose(); return; }
    importedTemplate = template;
    for (const member of members) {
      const imported = template.create(member.kind);
      if (!imported) continue;
      member.root.children.forEach(child => { child.visible = false; });
      member.root.add(imported.root); member.imported = imported;
      member.root.userData.model = `quaternius-${member.kind}`; importedViews.push(imported);
    }
  }).catch(() => { /* Keep the procedural fish when an optional model fails. */ });
  function available(member) { return !member.caught && member.root.visible && Math.hypot(member.root.position.x, member.root.position.z) < outerRadius - 0.5; }
  return {
    getFish() { return members.filter(available).map((member) => ({ id: member.id, kind: member.kind, x: member.root.position.x, z: member.root.position.z })); },
    takeFish(id) {
      const member = members.find((member) => member.id === id);
      if (!member || !available(member)) return null;
      member.caught = true; member.root.visible = false;
      return { id: member.id, kind: member.kind };
    },
    update(time, reduceMotion = false) {
      for (const school of schools) {
        let progress = (time - school.start) / school.route.duration;
        if (progress > 1.1) { school.start = time + 1 + Math.random() * 4; school.route = createPassage(outerRadius); school.members.forEach((member) => { member.caught = false; }); progress = -1; }
        for (const member of school.members) {
          member.root.visible = !member.caught && progress >= 0 && progress <= 1.1;
          if (!member.root.visible) continue;
          const sway = reduceMotion ? 0 : Math.sin(time * 0.9 + member.along) * 0.16;
          const p = passagePoint(school.route, progress, member.along, member.across + sway);
          member.root.visible = !isLand(p.x, p.z, -0.4);
          member.root.position.set(p.x, member.depth + Math.sin(time * 1.5 + member.along) * 0.06, p.z);
          member.root.rotation.y = p.heading + (reduceMotion ? 0 : Math.cos(time * 0.9 + member.along) * 0.035);
          member.root.rotation.z = reduceMotion ? 0 : Math.sin(time * 1.5 + member.along) * 0.035;
          member.imported?.update(reduceMotion ? 0 : time * (0.85 + Math.abs(member.along) * 0.15) + member.along);
          member.tail.rotation.y = Math.sin(time * 9 + member.along) * 0.5;
        }
      }
      for (const visitor of visitors) {
        let progress = (time - visitor.start) / visitor.duration;
        if (progress > 1.1) {
          visitor.start = time + 4 + Math.random() * 10; visitor.route = visitorPassage(visitor.lane);
          visitor.breach = visitor.kind === 'whale' && Math.random() < 0.65;
          visitor.launchSplash = visitor.landingSplash = false; progress = -1;
        }
        visitor.root.visible = progress >= 0 && progress <= 1.1;
        if (!visitor.root.visible) continue;
        const p = passagePoint(visitor.route, progress);
        visitor.root.visible = !isLand(p.x, p.z, -2.5);
        if (!visitor.root.visible) continue;
        const pose = whalePose(progress, visitor.duration, visitor.kind === 'whale' && visitor.breach, reduceMotion);
        visitor.root.position.set(p.x, visitor.depth + (reduceMotion ? 0 : Math.sin(time * 2) * 0.07) + pose.lift, p.z);
        visitor.root.rotation.set(pose.roll, p.heading, pose.pitch);
        const swimDt = Math.max(0, Math.min(0.1, time - (visitor.lastSwimUpdate ?? time)));
        visitor.lastSwimUpdate = time;
        visitor.swimTime = (visitor.swimTime ?? 0) + (reduceMotion ? 0 : swimDt * (pose.active ? 1.5 : 0.85));
        visitor.imported?.update(reduceMotion ? 0 : visitor.swimTime);
        if (visitor.kind === 'seal') seal.update(time, reduceMotion);
        if (visitor.breach && !reduceMotion && pose.u >= 0 && pose.u < 1.2) {
          if (!visitor.launchSplash && pose.u >= 0.05) { onSplash(p.x, p.z, 1.4); visitor.launchSplash = true; }
          if (!visitor.landingSplash && pose.u >= 0.92) { onSplash(p.x, p.z, 2.2); visitor.landingSplash = true; }
        }
        if (visitor.tail) visitor.tail.rotation.z = Math.sin(time * (visitor.kind === 'whale' ? 2 : 4)) * 0.2;
        visitor.arms.forEach((arm, i) => { arm.rotation.z = Math.sin(time * 3 + i) * 0.2; });
      }
    },
    dispose() {
      disposed = true;
      importedViews.forEach(view => view.dispose()); importedTemplate?.dispose();
      marineTemplate?.dispose(); seal.dispose();
      group.removeFromParent(); sphere.dispose(); cone.dispose();
      materials.forEach((value) => value.dispose());
    },
  };
}
