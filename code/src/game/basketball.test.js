import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBasketballState, canPickUpBall, toggleBall, shootBall, stepBasketball, basketballHud, HOOP, BALL_RADIUS } from './basketball.js';
import { COURT } from './world.js';
import { createIslandLandmarks } from './islandLandmarks.js';

test('ball requires proximity, dribbles above ground while moving and settles after being put down', () => {
  const state = createBasketballState(), player = { x: state.ball.x, y: COURT.y, z: state.ball.z };
  assert.equal(toggleBall(state, { x: 0, y: 0.52, z: 0 }), false); assert.ok(toggleBall(state, player));
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < 100; i++) { stepBasketball(state, 0.02, player, { moving: true }); low = Math.min(low, state.ball.y); high = Math.max(high, state.ball.y); }
  assert.ok(low >= player.y + BALL_RADIUS); assert.ok(high - low > 0.5);
  assert.ok(toggleBall(state, player));
  for (let i = 0; i < 400; i++) stepBasketball(state, 0.02, player);
  assert.equal(state.phase, 'ground'); assert.equal(state.shots, 0); assert.equal(state.makes, 0); assert.ok(canPickUpBall(state, player));
});

test('aimed throws arc down through the actual hoop, score once and cannot be shot again in flight', () => {
  for (const distance of [2, 5, 8]) for (const frame of [1 / 30, 1 / 60]) {
    const state = createBasketballState(), player = { x: HOOP.x, y: COURT.y, z: HOOP.z + distance };
    state.ball = { ...player, y: player.y + BALL_RADIUS }; toggleBall(state, player);
    assert.ok(shootBall(state, player, { random: () => 0.5 })); assert.equal(shootBall(state, player), false);
    for (let i = 0; i < 8 / frame; i++) stepBasketball(state, frame, player);
    assert.equal(state.makes, 1, `distance ${distance}`); assert.equal(state.shots, 1); assert.equal(state.phase, 'ground');
  }
  const scene = new THREE.Scene(), view = createIslandLandmarks(scene), hoop = scene.getObjectByName('basketball-hoop');
  assert.ok(hoop.position.distanceTo(new THREE.Vector3(HOOP.x, HOOP.y, HOOP.z)) < 1e-6);
  assert.ok(view.ball && scene.getObjectByName('interactive-basketball')); view.dispose();
});

test('upward crossings never score, range is limited, sea losses return the ball, and pause freezes physics', () => {
  const state = createBasketballState(), player = { x: COURT.x, y: COURT.y, z: COURT.z };
  state.phase = 'flight'; state.ball = { x: HOOP.x, y: HOOP.y - 0.03, z: HOOP.z }; state.velocity = { x: 0, y: 3, z: 0 };
  stepBasketball(state, 0.02, player); assert.equal(state.makes, 0);
  const paused = structuredClone(state); stepBasketball(state, 0, player); assert.deepEqual(state, paused);
  state.phase = 'held'; assert.equal(shootBall(state, { x: 80, y: 1, z: 80 }), false); assert.equal(state.shots, 0);
  state.phase = 'flight'; state.ball = { x: 31, y: -0.2, z: 0 }; state.velocity = { x: 0, y: -1, z: 0 };
  stepBasketball(state, 0.02, player); assert.equal(state.phase, 'ground'); assert.equal(state.result, 'returned');
  assert.equal(basketballHud(state, player).visible, true);
});
