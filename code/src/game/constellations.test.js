import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSTELLATIONS, constellationLayout } from './constellations.js';

test('constellation links refer to distinct valid stars and Orion retains its three-star belt',()=>{
  for(const c of CONSTELLATIONS)for(const [a,b] of c.edges){
    assert.ok(c.points[a]&&c.points[b]);assert.notEqual(a,b);
    assert.ok(Math.hypot(c.points[a][0]-c.points[b][0],c.points[a][1]-c.points[b][1])>0);
  }
  const [a,b,c]=CONSTELLATIONS.find(c=>c.id==='orion').points.slice(2,5);
  assert.ok(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<0.000001);
});

test('wide and portrait layouts keep complete figures on screen without stretching star patterns',()=>{
  for(const aspect of [0.2,0.4,0.75,1,1.78,2.6,0,NaN]){
    const layout=constellationLayout(aspect);assert.equal(layout.length,aspect>=1||Number.isNaN(aspect)?3:2);
    for(const c of layout){
      assert.ok(c.label.every(v=>v>0&&v<1));
      for(const p of c.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1);assert.ok(p.r>0&&p.r<2);}
    }
  }
  const ratio=aspect=>{const p=constellationLayout(aspect).find(c=>c.id==='orion').points;return Math.abs((p[1].x-p[0].x)*aspect/(p[1].y-p[0].y));};
  assert.ok(Math.abs(ratio(0.4)-ratio(1.78))<0.00001);
});
