import { terrainHeight, isLand, POND } from './world.js';

let RAPIER, loading;
export function initIslandPhysics() {
  loading ??= import('@dimforge/rapier3d-compat').then(async module => {
    const api=module.default??module;await api.init();RAPIER=api;
  }).catch(error=>{loading=undefined;throw error;});
  return loading;
}
export const ACTOR_SHAPES = {
  player: { radius: .35, height: 1.65 },
  cat: { radius: .54, height: 1.1 },
  dog: { radius: .56, height: 1.14 },
};

// The authored terrain remains sampled. Rapier owns solid contacts between actors and fixtures.
export function createIslandPhysics() {
  if(!RAPIER)throw new Error('Physics must be initialized before creating the island');
  const world=new RAPIER.World({x:0,y:0,z:0}),actors=new Map();
  world.timestep=1/60;
  const controller=world.createCharacterController(.025);controller.setSlideEnabled(true);controller.setApplyImpulsesToDynamicBodies(false);
  let fixtures=[],signature='',disposed=false;
  function refresh(){world.step();}
  function syncStatics(buildings=[],obstacles=[]) {
    const key=JSON.stringify([buildings.map(b=>[b.x,b.z,b.halfX,b.halfZ]),obstacles.map(o=>[o.x,o.z,o.radius])]);
    if(key===signature)return;signature=key;
    fixtures.forEach(c=>world.removeCollider(c,true));fixtures=[];
    for(const b of buildings) {
      const y=terrainHeight(b.x,b.z);fixtures.push(world.createCollider(RAPIER.ColliderDesc.cuboid(b.halfX,1.6,b.halfZ).setTranslation(b.x,y+1.6,b.z)));
    }
    for(const o of obstacles) {
      const height=o.type==='wood'||o.id?.startsWith('grove:')?5:o.x===POND.x&&o.z===POND.z?2:Math.max(1.5,o.height??o.radius*2);
      fixtures.push(world.createCollider(RAPIER.ColliderDesc.cylinder(height/2,o.radius).setTranslation(o.x,terrainHeight(o.x,o.z)+height/2,o.z)));
    }
    refresh();
  }
  function addActor(id,kind,position) {
    if(actors.has(id))return actors.get(id);
    const shape=ACTOR_SHAPES[kind],center=shape.height/2;
    const collider=world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(0,center-shape.radius),shape.radius).setTranslation(position.x,(position.y??terrainHeight(position.x,position.z))+center,position.z));
    const actor={id,kind,collider,...shape};actors.set(id,actor);refresh();return actor;
  }
  function place(id,position,enabled=true) {
    const actor=actors.get(id);if(!actor)return;
    actor.collider.setEnabled(enabled);
    actor.collider.setTranslation({x:position.x,y:(position.y??terrainHeight(position.x,position.z))+actor.height/2,z:position.z});refresh();
  }
  function allowed(actor,x,z) {
    return isLand(x,z,actor.radius+.3)&&Math.hypot(x-POND.x,z-POND.z)>POND.radius+.25+actor.radius;
  }
  function move(id,position,dx,dz,{height=0}={}) {
    const actor=actors.get(id);if(!actor||disposed)return {x:position.x,y:position.y??terrainHeight(position.x,position.z),z:position.z};
    // Sample shore constraints along the whole request; solid obstacles use Rapier shape casts.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));let fraction=1;
    for(let i=1;i<=steps;i++)if(!allowed(actor,position.x+dx*i/steps,position.z+dz*i/steps)){fraction=(i-1)/steps;break;}
    dx*=fraction;dz*=fraction;
    const from=actor.collider.translation();
    const y=terrainHeight(position.x+dx,position.z+dz)+height;
    controller.computeColliderMovement(actor.collider,{x:dx,y:y+actor.height/2-from.y,z:dz},undefined,undefined,c=>c.handle!==actor.collider.handle);
    const delta=controller.computedMovement();
    const next={x:from.x+delta.x,y:from.y+delta.y-actor.height/2,z:from.z+delta.z};
    if(!allowed(actor,next.x,next.z))return {x:position.x,y:position.y??terrainHeight(position.x,position.z),z:position.z};
    // Keep feet on the existing height field; the collider never inherits decorative animation bob.
    next.y=Math.max(terrainHeight(next.x,next.z),next.y);
    actor.collider.setTranslation({x:next.x,y:next.y+actor.height/2,z:next.z});refresh();
    return next;
  }
  return {syncStatics,addActor,place,move,
    get count(){return actors.size;},
    dispose(){if(disposed)return;disposed=true;actors.clear();fixtures=[];world.free();},
  };
}
