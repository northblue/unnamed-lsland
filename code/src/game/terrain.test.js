import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainHeight, canWalk, ISLAND, SCENERY_ROCKS, activeObstacles } from './world.js';
import { placementError } from './building.js';

test('expansion keeps old building ground flat and adds walkable land and raised hills', () => {
  for (let x = -11; x <= 11; x++) {
    for (let z = -8; z <= 8; z++) {
      if ((x / 12) ** 2 + (z / 9) ** 2 <= 1) assert.equal(terrainHeight(x, z), 0.52);
    }
  }
  assert.ok(canWalk(13, 0));
  assert.ok(!canWalk(ISLAND.x + 1, 0));
  assert.ok(terrainHeight(-9.6, -7.4) > 1);
  assert.equal(terrainHeight(0, ISLAND.z), 0.52);
  const rock = SCENERY_ROCKS[0];
  assert.equal(canWalk(rock.x, rock.z, [], activeObstacles([])), false);
});

test('huts can use new flat land but cannot straddle a steep hillside', () => {
  const inventory = { wood: 6, stone: 3, resources: [] };
  assert.equal(placementError({ buildings: [] }, inventory, { x: 12.5, z: 0 }, { x: 0, z: 4 }), null);
  assert.equal(placementError({ buildings: [] }, inventory, { x: -8, z: -7 }, { x: 0, z: 4 }), 'slope');
});


test('the previous 15 by 11.5 island retains its exact heights for existing saves', () => {
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  for(let x=-15;x<=15;x+=0.5) for(let z=-11.5;z<=11.5;z+=0.5) {
    const coast=Math.hypot(x/15,z/11.5); if(coast>1)continue;
    const hills=2.4*Math.exp(-((x+9.6)**2/10+(z+7.4)**2/5))
      +1.8*Math.exp(-((x-8)**2/10+(z+8.1)**2/5))
      +5*Math.exp(-((x+12.6)**2/4+(z+3.8)**2/8));
    const previous=0.52+hills*smooth(1,1.18,Math.hypot(x/12,z/9))*(1-smooth(0.85,0.98,coast));
    assert.equal(terrainHeight(x,z),previous);
  }
  assert.ok(canWalk(18,2,[],activeObstacles([])));
});
