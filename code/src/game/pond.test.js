import test from 'node:test';
import assert from 'node:assert/strict';
import { transferPondFish, pondTotal } from './pond.js';
import { emptyCatch } from './fishing.js';
import { createIslandState, validateIslandState } from './islandState.js';
import { POND, canWalk, activeObstacles, terrainHeight, ISLAND } from './world.js';
import { placementError } from './building.js';

test('pond transfers existing fish without duplication and round-trips through saves', () => {
  const state=createIslandState(); state.catches.gold=2;
  assert.equal(transferPondFish(state.catches,state.pond,'gold','deposit'),true);
  assert.equal(state.catches.gold,1); assert.equal(state.pond.gold,1);
  assert.deepEqual(validateIslandState(JSON.parse(JSON.stringify(state))),state);
  assert.equal(transferPondFish(state.catches,state.pond,'gold','withdraw'),true);
  assert.equal(state.catches.gold,2); assert.equal(state.pond.gold,0);
  assert.equal(transferPondFish(state.catches,state.pond,'gold','withdraw'),false);
  assert.equal(transferPondFish(state.catches,state.pond,'whale','deposit'),false);
  assert.equal(transferPondFish(state.catches,state.pond,'gold','invent'),false);
});

test('pond capacity and basket cap reject transfers without losing fish', () => {
  const catches={...emptyCatch(),blue:1}, pond={...emptyCatch(),gold:POND.capacity};
  assert.equal(transferPondFish(catches,pond,'blue','deposit'),false);
  assert.equal(catches.blue,1);assert.equal(pondTotal(pond),POND.capacity);
  catches.gold=1000000;
  assert.equal(transferPondFish(catches,pond,'gold','withdraw'),false);
  assert.equal(pond.gold,POND.capacity);
});

test('old saves get an empty pond, invalid species/counts and overflow are rejected', () => {
  const state=createIslandState(); const {pond,...legacy}=state;
  assert.deepEqual(validateIslandState(legacy).pond,pond);
  for(const invalid of [null,[],{whale:1},{blue:-1},{gold:0.5},{gold:24,blue:1}]) {
    assert.throws(()=>validateIslandState({...state,pond:invalid}),/invalidPond/);
  }
});

test('pond is inland, its basin lies below water, and walking/building avoid it', () => {
  assert.ok((POND.x/ISLAND.x)**2+(POND.z/ISLAND.z)**2<1);
  assert.ok(terrainHeight(POND.x,POND.z)<POND.waterY);
  assert.equal(canWalk(POND.x,POND.z,[],activeObstacles([])),false);
  assert.ok(placementError({buildings:[]},{wood:6,stone:3,resources:[]},POND,{x:0,z:4}));
  assert.ok(terrainHeight(-16,-2)>3);
  assert.ok(terrainHeight(-5,-12.5)>3);
});
