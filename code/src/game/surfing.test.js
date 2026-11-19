import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfState, startSurf, endSurf, stepSurf, surfPoint, surfWaveHeight, SURF_STATION } from './surfing.js';
import { coastRadius, canWalk, OCEAN_RADIUS } from './world.js';
import { createSurfView } from './surfView.js';
import { createOrbitWaves } from './orbitWaves.js';
import { createIslandState, validateIslandState } from './islandState.js';

test('surf lanes make a full circuit outside the underwater beach and within the expanded ocean', () => {
  assert.equal(OCEAN_RADIUS, 43);
  for (let i = 0; i < 3600; i++) for (const lane of [0.5, 2, 4.5]) {
    const angle = i / 3600 * Math.PI * 2, p = surfPoint(angle, lane), r = Math.hypot(p.x, p.z);
    assert.ok(r > coastRadius(angle) * 1.15 + 3); assert.ok(r < OCEAN_RADIUS - 2);
    const next = surfPoint(angle + 0.001, lane); assert.ok(Math.hypot(next.x - p.x, next.z - p.z) < 0.3);
  }
});
test('only nearby riders can mount; speed and lane stay bounded, laps accrue and pause freezes motion', () => {
  const surf = createSurfState(); assert.equal(startSurf(surf, { x: 0, z: 0 }), false);
  assert.ok(canWalk(SURF_STATION.x, SURF_STATION.z)); assert.ok(startSurf(surf, SURF_STATION));
  const shore = { ...surf.shore };
  for (let i = 0; i < 12000; i++) stepSurf(surf, 0.025, { steer: i < 6000 ? 1 : -1, throttle: i % 100 < 50 ? 1 : -1 });
  assert.ok(surf.laps >= 3); assert.ok(surf.lane >= 0.5 && surf.lane <= 4.5); assert.ok(surf.speed >= 3.5 && surf.speed <= 8.5);
  assert.deepEqual(surf.shore, shore); const copy = structuredClone(surf); stepSurf(surf, 0); assert.deepEqual(surf, copy);
  const save = createIslandState(); save.player = { ...surf.shore }; assert.deepEqual(validateIslandState(save).player, shore);
  assert.deepEqual(endSurf(surf), shore); assert.equal(surf.active, false);
});
test('return searches for a safe land spot and surfing is consistent at 30 and 60 fps', () => {
  const a = createSurfState(), b = createSurfState(); startSurf(a, SURF_STATION); startSurf(b, SURF_STATION);
  for (let i = 0; i < 1800; i++) stepSurf(a, 1 / 30);
  for (let i = 0; i < 3600; i++) stepSurf(b, 1 / 60);
  assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) < 0.2);
  const obstacle = { ...SURF_STATION, radius: 0.8 }, shore = endSurf(a, [], [obstacle]); assert.ok(shore); assert.ok(canWalk(shore.x, shore.z, [], [obstacle]));
  assert.ok(Math.abs(surfWaveHeight(0, 0) - surfWaveHeight(0, 1)) > 0.05);
});
test('board moves from rack to water, wake respects reduced motion and all surf scenery disposes', () => {
  const scene = new THREE.Scene(), view = createSurfView(scene), waves = createOrbitWaves(scene), state = createSurfState();
  view.update(state, 0, -0.12); assert.ok(view.board.position.y > 0.5);
  startSurf(state, SURF_STATION); stepSurf(state, 0.05); view.update(state, 1, (x, z) => -0.12 + Math.sin(x + z) * 0.01); assert.ok(Number.isFinite(view.board.position.y));
  assert.equal(view.board.position.x, state.position.x); assert.ok(scene.getObjectByName('surf-wake').visible);
  view.update(state, 2, -0.12, true); assert.equal(scene.getObjectByName('surf-wake').visible, false);
  waves.update(20, 1, true); assert.equal(waves.mesh.material.uniforms.time.value, 0); assert.equal(waves.mesh.material.uniforms.motion.value, 0);
  const seen = new Set(); let released = 0; scene.traverse(o => { if(o.geometry) seen.add(o.geometry); }); seen.forEach(g => g.addEventListener('dispose', () => released++));
  view.dispose(); waves.dispose(); assert.equal(scene.children.length, 0); assert.equal(released, seen.size);
});

test('rider stays on the same moving wave face across start times, pace changes and carving', () => {
  for (const begin of [0, 17, 93, 350]) {
    const state=createSurfState();startSurf(state,SURF_STATION,{waveTime:begin});
    let minPacket=1;
    for(let i=0;i<6000;i++) {
      const time=begin+(i+1)/60;
      stepSurf(state,1/60,{waveTime:time,throttle:Math.sin(i/70),steer:Math.sin(i/140)});
      const packet=Math.pow(.5+.5*Math.cos(state.angle*3-time*.48),5); minPacket=Math.min(minPacket,packet);
      assert.ok(state.lane>=1.95&&state.lane<=2.72);
      assert.ok(surfWaveHeight(state.angle,time,state.lane)>.65);
    }
    assert.ok(minPacket>.85);
    assert.ok(state.laps>=2);
  }
});
