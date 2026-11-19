import { canWalk, SPAWN, OBSTACLES } from './world.js';

// A valid point can still be enclosed by the collision margins around buildings.
export function isPlayerTrapped(position, buildings = [], obstacles = OBSTACLES) {
  if (!canWalk(position.x, position.z, buildings, obstacles)) return true;
  const step = 0.2, limit = 10, queue = [[0,0]], visited = new Set(['0:0']);
  for (let i=0;i<queue.length;i++) {
    const [x,z]=queue[i]; if(Math.abs(x)===limit||Math.abs(z)===limit)return false;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const nx=x+dx,nz=z+dz,key=`${nx}:${nz}`;if(visited.has(key))continue;visited.add(key);
      const px=position.x+nx*step,pz=position.z+nz*step;
      if(!canWalk(px,pz,buildings,obstacles)||![.25,.5,.75].every(t=>canWalk(px-dx*step*t,pz-dz*step*t,buildings,obstacles)))continue;
      queue.push([nx,nz]);
    }
  }
  return true;
}
export function safeRecoveryPosition(buildings = [], obstacles = OBSTACLES) {
  // Prefer the original clearing; choose open ground rather than another narrow gap.
  for(let ring=0;ring<=32;ring++) for(let i=0;i<(ring?ring*8:1);i++) {
    const a=i/Math.max(1,ring*8)*Math.PI*2,p={x:SPAWN.x+Math.cos(a)*ring*.4,z:SPAWN.z+Math.sin(a)*ring*.4};
    if(!canWalk(p.x,p.z,buildings,obstacles))continue;
    if(![0,1,2,3,4,5,6,7].every(j=>canWalk(p.x+Math.cos(j*Math.PI/4)*.65,p.z+Math.sin(j*Math.PI/4)*.65,buildings,obstacles)))continue;
    if(!isPlayerTrapped(p,buildings,obstacles))return p;
  }
  return null;
}
