import test from 'node:test';
import assert from 'node:assert/strict';
import { surfCameraTarget, smoothCameraAngle, surfCameraZoom } from './surfCamera.js';

test('rider camera looks ahead in the actual travel direction and keeps the face above target', () => {
  const p = { x: 12, y: 2, z: -4 };
  for (let heading = -Math.PI; heading <= Math.PI; heading += 0.1) {
    const target = surfCameraTarget(p, heading);
    assert.ok(Math.abs(Math.hypot(target.x-p.x,target.z-p.z)-1.1)<1e-10);
    assert.ok((target.x-p.x)*-Math.sin(heading)+(target.z-p.z)*-Math.cos(heading)>1);
    assert.equal(target.y,2.8);
  }
  assert.deepEqual(p,{x:12,y:2,z:-4});
});
test('camera turns across the angle seam smoothly, freezes at zero delta and matches frame rates', () => {
  const start = Math.PI-0.02, end = -Math.PI+0.04;
  assert.ok(smoothCameraAngle(start,end,1/60)>start);
  assert.equal(smoothCameraAngle(start,end,0),start);
  let a=0,b=0; for(let i=0;i<30;i++)a=smoothCameraAngle(a,1,1/30);for(let i=0;i<60;i++)b=smoothCameraAngle(b,1,1/60);
  assert.ok(Math.abs(a-b)<1e-10);assert.ok(a>0.99&&a<1);
});
test('portrait and landscape both frame the rider at a close readable height', () => {
  for(const top of [37,44/(390/844)])assert.ok(Math.abs(top/surfCameraZoom(top)-5.2)<1e-10);
  assert.ok(surfCameraZoom(300)<=20);
});
