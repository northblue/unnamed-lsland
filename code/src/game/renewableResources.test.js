import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatheringState, gatherResource, stepTreeGrowth, TREE_GROW_SECONDS, resourceSnapshot } from './gathering.js';
import { createIslandState, validateIslandState } from './islandState.js';
import { createDriftwood, stepDriftwood, collectDriftwood, nearbyDriftwood } from './driftwood.js';
import { ISLAND } from './world.js';

test('a harvested tree grows gradually, survives saves, and yields only after maturity', () => {
  const inventory=createGatheringState(), tree=inventory.resources[0];
  for(let i=0;i<3;i++)gatherResource(inventory,tree);
  assert.equal(tree.growth,0);
  for(let i=0;i<9;i++)stepTreeGrowth(inventory,10);
  assert.equal(tree.growth,90);assert.equal(tree.remaining,0);assert.equal(gatherResource(inventory,tree),null);
  const save={...createIslandState(),resources:resourceSnapshot(inventory.resources)};
  assert.equal(validateIslandState(save).resources[0].growth,90);
  for(let i=0;i<9;i++)stepTreeGrowth(inventory,10);
  assert.equal(tree.growth,TREE_GROW_SECONDS);assert.equal(tree.remaining,3);
  assert.equal(inventory.wood,3);assert.ok(gatherResource(inventory,tree));assert.equal(inventory.wood,4);
});

test('trees do not regrow through huts or mature around a player, and rocks do not regenerate', () => {
  const inventory=createGatheringState(), tree=inventory.resources[0], rock=inventory.resources.at(-1);
  tree.remaining=0;tree.growth=179;rock.remaining=0;
  stepTreeGrowth(inventory,10,[{...tree,halfX:1.4,halfZ:1.2}]);assert.equal(tree.growth,179);
  stepTreeGrowth(inventory,10,[],tree);assert.equal(tree.remaining,0);
  stepTreeGrowth(inventory,0);assert.equal(tree.remaining,3);assert.equal(rock.remaining,0);
});

test('old resource saves default growth correctly and reject bad timers', () => {
  const state=createIslandState();state.resources[0].remaining=0;
  state.resources=state.resources.map(({growth,...r})=>r);
  const parsed=validateIslandState(state);
  assert.equal(parsed.resources[0].growth,0);assert.equal(parsed.resources[1].growth,180);
  for(const value of [-1,181,'fast']) {
    state.resources[0].growth=value;
    assert.throws(()=>validateIslandState(state),/invalidWorld/);
  }
});

test('driftwood approaches shore, only nearby visible items give rewards, never twice', () => {
  const items=createDriftwood(()=>0.2), inventory={wood:0,stone:0};
  const player={x:0,z:ISLAND.z-1};const item=nearbyDriftwood(items,player);assert.ok(item);
  assert.equal(collectDriftwood(items,inventory,{x:0,z:0},item.id),null);
  assert.equal(collectDriftwood(items,inventory,player,item.id).wood,2);
  assert.equal(collectDriftwood(items,inventory,player,item.id),null);assert.equal(inventory.wood,2);
  const approaching=items[2],before=Math.hypot(approaching.x,approaching.z);
  stepDriftwood(items,30,()=>0.2);assert.ok(Math.hypot(approaching.x,approaching.z)<before);
  item.kind='crate';item.visible=true;item.collected=false;
  assert.deepEqual(collectDriftwood(items,inventory,player,item.id),{wood:1,stone:2,kind:'crate'});
  assert.deepEqual(inventory,{wood:3,stone:2});
});
