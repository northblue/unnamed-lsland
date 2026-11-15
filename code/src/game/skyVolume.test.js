import test from 'node:test';
import assert from 'node:assert/strict';
import { SKY_VOLUME,skyVisibility } from './skyVolume.js';
import { OCEAN_RADIUS } from './world.js';

test('sky fade uses one spherical boundary with a soft margin, matching the ocean radius',()=>{
  const {radius,y,fade}=SKY_VOLUME;assert.equal(radius,OCEAN_RADIUS);
  assert.equal(skyVisibility({x:0,y:10,z:0}),1);
  assert.equal(skyVisibility({x:radius,y,z:0}),0);
  assert.equal(skyVisibility({x:0,y:y+radius+1,z:0}),0);
  for(let r=radius-fade;r<=radius;r+=0.25) {
    const a=skyVisibility({x:r,y,z:0}),b=skyVisibility({x:0,y:y+r,z:0});
    assert.equal(a,b);assert.ok(a>=0&&a<=1);
    assert.ok(skyVisibility({x:r+0.1,y,z:0})<=a);
  }
});
