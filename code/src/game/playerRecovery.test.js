import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlayerTrapped, safeRecoveryPosition } from './playerRecovery.js';
import { canWalk, movePlayer, SPAWN } from './world.js';

const walls=[{x:-1,z:0,halfX:.2,halfZ:1.4},{x:1,z:0,halfX:.2,halfZ:1.4},{x:0,z:-1,halfX:1.4,halfZ:.2},{x:0,z:1,halfX:1.4,halfZ:.2}];
test('a collision-valid saved position enclosed by buildings is detected, open ground is retained',()=>{
 assert.ok(canWalk(0,0,walls,[]));assert.ok(isPlayerTrapped({x:0,z:0},walls,[]));
 assert.equal(isPlayerTrapped(SPAWN),false);assert.ok(isPlayerTrapped({x:16,z:6}));
});
test('recovery avoids occupied spawn and does not move buildings or alter obstacles',()=>{
 const buildings=[{...SPAWN,halfX:1.4,halfZ:1.2}],before=structuredClone(buildings);
 const point=safeRecoveryPosition(buildings);assert.ok(point);assert.ok(canWalk(point.x,point.z,buildings));
 assert.equal(isPlayerTrapped(point,buildings),false);assert.deepEqual(buildings,before);
 assert.notDeepEqual(point,SPAWN);
});
test('two blocked coordinate axes do not trap a player when the swept diagonal is clear',()=>{
 const obstacles=[{x:.7,z:-.7,radius:.63},{x:-.7,z:.7,radius:.63}],position={x:0,z:0};
 assert.equal(canWalk(.1,0,[],obstacles),false);assert.equal(canWalk(0,.1,[],obstacles),false);
 movePlayer(position,.1,.1,[],obstacles);assert.deepEqual(position,{x:.1,z:.1});assert.equal(isPlayerTrapped({x:0,z:0},[],obstacles),false);
});
test('diagonal fallback does not tunnel through an obstructed path',()=>{
 const position={x:0,z:0},obstacles=[{x:.5,z:.5,radius:.2},{x:1,z:0,radius:.2},{x:0,z:1,radius:.2}];
 movePlayer(position,1,1,[],obstacles);assert.deepEqual(position,{x:0,z:0});
});
