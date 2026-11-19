import test from 'node:test';
import assert from 'node:assert/strict';
import { initIslandPhysics,createIslandPhysics,ACTOR_SHAPES } from './islandPhysics.js';
import { terrainHeight, circleIntersectsBox } from './world.js';
await initIslandPhysics();

test('Rapier stops a fast character at a house and permits sliding along its wall',()=>{
 const physics=createIslandPhysics();physics.syncStatics([{x:0,z:0,halfX:1.4,halfZ:1.2}],[]);
 let p={x:4,z:0};physics.addActor('player','player',p);p=physics.move('player',p,-8,0);assert.ok(p.x>1.74);
 for(let i=0;i<60;i++){p=physics.move('player',p,-.04,.04);assert.equal(circleIntersectsBox({...p,radius:.35},{x:0,z:0},1.4,1.2),false);}
 assert.ok(p.z>1.8);physics.dispose();physics.dispose();
});
test('people and pets block one another instead of walking through each other',()=>{
 const physics=createIslandPhysics();physics.syncStatics([],[]);
 let p={x:0,z:0},dog={x:2,z:0};physics.addActor('player','player',p);physics.addActor('dog','dog',dog);
 p=physics.move('player',p,4,0);assert.ok(p.x<1.2);
 dog=physics.move('dog',dog,-4,0);assert.ok(dog.x-p.x>=ACTOR_SHAPES.player.radius+ACTOR_SHAPES.dog.radius-.01);
 physics.place('player',{x:0,y:terrainHeight(0,0),z:0},false);dog=physics.move('dog',dog,-1,0);assert.ok(dog.x<1.9);
 physics.dispose();
});
test('resource removal and building edits update colliders without rebuilding actors',()=>{
 const physics=createIslandPhysics();const p={x:4,z:0};physics.addActor('p','player',p);
 physics.syncStatics([],[{x:2,z:0,radius:.7}]);let blocked=physics.move('p',p,-2,0);assert.ok(blocked.x>3);
 physics.syncStatics([],[]);const free=physics.move('p',blocked,-2,0);assert.ok(free.x<2);assert.equal(physics.count,1);
 physics.dispose();
});

test('six roaming pets remain separated from the avatar and one another over sustained updates', async()=>{
 const {createPets}=await import('./petView.js'),THREE=await import('three');
 const {createGatheringState}=await import('./gathering.js');const {activeObstacles}=await import('./world.js');
 const resources=createGatheringState().resources,physics=createIslandPhysics(),scene=new THREE.Scene();
 physics.syncStatics([],activeObstacles(resources));const player={x:0,y:terrainHeight(0,4),z:4};physics.addActor('player','player',player);
 const pets=createPets(scene,{physics,modelLoader:null});
 for(let frame=0;frame<1800;frame++) {
   pets.update(1/30,[],resources,false,player);
   const all=[{...player,kind:'player'},...pets.state.pets];
   for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
     const a=all[i],b=all[j],sa=ACTOR_SHAPES[a.kind],sb=ACTOR_SHAPES[b.kind];
     const ay=terrainHeight(a.x,a.z),by=terrainHeight(b.x,b.z);
     const gap=Math.max(ay+sa.radius-(by+sb.height-sb.radius),by+sb.radius-(ay+sa.height-sa.radius),0);
     assert.ok(Math.hypot(a.x-b.x,a.z-b.z,gap)>=sa.radius+sb.radius-.02,`${a.id??'player'} / ${b.id}: ${frame}`);
   }
 }
 pets.dispose();physics.dispose();assert.equal(scene.children.length,0);
});
